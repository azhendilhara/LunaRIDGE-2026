import pytest
from datetime import datetime,timedelta,timezone
from app.schemas.visibility import AnalysisRequest,AnalysisResponse,AnalysisPoint,SiteInfo,TimeRangeSummary
from app.services.visibility_service import VisibilityService
from app.services.mission_assessment import *

def sample_envelope(earth=(1,1,1),sun=(1,1,1),profile='Balanced'):
    req=AnalysisRequest(latitude=-89,longitude=0,start_time='2026-11-06',stop_time='2026-11-06T04:00:00Z')
    service=VisibilityService();points=[]
    for i,(e,s) in enumerate(zip(earth,sun)):
        ts=(datetime(2026,11,6,tzinfo=timezone.utc)+timedelta(hours=i*2)).strftime('%Y-%m-%dT%H:%M:%SZ')
        points.append(AnalysisPoint(timestamp=ts,earth=service.evaluate_target_visibility(0,e,0,'earth',0),sun=service.evaluate_target_visibility(0,s,0,'sun',0)))
    result=AnalysisResponse(submitted_scenario=req.model_copy(deep=True),site=SiteInfo(latitude=-89,longitude=0,ground_elevation_m=1000,observer_height_m=2,total_altitude_m=1002),time_range=TimeRangeSummary(start_time=points[0].timestamp,stop_time=points[-1].timestamp,requested_start_time=req.start_time,requested_stop_time=req.stop_time,step_size=req.step_size,total_points=3,elapsed_hours=4),earth_comm=service.identify_windows_and_summary(points,'earth',4),solar_power=service.identify_windows_and_summary(points,'sun',4),data=points)
    return MissionEnvelope(scenario=req,draft_scenario=req.model_copy(deep=True),result=result,settings=AssessmentSettings(profile=profile))

@pytest.mark.parametrize('earth,sun,profile,label',[
 ((1,1,1),(1,1,1),'Balanced','Favorable'),
 ((-1,-1,-1),(-1,-1,-1),'Balanced','Challenging'),
 ((-1,-1,-1),(1,1,1),'Solar Priority','Conditional'),
 ((-1,-1,-1),(1,1,1),'Communication Priority','Challenging'),
 ((1,1,1),(-1,-1,-1),'Balanced','Conditional')])
def test_assessment_profiles(earth,sun,profile,label):
    result=assess(sample_envelope(earth,sun,profile));assert result['label']==label
    assert len(result['requirements'])==4

def test_borderline_inclusive_and_editable():
    env=sample_envelope();env.settings.thresholds=Thresholds(earth_min_percent=100,sun_min_percent=100,earth_max_blackout_hours=0,sun_max_blackout_hours=0)
    assert assess(env)['label']=='Favorable'
    env=sample_envelope(earth=(-1,1,-1));env.settings.thresholds=Thresholds(earth_min_percent=50,sun_min_percent=100,earth_max_blackout_hours=1,sun_max_blackout_hours=0)
    assert assess(env)['label']=='Favorable'
    env.settings.thresholds.earth_min_percent=50.01
    assert assess(env)['label']=='Conditional'

@pytest.mark.parametrize('kind',['missing','incomplete','stale','summary','clearance','radius','no_provenance','los'])
def test_insufficient_data_blocks_export(kind):
    env=sample_envelope()
    if kind=='missing':env.result=None
    if kind=='incomplete':env.result.status='incomplete'
    if kind=='stale':env.draft_scenario.latitude=-88
    if kind=='summary':env.result.earth_comm.total_visible_hours=3
    if kind=='clearance':env.result.data[0].earth.clearance_deg=99
    if kind=='radius':env.scenario.horizon_max_distance_km=25
    if kind=='no_provenance':env.result.submitted_scenario=None
    if kind=='los':env.result.data[0].earth.los_status='BLOCKED_BY_TERRAIN'
    result=assess(env);assert result['label']=='Insufficient Data';assert not result['exportable']

def test_threshold_validation():
    with pytest.raises(ValueError):Thresholds(earth_min_percent=101,sun_min_percent=50,earth_max_blackout_hours=24,sun_max_blackout_hours=24)

def test_permissive_user_requirements_never_rewrite_zero_measurements():
    env=sample_envelope(earth=(-1,-1,-1),sun=(-1,-1,-1))
    env.settings.thresholds=Thresholds(earth_min_percent=0,sun_min_percent=0,earth_max_blackout_hours=4,sun_max_blackout_hours=4)
    answer=assess(env)
    assert answer['label']=='Favorable'
    assert env.result.solar_power.total_visible_hours==0
    assert all(r['actual']==0 for r in answer['requirements'] if r['unit']=='%')

def test_nonfinite_site_metadata_is_insufficient():
    env=sample_envelope();env.result.site.ground_elevation_m=float('nan')
    assert assess(env)['label']=='Insufficient Data'
