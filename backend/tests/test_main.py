"""FastAPI endpoint tests for LunaRIDGE."""

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_root_endpoint():
    """Verify existing root / endpoint remains functional."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "LunaRIDGE backend is running"}


def test_health_endpoint():
    """Verify existing /health endpoint remains functional."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_validation_latitude_out_of_range():
    """Test latitude bounds validation (-90 to +90)."""
    response = client.post(
        "/api/ephemeris",
        json={
            "latitude": -95.0,  # Invalid
            "longitude": 0.0,
            "start_time": "2026-11-06T00:00:00",
            "stop_time": "2026-11-06T02:00:00",
            "step_size": "1h",
        },
    )
    assert response.status_code == 422


def test_validation_invalid_step_format():
    """Test step_size format validation."""
    response = client.post(
        "/api/ephemeris",
        json={
            "latitude": -89.9,
            "longitude": 0.0,
            "start_time": "2026-11-06T00:00:00",
            "stop_time": "2026-11-06T02:00:00",
            "step_size": "invalid_step",  # Invalid
        },
    )
    assert response.status_code == 422


def test_validation_start_time_after_stop_time():
    """Test that start_time >= stop_time fails validation."""
    response = client.post(
        "/api/ephemeris",
        json={
            "latitude": -89.9,
            "longitude": 0.0,
            "start_time": "2026-11-06T04:00:00",
            "stop_time": "2026-11-06T02:00:00",  # Stop earlier than start
            "step_size": "1h",
        },
    )
    assert response.status_code == 422


def test_live_ephemeris_post_south_pole():
    """Test POST /api/ephemeris with real lunar South Pole coordinates."""
    response = client.post(
        "/api/ephemeris",
        json={
            "latitude": -89.9,
            "longitude": 0.0,
            "start_time": "2026-11-06T00:00:00",
            "stop_time": "2026-11-06T03:00:00",
            "step_size": "1h",
            "altitude": 0.0,
        },
    )
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "success"
    assert data["source"] == "NASA JPL Horizons On-Line Ephemeris System"
    assert data["observer"]["latitude"] == -89.9
    assert data["observer"]["longitude"] == 0.0
    assert data["count"] == 4
    assert len(data["data"]) == 4

    first = data["data"][0]
    assert "timestamp" in first
    assert "azimuth_deg" in first["earth"]
    assert "elevation_deg" in first["earth"]
    assert "azimuth_deg" in first["sun"]
    assert "elevation_deg" in first["sun"]


def test_live_ephemeris_get_south_pole():
    """Test GET /api/ephemeris with query parameters."""
    response = client.get(
        "/api/ephemeris",
        params={
            "latitude": -89.9,
            "longitude": 0.0,
            "start_time": "2026-11-06T00:00:00",
            "stop_time": "2026-11-06T02:00:00",
            "step_size": "1h",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 3
    assert len(data["data"]) == 3
