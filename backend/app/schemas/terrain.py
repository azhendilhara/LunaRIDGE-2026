"""Pydantic schemas for lunar terrain elevation and horizon obstruction profiles."""

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class ElevationRequest(BaseModel):
    """Request schema for lunar surface elevation lookup."""

    latitude: float = Field(
        ...,
        ge=-90.0,
        le=-80.0,
        description="Observer selenodetic latitude on the Moon (-90° to -80° for South Pole DEM).",
        examples=[-89.9],
    )
    longitude: float = Field(
        ...,
        ge=-180.0,
        le=360.0,
        description="Observer selenodetic longitude on the Moon (East-positive, -180° to 180° or 0° to 360°).",
        examples=[0.0],
    )


class ElevationResponse(BaseModel):
    """Response schema for lunar surface elevation lookup."""

    status: str = "success"
    latitude: float
    longitude: float
    elevation_m: float = Field(
        ...,
        description="Elevation in meters relative to the lunar reference radius (1737.4 km).",
    )
    projected_x_m: float = Field(
        ...,
        description="Projected Easting coordinate X in meters in Polar Stereographic projection.",
    )
    projected_y_m: float = Field(
        ...,
        description="Projected Northing coordinate Y in meters in Polar Stereographic projection.",
    )
    dem_source: str = "NASA LOLA LDEM_80S_80MPP_ADJ (80 m/pixel)"
    reference_datum: str = "Lunar sphere R=1737.4 km (MOON_ME)"


class HorizonPoint(BaseModel):
    """Obstruction profile point for a single azimuth direction."""

    azimuth_deg: float = Field(
        ...,
        description="Azimuth in degrees clockwise from local selenodetic North (0°=N, 90°=E, 180°=S, 270°=W).",
    )
    horizon_elevation_deg: float = Field(
        ...,
        description="Terrain horizon obstruction elevation angle in degrees above the local horizontal plane.",
    )
    obstacle_distance_m: float = Field(
        ...,
        description="Distance in meters from observer to the limiting terrain obstruction feature.",
    )
    obstacle_latitude: Optional[float] = Field(
        default=None,
        description="Latitude of the limiting terrain obstacle.",
    )
    obstacle_longitude: Optional[float] = Field(
        default=None,
        description="Longitude of the limiting terrain obstacle.",
    )
    obstacle_elevation_m: Optional[float] = Field(
        default=None,
        description="Surface elevation in meters of the limiting terrain obstacle.",
    )


class ObserverTerrainInfo(BaseModel):
    """Observer terrain positioning details."""

    latitude: float
    longitude: float
    ground_elevation_m: float
    observer_height_m: float
    total_altitude_m: float


class HorizonProfileRequest(BaseModel):
    """Request schema for directional horizon obstruction profile."""

    latitude: float = Field(
        ...,
        ge=-90.0,
        le=-80.0,
        description="Observer selenodetic latitude on the Moon (-90° to -80° for South Pole DEM).",
        examples=[-89.9],
    )
    longitude: float = Field(
        ...,
        ge=-180.0,
        le=360.0,
        description="Observer selenodetic longitude on the Moon (East-positive).",
        examples=[0.0],
    )
    observer_height_m: float = Field(
        default=2.0,
        ge=0.0,
        le=100.0,
        description="Observer instrument / antenna mast height in meters above local lunar ground. Default 2.0m.",
        examples=[2.0],
    )
    azimuth_start_deg: float = Field(
        default=0.0,
        ge=0.0,
        lt=360.0,
        description="Starting azimuth angle in degrees (clockwise from North). Default 0.0°.",
    )
    azimuth_end_deg: float = Field(
        default=360.0,
        gt=0.0,
        le=360.0,
        description="Ending azimuth angle in degrees. Default 360.0°.",
    )
    azimuth_step_deg: float = Field(
        default=1.0,
        ge=0.1,
        le=45.0,
        description="Step size between azimuth rays in degrees. Default 1.0° (360 samples).",
    )
    max_distance_km: float = Field(
        default=50.0,
        ge=1.0,
        le=150.0,
        description="Maximum radial lookahead distance in km for terrain obstruction analysis. Default 50.0 km.",
    )
    sample_step_m: float = Field(
        default=80.0,
        ge=20.0,
        le=1000.0,
        description="Radial sampling step in meters along each azimuth ray. Default 80.0m (matching DEM resolution).",
    )


class HorizonProfileResponse(BaseModel):
    """Response containing directional terrain horizon obstruction profile."""

    status: str = "success"
    observer: ObserverTerrainInfo
    azimuth_convention: str = (
        "Clockwise from selenodetic North (0° = N, 90° = E, 180° = S, 270° = W)"
    )
    reference_frame: str = "MOON_ME (LOLA Polar Stereographic, R=1737.4 km)"
    dem_source: str = "NASA LOLA LDEM_80S_80MPP_ADJ (80 m/pixel)"
    count: int
    profile: List[HorizonPoint]
