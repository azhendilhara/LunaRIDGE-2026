"""Integration tests for terrain API endpoints."""

import os
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

REAL_DEM_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), "..", "..", "data", "lunar_dem", "LDEM_80S_80MPP_ADJ.TIF"
    )
)


def test_elevation_validation():
    """Test validation on GET /api/terrain/elevation."""
    # Latitude out of bounds for South Pole DEM (must be <= -80.0)
    response = client.get(
        "/api/terrain/elevation", params={"latitude": -75.0, "longitude": 0.0}
    )
    assert response.status_code == 422


@pytest.mark.skipif(
    not os.path.exists(REAL_DEM_PATH)
    or os.path.getsize(REAL_DEM_PATH) < 189158392,
    reason="Full LOLA DEM not yet available on disk",
)
def test_real_elevation_endpoint():
    """Test GET /api/terrain/elevation using real LOLA DEM at Shackleton crater rim."""
    # Shackleton crater rim: ~89.9°S, 0.0°E
    response = client.get(
        "/api/terrain/elevation", params={"latitude": -89.9, "longitude": 0.0}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["latitude"] == -89.9
    assert data["longitude"] == 0.0
    assert "elevation_m" in data
    assert -9000.0 <= data["elevation_m"] <= 9000.0
    assert data["reference_datum"] == "Lunar sphere R=1737.4 km (MOON_ME)"


@pytest.mark.skipif(
    not os.path.exists(REAL_DEM_PATH)
    or os.path.getsize(REAL_DEM_PATH) < 189158392,
    reason="Full LOLA DEM not yet available on disk",
)
def test_real_horizon_profile_endpoint():
    """Test POST /api/terrain/horizon using real LOLA DEM at Shackleton crater rim."""
    payload = {
        "latitude": -89.9,
        "longitude": 0.0,
        "observer_height_m": 2.0,
        "azimuth_start_deg": 0.0,
        "azimuth_end_deg": 360.0,
        "azimuth_step_deg": 30.0,  # 12 rays for fast integration test
        "max_distance_km": 20.0,
        "sample_step_m": 80.0,
    }
    response = client.post("/api/terrain/horizon", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["observer"]["latitude"] == -89.9
    assert data["observer"]["longitude"] == 0.0
    assert len(data["profile"]) == 12

    for pt in data["profile"]:
        assert 0.0 <= pt["azimuth_deg"] <= 360.0
        assert -90.0 <= pt["horizon_elevation_deg"] <= 90.0
        assert pt["obstacle_distance_m"] >= 0.0
