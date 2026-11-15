"""Pydantic schemas for terrain-aware Earth communication and solar visibility analysis."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator
import re


def parse_utc_datetime(val: str) -> datetime:
    """Parse common UTC datetime strings."""
    from app.schemas.ephemeris import parse_date_str
    return parse_date_str(val)



class AnalysisRequest(BaseModel):
    """Input payload for terrain-aware visibility analysis."""

    latitude: float = Field(
        ...,
        ge=-90.0,
        le=-80.0,
        description="Observer selenodetic latitude on the Moon (-90° to -80° for LOLA South Pole DEM).",
        examples=[-89.9],
    )
    longitude: float = Field(
        ...,
        ge=-180.0,
        le=360.0,
        description="Observer selenodetic longitude on the Moon (East-positive, -180° to 180° or 0° to 360°).",
        examples=[0.0],
    )
    start_time: str = Field(
        ...,
        description="Start time in UTC (e.g. '2026-11-06T00:00:00' or '2026-11-06 00:00').",
        examples=["2026-11-06T00:00:00"],
    )
    stop_time: str = Field(
        ...,
        description="Stop time in UTC (e.g. '2026-11-08T00:00:00' or '2026-11-08 00:00').",
        examples=["2026-11-08T00:00:00"],
    )
    step_size: str = Field(
        default="1h",
        description="Time step for ephemeris evaluation (e.g. '10m', '30m', '1h', '6h', '1d'). Default 1h.",
        examples=["1h"],
    )
    observer_height_m: float = Field(
        default=2.0,
        ge=0.0,
        le=100.0,
        description="Observer instrument / antenna mast height in meters above local ground. Default 2.0m.",
        examples=[2.0],
    )
    horizon_azimuth_step_deg: float = Field(
        default=1.0,
        ge=0.1,
        le=45.0,
        description="Azimuth angular resolution for terrain horizon profiling in degrees. Default 1.0° (360 samples).",
        examples=[1.0],
    )
    horizon_max_distance_km: float = Field(
        default=50.0,
        ge=1.0,
        le=150.0,
        description="Maximum search radius in km for terrain horizon obstruction. Default 50.0 km.",
        examples=[50.0],
    )

    @field_validator("step_size")
    @classmethod
    def validate_step(cls, v: str) -> str:
        v = v.strip()
        pattern = r"^\d+\s*(m|min|h|d)$"
        if not re.match(pattern, v, re.IGNORECASE) or int(re.match(r"^\d+", v).group()) == 0:
            raise ValueError(
                f"Invalid step_size format: '{v}'. Must be an integer followed by m, min, h, or d (e.g. '10m', '1h', '1d')."
            )
        return v

    @model_validator(mode="after")
    def validate_time_bounds(self) -> "AnalysisRequest":
        start_dt = parse_utc_datetime(self.start_time)
        stop_dt = parse_utc_datetime(self.stop_time)
        if start_dt >= stop_dt:
            raise ValueError("start_time must be strictly earlier than stop_time.")
        self.start_time = start_dt.isoformat().replace("+00:00", "Z")
        self.stop_time = stop_dt.isoformat().replace("+00:00", "Z")
        return self


class DiskOcclusionState:
    FULLY_VISIBLE = "FULLY_VISIBLE"
    PARTIAL_LIMB = "PARTIAL_LIMB"
    FULLY_BLOCKED = "FULLY_BLOCKED"


class TargetVisibilityPoint(BaseModel):
    """Visibility and line-of-sight metrics for a single celestial target at one timestamp."""

    azimuth_deg: float = Field(..., description="Apparent topocentric azimuth in degrees (clockwise from North).")
    elevation_deg: float = Field(..., description="Apparent topocentric elevation in degrees above local horizontal.")
    horizon_elevation_deg: float = Field(..., description="Terrain horizon obstruction elevation at target azimuth in degrees.")
    clearance_deg: float = Field(..., description="Angular clearance (target elevation minus terrain horizon). Positive = visible.")
    visible: bool = Field(..., description="True if center of target is above terrain horizon (clearance > 0°).")
    los_status: str = Field(..., description="Line-of-sight status: 'VISIBLE', 'BLOCKED_BY_TERRAIN', or 'BELOW_GEOMETRIC_HORIZON'.")
    disk_occlusion: str = Field(..., description="Finite disk occlusion: 'FULLY_VISIBLE', 'PARTIAL_LIMB', or 'FULLY_BLOCKED'.")


class AnalysisPoint(BaseModel):
    """Terrain-aware visibility evaluation for both Earth and Sun at a timestamp."""

    timestamp: str = Field(..., description="ISO-8601 UTC timestamp of measurement.")
    earth: TargetVisibilityPoint
    sun: TargetVisibilityPoint


class VisibilityWindow(BaseModel):
    """Contiguous interval of line-of-sight visibility."""

    window_index: int
    start_time: str = Field(..., description="Estimated UTC start of visibility window (ISO-8601).")
    end_time: str = Field(..., description="Estimated UTC end of visibility window (ISO-8601).")
    duration_hours: float = Field(..., description="Window duration in hours (end_time - start_time).")
    first_sample_time: str = Field(..., description="Timestamp of first visible sample in window.")
    last_sample_time: str = Field(..., description="Timestamp of last visible sample in window.")
    sample_count: int = Field(..., description="Number of contiguous visible samples in window.")
    peak_elevation_deg: float = Field(..., description="Highest target elevation reached during window in degrees.")
    min_clearance_deg: float = Field(..., description="Minimum angular clearance above terrain during window in degrees.")
    max_clearance_deg: float = Field(..., description="Maximum angular clearance above terrain during window in degrees.")


class TargetSummary(BaseModel):
    """Aggregated visibility statistics and contiguous windows for a target."""

    total_visible_hours: float = Field(..., description="Sum of visible hours across the requested period.")
    total_blocked_hours: float = Field(..., description="Sum of blocked hours across the requested period.")
    total_interval_hours: float = Field(..., description="Total elapsed hours between first and last timestamp.")
    visibility_percentage: float = Field(..., description="Percentage of elapsed period where target center is visible.")
    full_disk_visible_hours: float = Field(default=0.0, description="Hours where entire disk is unoccluded (clearance >= angular radius).")
    partial_limb_hours: float = Field(default=0.0, description="Hours where disk is grazing terrain (-radius < clearance < +radius).")
    fully_blocked_hours: float = Field(default=0.0, description="Hours where entire disk is behind terrain (clearance <= -radius).")
    window_count: int = Field(..., description="Number of discrete visible windows.")
    longest_window_hours: float = Field(..., description="Duration of longest continuous visibility window in hours.")
    longest_blackout_hours: float = Field(..., description="Duration of longest continuous blackout period in hours.")
    transition_estimation_method: str = Field(
        default="Linear clearance root interpolation between adjacent samples.",
        description="Method used to estimate transition timestamps between discrete samples."
    )
    sampling_uncertainty_note: str = Field(
        default="Linear crossing estimates depend on sampling; short events can be missed between samples.",
        description="Sampling precision limitation."
    )
    windows: List[VisibilityWindow] = Field(..., description="List of contiguous visibility windows.")


class SiteInfo(BaseModel):
    """Observer location and terrain metadata."""

    latitude: float
    longitude: float
    ground_elevation_m: float
    observer_height_m: float
    total_altitude_m: float
    reference_frame: str = "MEAN_ME (DE421 surface coordinates; LOLA terrain; DE441 ephemerides)"
    datum: str = "Moon (2015) - Sphere, R=1737.4 km"


class TimeRangeSummary(BaseModel):
    """Time range configuration and discrete precision metadata."""

    start_time: str
    stop_time: str
    requested_start_time: Optional[str] = None
    requested_stop_time: Optional[str] = None
    step_size: str
    total_points: int
    elapsed_hours: float
    time_step_precision: str = "Linear crossing estimates depend on sampling; short events can be missed."


class AnalysisResponse(BaseModel):
    """Complete response payload for POST /api/analyze."""

    status: str = "success"
    submitted_scenario: Optional[AnalysisRequest] = None
    site: SiteInfo
    time_range: TimeRangeSummary
    scientific_model_notes: List[str] = Field(
        default=[
            "Geometric Earth visibility does not guarantee an RF link; sunlight visibility is not electrical power.",
            "No sunlight in an interval does not establish permanent shadow; eclipses are not modeled.",
            "Terrain coverage is checked at every sampled point; terrain beyond the finite search radius remains unmodeled.",
            "Target center visibility is the primary line-of-sight model (clearance > 0°).",
            "Finite angular diameter effects: Earth mean radius ~0.95°, Sun radius ~0.267°.",
            "Partial limb grazing is classified separately from complete illumination and full blockage.",
            "Conservation property: total_visible_hours + total_blocked_hours == total_interval_hours.",
            "No window duration exceeds the total observation interval.",
            "LOLA and Horizons lunar coordinates are used without a fitted frame transformation; independent frame validation remains required.",
        ]
    )
    earth_comm: TargetSummary = Field(..., description="Legacy field name: geometric Earth-center visibility, not an RF link budget.")
    solar_power: TargetSummary = Field(..., description="Legacy field name: Sun-center visibility, not electrical power.")
    data: List[AnalysisPoint]
