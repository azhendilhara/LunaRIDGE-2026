"""LunaRIDGE FastAPI Application.

LunaRIDGE — Radio, Illumination & Direct-to-Earth Geometry Evaluator
Tagline: Explore the Moon. Predict Visibility. Plan Missions.

Provides REST API endpoints for lunar surface communication, ephemeris services
backed by official NASA JPL Horizons, high-resolution lunar terrain elevation and obstruction
profiling using NASA LOLA DEM datasets, and terrain-aware line-of-sight visibility analysis.
"""

from typing import Optional
from contextlib import asynccontextmanager
from app.deployment import Settings,Admission,RequestPolicy,bound_time,bound_terrain,dem_path
from app.jpl_transport import JplTransport
from download_dem import verify_dem
from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.schemas.ephemeris import EphemerisRequest, EphemerisResponse
from app.schemas.terrain import (
    ElevationRequest,
    ElevationResponse,
    HorizonProfileRequest,
    HorizonProfileResponse,
)
from app.schemas.visibility import AnalysisRequest, AnalysisResponse
from app.services.horizons_service import HorizonsAPIError, HorizonsService
from app.services.terrain_service import TerrainService, TerrainServiceError
from app.services.visibility_service import VisibilityService, VisibilityServiceError

settings=Settings.load()
admission=Admission()

@asynccontextmanager
async def lifespan(app):
    try:
        app.state.dem_digest=verify_dem(dem_path())
        terrain_service.get_metadata()
        st=dem_path().stat();app.state.dem_stat=(str(dem_path()),st.st_size,st.st_mtime_ns)
    except Exception as exc:
        raise RuntimeError('LOLA readiness failed. Obtain and verify the pinned DEM before starting this service.') from exc
    app.state.ready=True
    try:yield
    finally:
        app.state.ready=False
        terrain_service.close()

app = FastAPI(
    lifespan=lifespan,
    title="LunaRIDGE API",
    description=(
        "LunaRIDGE \u2014 Radio, Illumination & Direct-to-Earth Geometry Evaluator. "
        "Explore the Moon. Predict Visibility. Plan Missions. "
        "Lunar surface communication and ephemeris analysis platform utilizing official NASA JPL Horizons and NASA LOLA terrain data."
    ),
    version="0.5.0",
)

# CORS is an explicit browser allowlist, not authentication or a rate limiter.
app.add_middleware(RequestPolicy,settings=settings)
app.add_middleware(CORSMiddleware,allow_origins=list(settings.origins),allow_credentials=False,
    allow_methods=['GET','POST','OPTIONS'],allow_headers=['Content-Type','Accept'],
    expose_headers=['Content-Disposition','Retry-After'])

horizons_service = HorizonsService(transport=JplTransport(settings.user_agent))
terrain_service = TerrainService()
visibility_service = VisibilityService(
    horizons_service=horizons_service, terrain_service=terrain_service
)


@app.exception_handler(HorizonsAPIError)
async def horizons_exception_handler(request: Request, exc: HorizonsAPIError):
    """Handle NASA JPL Horizons API specific errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "NASA JPL Horizons Error",
            "detail": exc.message,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(TerrainServiceError)
async def terrain_exception_handler(request: Request, exc: TerrainServiceError):
    """Handle lunar terrain service specific errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "NASA LOLA Terrain Service Error",
            "detail": exc.message,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(VisibilityServiceError)
async def visibility_exception_handler(request: Request, exc: VisibilityServiceError):
    """Handle visibility prediction specific errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "LunaRIDGE Visibility Analysis Error",
            "detail": exc.message,
            "status_code": exc.status_code,
        },
    )


@app.get("/")
def home():
    """Root endpoint verifying backend availability."""
    return {"message": "LunaRIDGE backend is running"}


@app.get("/health")
def health():
    """Health check endpoint."""
    try:
        st=dem_path().stat();stamp=(str(dem_path()),st.st_size,st.st_mtime_ns)
        if not getattr(app.state,'ready',False) or getattr(app.state,'dem_stat',None)!=stamp:
            app.state.dem_digest=verify_dem(dem_path());terrain_service.get_metadata();app.state.dem_stat=stamp;app.state.ready=True
    except Exception:
        app.state.ready=False
        return JSONResponse({'status':'unavailable','detail':'Pinned LOLA DEM is missing, invalid or not ready.'},503)
    return {'status':'ok'}



@app.get(
    "/api/ephemeris",
    response_model=EphemerisResponse,
    summary="Get Earth and Sun ephemeris for a lunar surface observer (GET)",
    description=(
        "Retrieves real topocentric azimuth and elevation measurements for Earth and Sun "
        "relative to a specified observer on the Moon using the official NASA JPL Horizons API. "
        "Reference frame: lunar topocentric MEAN_ME frame (East-lon positive, clockwise azimuth from North)."
    ),
)
def get_ephemeris_get(
    latitude: float = Query(
        ...,
        ge=-90.0,
        le=90.0,
        description="Observer selenodetic latitude on the Moon (-90° to +90°).",
        examples=[-89.9],
    ),
    longitude: float = Query(
        ...,
        ge=-180.0,
        le=360.0,
        description="Observer selenodetic longitude on the Moon in degrees (East-positive).",
        examples=[0.0],
    ),
    start_time: str = Query(
        ...,
        description="Start time in UTC (e.g. '2026-11-06T00:00:00' or '2026-11-06 00:00').",
        examples=["2026-11-06T00:00:00"],
    ),
    stop_time: str = Query(
        ...,
        description="Stop time in UTC (e.g. '2026-11-06T06:00:00' or '2026-11-06 06:00').",
        examples=["2026-11-06T06:00:00"],
    ),
    step_size: str = Query(
        default="1h",
        description="Evaluation interval step size (e.g. '10m', '30m', '1h', '1d').",
        examples=["1h"],
    ),
    altitude: float = Query(
        default=0.0,
        ge=-20.0,
        le=50.0,
        description="Observer altitude in km above lunar mean sphere (radius 1737.4 km).",
        examples=[0.0],
    ),
):
    try:
        req = EphemerisRequest(
            latitude=latitude,
            longitude=longitude,
            start_time=start_time,
            stop_time=stop_time,
            step_size=step_size,
            altitude=altitude,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)
        )

    bound_time(req,settings)
    with admission.slot():return horizons_service.get_ephemeris(req)


@app.post(
    "/api/ephemeris",
    response_model=EphemerisResponse,
    summary="Get Earth and Sun ephemeris for a lunar surface observer (POST)",
    description=(
        "Retrieves real topocentric azimuth and elevation measurements for Earth and Sun "
        "relative to a specified observer on the Moon using the official NASA JPL Horizons API. "
        "Accepts structured JSON request payload."
    ),
)
def get_ephemeris_post(payload: EphemerisRequest):
    bound_time(payload,settings)
    with admission.slot():return horizons_service.get_ephemeris(payload)


@app.get(
    "/api/terrain/elevation",
    response_model=ElevationResponse,
    summary="Lookup surface elevation on lunar South Pole DEM (GET)",
    description=(
        "Queries elevation in meters relative to lunar reference radius (1737.4 km) "
        "using official NASA LOLA South Pole DEM (LDEM_80S_80MPP_ADJ)."
    ),
)
def get_terrain_elevation(
    latitude: float = Query(
        ...,
        ge=-90.0,
        le=-80.0,
        description="Observer selenodetic latitude on the Moon (-90° to -80°).",
        examples=[-89.9],
    ),
    longitude: float = Query(
        ...,
        ge=-180.0,
        le=360.0,
        description="Observer selenodetic longitude on the Moon (East-positive).",
        examples=[0.0],
    ),
):
    req = ElevationRequest(latitude=latitude, longitude=longitude)
    with admission.slot():return terrain_service.get_elevation(req)


@app.post(
    "/api/terrain/horizon",
    response_model=HorizonProfileResponse,
    summary="Calculate directional terrain horizon obstruction profile (POST)",
    description=(
        "Computes 360-degree directional horizon profile accounting for lunar surface curvature, "
        "observer instrument mast height, and terrain elevation from NASA LOLA DEM. "
        "Azimuth convention: measured clockwise from selenodetic North (0°=N, 90°=E, 180°=S, 270°=W)."
    ),
)
def post_terrain_horizon(payload: HorizonProfileRequest):
    bound_terrain(payload,settings)
    with admission.slot():return terrain_service.get_horizon_profile(payload)


@app.post(
    "/api/analyze",
    response_model=AnalysisResponse,
    summary="Predict terrain-aware Earth communication and solar visibility windows (POST)",
    description=(
        "Integrates official NASA JPL Horizons topocentric ephemerides with high-resolution "
        "NASA LOLA lunar South Pole terrain obstruction profiles. Computes line-of-sight clearances, "
        "identifies contiguous communication and sunlight windows, and quantifies blackout durations."
    ),
)
def post_analyze_visibility(payload: AnalysisRequest):
    bound_time(payload,settings);bound_terrain(payload,settings)
    with admission.slot():
        try:return visibility_service.analyze_visibility(payload)
        finally:
            while len(visibility_service._horizon_cache)>16:visibility_service._horizon_cache.pop(next(iter(visibility_service._horizon_cache)))

# Geometry-only planning and report endpoints are additive; existing science routes are unchanged.
from app.services.mission_assessment import MissionEnvelope, assess, ReportConsistencyError
from app.services.mission_report import build_report
from fastapi.responses import Response

@app.post('/api/mission/assessment', summary='Assess editable geometric mission requirements')
def post_mission_assessment(payload: MissionEnvelope):
    if payload.result and len(payload.result.data)>settings.max_samples:raise HTTPException(413,'Report/assessment sample count exceeds the server budget.')
    with admission.slot(reports=True):return assess(payload)

@app.post('/api/reports/pdf', summary='Export a consistent submitted geometry analysis as PDF')
def post_mission_pdf(payload: MissionEnvelope):
    try:
        if payload.result and len(payload.result.data)>settings.max_samples:raise HTTPException(413,'Report sample count exceeds the server budget.')
        with admission.slot(reports=True):content=build_report(payload)
    except (ReportConsistencyError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return Response(content=content,media_type='application/pdf',headers={'Content-Disposition':'attachment; filename="LunaRIDGE-mission-report.pdf"','Cache-Control':'no-store'})
