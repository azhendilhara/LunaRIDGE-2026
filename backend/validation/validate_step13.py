"""Reproducible live NASA/LOLA validation. Run from backend with ../docs output."""
import sys, json, hashlib, csv, re, math
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import requests
from app.services.horizons_service import HorizonsService
from app.services.terrain_service import TerrainService
from app.services.visibility_service import VisibilityService
from app.schemas.visibility import AnalysisRequest
OUT=Path(__file__).resolve().parents[2]/'docs/validation-step13'
OUT.mkdir(exist_ok=True)
class RecordedHorizons(HorizonsService):
 def query_target(self, **kwargs):
  key=hashlib.sha256(json.dumps(kwargs,sort_keys=True).encode()).hexdigest()[:20]
  path=OUT/f'ephemeris-{key}.json'
  if path.exists(): return json.loads(path.read_text())['records']
  rows=super().query_target(**kwargs)
  path.write_text(json.dumps({'request':kwargs,'retrieved_utc':datetime.now(timezone.utc).isoformat(),'records':rows},indent=2))
  return rows

def diagnostics(result):
 d=result.model_dump(); output={'site':d['site'],'time_range':d['time_range']}
 for target,field in [('earth','earth_comm'),('sun','solar_power')]:
  pts=[p[target] for p in d['data']]
  output[target]={'summary':d[field],**{key:[min(p[key] for p in pts),max(p[key] for p in pts)] for key in ['elevation_deg','azimuth_deg','horizon_elevation_deg','clearance_deg']},'disk_counts':{state:sum(p['disk_occlusion']==state for p in pts) for state in ['FULLY_VISIBLE','PARTIAL_LIMB','FULLY_BLOCKED']}}
  assert abs(d[field]['total_visible_hours']+d[field]['total_blocked_hours']-d[field]['total_interval_hours'])<0.001
  assert abs(sum(w['duration_hours'] for w in d[field]['windows'])-d[field]['total_visible_hours'])<0.001
 return output

BASE={'start_time':'2026-11-06T00:00:00Z','stop_time':'2026-11-26T12:00:00Z','step_size':'1h','observer_height_m':2,'horizon_azimuth_step_deg':1,'horizon_max_distance_km':50}
SCENARIOS={'nobile36':dict(BASE,latitude=-85.25,longitude=53.5,stop_time='2026-11-07T12:00:00Z'),'degerlache492':dict(BASE,latitude=-88.5,longitude=-88.3),'haworth492':dict(BASE,latitude=-87.87,longitude=-5.1)}
def baseline():
 service=VisibilityService(RecordedHorizons(),TerrainService())
 results={}
 for name,payload in SCENARIOS.items():
  request=AnalysisRequest(**payload)
  result=service.analyze_visibility(request)
  (OUT/f'{name}-analysis.json').write_text(result.model_dump_json(indent=2))
  results[name]={'input':request.model_dump(),'diagnostics':diagnostics(result)}
  (OUT/'baseline.json').write_text(json.dumps(results,indent=2))
  print(name,[(t,results[name]['diagnostics'][t]['summary']['visibility_percentage'],results[name]['diagnostics'][t]['elevation_deg'],results[name]['diagnostics'][t]['horizon_elevation_deg'],results[name]['diagnostics'][t]['clearance_deg']) for t in ['earth','sun']],flush=True)
 return service,results

def reference_and_terrain(service, results):
 import numpy as np
 import rasterio
 from pyproj import Transformer
 from app.schemas.terrain import HorizonProfileRequest
 reference={}; terrain_checks={}
 for name,base in results.items():
  payload=base['input']; diag=base['diagnostics']; step='18h' if name=='nobile36' else '246h'
  reference[name]={}
  for target,command in [('earth','399'),('sun','10')]:
   params={'format':'text','COMMAND':command,'CENTER':'coord@301','COORD_TYPE':'GEODETIC','SITE_COORD':f"{payload['longitude']},{payload['latitude']},{diag['site']['total_altitude_m']/1000}",'EPHEM_TYPE':'OBSERVER','START_TIME':payload['start_time'].replace('T',' ').replace('Z',''),'STOP_TIME':payload['stop_time'].replace('T',' ').replace('Z',''),'STEP_SIZE':step,'QUANTITIES':'4','CSV_FORMAT':'NO','TIME_TYPE':'UT','TIME_DIGITS':'SECONDS','APPARENT':'AIRLESS','ANG_FORMAT':'DEG','EXTRA_PREC':'YES','OBJ_DATA':'YES'}
   # Quote values separately from URL encoding, matching NASA's documented API grammar.
   params={k:(v if k=='format' else "'"+v+"'") for k,v in params.items()}
   path=OUT/f'{name}-{target}-reference.txt'
   if not path.exists():
    response=requests.get('https://ssd.jpl.nasa.gov/api/horizons.api',params=params,timeout=60); response.raise_for_status(); path.write_text(response.text)
   text=path.read_text(); rows=[]
   for line in text.split('$$SOE')[1].split('$$EOE')[0].splitlines():
    match=re.search(r'(\d{4}-[A-Za-z]{3}-\d{2} \d{2}:\d{2}:\d{2})',line)
    if not match: continue
    values=re.findall(r'[-+]?\d+\.\d+',line[match.end():])
    ts=datetime.strptime(match.group(),'%Y-%b-%d %H:%M:%S').strftime('%Y-%m-%dT%H:%M:%SZ')
    pt=next(p[target] for p in json.loads((OUT/f'{name}-analysis.json').read_text())['data'] if p['timestamp']==ts)
    az,el=map(float,values[-2:]); rows.append({'timestamp':ts,'reference_azimuth':az,'reference_elevation':el,'app_azimuth':pt['azimuth_deg'],'app_elevation':pt['elevation_deg'],'azimuth_difference_deg':((pt['azimuth_deg']-az+180)%360)-180,'elevation_difference_deg':pt['elevation_deg']-el})
   reference[name][target]={'parameters':params,'values':rows,'header':[line for line in text.splitlines() if any(word in line for word in ['Center radii','Center geodetic','Center pole','Target body','Center body','Start time','Stop  time'])]}
  # Independent spherical forward-geodesic rays and direct ECEF dot-product skyline.
  terrain=service.terrain_service; terrain._ensure_loaded(); ds=terrain._dataset
  raster=ds.read(1,masked=True).astype(float).filled(np.nan)
  lat,lon=np.radians([payload['latitude'],payload['longitude']]); az=np.radians(np.arange(360))[:,None]
  distances=np.arange(80,50000+1,80); delta=distances/1737400
  lat2=np.arcsin(np.sin(lat)*np.cos(delta)+np.cos(lat)*np.sin(delta)*np.cos(az))
  lon2=lon+np.arctan2(np.sin(az)*np.sin(delta)*np.cos(lat),np.cos(delta)-np.sin(lat)*np.sin(lat2))
  x,y=terrain._trans_to_proj.transform(np.degrees(lon2),np.degrees(lat2)); col,row=(~ds.transform)*(x,y); row=np.floor(row).astype(int); col=np.floor(col).astype(int)
  heights=raster[row,col]; assert np.isfinite(heights).all()
  # Relative Cartesian vectors projected onto local up and travel tangent.
  radius=1737400+heights; ro=1737400+diag['site']['total_altitude_m']
  up=np.array([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)])
  xyz=np.stack([radius*np.cos(lat2)*np.cos(lon2),radius*np.cos(lat2)*np.sin(lon2),radius*np.sin(lat2)],axis=-1)
  relative=xyz-ro*up
  vertical=relative@up
  horizontal=np.linalg.norm(relative-vertical[:,:,None]*up,axis=-1)
  angles=np.degrees(np.arctan2(vertical,horizontal))
  skyline=np.max(angles,axis=1)
  prod=terrain.get_horizon_profile(HorizonProfileRequest(latitude=payload['latitude'],longitude=payload['longitude'],observer_height_m=payload['observer_height_m'],azimuth_step_deg=1,max_distance_km=50))
  (OUT/f'{name}-skyline.json').write_text(json.dumps({'production':prod.model_dump(),'independent_geodesic_ecef_skyline_deg':skyline.tolist()},indent=2))
  diff=skyline-np.array([p.horizon_elevation_deg for p in prod.profile])
  terrain_checks[name]={'method':'spherical forward geodesic, independently sampled raster, exact radial dot-product angles','max_abs_skyline_difference_deg':float(np.max(np.abs(diff))),'rms_difference_deg':float(np.sqrt(np.mean(diff**2))),'cardinal_skyline_deg':{str(a):float(skyline[a]) for a in [0,90,180,270]},'independent_target_diagnostics':{}}
  analysis=json.loads((OUT/f'{name}-analysis.json').read_text())
  for target in ['earth','sun']:
   pts=analysis['data']; clearance=np.array([p[target]['elevation_deg'] for p in pts])-np.interp([p[target]['azimuth_deg'] for p in pts],np.arange(361),np.append(skyline,skyline[0]))
   terrain_checks[name]['independent_target_diagnostics'][target]={'clearance_range_deg':[float(clearance.min()),float(clearance.max())],'visible_sample_count':int(sum(clearance>0)), 'independent_visible_hours':float(sum(1 if a>0 and b>0 else 0 if a<=0 and b<=0 else b/(b-a) if a<=0 else a/(a-b) for a,b in zip(clearance,clearance[1:])))}
  (OUT/'references.json').write_text(json.dumps(reference,indent=2)); (OUT/'terrain-independent.json').write_text(json.dumps(terrain_checks,indent=2))
  print('reference and geodesic terrain',name,terrain_checks[name]['max_abs_skyline_difference_deg'],flush=True)

def sensitivity(service):
 output={}
 for name,payload in SCENARIOS.items():
  output[name]={}
  variants={'baseline':{},'mast20m':{'observer_height_m':20},'mast100m':{'observer_height_m':100},'azimuth0.5deg':{'horizon_azimuth_step_deg':0.5},'azimuth5deg':{'horizon_azimuth_step_deg':5},'radius25km':{'horizon_max_distance_km':25},'radius100km':{'horizon_max_distance_km':100},'time10min':{'step_size':'10m'},'time6h':{'step_size':'6h'},'dates_plus14d':{'start_time':'2026-11-20T00:00:00Z','stop_time':'2026-11-21T12:00:00Z' if name=='nobile36' else '2026-12-10T12:00:00Z'}}
  for variant,updates in variants.items():
   path=OUT/f'{name}-{variant}-sensitivity.json'
   if path.exists(): output[name][variant]=json.loads(path.read_text()); continue
   req=AnalysisRequest(**dict(payload,**updates)); result=service.analyze_visibility(req); diag=diagnostics(result)
   data={'input':req.model_dump(),'site':diag['site'],'time_range':diag['time_range'],'targets':{t:{'percent':diag[t]['summary']['visibility_percentage'],'visible_hours':diag[t]['summary']['total_visible_hours'],'clearance_range_deg':diag[t]['clearance_deg'],'windows':diag[t]['summary']['window_count']} for t in ['earth','sun']}}
   path.write_text(json.dumps(data,indent=2)); output[name][variant]=data
   print('sensitivity',name,variant,[(t,data['targets'][t]['percent']) for t in ['earth','sun']],flush=True)
  (OUT/'sensitivity.json').write_text(json.dumps(output,indent=2))


def disk_references(results):
 output={}
 for name,base in results.items():
  p=base['input']; alt=base['diagnostics']['site']['total_altitude_m']/1000
  output[name]={}
  for target,command in [('earth','399'),('sun','10')]:
   params={'format':'text','COMMAND':command,'EPHEM_TYPE':'OBSERVER','CENTER':'coord@301','COORD_TYPE':'GEODETIC','SITE_COORD':f"{p['longitude']},{p['latitude']},{alt}",'START_TIME':p['start_time'].replace('T',' ').replace('Z',''),'STOP_TIME':p['stop_time'].replace('T',' ').replace('Z',''),'STEP_SIZE':'18h' if name=='nobile36' else '246h','QUANTITIES':'13','CSV_FORMAT':'NO','TIME_TYPE':'UT','TIME_DIGITS':'SECONDS'}
   params={k:(v if k=='format' else "'"+v+"'") for k,v in params.items()}
   path=OUT/f'{name}-{target}-disk-reference.txt'
   if not path.exists():
    response=requests.get('https://ssd.jpl.nasa.gov/api/horizons.api',params=params,timeout=60);response.raise_for_status();path.write_text(response.text)
   text=path.read_text();values=[]
   for line in text.split('$$SOE')[1].split('$$EOE')[0].splitlines():
    match=re.search(r'\d{4}-[A-Za-z]{3}-\d{2} \d{2}:\d{2}:\d{2}',line)
    if match:
     numbers=re.findall(r'[-+]?\d+\.\d+',line[match.end():]);values.append({'utc':match.group(),'angular_radius_deg':float(numbers[-1])/7200})
   output[name][target]={'parameters':params,'values':values}
  (OUT/'disk-references.json').write_text(json.dumps(output,indent=2))
  print('finite disk reference',name,flush=True)

if __name__=='__main__':
 service,results=baseline()
 reference_and_terrain(service,results)
 sensitivity(service)
 disk_references(results)
