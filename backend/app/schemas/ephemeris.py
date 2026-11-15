"""Pydantic schemas for LunaRIDGE ephemeris requests and responses."""

import re
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


def parse_date_str(val: str) -> datetime:
    """Parse various acceptable datetime strings into UTC datetime."""
    try:
        dt = datetime.fromisoformat(val.strip().replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Expected an ISO-8601 datetime or YYYY-MM-DD; naive values mean UTC.") from exc
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)



class EphemerisRequest(BaseModel):
    """Input parameters for lunar surface ephemeris query."""

    latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Observer selenodetic latitude on the Moon in degrees (-90.0 for South Pole, +90.0 for North Pole).",
        examples=[-89.9],
    )
    longitude: float = Field(
        ...,
        ge=-180.0,
        le=360.0,
        description="Observer selenodetic longitude on the Moon in degrees (East-positive, -180 to 180 or 0 to 360).",
        examples=[0.0],
    )
    start_time: str = Field(
        ...,
        description="Start time in UTC (e.g., '2026-11-06T00:00:00' or '2026-11-06 00:00').",
        examples=["2026-11-06T00:00:00"],
    )
    stop_time: str = Field(
        ...,
        description="Stop time in UTC (e.g., '2026-11-06T06:00:00' or '2026-11-06 06:00').",
        examples=["2026-11-06T06:00:00"],
    )
    step_size: str = Field(
        default="1h",
        description="Time step between ephemeris evaluations (e.g., '10m', '30m', '1h', '6h', '1d').",
        examples=["1h"],
    )
    altitude: float = Field(
        default=0.0,
        ge=-20.0,
        le=50.0,
        description="Observer altitude in km above lunar mean radius (1737.4 km). Default 0.0.",
        examples=[0.0],
    )

    @field_validator("step_size")
    @classmethod
    def validate_step_size(cls, v: str) -> str:
        v = v.strip()
        pattern = r"^\d+\s*(m|min|h|d)$"
        if not re.match(pattern, v, re.IGNORECASE) or int(re.match(r"^\d+", v).group()) == 0:
            raise ValueError(
                f"Invalid step_size format: '{v}'. Must be an integer followed by m, min, h, or d (e.g. '10m', '1h', '1d')."
            )
        return v

    @model_validator(mode="after")
    def validate_time_range(self) -> "EphemerisRequest":
        start_dt = parse_date_str(self.start_time)
        stop_dt = parse_date_str(self.stop_time)
        if start_dt >= stop_dt:
            raise ValueError("start_time must be strictly earlier than stop_time.")
        self.start_time = start_dt.isoformat().replace("+00:00", "Z")
        self.stop_time = stop_dt.isoformat().replace("+00:00", "Z")
        return self


class BodyPosition(BaseModel):
    """Azimuth and elevation position for a celestial target."""

    azimuth_deg: float = Field(
        ...,
        description="Azimuth in degrees measured clockwise from local lunar North: 0° (North) -> 90° (East) -> 180° (South) -> 270° (West).",
    )
    elevation_deg: float = Field(
        ...,
        description="Elevation angle in degrees relative to the observer's local horizontal plane (-90° nadir to +90° zenith).",
    )
    altitude_deg: float = Field(
        ...,
        description="Convenience alias for elevation angle in degrees above the local lunar horizon.",
    )
    visible: bool = Field(
        ...,
        description="True if elevation > 0.0° (above local geometric horizon, assuming spherical Moon).",
    )
    solar_presence: Optional[str] = Field(
        default=None,
        description="NASA JPL Horizons solar presence code ('*' for daylight, ' ' for night).",
    )


class EphemerisPoint(BaseModel):
    """Ephemeris measurements at a specific timestamp."""

    timestamp: str = Field(
        ...,
        description="ISO-8601 UTC timestamp of measurement.",
        examples=["2026-11-06T00:00:00Z"],
    )
    earth: BodyPosition = Field(..., description="Apparent topocentric position of Earth.")
    sun: BodyPosition = Field(..., description="Apparent topocentric position of Sun.")


class ObserverInfo(BaseModel):
    """Metadata describing the lunar surface observer."""

    latitude: float
    longitude: float
    altitude_km: float
    body: str = "Moon (301)"
    reference_frame: str = "MEAN_ME (DE421 surface coordinates; DE441 ephemerides)"
    coordinate_system: str = "Selenodetic (East-lon positive, spherical radius 1737.4 km)"


class TimeRangeInfo(BaseModel):
    """Metadata regarding time bounds and evaluation interval."""

    start_time: str
    stop_time: str
    step_size: str


class EphemerisResponse(BaseModel):
    """Complete response returned by /api/ephemeris."""

    status: str = "success"
    source: str = "NASA JPL Horizons On-Line Ephemeris System"
    observer: ObserverInfo
    time_range: TimeRangeInfo
    count: int
    data: List[EphemerisPoint]
