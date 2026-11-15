"""Deployment policy around the existing engine; no scientific equations live here."""
from dataclasses import dataclass
from pathlib import Path
from contextlib import contextmanager
import os,re,threading,time,math
from collections import OrderedDict,deque
from urllib.parse import urlsplit
from fastapi import HTTPException

ROOT=Path(__file__).resolve().parents[2]
DEFAULT_DEM=ROOT/'data/lunar_dem/LDEM_80S_80MPP_ADJ.TIF'
def dem_path():return Path(os.environ.get('DEM_PATH') or DEFAULT_DEM).expanduser().resolve()
def integer(env,key,default,low,high):
    value=int(env.get(key,str(default)))
    if not low<=value<=high:raise ValueError(f'{key} must be {low}–{high}.')
    return value

@dataclass(frozen=True)
class Settings:
    production:bool
    origins:tuple[str,...]
    user_agent:str
    max_samples:int
    max_hours:int
    max_terrain:int
    body_bytes:int
    rate_per_ip:int
    global_per_minute:int
    science_per_ip:int
    science_global:int
    @classmethod
    def load(cls,env=None):
        env=os.environ if env is None else env
        mode=env.get('LUNARIDGE_ENV','development')
        if mode not in ('development','production'):raise ValueError('LUNARIDGE_ENV must be development or production.')
        prod=mode=='production'
        raw=env.get('CORS_ORIGINS','' if prod else 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5175,http://127.0.0.1:5175,http://127.0.0.1:5176')
        origins=tuple(dict.fromkeys(o.strip().rstrip('/') for o in raw.split(',') if o.strip()))
        if not origins:raise ValueError('Set explicit CORS_ORIGINS before production startup.')
        for origin in origins:
            p=urlsplit(origin)
            _=p.port
            if '*' in origin or p.scheme not in ('https','http') or not p.hostname or p.username or p.password or p.path or p.query or p.fragment or any(c.isspace() for c in origin):raise ValueError('CORS_ORIGINS must contain exact HTTP(S) origins, without paths, credentials or wildcards.')
            if p.scheme=='http' and p.hostname not in ('localhost','127.0.0.1','::1'):raise ValueError('Non-loopback CORS origins must use HTTPS.')
            if prod and re.search(r'YOUR_|REPLACE|example\.invalid',origin,re.I):raise ValueError('Replace the CORS origin placeholder with the real frontend origin.')
        ua=env.get('NASA_USER_AGENT','LunaRIDGE/0.5.0 (local development; contact unconfigured)')
        if '\n' in ua or '\r' in ua or len(ua)>300:raise ValueError('Invalid NASA_USER_AGENT header.')
        if prod and ('LunaRIDGE/' not in ua or not re.search(r'https://[^\s)]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}',ua) or re.search(r'REPLACE|YOUR_|example\.(com|org|invalid)|unconfigured',ua,re.I)):
            raise ValueError('Set NASA_USER_AGENT to LunaRIDGE/version plus a genuine owner-provided public contact email or HTTPS URL.')
        if prod and env.get('WEB_CONCURRENCY','1')!='1':raise ValueError('This bounded service requires one worker and one instance; distributed admission control is not configured.')
        return cls(prod,origins,ua,integer(env,'MAX_SAMPLES',2000 if prod else 20000,2,20000),integer(env,'MAX_MISSION_HOURS',720 if prod else 87600,1,87600),integer(env,'MAX_TERRAIN_SAMPLES',1000000 if prod else 10000000,1000,10000000),integer(env,'MAX_BODY_BYTES',4000000 if prod else 16000000,100000,16000000),integer(env,'REQUESTS_PER_IP_MINUTE',120 if prod else 1000,1,1000),integer(env,'REQUESTS_GLOBAL_MINUTE',600 if prod else 10000,1,10000),integer(env,'SCIENCE_PER_IP_MINUTE',12 if prod else 1000,1,1000),integer(env,'SCIENCE_GLOBAL_MINUTE',30 if prod else 10000,1,10000))

class Admission:
    def __init__(self):
        self.science=threading.BoundedSemaphore(1);self.reports=threading.BoundedSemaphore(2)
    @contextmanager
    def slot(self,reports=False):
        gate=self.reports if reports else self.science
        if not gate.acquire(blocking=False):raise HTTPException(503,'Server compute slot is busy. Retry after 3 seconds; no analysis was started.',headers={'Retry-After':'3'})
        try:yield
        finally:gate.release()

def bound_time(request,settings):
    from app.schemas.visibility import parse_utc_datetime
    hours=(parse_utc_datetime(request.stop_time)-parse_utc_datetime(request.start_time)).total_seconds()/3600
    match=re.fullmatch(r'(\d+)\s*(m|min|h|d)',request.step_size.strip(),re.I)
    if not match:raise HTTPException(422,'Unsupported time sampling.')
    step=int(match[1])*{'m':1/60,'min':1/60,'h':1,'d':24}[match[2].lower()]
    if not math.isfinite(hours) or hours<=0 or hours>settings.max_hours or step<=0 or math.ceil(hours/step)+1>settings.max_samples:
        raise HTTPException(422,f'Request exceeds server budget: at most {settings.max_hours} hours and {settings.max_samples} estimated time points. Increase sampling interval or shorten the mission.')
def bound_terrain(request,settings):
    spacing=getattr(request,'horizon_azimuth_step_deg',getattr(request,'azimuth_step_deg',1))
    radius=getattr(request,'horizon_max_distance_km',getattr(request,'max_distance_km',50))
    radial=getattr(request,'sample_step_m',80)
    span=getattr(request,'azimuth_end_deg',360)-getattr(request,'azimuth_start_deg',0)
    values=[request.latitude,request.longitude,request.observer_height_m,spacing,radius,radial,span]
    if not all(math.isfinite(v) for v in values) or spacing<=0 or radial<=0:raise HTTPException(422,'Scientific input settings must be finite.')
    if (math.floor((span+.001)/spacing)+1)*math.ceil(radius*1000/radial)>settings.max_terrain:raise HTTPException(422,'Terrain sampling exceeds the server budget. Increase azimuth spacing or reduce radius.')

class RequestPolicy:
    """Body/rate bounds, using the socket peer only (never trusting spoofed X-Forwarded-For)."""
    def __init__(self,app,settings):self.app=app;self.settings=settings;self.peers=OrderedDict();self.global_times={False:deque(),True:deque()};self.lock=threading.Lock()
    def allowed(self,peer,science=False):
        now=time.monotonic()
        with self.lock:
            global_times=self.global_times[science]
            while global_times and global_times[0]<=now-60:global_times.popleft()
            key=(peer,science);times=self.peers.pop(key,deque())
            while times and times[0]<=now-60:times.popleft()
            self.peers[key]=times
            if len(self.peers)>1024:self.peers.popitem(last=False)
            if len(times)>=(self.settings.science_per_ip if science else self.settings.rate_per_ip) or len(global_times)>=(self.settings.science_global if science else self.settings.global_per_minute):return False
            times.append(now);global_times.append(now);return True
    async def __call__(self,scope,receive,send):
        if scope['type']!='http':return await self.app(scope,receive,send)
        from starlette.responses import JSONResponse
        if scope.get('path','').startswith('/api/') and scope['method']!='OPTIONS':
            peer=(scope.get('client') or ('unknown',0))[0]
            if not self.allowed(peer):return await JSONResponse({'detail':'Request rate limit reached. Retry after 60 seconds.'},429,headers={'Retry-After':'60'})(scope,receive,send)
            if scope['path'] in ('/api/analyze','/api/ephemeris','/api/terrain/horizon') and not self.allowed(peer,True):return await JSONResponse({'detail':'Science request rate limit reached. Retry after 60 seconds.'},429,headers={'Retry-After':'60'})(scope,receive,send)
            if scope['method']=='POST':
                chunks=[];size=0
                while True:
                    message=await receive()
                    if message['type']=='http.disconnect':return
                    chunk=message.get('body',b'');size+=len(chunk)
                    if size>self.settings.body_bytes:return await JSONResponse({'detail':'Request body exceeds the server limit.'},413)(scope,receive,send)
                    chunks.append(chunk)
                    if not message.get('more_body',False):break
                sent=False
                async def replay():
                    nonlocal sent
                    if not sent:sent=True;return {'type':'http.request','body':b''.join(chunks),'more_body':False}
                    return await receive()
                return await self.app(scope,replay,send)
        return await self.app(scope,receive,send)
