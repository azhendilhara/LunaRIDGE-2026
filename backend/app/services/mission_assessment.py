"""Geometry-only planning assessments; illustrative requirements, never success probabilities."""
import json
import math
from pathlib import Path
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.visibility import AnalysisRequest, AnalysisResponse, parse_utc_datetime
from app.services.visibility_service import VisibilityService

PROFILES = json.loads((Path(__file__).resolve().parents[3]/'shared/mission_profiles.json').read_text())
class Thresholds(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra='forbid')
    earth_min_percent: float = Field(ge=0, le=100)
    sun_min_percent: float = Field(ge=0, le=100)
    earth_max_blackout_hours: float = Field(ge=0, le=100000)
    sun_max_blackout_hours: float = Field(ge=0, le=100000)
class AssessmentSettings(BaseModel):
    profile: Literal['Solar Priority','Communication Priority','Balanced'] = 'Balanced'
    thresholds: Thresholds | None = None
    def resolved(self):
        return self.thresholds or Thresholds(**PROFILES[self.profile])
class MissionEnvelope(BaseModel):
    scenario: AnalysisRequest | None = None
    result: AnalysisResponse | None = None
    draft_scenario: AnalysisRequest | None = None
    settings: AssessmentSettings = Field(default_factory=AssessmentSettings)

class ReportConsistencyError(ValueError): pass

def validate_envelope(envelope: MissionEnvelope):
    req, result = envelope.scenario, envelope.result
    if req is None or result is None: raise ReportConsistencyError('No completed submitted scenario is available.')
    if result.status != 'success': raise ReportConsistencyError('Coverage or analysis is incomplete; no suitability judgment is supported.')
    if envelope.draft_scenario and envelope.draft_scenario.model_dump() != req.model_dump():
        raise ReportConsistencyError('Draft inputs differ from the submitted scenario. Results are stale; rerun analysis.')
    if result.submitted_scenario is None:
        raise ReportConsistencyError('Result lacks submitted-scenario provenance. Restart the updated backend and rerun analysis.')
    if result.submitted_scenario.model_dump() != req.model_dump():
        raise ReportConsistencyError('Submitted scenario and result provenance disagree.')
    site=result.site
    if not all(math.isfinite(v) for v in [site.latitude,site.longitude,site.ground_elevation_m,site.observer_height_m,site.total_altitude_m,result.time_range.elapsed_hours]):
        raise ReportConsistencyError('Observer or interval metadata are non-finite.')
    if any(abs(a-b)>1e-7 for a,b in [(site.latitude,req.latitude),(site.longitude,req.longitude),(site.observer_height_m,req.observer_height_m),(site.total_altitude_m,site.ground_elevation_m+site.observer_height_m)]):
        raise ReportConsistencyError('Result observer geometry disagrees with the submitted scenario.')
    t=result.time_range
    if t.requested_start_time != req.start_time or t.requested_stop_time != req.stop_time or t.step_size != req.step_size:
        raise ReportConsistencyError('Requested time bounds or sampling settings disagree.')
    if len(result.data)<2 or len(result.data)>20000 or t.total_points != len(result.data):
        raise ReportConsistencyError('Complete sample diagnostics are required (2 to 20,000 samples per export).')
    times=[parse_utc_datetime(p.timestamp) for p in result.data]
    if any(b<=a for a,b in zip(times,times[1:])) or times[0]<parse_utc_datetime(req.start_time) or times[-1]>parse_utc_datetime(req.stop_time):
        raise ReportConsistencyError('Sample timestamps are not ordered within the requested interval.')
    elapsed=(times[-1]-times[0]).total_seconds()/3600
    if elapsed<=0 or abs(elapsed-t.elapsed_hours)>0.0001 or parse_utc_datetime(t.start_time)!=times[0] or parse_utc_datetime(t.stop_time)!=times[-1]:
        raise ReportConsistencyError('Evaluated interval is inconsistent with sample timestamps.')
    service=VisibilityService()
    for target,summary in [('earth',result.earth_comm),('sun',result.solar_power)]:
        for point in result.data:
            p=getattr(point,target)
            values=[p.azimuth_deg,p.elevation_deg,p.horizon_elevation_deg,p.clearance_deg]
            if not all(math.isfinite(v) for v in values) or abs(p.clearance_deg-(p.elevation_deg-p.horizon_elevation_deg))>1e-7:
                raise ReportConsistencyError('Paired clearance diagnostics are missing or inconsistent.')
            expected=service.evaluate_target_visibility(p.azimuth_deg,p.elevation_deg,p.horizon_elevation_deg,target,0)
            if p.visible != expected.visible or p.disk_occlusion != expected.disk_occlusion or p.los_status != expected.los_status:
                raise ReportConsistencyError('Target visibility or disk classification contradicts clearance.')
        expected=service.identify_windows_and_summary(result.data,target,elapsed)
        for key in ['total_visible_hours','total_blocked_hours','total_interval_hours','visibility_percentage','full_disk_visible_hours','partial_limb_hours','fully_blocked_hours','longest_window_hours','longest_blackout_hours','window_count']:
            actual=getattr(summary,key)
            if not math.isfinite(actual) or abs(actual-getattr(expected,key))>0.00011:
                raise ReportConsistencyError(f'{target} summary is inconsistent with sample diagnostics: {key}.')
        if summary.windows != expected.windows: raise ReportConsistencyError(f'{target} windows are inconsistent with sampled clearance.')
    return req,result

def assess(envelope: MissionEnvelope):
    settings=envelope.settings; thresholds=settings.resolved()
    try: req,result=validate_envelope(envelope)
    except (ValueError,TypeError,OverflowError) as exc:
        return {'label':'Insufficient Data','profile':settings.profile,'thresholds':thresholds.model_dump(),'requirements':[], 'reason':str(exc),'exportable':False}
    requirements=[]
    for target,summary in [('earth',result.earth_comm),('sun',result.solar_power)]:
        minimum=getattr(thresholds,f'{target}_min_percent'); maximum=getattr(thresholds,f'{target}_max_blackout_hours')
        primary=settings.profile=='Balanced' or (target=='sun' and settings.profile=='Solar Priority') or (target=='earth' and settings.profile=='Communication Priority')
        requirements.extend([
          {'key':f'{target}_visibility','target':target,'title':f'{target.title()} center visibility','actual':summary.visibility_percentage,'threshold':minimum,'relation':'>=','unit':'%','passed':summary.visibility_percentage>=minimum,'primary':primary},
          {'key':f'{target}_blackout','target':target,'title':f'{target.title()} longest center-blocked interval','actual':summary.longest_blackout_hours,'threshold':maximum,'relation':'<=','unit':'h','passed':summary.longest_blackout_hours<=maximum,'primary':primary}])
    groups={target:all(r['passed'] for r in requirements if r['target']==target) for target in ['earth','sun']}
    if all(groups.values()): label='Favorable'
    elif settings.profile=='Balanced': label='Conditional' if any(groups.values()) else 'Challenging'
    else: label='Conditional' if groups['sun' if settings.profile=='Solar Priority' else 'earth'] else 'Challenging'
    return {'label':label,'profile':settings.profile,'thresholds':thresholds.model_dump(),'requirements':requirements,'reason':{
      'Favorable':'All four configured geometric requirements pass.',
      'Conditional':'The priority target requirements pass, but other requirements fail.' if settings.profile!='Balanced' else 'One target meets both requirements; the other does not.',
      'Challenging':'At least one priority-target requirement fails.' if settings.profile!='Balanced' else 'Neither target meets both configured requirements.'}[label], 'exportable':True}
