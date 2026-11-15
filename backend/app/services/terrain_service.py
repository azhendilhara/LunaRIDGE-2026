"""NASA LOLA Lunar South Pole Terrain Service.

Provides high-resolution elevation lookup and directional terrain horizon
obstruction profiling based on official NASA LOLA South Pole DEMs.
"""

import math
import os
from typing import List, Optional, Tuple

import numpy as np
import pyproj
import rasterio
from rasterio.windows import Window

from app.schemas.terrain import (
    ElevationRequest,
    ElevationResponse,
    HorizonPoint,
    HorizonProfileRequest,
    HorizonProfileResponse,
    ObserverTerrainInfo,
)


class TerrainServiceError(Exception):
    """Exception raised when terrain analysis encounters an error."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class TerrainService:
    """Service for lunar elevation lookup and horizon obstruction calculations."""

    LUNAR_RADIUS_M = 1737400.0  # IAU / LOLA reference sphere radius (1737.4 km)

    def __init__(self, dem_path: Optional[str] = None):
        if dem_path is None:
            from app.deployment import dem_path as configured_dem_path
            self.dem_path = str(configured_dem_path())
        else:
            self.dem_path = dem_path

        self._dataset: Optional[rasterio.DatasetReader] = None
        self._trans_to_proj: Optional[pyproj.Transformer] = None
        self._trans_to_geo: Optional[pyproj.Transformer] = None
        self._cached_data: Optional[np.ndarray] = None

    def _ensure_loaded(self):
        """Open rasterio dataset and initialize pyproj transformers."""
        if self._dataset is not None and not self._dataset.closed:
            return

        if not os.path.exists(self.dem_path):
            raise TerrainServiceError(
                f"LOLA DEM dataset not found at '{self.dem_path}'. Please ensure the GeoTIFF is downloaded.",
                status_code=503,
            )

        try:
            self._dataset = rasterio.open(self.dem_path)
        except Exception as e:
            raise TerrainServiceError(
                f"Failed to open LOLA DEM dataset: {str(e)}", status_code=500
            )

        # Build pyproj transformers strictly using DEM's CRS and geodetic CRS (NO Earth assumptions)
        crs = pyproj.CRS.from_wkt(self._dataset.crs.to_wkt())
        geodetic_crs = crs.geodetic_crs

        self._trans_to_proj = pyproj.Transformer.from_crs(
            geodetic_crs, crs, always_xy=True
        )
        self._trans_to_geo = pyproj.Transformer.from_crs(
            crs, geodetic_crs, always_xy=True
        )

    def close(self):
        """Close dataset if open."""
        if self._dataset is not None and not self._dataset.closed:
            self._dataset.close()
            self._dataset = None

    def get_metadata(self) -> dict:
        """Inspect and return DEM metadata."""
        self._ensure_loaded()
        ds = self._dataset
        crs_wkt = ds.crs.to_wkt()
        return {
            "file": os.path.basename(self.dem_path),
            "crs_name": ds.crs.data if ds.crs else "Unknown",
            "crs_wkt": crs_wkt,
            "bounds": {
                "left": ds.bounds.left,
                "bottom": ds.bounds.bottom,
                "right": ds.bounds.right,
                "top": ds.bounds.top,
            },
            "dimensions": {"width": ds.width, "height": ds.height},
            "resolution": {"x_m": ds.res[0], "y_m": ds.res[1]},
            "nodata": ds.nodata if ds.nodata is None or not np.isnan(ds.nodata) else "NaN",
            "dtype": str(ds.dtypes[0]),
            "reference_datum": "Moon (2015) - Sphere, Radius 1737400 m",
            "coverage": "Lunar South Pole (80°S to 90°S, all longitudes)",
            "elevation_units": "meters (relative to R=1737.4 km)",
        }

    def convert_lat_lon_to_xy(self, latitude: float, longitude: float) -> Tuple[float, float]:
        """Convert selenodetic coordinates to Polar Stereographic (X, Y) in meters."""
        self._ensure_loaded()
        # Ensure longitude is in range [-180, 180] or [0, 360]
        lon = ((longitude + 180) % 360) - 180
        x, y = self._trans_to_proj.transform(lon, latitude)
        return float(x), float(y)

    def convert_xy_to_lat_lon(self, x: float, y: float) -> Tuple[float, float]:
        """Convert Polar Stereographic (X, Y) in meters to selenodetic coordinates."""
        self._ensure_loaded()
        lon, lat = self._trans_to_geo.transform(x, y)
        return float(lat), float(lon)

    def get_elevation_at_xy(self, x: float, y: float) -> float:
        """Query elevation at projected coordinate (x, y) with boundary checking."""
        self._ensure_loaded()
        ds = self._dataset
        bounds = ds.bounds

        if not (bounds.left <= x <= bounds.right and bounds.bottom <= y <= bounds.top):
            raise TerrainServiceError(
                f"Projected coordinates ({x:.1f}, {y:.1f}) are outside DEM extent.",
                status_code=400,
            )

        row, col = ds.index(x, y)
        if not (0 <= row < ds.height and 0 <= col < ds.width):
            raise TerrainServiceError(
                f"Sample point ({row}, {col}) exceeds grid indices.", status_code=400
            )

        # Read 1x1 window
        val = ds.read(1, window=Window(col, row, 1, 1), masked=True).astype(float).filled(np.nan)[0, 0]
        if not np.isfinite(val) or (ds.nodata is not None and val == ds.nodata):
            raise TerrainServiceError(
                "Elevation at specified point is NoData in the DEM.", status_code=404
            )

        return float(val)

    def get_elevation(self, req: ElevationRequest) -> ElevationResponse:
        """Lookup surface elevation for given lunar latitude and longitude."""
        x, y = self.convert_lat_lon_to_xy(req.latitude, req.longitude)
        elevation = self.get_elevation_at_xy(x, y)

        return ElevationResponse(
            status="success",
            latitude=req.latitude,
            longitude=req.longitude,
            elevation_m=round(elevation, 2),
            projected_x_m=round(x, 2),
            projected_y_m=round(y, 2),
            dem_source="NASA LOLA LDEM_80S_80MPP_ADJ (80 m/pixel)",
            reference_datum="Lunar sphere R=1737.4 km (MOON_ME)",
        )

    def get_horizon_profile(self, req: HorizonProfileRequest) -> HorizonProfileResponse:
        """Compute directional terrain horizon obstruction profile.

        Azimuth convention:
            Measured clockwise from selenodetic North:
            0° = North, 90° = East, 180° = South, 270° = West.

        Lunar Curvature & Obstruction Geometry:
            Observer radial distance from center: r_obs = R_moon + h_ground + h_mast
            Terrain point at radial distance: r_pt = R_moon + h_pt
            Central angle: alpha = s / R_moon
            Relative displacement in local horizontal/vertical frame:
                Delta x = r_pt * sin(alpha)
                Delta z = r_pt * cos(alpha) - r_obs
            Apparent elevation angle: theta = arctan2(Delta z, Delta x)
            Horizon angle for azimuth A = max_s(theta(s))
        """
        self._ensure_loaded()
        ds = self._dataset

        obs_x, obs_y = self.convert_lat_lon_to_xy(req.latitude, req.longitude)
        ground_elev = self.get_elevation_at_xy(obs_x, obs_y)

        r_obs = self.LUNAR_RADIUS_M + ground_elev + req.observer_height_m

        # Observer longitude in radians for azimuth vector calculation
        lon_rad = math.radians(req.longitude)

        # Azimuth range
        azimuths = np.arange(
            req.azimuth_start_deg,
            req.azimuth_end_deg,
            req.azimuth_step_deg,
            dtype=float,
        )
        if len(azimuths) == 0:
            azimuths = np.array([req.azimuth_start_deg], dtype=float)

        max_dist_m = req.max_distance_km * 1000.0
        step_m = req.sample_step_m
        distances = np.unique(np.append(np.arange(step_m, max_dist_m, step_m, dtype=float), max_dist_m))

        # Precompute central angles and sin/cos for lunar curvature
        alphas = distances / self.LUNAR_RADIUS_M
        sin_alphas = np.sin(alphas)
        cos_alphas = np.cos(alphas)

        profile_points: List[HorizonPoint] = []

        # Bounding box limits in projected coords
        b_left, b_bottom, b_right, b_top = (
            ds.bounds.left,
            ds.bounds.bottom,
            ds.bounds.right,
            ds.bounds.top,
        )

        for az in azimuths:
            az_rad = math.radians(az)
            # Direction in South Polar Stereographic projection:
            # North vector: (sin(lon), cos(lon))
            # East vector:  (cos(lon), -sin(lon))
            # Direction vector at azimuth az clockwise from North:
            # u = (sin(lon + az), cos(lon + az))
            ux = math.sin(lon_rad + az_rad)
            uy = math.cos(lon_rad + az_rad)

            # Sample coordinates along ray
            ray_x = obs_x + distances * ux
            ray_y = obs_y + distances * uy

            # Filter points within DEM bounds
            valid_mask = (
                (ray_x >= b_left)
                & (ray_x <= b_right)
                & (ray_y >= b_bottom)
                & (ray_y <= b_top)
            )

            if not np.all(valid_mask):
                raise TerrainServiceError(f"Incomplete DEM coverage at azimuth {az:.2f} degrees: ray leaves raster extent.", status_code=422)

            valid_x = ray_x[valid_mask]
            valid_y = ray_y[valid_mask]
            valid_dist = distances[valid_mask]
            valid_sin_a = sin_alphas[valid_mask]
            valid_cos_a = cos_alphas[valid_mask]

            # Convert to pixel rows and cols
            # Affine: x = a*col + b*row + c, y = d*col + e*row + f
            inv_transform = ~ds.transform
            try:
                cols, rows = inv_transform @ (valid_x, valid_y)
            except TypeError:
                cols, rows = inv_transform * (valid_x, valid_y)
            cols = np.floor(cols).astype(int)
            rows = np.floor(rows).astype(int)

            # Clip indices to dataset range
            in_grid = (
                (rows >= 0) & (rows < ds.height) & (cols >= 0) & (cols < ds.width)
            )
            if not np.all(in_grid):
                raise TerrainServiceError("Incomplete DEM coverage: ray exceeds raster indices.", status_code=422)

            valid_dist = valid_dist[in_grid]
            valid_x = valid_x[in_grid]
            valid_y = valid_y[in_grid]
            valid_sin_a = valid_sin_a[in_grid]
            valid_cos_a = valid_cos_a[in_grid]
            cols = cols[in_grid]
            rows = rows[in_grid]

            # Read elevations along ray
            # Optimize reading: for small bounding window, read window; or sample coordinates
            min_r, max_r = int(rows.min()), int(rows.max())
            min_c, max_c = int(cols.min()), int(cols.max())
            win_h = max_r - min_r + 1
            win_w = max_c - min_c + 1

            if win_h * win_w <= 2_500_000:  # If window is reasonable, read block
                block = ds.read(
                    1, window=Window(min_c, min_r, win_w, win_h), masked=True
                ).astype(float).filled(np.nan)
                h_vals = block[rows - min_r, cols - min_c]
            else:
                # Sample points generator
                h_vals = np.fromiter(
                    (float(p.filled(np.nan)[0]) for p in ds.sample(zip(valid_x, valid_y), masked=True)),
                    dtype=float,
                    count=len(valid_x),
                )

            # Mask NoData / NaNs
            valid_h = np.isfinite(h_vals)
            if ds.nodata is not None and not np.isnan(ds.nodata):
                valid_h &= h_vals != ds.nodata

            if not np.all(valid_h):
                raise TerrainServiceError(f"Incomplete DEM coverage at azimuth {az:.2f} degrees: NoData samples.", status_code=422)

            h_pts = h_vals[valid_h]
            dist_pts = valid_dist[valid_h]
            x_pts = valid_x[valid_h]
            y_pts = valid_y[valid_h]
            sin_a_pts = valid_sin_a[valid_h]
            cos_a_pts = valid_cos_a[valid_h]

            # Exact spherical curvature elevation angle
            r_pts = self.LUNAR_RADIUS_M + h_pts
            delta_x = r_pts * sin_a_pts
            delta_z = r_pts * cos_a_pts - r_obs

            # Elevation angles in degrees above local horizontal
            angles_rad = np.arctan2(delta_z, delta_x)
            angles_deg = np.degrees(angles_rad)

            max_idx = int(np.argmax(angles_deg))
            max_angle = float(angles_deg[max_idx])
            obs_dist = float(dist_pts[max_idx])
            obs_elev = float(h_pts[max_idx])
            obs_x_pos = float(x_pts[max_idx])
            obs_y_pos = float(y_pts[max_idx])

            obs_lat, obs_lon = self.convert_xy_to_lat_lon(obs_x_pos, obs_y_pos)

            profile_points.append(
                HorizonPoint(
                    azimuth_deg=round(float(az), 2),
                    horizon_elevation_deg=round(max_angle, 4),
                    obstacle_distance_m=round(obs_dist, 1),
                    obstacle_latitude=round(obs_lat, 5),
                    obstacle_longitude=round(obs_lon, 5),
                    obstacle_elevation_m=round(obs_elev, 2),
                )
            )

        return HorizonProfileResponse(
            status="success",
            observer=ObserverTerrainInfo(
                latitude=req.latitude,
                longitude=req.longitude,
                ground_elevation_m=round(ground_elev, 2),
                observer_height_m=round(req.observer_height_m, 2),
                total_altitude_m=round(ground_elev + req.observer_height_m, 2),
            ),
            azimuth_convention="Clockwise from selenodetic North (0° = N, 90° = E, 180° = S, 270° = W)",
            reference_frame="MOON_ME (LOLA Polar Stereographic, R=1737.4 km)",
            dem_source="NASA LOLA LDEM_80S_80MPP_ADJ (80 m/pixel)",
            count=len(profile_points),
            profile=profile_points,
        )
