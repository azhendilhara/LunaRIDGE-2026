import dataclasses
import json
import pytest
import requests
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient
from app.deployment import Settings,Admission,RequestPolicy,bound_time,bound_terrain
from app.jpl_transport import JplTransport
from app.schemas.visibility import AnalysisRequest

def request(**changes):
    values=dict(latitude=-85.25,longitude=53.5,start_time='2026-11-06 00:00',stop_time='2026-11-07 12:00',step_size='1 h',observer_height_m=2)
    return AnalysisRequest(**(values|changes))

@pytest.mark.parametrize('origin',['*','https://host.org/path','http://remote.org','https://user:pass@host.org','https://host.org?key=1'])
def test_invalid_cors(origin):
    with pytest.raises(ValueError):Settings.load({'CORS_ORIGINS':origin})

def test_production_contact_and_origin_are_required():
    with pytest.raises(ValueError):Settings.load({'LUNARIDGE_ENV':'production'})
    with pytest.raises(ValueError):Settings.load({'LUNARIDGE_ENV':'production','CORS_ORIGINS':'https://frontend.org'})

def test_production_settings_and_worker_validation_use_synthetic_contact_only():
    # Reserved .test domain; configuration unit test only, never sent to NASA.
    env={'LUNARIDGE_ENV':'production','CORS_ORIGINS':'https://frontend.test','NASA_USER_AGENT':'LunaRIDGE/0.5.0 (unit-tests-only@lunaridge.test)'}
    settings=Settings.load(env)
    assert settings.max_samples==2000 and settings.science_per_ip==12
    with pytest.raises(ValueError):Settings.load(env|{'WEB_CONCURRENCY':'2'})
    with pytest.raises(ValueError):Settings.load(env|{'NASA_USER_AGENT':'LunaRIDGE/0.5.0 (YOUR_PUBLIC_CONTACT)'})

def test_scientific_budget_keeps_normal_scenario_and_rejects_excess():
    settings=dataclasses.replace(Settings.load({}),max_samples=2000,max_hours=720,max_terrain=1000000)
    bound_time(request(),settings);bound_terrain(request(),settings)
    with pytest.raises(HTTPException):bound_time(request(step_size='1 m',stop_time='2026-11-26 12:00'),settings)
    with pytest.raises(HTTPException):bound_time(request(stop_time='2027-01-01 00:00'),settings)
    with pytest.raises(HTTPException):bound_terrain(request(horizon_azimuth_step_deg=.1,horizon_max_distance_km=100),settings)

def test_admission_releases_on_error_and_does_not_queue_work():
    admission=Admission()
    with admission.slot():
        with pytest.raises(HTTPException) as exc:
            with admission.slot():pass
        assert exc.value.status_code==503
    with pytest.raises(ValueError):
        with admission.slot():raise ValueError()
    with admission.slot():pass

def test_body_rate_and_health_exemption():
    app=FastAPI();settings=dataclasses.replace(Settings.load({}),body_bytes=10,rate_per_ip=2)
    app.add_middleware(RequestPolicy,settings=settings)
    @app.post('/api/test')
    def endpoint():return {'ok':True}
    @app.get('/health')
    def health():return {'status':'ok'}
    client=TestClient(app)
    assert client.post('/api/test',content='x'*11).status_code==413
    assert client.post('/api/test',content='{}').status_code==200
    assert client.post('/api/test',content='{}',headers={'X-Forwarded-For':'different'}).status_code==429
    assert client.get('/health').status_code==200

def test_science_quota_is_separate_from_map_requests():
    settings=dataclasses.replace(Settings.load({}),science_per_ip=1)
    policy=RequestPolicy(None,settings)
    assert policy.allowed('local',True)
    assert not policy.allowed('local',True)
    assert policy.allowed('local',False)

def test_jpl_cache_exact_parameters_ttl_size_and_identity(monkeypatch):
    calls=[];now=[0]
    def get(url,**kwargs):
        calls.append(kwargs);response=requests.Response();response.status_code=200
        response._content=json.dumps({'result':'response fixture','signature':{'version':'1.2'}}).encode();return response
    monkeypatch.setattr(requests,'get',get)
    transport=JplTransport('unit-test only',clock=lambda:now[0],entries=1)
    url='https://ssd.jpl.nasa.gov/api/horizons.api'
    assert transport.get(url,{'COMMAND':'399'},30).json()['result']=='response fixture'
    transport.get(url,{'COMMAND':'399'},30);assert len(calls)==1
    transport.get(url,{'COMMAND':'10'},30);assert len(calls)==2 and len(transport.cache)==1
    now[0]=301;transport.get(url,{'COMMAND':'10'},30);assert len(calls)==3
    assert calls[0]['headers']['User-Agent']=='unit-test only'
    with pytest.raises(ValueError):transport.get('https://other.org',{},30)

def test_jpl_errors_are_not_cached(monkeypatch):
    calls=[]
    def get(*args,**kwargs):
        calls.append(1);response=requests.Response();response.status_code=200;response._content=b'{"error":"not available"}';return response
    monkeypatch.setattr(requests,'get',get)
    transport=JplTransport('unit-test only')
    for _ in range(2):transport.get('https://ssd.jpl.nasa.gov/api/horizons.api',{},30)
    assert len(calls)==2 and not transport.cache

def test_unknown_nasa_signature_stops_before_parsing(monkeypatch):
    from app.services.horizons_service import HorizonsAPIError
    response=requests.Response();response.status_code=200;response._content=b'{"result":"table","signature":{"version":"unreviewed"}}'
    monkeypatch.setattr(requests,'get',lambda *a,**k:response)
    with pytest.raises(HorizonsAPIError,match='version changed'):
        JplTransport('unit test only').get('https://ssd.jpl.nasa.gov/api/horizons.api',{},30)

def test_nasa_rate_limit_stops_repeated_network_requests(monkeypatch):
    from app.services.horizons_service import HorizonsAPIError
    calls=[];now=[0]
    def get(*args,**kwargs):
        calls.append(1);response=requests.Response();response.status_code=429;response.headers['Retry-After']='120';return response
    monkeypatch.setattr(requests,'get',get)
    transport=JplTransport('unit test only',clock=lambda:now[0]);url='https://ssd.jpl.nasa.gov/api/horizons.api'
    assert transport.get(url,{},30).status_code==429
    with pytest.raises(HorizonsAPIError,match='cooldown'):transport.get(url,{},30)
    assert len(calls)==1
    now[0]=121;assert transport.get(url,{},30).status_code==429 and len(calls)==2

def test_failed_download_never_accepts_partial(tmp_path,monkeypatch):
    import download_dem
    class Response:
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def raise_for_status(self):pass
        def iter_content(self,**kwargs):yield b'partial invalid DEM'
    monkeypatch.setattr(download_dem.requests,'get',lambda *args,**kwargs:Response())
    destination=tmp_path/'dem.TIF'
    with pytest.raises(ValueError):download_dem.download_dem(destination)
    assert not destination.exists() and not list(tmp_path.glob('*.part'))

def test_health_fails_with_missing_dem(monkeypatch,tmp_path):
    import main
    monkeypatch.setenv('DEM_PATH',str(tmp_path/'missing.TIF'))
    assert TestClient(main.app).get('/health').status_code==503

def test_startup_fails_before_accepting_missing_terrain(monkeypatch,tmp_path):
    import main
    monkeypatch.setenv('DEM_PATH',str(tmp_path/'missing.TIF'))
    with pytest.raises(RuntimeError,match='LOLA readiness failed'):
        with TestClient(main.app):pass

@pytest.mark.parametrize('body',[b'[]',b'not json',b'{"result":"table","signature":null}'])
def test_unexpected_nasa_json_fails_closed(monkeypatch,body):
    from app.services.horizons_service import HorizonsAPIError
    response=requests.Response();response.status_code=200;response._content=body
    monkeypatch.setattr(requests,'get',lambda *a,**k:response)
    with pytest.raises(HorizonsAPIError):JplTransport('unit test only').get('https://ssd.jpl.nasa.gov/api/horizons.api',{},30)
