"""Build static examples only from hash-checked Step 13 evidence. No network."""
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from app.schemas.visibility import AnalysisRequest,AnalysisResponse
from app.services.mission_assessment import MissionEnvelope,AssessmentSettings,assess
EVIDENCE=ROOT/'docs/validation-step13'
OUT=ROOT/'frontend/public/examples'
EXAMPLES=[('haworth492','Haworth area · contact trade-off'),('nobile36','Nobile area · short-window constraints'),('degerlache492','de Gerlache area · terrain constraints')]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def build():
    manifest=json.loads((EVIDENCE/'manifest.json').read_text());baseline=json.loads((EVIDENCE/'baseline.json').read_text());items=[];OUT.mkdir(exist_ok=True)
    for id,name in EXAMPLES:
        source=id+'-analysis.json';path=EVIDENCE/source;digest=sha(path)
        if digest!=manifest['files'][source]:raise ValueError('Saved evidence hash mismatch: '+source)
        req=AnalysisRequest(**baseline[id]['input']);result=AnalysisResponse.model_validate_json(path.read_bytes())
        # Explicit archive adapter: bind separately recorded exact inputs for current guards.
        # Original evidence is NEVER modified, and scientific result fields are unchanged.
        result.submitted_scenario=req.model_copy(deep=True)
        settings=AssessmentSettings(profile='Balanced',thresholds={'earth_min_percent':20,'sun_min_percent':50,'earth_max_blackout_hours':400,'sun_max_blackout_hours':24})
        verdict=assess(MissionEnvelope(scenario=req,draft_scenario=req,result=result,settings=settings))
        if not verdict['exportable']:raise ValueError(verdict['reason'])
        response=(result.model_dump_json()+'\n').encode();(OUT/(id+'.json')).write_bytes(response)
        items.append({'id':id,'name':name,'scenario':req.model_dump(),'settings':{'profile':settings.profile,'thresholds':settings.resolved().model_dump()},'assessment':verdict,'earth':result.earth_comm.model_dump(),'sun':result.solar_power.model_dump(),'evaluated':result.time_range.model_dump(),'source':{'path':'docs/validation-step13/'+source,'sha256':digest,'baseline_sha256':sha(EVIDENCE/'baseline.json'),'dem_sha256':manifest['dem_sha256'],'dem':'NASA LOLA LDEM_80S_80MPP_ADJ.TIF; 80 m; MOON_ME/DE421; sphere R=1737400 m','validation_scope':'Step 13 sampled scenario: independent Horizons references and separate geodesic/ECEF terrain checks; finite window and search radius only. Approximate area label, not a certified landing site.','adapter':'Exact baseline.json input bound as submitted_scenario for current transfer/assessment guards; archived response otherwise preserved.','response_url':'/examples/'+id+'.json','response_sha256':hashlib.sha256(response).hexdigest()}})
    catalog={'version':1,'evidence':'docs/SCIENTIFIC_VALIDATION_STEP13.md','requirements_note':'Illustrative Balanced requirements: Earth >=20%, sunlight >=50%, Earth interruption <=400 h, sunlight interruption <=24 h. Not NASA recommendations. Dates are recorded evaluated examples, not future mission recommendations.','items':items}
    (OUT/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf-8');print('Built',len(items),'evidence-backed examples; no NASA requests.');return catalog
if __name__=='__main__':build()
