"""Unit and integration tests for the NASA JPL Horizons service."""

import pytest
from app.schemas.ephemeris import EphemerisRequest
from app.services.horizons_service import HorizonsAPIError, HorizonsService

SAMPLE_HORIZONS_OUTPUT = """
*******************************************************************************
 Revised: April 12, 2021                 Earth                              399
*******************************************************************************
$$SOE
 2026-Nov-06 00:00:00,*, ,   5.544634,    -4.275793,
 2026-Nov-06 01:00:00,*, ,   5.536415,    -4.324106,
 2026-Nov-06 02:00:00,*, ,   5.527905,    -4.372013,
$$EOE
*******************************************************************************
"""

SAMPLE_HORIZONS_SUN_OUTPUT = """
*******************************************************************************
 Revised: April 12, 2021                 Sun                                 10
*******************************************************************************
$$SOE
 2026-Nov-06 00:00:00,*, , 224.210405,     1.437290,
 2026-Nov-06 01:00:00,*, , 223.702200,     1.437119,
 2026-Nov-06 02:00:00,*, , 223.194002,     1.437000,
$$EOE
*******************************************************************************
"""


def test_parse_ephemeris_table():
    service = HorizonsService()
    records = service._parse_ephemeris_table(SAMPLE_HORIZONS_OUTPUT)

    assert len(records) == 3
    assert records[0]["timestamp"] == "2026-11-06T00:00:00Z"
    assert pytest.approx(records[0]["azimuth_deg"], rel=1e-4) == 5.544634
    assert pytest.approx(records[0]["elevation_deg"], rel=1e-4) == -4.275793
    assert records[0]["visible"] is False
    assert records[0]["solar_presence"] == "*"


def test_parse_ephemeris_sun_visibility():
    service = HorizonsService()
    records = service._parse_ephemeris_table(SAMPLE_HORIZONS_SUN_OUTPUT)

    assert len(records) == 3
    assert records[0]["timestamp"] == "2026-11-06T00:00:00Z"
    assert pytest.approx(records[0]["azimuth_deg"], rel=1e-4) == 224.210405
    assert pytest.approx(records[0]["elevation_deg"], rel=1e-4) == 1.437290
    assert records[0]["visible"] is True


def test_parse_missing_soe_eoe():
    service = HorizonsService()
    invalid_output = "No valid data here\nSome error message"

    with pytest.raises(HorizonsAPIError) as exc_info:
        service._parse_ephemeris_table(invalid_output)

    assert "did not return ephemeris data" in exc_info.value.message


def test_convert_horizons_time():
    service = HorizonsService()
    assert (
        service._convert_horizons_time_to_iso("2026-Nov-06 14:30:00")
        == "2026-11-06T14:30:00Z"
    )
    assert (
        service._convert_horizons_time_to_iso("2026-Nov-06 14:30")
        == "2026-11-06T14:30:00Z"
    )


@pytest.mark.network
def test_live_horizons_south_pole_query():
    """Live integration test against official NASA JPL Horizons API for lunar South Pole."""
    service = HorizonsService()
    req = EphemerisRequest(
        latitude=-89.9,
        longitude=0.0,
        start_time="2026-11-06T00:00:00",
        stop_time="2026-11-06T02:00:00",
        step_size="1h",
        altitude=0.0,
    )
    res = service.get_ephemeris(req)

    assert res.status == "success"
    assert res.count == 3
    assert len(res.data) == 3
    assert res.observer.latitude == -89.9
    assert res.observer.longitude == 0.0

    point0 = res.data[0]
    assert point0.timestamp == "2026-11-06T00:00:00Z"
    assert 0.0 <= point0.earth.azimuth_deg <= 360.0
    assert -90.0 <= point0.earth.elevation_deg <= 90.0
    assert 0.0 <= point0.sun.azimuth_deg <= 360.0
    assert -90.0 <= point0.sun.elevation_deg <= 90.0
