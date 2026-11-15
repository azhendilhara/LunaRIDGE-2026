from pathlib import Path
from io import BytesIO
import json
import pytest
from pypdf import PdfReader
from fastapi.testclient import TestClient
from main import app
from app.schemas.visibility import AnalysisRequest,AnalysisResponse
from app.services.mission_assessment import MissionEnvelope,AssessmentSettings,validate_envelope,ReportConsistencyError
from app.services.mission_report import build_report
ROOT=Path(__file__).resolve().parents[2]

def recorded_envelope():
    baseline=json.loads((ROOT/'docs/validation-step13/baseline.json').read_text())['haworth492']
    req=AnalysisRequest(**baseline['input'])
    result=AnalysisResponse.model_validate_json((ROOT/'docs/validation-step13/haworth492-analysis.json').read_text())
    # Old evidence is not modified: an explicit test envelope binds the known recorded baseline inputs.
    result.submitted_scenario=req.model_copy(deep=True)
    return MissionEnvelope(scenario=req,draft_scenario=req.model_copy(deep=True),result=result,settings=AssessmentSettings())

def test_actual_pdf_content_and_pages(tmp_path):
    env=recorded_envelope();raw=build_report(env);assert raw.startswith(b'%PDF-')
    reader=PdfReader(BytesIO(raw));assert 3<=len(reader.pages)<=5
    text='\n'.join(page.extract_text() for page in reader.pages)
    for expected in ['Challenging','Balanced','137.4330','354.5670','492.0000','2026-11-26T12:00:00Z','2026-11-20T18:34:01Z','horizon_max_distance_km','50.0','Barker','10.3847/PSJ/acf3e1','geometry-based planning','not landing certification','PASS','FAIL']:
        assert expected in text,expected
    assert all(page.extract_text().strip() for page in reader.pages)
    (tmp_path/'report.pdf').write_bytes(raw)

def test_pdf_endpoint_download_and_assessment():
    env=recorded_envelope();client=TestClient(app)
    a=client.post('/api/mission/assessment',json=env.model_dump());assert a.status_code==200;assert a.json()['label']=='Challenging'
    response=client.post('/api/reports/pdf',json=env.model_dump());assert response.status_code==200
    assert response.headers['content-type']=='application/pdf';assert 'attachment' in response.headers['content-disposition']
    assert len(PdfReader(BytesIO(response.content)).pages)>=3

def test_assessment_only_edits_reuse_science_and_pdf_uses_current_requirements(monkeypatch):
    env=recorded_envelope();client=TestClient(app)
    original=env.result.model_dump_json()
    def no_science(*args,**kwargs):
        raise AssertionError('Assessment-only changes must not call NASA or terrain analysis')
    from app.services.visibility_service import VisibilityService
    monkeypatch.setattr(VisibilityService,'analyze_visibility',no_science)
    monkeypatch.setattr(VisibilityService,'get_or_compute_horizon',no_science)
    env.settings=AssessmentSettings(profile='Balanced',thresholds={'earth_min_percent':20,'sun_min_percent':50,'earth_max_blackout_hours':360,'sun_max_blackout_hours':24})
    response=client.post('/api/mission/assessment',json=env.model_dump())
    assert response.status_code==200 and response.json()['label']=='Conditional'
    pdf=client.post('/api/reports/pdf',json=env.model_dump());assert pdf.status_code==200
    text='\n'.join(p.extract_text() for p in PdfReader(BytesIO(pdf.content)).pages)
    for value in ['Conditional','>= 20 %','<= 360 h','137.4330','354.5670']:assert value in text
    assert env.result.model_dump_json()==original

@pytest.mark.parametrize('issue',['stale','incomplete','inconsistent','missing','no_provenance','los'])
def test_no_pdf_for_invalid_or_stale_results(issue):
    env=recorded_envelope()
    if issue=='stale':env.draft_scenario.longitude=12
    if issue=='incomplete':env.result.status='incomplete'
    if issue=='inconsistent':env.result.solar_power.visibility_percentage=100
    if issue=='missing':env.result=None
    if issue=='no_provenance':env.result.submitted_scenario=None
    if issue=='los':env.result.data[0].earth.los_status='VISIBLE'
    response=TestClient(app).post('/api/reports/pdf',json=env.model_dump());assert response.status_code==422
    assert response.headers['content-type'].startswith('application/json')
