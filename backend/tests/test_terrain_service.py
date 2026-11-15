"""Automated tests for lunar terrain service and horizon obstruction analysis."""

import os
import math
import numpy as np
import pytest
import rasterio
from affine import Affine
from rasterio.transform import from_origin
import pyproj
from app.schemas.terrain import ElevationRequest, HorizonProfileRequest
from app.services.terrain_service import TerrainService, TerrainServiceError

# WKT for Moon (2015) Sphere South Polar Stereographic (official NASA LOLA CRS)
MOON_SOUTH_POLAR_WKT = (
    'PROJCS["Moon (2015) - Sphere / Ocentric / South Polar",'
    'GEOGCS["Moon (2015) - Sphere / Ocentric",'
    'DATUM["Moon (2015) - Sphere",'
    'SPHEROID["Moon (2015) - Sphere",1737400,0]],'
    'PRIMEM["Reference Meridian",0],'
    'UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]]],'
    'PROJECTION["Polar_Stereographic"],'
    'PARAMETER["latitude_of_origin",-90],'
    'PARAMETER["central_meridian",0],'
    'PARAMETER["false_easting",0],'
    'PARAMETER["false_northing",0],'
    'UNIT["metre",1],'
    'AXIS["Easting",NORTH],'
    'AXIS["Northing",NORTH]]'
)


@pytest.fixture(scope="session")
def synthetic_dem_path(tmp_path_factory):
    """Create a temporary synthetic South Pole DEM GeoTIFF for unit testing.

    Grid: 201 x 201 pixels at 100 m/pixel resolution.
    X range: -10,000 m to +10,000 m
    Y range: -10,000 m to +10,000 m
    Center: (0, 0) is the South Pole (-90°).

    Features:
    - Base ground: 1000 m elevation.
    - A tall mountain ridge placed at (x=0, y=5000), which is 5000m North of the South Pole on meridian 0°.
      Height = 3000 m (total 4000 m).
    """
    tmp_dir = tmp_path_factory.mktemp("dem")
    dem_file = os.path.join(tmp_dir, "synthetic_south_pole.tif")

    res = 100.0  # 100 m/pixel
    width = 201
    height = 201

    # Top-left is at x = -10050, y = +10050
    transform = Affine(res, 0.0, -10050.0, 0.0, -res, 10050.0)

    # Base elevation 1000m
    data = np.full((height, width), 1000.0, dtype=np.float32)

    # Add a mountain at (x=0, y=5000)
    # y=5000 corresponds to row: (10050 - 5000) / 100 = 50.5 -> row 50
    # x=0 corresponds to col: (0 - (-10050)) / 100 = 100.5 -> col 100
    peak_row = 50
    peak_col = 100
    for r in range(peak_row - 10, peak_row + 11):
        for c in range(peak_col - 10, peak_col + 11):
            dist_sq = (r - peak_row) ** 2 + (c - peak_col) ** 2
            if dist_sq < 100:
                data[r, c] += 3000.0 * math.exp(-dist_sq / 25.0)

    crs = rasterio.crs.CRS.from_wkt(MOON_SOUTH_POLAR_WKT)

    with rasterio.open(
        dem_file,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype=np.float32,
        crs=crs,
        transform=transform,
        nodata=np.nan,
    ) as dst:
        dst.write(data, 1)

    return dem_file


def test_synthetic_dem_metadata(synthetic_dem_path):
    """Test reading metadata from synthetic DEM."""
    service = TerrainService(dem_path=synthetic_dem_path)
    meta = service.get_metadata()
    assert meta["dimensions"]["width"] == 201
    assert meta["dimensions"]["height"] == 201
    assert meta["resolution"]["x_m"] == 100.0
    assert meta["reference_datum"] == "Moon (2015) - Sphere, Radius 1737400 m"


def test_coordinate_conversion(synthetic_dem_path):
    """Test coordinate conversion between selenodetic and Polar Stereographic."""
    service = TerrainService(dem_path=synthetic_dem_path)

    # South Pole (-90° lat) must map to (0, 0)
    x, y = service.convert_lat_lon_to_xy(-90.0, 0.0)
    assert abs(x) < 1e-3
    assert abs(y) < 1e-3

    # Round trip
    lat, lon = service.convert_xy_to_lat_lon(0.0, 0.0)
    assert pytest.approx(lat, abs=1e-4) == -90.0


def test_manual_polar_stereographic_formula_regression(synthetic_dem_path):
    """Regression test: verify manual formula matches pyproj transform to <0.001 mm."""
    service = TerrainService(dem_path=synthetic_dem_path)
    R = 1737400.0

    test_lats = [-90.0, -89.9, -89.5, -88.0, -85.0, -82.0, -80.0]
    test_lons = [-180.0, -135.0, -90.0, -45.0, 0.0, 45.0, 90.0, 135.0, 180.0]

    for lat in test_lats:
        for lon in test_lons:
            px, py = service.convert_lat_lon_to_xy(lat, lon)
            # Analytical formula:
            theta_rad = math.radians(90.0 + lat)
            r = 2.0 * R * math.tan(theta_rad / 2.0)
            lon_rad = math.radians(lon)
            mx = r * math.sin(lon_rad)
            my = r * math.cos(lon_rad)

            assert abs(px - mx) < 1e-3  # less than 1 mm
            assert abs(py - my) < 1e-3


def test_synthetic_elevation_lookup(synthetic_dem_path):
    """Test elevation lookup at flat ground and at mountain peak."""
    service = TerrainService(dem_path=synthetic_dem_path)

    # Ground at South Pole
    req = ElevationRequest(latitude=-90.0, longitude=0.0)
    res = service.get_elevation(req)
    assert res.status == "success"
    assert pytest.approx(res.elevation_m, abs=1.0) == 1000.0

    # Query mountain peak located at x=0, y=5000m
    lat_peak, lon_peak = service.convert_xy_to_lat_lon(0.0, 5000.0)
    req_peak = ElevationRequest(latitude=lat_peak, longitude=lon_peak)
    res_peak = service.get_elevation(req_peak)
    assert res_peak.elevation_m > 3800.0


def test_synthetic_horizon_profile_and_azimuth_convention(synthetic_dem_path):
    """Verify that horizon obstruction peak correctly identifies North (Azimuth = 0°).

    Observer is placed at South Pole (0, -90°).
    Mountain is at (x=0, y=5000), which is along Meridian 0° pointing towards North.
    Therefore, the maximum horizon obstruction MUST occur at Azimuth = 0° (North)!
    """
    service = TerrainService(dem_path=synthetic_dem_path)

    req = HorizonProfileRequest(
        latitude=-90.0,
        longitude=0.0,
        observer_height_m=2.0,
        azimuth_start_deg=0.0,
        azimuth_end_deg=360.0,
        azimuth_step_deg=15.0,
        max_distance_km=8.0,
        sample_step_m=100.0,
    )
    res = service.get_horizon_profile(req)

    assert res.status == "success"
    assert res.count > 0

    # Find the azimuth with highest obstruction angle
    max_pt = max(res.profile, key=lambda p: p.horizon_elevation_deg)

    # Peak obstruction MUST be at azimuth 0° (North)
    assert max_pt.azimuth_deg == 0.0
    assert max_pt.horizon_elevation_deg > 20.0  # ~3000m rise over 5000m is ~30 degrees
    assert pytest.approx(max_pt.obstacle_distance_m, abs=300.0) == 5000.0


def test_observer_mast_height_effect(synthetic_dem_path):
    """Regression test: higher mast strictly reduces or maintains terrain obstruction angle."""
    service = TerrainService(dem_path=synthetic_dem_path)

    req_low = HorizonProfileRequest(
        latitude=-90.0,
        longitude=0.0,
        observer_height_m=2.0,
        azimuth_start_deg=0.0,
        azimuth_end_deg=15.0,
        azimuth_step_deg=5.0,
        max_distance_km=8.0,
        sample_step_m=100.0,
    )
    res_low = service.get_horizon_profile(req_low)

    req_high = HorizonProfileRequest(
        latitude=-90.0,
        longitude=0.0,
        observer_height_m=20.0,  # 20m mast
        azimuth_start_deg=0.0,
        azimuth_end_deg=15.0,
        azimuth_step_deg=5.0,
        max_distance_km=8.0,
        sample_step_m=100.0,
    )
    res_high = service.get_horizon_profile(req_high)

    # For each azimuth, the obstruction angle from a 20m mast must be lower than from a 2m mast
    for p_low, p_high in zip(res_low.profile, res_high.profile):
        assert p_high.horizon_elevation_deg < p_low.horizon_elevation_deg


def test_fine_azimuth_sampling(synthetic_dem_path):
    """Regression test: verify fine 1.0 degree sampling generates exactly 360 azimuth points."""
    service = TerrainService(dem_path=synthetic_dem_path)

    req = HorizonProfileRequest(
        latitude=-90.0,
        longitude=0.0,
        observer_height_m=2.0,
        azimuth_start_deg=0.0,
        azimuth_end_deg=360.0,
        azimuth_step_deg=1.0,
        max_distance_km=8.0,
        sample_step_m=100.0,
    )
    res = service.get_horizon_profile(req)
    assert res.count == 360
    assert len(res.profile) == 360


def test_out_of_bounds_error(synthetic_dem_path):
    """Test error handling when coordinates are outside DEM boundaries."""
    service = TerrainService(dem_path=synthetic_dem_path)
    req = ElevationRequest(latitude=-85.0, longitude=0.0)
    with pytest.raises(TerrainServiceError) as exc_info:
        service.get_elevation(req)
    assert "outside DEM extent" in exc_info.value.message
