"""Unit and integration tests for Interactive Lunar Map and Site Comparison."""

import math
import os
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from main import app
from app.services.terrain_service import TerrainService
from app.services.visibility_service import VisibilityService
from app.schemas.visibility import AnalysisRequest

client = TestClient(app)

MOON_RADIUS_M = 1737400.0


def lat_lon_to_polar_stereo(lat: float, lon: float):
    """Analytical South Polar Stereographic forward transform."""
    theta_rad = math.radians(90.0 + lat)
    r = 2.0 * MOON_RADIUS_M * math.tan(theta_rad / 2.0)
    lon_rad = math.radians(lon)
    return r * math.sin(lon_rad), r * math.cos(lon_rad)


def polar_stereo_to_lat_lon(x: float, y: float):
    """Analytical South Polar Stereographic inverse transform."""
    r = math.hypot(x, y)
    if r == 0:
        return -90.0, 0.0
    lat = math.degrees(2.0 * math.atan(r / (2.0 * MOON_RADIUS_M))) - 90.0
    lon = math.degrees(math.atan2(x, y))
    if lon < -180.0:
        lon += 360.0
    elif lon > 180.0:
        lon -= 360.0
    return lat, lon


def test_map_coordinate_round_trip_accuracy():
    """Test analytical round-trip coordinate transformation across South Polar latitudes."""
    test_locations = [
        ("South Pole Center", -90.0, 0.0),
        ("Shackleton Crater Rim", -89.9, 0.0),
        ("Connecting Ridge", -89.44, 137.31),
        ("Malapert Mountain Peak", -85.99, 2.93),
        ("de Gerlache Rim", -88.5, -88.3),
        ("Haworth Edge", -87.87, -5.1),
        ("Nobile Rim", -85.25, 53.5),
        ("DEM Boundary 80S (Meridian 0)", -80.0, 0.0),
        ("DEM Boundary 80S (Meridian 90E)", -80.0, 90.0),
        ("DEM Boundary 80S (Meridian 180)", -80.0, 180.0),
        ("DEM Boundary 80S (Meridian -90W)", -80.0, -90.0),
    ]

    for name, lat, lon in test_locations:
        x, y = lat_lon_to_polar_stereo(lat, lon)
        inv_lat, inv_lon = polar_stereo_to_lat_lon(x, y)

        assert abs(inv_lat - lat) < 1e-5, f"Latitude mismatch at {name}: {inv_lat} vs {lat}"
        if lat > -89.999:
            # Longitude at pole is degenerate
            lon_diff = abs(((inv_lon - lon + 180) % 360) - 180)
            assert lon_diff < 1e-4, f"Longitude mismatch at {name}: {inv_lon} vs {lon}"


def test_terrain_service_vs_analytical_transform():
    """Verify TerrainService pyproj transforms match analytical formulas within millimeters."""
    service = TerrainService()

    for lat in [-90.0, -89.9, -88.5, -85.99, -82.0, -80.0]:
        for lon in [-180.0, -90.0, 0.0, 45.0, 137.31, 180.0]:
            px, py = service.convert_lat_lon_to_xy(lat, lon)
            ax, ay = lat_lon_to_polar_stereo(lat, lon)
            assert abs(px - ax) < 1e-3, f"X mismatch at ({lat}, {lon}): {px} vs {ax}"
            assert abs(py - ay) < 1e-3, f"Y mismatch at ({lat}, {lon}): {py} vs {ay}"


def test_dem_elevation_lookup_at_presets():
    """Test that elevation lookup on the real LOLA DEM returns valid non-NaN meters for all presets."""
    service = TerrainService()

    presets = [
        (-89.90, 0.00),     # Shackleton Rim
        (-89.44, 137.31),   # Connecting Ridge
        (-85.99, 2.93),     # Malapert Mountain Peak
        (-88.50, -88.30),   # de Gerlache
    ]

    for lat, lon in presets:
        x, y = service.convert_lat_lon_to_xy(lat, lon)
        elev = service.get_elevation_at_xy(x, y)
        assert not math.isnan(elev), f"Elevation at ({lat}, {lon}) is NaN"
        assert -9000.0 < elev < 10000.0, f"Elevation {elev} out of expected lunar range"

    # Malapert Mountain peak must be a high summit (>4000 m)
    x_malapert, y_malapert = service.convert_lat_lon_to_xy(-85.99, 2.93)
    elev_malapert = service.get_elevation_at_xy(x_malapert, y_malapert)
    assert elev_malapert > 4500.0, f"Malapert peak should be >4500m, got {elev_malapert}m"


def test_dual_site_comparison_pipeline():
    """Test comparative analysis between Site A (Shackleton) and Site B (Malapert Mountain)."""
    # Query Site A
    res_a = client.post(
        "/api/analyze",
        json={
            "latitude": -89.90,
            "longitude": 0.00,
            "start_time": "2026-11-06T00:00:00",
            "stop_time": "2026-11-07T12:00:00",
            "step_size": "2h",
            "observer_height_m": 2.0,
        },
    )
    assert res_a.status_code == 200
    data_a = res_a.json()

    # Query Site B
    res_b = client.post(
        "/api/analyze",
        json={
            "latitude": -85.99,
            "longitude": 2.93,
            "start_time": "2026-11-06T00:00:00",
            "stop_time": "2026-11-07T12:00:00",
            "step_size": "2h",
            "observer_height_m": 2.0,
        },
    )
    assert res_b.status_code == 200
    data_b = res_b.json()

    # Verify both responses adhere to duration conservation
    for data, name in [(data_a, "Site A"), (data_b, "Site B")]:
        total_interval = data["time_range"]["elapsed_hours"]
        earth_vis = data["earth_comm"]["total_visible_hours"]
        earth_blk = data["earth_comm"]["total_blocked_hours"]
        assert pytest.approx(earth_vis + earth_blk, abs=0.1) == total_interval, f"{name} Earth duration violation"

        sun_vis = data["solar_power"]["total_visible_hours"]
        sun_blk = data["solar_power"]["total_blocked_hours"]
        assert pytest.approx(sun_vis + sun_blk, abs=0.1) == total_interval, f"{name} Sun duration violation"

    # Compare metrics: Malapert Mountain has higher elevation and higher Earth visibility on this date
    assert data_b["site"]["ground_elevation_m"] > data_a["site"]["ground_elevation_m"]
    assert data_b["earth_comm"]["visibility_percentage"] >= data_a["earth_comm"]["visibility_percentage"]


def test_generated_map_image_validity():
    """Verify that the generated shaded-relief map image exists, is valid, and matches specifications."""
    public_img_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "lunar_south_pole_dem.png")
    )
    assert os.path.exists(public_img_path), f"Map image not found at {public_img_path}"
    
    file_size_bytes = os.path.getsize(public_img_path)
    # File size should be reasonable (< 2MB, optimized for fast web loading)
    assert 100_000 < file_size_bytes < 2_500_000, f"Map image size {file_size_bytes} bytes unexpected"

    with Image.open(public_img_path) as img:
        assert img.size == (1024, 1024), f"Image dimension {img.size} is not 1024x1024"
        assert img.mode in ("RGBA", "RGB"), f"Image mode {img.mode} is not RGBA/RGB"


def test_elevation_endpoint_at_all_presets():
    """Verify GET /api/terrain/elevation endpoint returns valid elevation for all preset exploration sites."""
    presets = [
        (-89.90, 0.00),     # Shackleton Rim
        (-89.44, 137.31),   # Connecting Ridge
        (-85.99, 2.93),     # Malapert Mountain
        (-88.50, -88.30),   # de Gerlache Rim
        (-87.87, -5.10),    # Haworth Edge
        (-85.25, 53.50),    # Nobile Rim
        (-84.50, 82.80),    # Amundsen Rim
        (-90.00, 0.00),     # True South Pole
    ]

    for lat, lon in presets:
        res = client.get(f"/api/terrain/elevation?latitude={lat}&longitude={lon}")
        assert res.status_code == 200, f"Failed at ({lat}, {lon}): {res.text}"
        data = res.json()
        assert "elevation_m" in data
        assert -9000.0 < data["elevation_m"] < 10000.0
        assert data["latitude"] == pytest.approx(lat, abs=1e-4)
        assert data["longitude"] == pytest.approx(lon, abs=1e-4)


def test_elevation_endpoint_out_of_bounds_validation():
    """Verify GET /api/terrain/elevation rejects latitudes outside South Pole DEM coverage (-90 to -80)."""
    # Latitude -75.0 is outside the South Polar 80S coverage (-90° to -80°)
    res = client.get("/api/terrain/elevation?latitude=-75.0&longitude=0.0")
    assert res.status_code == 422
    # Detail should mention constraint violation on latitude
    assert "latitude" in str(res.json()).lower() or "less_than_equal" in str(res.json()).lower()


