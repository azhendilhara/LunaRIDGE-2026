"""Automated unit and regression tests for VisibilityService and /api/analyze."""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from main import app
from app.schemas.terrain import HorizonPoint
from app.schemas.visibility import (
    AnalysisPoint,
    DiskOcclusionState,
    TargetVisibilityPoint,
)
from app.services.visibility_service import VisibilityService

client = TestClient(app)


def test_circular_azimuth_interpolation_within_range():
    """Verify linear interpolation between standard adjacent azimuths."""
    profile = [
        HorizonPoint(azimuth_deg=0.0, horizon_elevation_deg=5.0, obstacle_distance_m=1000.0),
        HorizonPoint(azimuth_deg=90.0, horizon_elevation_deg=15.0, obstacle_distance_m=1000.0),
        HorizonPoint(azimuth_deg=180.0, horizon_elevation_deg=25.0, obstacle_distance_m=1000.0),
        HorizonPoint(azimuth_deg=270.0, horizon_elevation_deg=5.0, obstacle_distance_m=1000.0),
    ]

    # At 45°: exactly halfway between 0° (5.0°) and 90° (15.0°) => 10.0°
    interp_45 = VisibilityService.interpolate_horizon_elevation(45.0, profile)
    assert pytest.approx(interp_45, rel=1e-4) == 10.0

    # At 90°: exact match
    interp_90 = VisibilityService.interpolate_horizon_elevation(90.0, profile)
    assert pytest.approx(interp_90, rel=1e-4) == 15.0


def test_circular_azimuth_interpolation_wraparound():
    """Verify circular interpolation across 359° -> 0° boundary."""
    profile = [
        HorizonPoint(azimuth_deg=0.0, horizon_elevation_deg=10.0, obstacle_distance_m=1000.0),
        HorizonPoint(azimuth_deg=180.0, horizon_elevation_deg=20.0, obstacle_distance_m=1000.0),
        HorizonPoint(azimuth_deg=350.0, horizon_elevation_deg=30.0, obstacle_distance_m=1000.0),
    ]

    # Interval across 350° -> 0° (+360° = 360° span = 10°)
    # At 355°: halfway between 350° (30.0°) and 0°/360° (10.0°) => 20.0°
    interp_355 = VisibilityService.interpolate_horizon_elevation(355.0, profile)
    assert pytest.approx(interp_355, rel=1e-4) == 20.0

    # At 359°: 90% of the way from 350° to 360° => 30.0 + 0.9 * (10.0 - 30.0) = 12.0°
    interp_359 = VisibilityService.interpolate_horizon_elevation(359.0, profile)
    assert pytest.approx(interp_359, rel=1e-4) == 12.0


def test_evaluate_target_visibility_classifications():
    """Verify line-of-sight status and finite disk occlusion states."""
    service = VisibilityService()
    dip_angle = -0.05

    # 1. Unobstructed high target
    pt_vis = service.evaluate_target_visibility(
        azimuth_deg=10.0,
        elevation_deg=15.0,
        horizon_elev_deg=5.0,
        target_name="earth",
        dip_angle_deg=dip_angle,
    )
    assert pt_vis.visible is True
    assert pt_vis.los_status == "VISIBLE"
    assert pt_vis.clearance_deg == 10.0
    assert pt_vis.disk_occlusion == DiskOcclusionState.FULLY_VISIBLE

    # 2. Blocked by high terrain
    pt_blocked = service.evaluate_target_visibility(
        azimuth_deg=10.0,
        elevation_deg=3.0,
        horizon_elev_deg=8.0,
        target_name="earth",
        dip_angle_deg=dip_angle,
    )
    assert pt_blocked.visible is False
    assert pt_blocked.los_status == "BLOCKED_BY_TERRAIN"
    assert pt_blocked.clearance_deg == -5.0
    assert pt_blocked.disk_occlusion == DiskOcclusionState.FULLY_BLOCKED

    # 3. Partial grazing limb (clearance within Earth radius 0.95°)
    pt_limb = service.evaluate_target_visibility(
        azimuth_deg=10.0,
        elevation_deg=5.3,
        horizon_elev_deg=5.0,
        target_name="earth",
        dip_angle_deg=dip_angle,
    )
    assert pt_limb.visible is True
    assert pt_limb.clearance_deg == 0.3
    assert pt_limb.disk_occlusion == DiskOcclusionState.PARTIAL_LIMB

    # 4. Below the reference horizontal but above a depressed terrain skyline
    pt_below = service.evaluate_target_visibility(
        azimuth_deg=10.0,
        elevation_deg=-2.0,
        horizon_elev_deg=-4.0,
        target_name="earth",
        dip_angle_deg=dip_angle,
    )
    assert pt_below.visible is True
    assert pt_below.los_status == "VISIBLE"


def make_dummy_point(
    timestamp_str: str,
    earth_vis: bool,
    sun_vis: bool,
    earth_clr: float = 1.0,
    sun_clr: float = 1.0,
) -> AnalysisPoint:
    """Helper creating dummy AnalysisPoint for window testing."""
    dummy_target_earth = TargetVisibilityPoint(
        azimuth_deg=0.0,
        elevation_deg=5.0 if earth_vis else -5.0,
        horizon_elevation_deg=5.0 - earth_clr,
        clearance_deg=earth_clr,
        visible=earth_vis,
        los_status="VISIBLE" if earth_vis else "BLOCKED_BY_TERRAIN",
        disk_occlusion=DiskOcclusionState.FULLY_VISIBLE if earth_clr >= 0.95 else (
            DiskOcclusionState.PARTIAL_LIMB if earth_clr > -0.95 else DiskOcclusionState.FULLY_BLOCKED
        ),
    )
    dummy_target_sun = TargetVisibilityPoint(
        azimuth_deg=180.0,
        elevation_deg=2.0 if sun_vis else -2.0,
        horizon_elevation_deg=2.0 - sun_clr,
        clearance_deg=sun_clr,
        visible=sun_vis,
        los_status="VISIBLE" if sun_vis else "BLOCKED_BY_TERRAIN",
        disk_occlusion=DiskOcclusionState.FULLY_VISIBLE if sun_clr >= 0.267 else (
            DiskOcclusionState.PARTIAL_LIMB if sun_clr > -0.267 else DiskOcclusionState.FULLY_BLOCKED
        ),
    )
    return AnalysisPoint(timestamp=timestamp_str, earth=dummy_target_earth, sun=dummy_target_sun)


# ==============================================================================
# EXACT BUG REGRESSION TESTS
# ==============================================================================


def test_regression_19_samples_36_hours_always_visible():
    """Regression test: 19 timestamps at 2h intervals covering exactly 36h must report 36h duration (NOT 38h)."""
    t0 = datetime(2026, 11, 6, 0, 0)
    timestamps = [t0 + timedelta(hours=2 * i) for i in range(19)]
    assert (timestamps[-1] - timestamps[0]).total_seconds() / 3600.0 == 36.0

    points = [
        make_dummy_point(
            ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
            earth_vis=True,
            sun_vis=True,
            earth_clr=2.0,
            sun_clr=2.0,
        )
        for ts in timestamps
    ]

    summary = VisibilityService.identify_windows_and_summary(
        points, "earth", total_interval_hours=36.0
    )

    # Must be exactly 36.0 hours, NOT 38.0 hours
    assert summary.total_visible_hours == 36.0
    assert summary.total_blocked_hours == 0.0
    assert summary.total_interval_hours == 36.0
    assert summary.longest_window_hours == 36.0
    assert summary.longest_blackout_hours == 0.0
    assert summary.visibility_percentage == 100.0
    assert summary.window_count == 1
    assert summary.windows[0].duration_hours == 36.0
    assert summary.windows[0].sample_count == 19


def test_regression_19_samples_36_hours_always_blocked():
    """Regression test: 19 timestamps at 2h intervals covering exactly 36h must report 36h blackout (NOT 38h)."""
    t0 = datetime(2026, 11, 6, 0, 0)
    timestamps = [t0 + timedelta(hours=2 * i) for i in range(19)]
    points = [
        make_dummy_point(
            ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
            earth_vis=False,
            sun_vis=False,
            earth_clr=-2.0,
            sun_clr=-2.0,
        )
        for ts in timestamps
    ]

    summary = VisibilityService.identify_windows_and_summary(
        points, "earth", total_interval_hours=36.0
    )

    # Must be exactly 36.0 hours blackout and 0.0 hours visible
    assert summary.total_visible_hours == 0.0
    assert summary.total_blocked_hours == 36.0
    assert summary.total_interval_hours == 36.0
    assert summary.longest_window_hours == 0.0
    assert summary.longest_blackout_hours == 36.0
    assert summary.visibility_percentage == 0.0
    assert summary.window_count == 0


def test_regression_total_duration_conservation():
    """Regression test: total_visible_hours + total_blocked_hours MUST equal total_interval_hours."""
    t0 = datetime(2026, 11, 6, 0, 0)
    timestamps = [t0 + timedelta(hours=2 * i) for i in range(19)]

    # 10 visible followed by 9 blocked
    states = [True] * 10 + [False] * 9
    clrs = [1.0] * 10 + [-1.0] * 9

    points = [
        make_dummy_point(
            ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
            earth_vis=s,
            sun_vis=s,
            earth_clr=c,
            sun_clr=c,
        )
        for ts, s, c in zip(timestamps, states, clrs)
    ]

    summary = VisibilityService.identify_windows_and_summary(
        points, "earth", total_interval_hours=36.0
    )

    # Exact conservation within 0.001h
    assert abs((summary.total_visible_hours + summary.total_blocked_hours) - 36.0) < 1e-3
    assert summary.longest_window_hours <= 36.0
    assert summary.longest_blackout_hours <= 36.0
    assert summary.window_count == 1
    assert summary.windows[0].duration_hours <= 36.0


def test_regression_alternating_states():
    """Regression test: alternating visible/blocked states across 19 samples."""
    t0 = datetime(2026, 11, 6, 0, 0)
    timestamps = [t0 + timedelta(hours=2 * i) for i in range(19)]

    # Alternating: [T, F, T, F, T, F, ...]
    states = [i % 2 == 0 for i in range(19)]
    clrs = [1.0 if s else -1.0 for s in states]

    points = [
        make_dummy_point(
            ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
            earth_vis=s,
            sun_vis=s,
            earth_clr=c,
            sun_clr=c,
        )
        for ts, s, c in zip(timestamps, states, clrs)
    ]

    summary = VisibilityService.identify_windows_and_summary(
        points, "earth", total_interval_hours=36.0
    )

    # Conservation must hold identically
    assert abs((summary.total_visible_hours + summary.total_blocked_hours) - 36.0) < 1e-3
    assert summary.longest_window_hours <= 36.0
    assert summary.longest_blackout_hours <= 36.0
    for w in summary.windows:
        assert w.duration_hours <= 36.0


def test_regression_irregular_intervals():
    """Regression test: non-uniform interval spacing (e.g. 1h, 3h, 30m, 15m)."""
    t0 = datetime(2026, 11, 6, 0, 0)
    offsets_hours = [0.0, 1.0, 4.0, 4.5, 5.0, 8.0, 10.0]
    timestamps = [t0 + timedelta(hours=h) for h in offsets_hours]
    total_period = offsets_hours[-1] - offsets_hours[0]  # 10.0 hours

    states = [True, False, True, True, False, False, True]
    clrs = [1.0, -1.0, 2.0, 1.5, -0.5, -2.0, 1.0]

    points = [
        make_dummy_point(
            ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
            earth_vis=s,
            sun_vis=s,
            earth_clr=c,
            sun_clr=c,
        )
        for ts, s, c in zip(timestamps, states, clrs)
    ]

    summary = VisibilityService.identify_windows_and_summary(
        points, "earth", total_interval_hours=total_period
    )

    assert abs((summary.total_visible_hours + summary.total_blocked_hours) - total_period) < 1e-3
    assert summary.longest_window_hours <= total_period
    assert summary.longest_blackout_hours <= total_period


def test_regression_boundary_transitions():
    """Regression test: state transitions at the very first step (t0->t1) and last step (tN-2->tN-1)."""
    t0 = datetime(2026, 11, 6, 0, 0)
    timestamps = [t0 + timedelta(hours=i) for i in range(6)]  # 5 hours total

    # T -> F -> F -> F -> F -> T
    states = [True, False, False, False, False, True]
    clrs = [1.0, -1.0, -2.0, -2.0, -1.0, 1.0]

    points = [
        make_dummy_point(
            ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
            earth_vis=s,
            sun_vis=s,
            earth_clr=c,
            sun_clr=c,
        )
        for ts, s, c in zip(timestamps, states, clrs)
    ]

    summary = VisibilityService.identify_windows_and_summary(
        points, "earth", total_interval_hours=5.0
    )

    assert abs((summary.total_visible_hours + summary.total_blocked_hours) - 5.0) < 1e-3
    assert summary.window_count == 2
    assert summary.windows[0].duration_hours <= 5.0
    assert summary.windows[1].duration_hours <= 5.0


def test_disk_occlusion_durations_conservation():
    """Verify that full_disk + partial_limb + fully_blocked hours equals total interval hours."""
    t0 = datetime(2026, 11, 6, 0, 0)
    timestamps = [t0 + timedelta(hours=i) for i in range(10)]  # 9 hours
    # Clearances ranging across full visible, partial limb, and fully blocked
    clearances = [2.0, 1.5, 0.5, 0.0, -0.5, -1.5, -2.0, -0.5, 0.5, 2.0]

    full_vis, part, blk = VisibilityService.compute_disk_occlusion_durations(
        timestamps, clearances, r_ang=0.95
    )
    assert abs((full_vis + part + blk) - 9.0) < 1e-4


def test_analyze_validation_latitude():
    """Verify latitude validation on POST /api/analyze."""
    response = client.post(
        "/api/analyze",
        json={
            "latitude": -75.0,  # Outside LOLA South Pole DEM coverage (must be <= -80.0)
            "longitude": 0.0,
            "start_time": "2026-11-06T00:00:00",
            "stop_time": "2026-11-06T06:00:00",
            "step_size": "1h",
        },
    )
    assert response.status_code == 422


@pytest.mark.network
def test_live_analyze_south_pole_endpoint():
    """Live end-to-end test of POST /api/analyze at Shackleton Crater rim."""
    payload = {
        "latitude": -89.9,
        "longitude": 0.0,
        "start_time": "2026-11-06T00:00:00",
        "stop_time": "2026-11-06T06:00:00",
        "step_size": "1h",
        "observer_height_m": 2.0,
        "horizon_azimuth_step_deg": 1.0,
        "horizon_max_distance_km": 30.0,
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "success"
    assert data["site"]["latitude"] == -89.9
    assert data["site"]["longitude"] == 0.0
    assert "ground_elevation_m" in data["site"]
    assert len(data["data"]) == 7

    # Verify duration conservation on live response
    e_comm = data["earth_comm"]
    assert abs((e_comm["total_visible_hours"] + e_comm["total_blocked_hours"]) - 6.0) < 1e-2
    assert e_comm["longest_window_hours"] <= 6.0
    assert e_comm["longest_blackout_hours"] <= 6.0

    s_power = data["solar_power"]
    assert abs((s_power["total_visible_hours"] + s_power["total_blocked_hours"]) - 6.0) < 1e-2
    assert s_power["longest_window_hours"] <= 6.0
    assert s_power["longest_blackout_hours"] <= 6.0
