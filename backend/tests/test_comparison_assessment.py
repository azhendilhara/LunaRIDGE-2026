"""Comparison clients reuse the established per-scenario service and identical criteria."""
from pathlib import Path
import json
import pytest
from fastapi.testclient import TestClient
from main import app
from app.schemas.visibility import AnalysisRequest,AnalysisResponse
from app.services.mission_assessment import MissionEnvelope,AssessmentSettings
from app.services.visibility_service import VisibilityService
ROOT=Path(__file__).resolve().parents[2]

def recorded():
    baseline=json.loads((ROOT/'docs/validation-step13/baseline.json').read_text())['haworth492']
    req=AnalysisRequest(**baseline['input'])
    result=AnalysisResponse.model_validate_json((ROOT/'docs/validation-step13/haworth492-analysis.json').read_text())
    result.submitted_scenario=req.model_copy(deep=True)
    return MissionEnvelope(scenario=req,draft_scenario=req.model_copy(deep=True),result=result)

@pytest.mark.parametrize('count',[2,3,4,5])
@pytest.mark.parametrize('profile',['Solar Priority','Communication Priority','Balanced'])
def test_same_criteria_for_all_scenarios_without_new_science(count,profile,monkeypatch):
    def forbidden(*args,**kwargs):raise AssertionError('Assessment must not call NASA or terrain analysis')
    monkeypatch.setattr(VisibilityService,'analyze_visibility',forbidden)
    monkeypatch.setattr(VisibilityService,'get_or_compute_horizon',forbidden)
    env=recorded();env.settings=AssessmentSettings(profile=profile)
    client=TestClient(app);responses=[client.post('/api/mission/assessment',json=env.model_dump()).json() for _ in range(count)]
    assert all(r==responses[0] for r in responses)
    assert responses[0]['label']=='Challenging'
    assert responses[0]['exportable'] is True

@pytest.mark.parametrize('thresholds,status,label',[
    ({'earth_min_percent':0,'sun_min_percent':0,'earth_max_blackout_hours':1000,'sun_max_blackout_hours':1000},'success','Favorable'),
    ({'earth_min_percent':20,'sun_min_percent':50,'earth_max_blackout_hours':360,'sun_max_blackout_hours':24},'success','Conditional'),
    (None,'success','Challenging'),(None,'incomplete','Insufficient Data')])
def test_shared_assessment_labels_preserve_real_zero_sunlight(thresholds,status,label):
    env=recorded();env.settings=AssessmentSettings(profile='Balanced',thresholds=thresholds);env.result.status=status
    response=TestClient(app).post('/api/mission/assessment',json=env.model_dump())
    assert response.status_code==200 and response.json()['label']==label
    assert env.result.solar_power.total_visible_hours==0
