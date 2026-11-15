import React,{useEffect,useMemo,useRef,useState} from 'react';
import profiles from '../../../shared/mission_profiles.json';
import type {AnalysisRequest,AnalysisResponse} from '../types/api';
import {assessmentEnvelope,exportBlockReason,validThresholds} from '../utils/assessment';
import type {Profile,Thresholds,Assessment,MissionEnvelope} from '../utils/assessment';
import {getMissionAssessment,downloadMissionPdf} from '../services/api';

export const PROFILE_HELP:Record<Profile,string>={
 'Solar Priority':'Sunlight requirements take priority; Earth visibility is secondary.',
 'Communication Priority':'Earth visibility requirements take priority; sunlight is secondary.',
 'Balanced':'Earth visibility and sunlight have equal priority.'
};
const REQUIREMENTS=[
 ['earth_min_percent','Minimum Earth visibility','%',100],
 ['sun_min_percent','Minimum sunlight availability','%',100],
 ['earth_max_blackout_hours','Maximum tolerable Earth communication interruption','h',100000],
 ['sun_max_blackout_hours','Maximum tolerable sunlight interruption','h',100000]
] as const;
const PLAIN_LABELS:Record<string,string>={earth_visibility:'Earth visible',sun_visibility:'Sunlight available',earth_blackout:'Longest Earth interruption',sun_blackout:'Longest sunlight interruption'};
export function AssessmentVerdict({assessment}:{assessment:Assessment}) {
 const met=assessment.requirements.filter(r=>r.passed).length;
 const earthPass=assessment.requirements.filter(r=>r.key.startsWith('earth_')).every(r=>r.passed);
 const priority=assessment.profile==='Solar Priority'?'Sunlight':'Earth visibility';
 const reason=assessment.label==='Insufficient Data'?assessment.reason:assessment.label==='Favorable'?'Your four geometric requirements are met.':assessment.label==='Conditional'?(assessment.profile==='Balanced'?`${earthPass?'Earth visibility':'Sunlight'} meets its requirements; ${earthPass?'sunlight':'Earth visibility'} does not.`:`${priority} meets its priority requirements; a secondary requirement is unmet.`):assessment.profile==='Balanced'?'Earth visibility and sunlight each miss at least one requirement.':`${priority} misses at least one priority requirement.`;
 return <div className={`assessment-verdict verdict-${assessment.label.toLowerCase().replaceAll(' ','-')}`}>
  <div className="verdict-heading"><div><span className="eyebrow">YOUR MISSION ASSESSMENT</span><h2>{assessment.label}</h2></div>{assessment.requirements.length>0 && <span className="requirements-count">{met} of {assessment.requirements.length} requirements met</span>}</div>
  <p>{reason}</p>
  {assessment.requirements.length>0 && <ul className="requirement-list">{assessment.requirements.map(r=><li key={r.key} className={`${r.primary?'requirement-primary':'requirement-secondary'} ${r.passed?'requirement-pass':'requirement-fail'}`}>
   <strong className="requirement-status"><span aria-hidden="true">{r.passed?'✓':'×'}</span> {r.passed?'PASS':'FAIL'}</strong><span className="requirement-name">{PLAIN_LABELS[r.key] || r.title}<small>{r.primary?'Priority':'Secondary'}</small></span><span className="requirement-value">{r.actual.toFixed(2)} {r.unit}<small>Need {r.relation} {r.threshold} {r.unit}</small></span>
  </li>)}</ul>}
  <p className="assessment-scope">Geometry only: Earth visibility does not guarantee RF communication; sunlight does not quantify electrical energy or battery charging. This is not a probability of mission success or landing-safety certification.</p>
 </div>;
}
export function RequirementControls({thresholds,onChange,elapsedHours=24}:{thresholds:Thresholds;onChange:(value:Thresholds)=>void;elapsedHours?:number}) {
 return <details className="assessment-thresholds"><summary>Adjust mission requirements</summary><p>Illustrative defaults, not NASA recommendations. These controls change requirements only, not NASA results.</p>
  <div className="threshold-grid">{REQUIREMENTS.map(([field,label,unit,max])=>{
   const limit=unit==='%'?max:Math.min(max,Math.max(24,Math.ceil(elapsedHours),Number.isFinite(thresholds[field])?thresholds[field]:0));
   return <label className="threshold-slider" key={field}><span>{label}<output>{Number.isFinite(thresholds[field])?thresholds[field]:'—'} {unit}</output></span><input aria-label={label} type="range" min={0} max={limit} step="any" value={Number.isFinite(thresholds[field])?thresholds[field]:0} onChange={e=>onChange({...thresholds,[field]:Math.round(e.target.valueAsNumber*10)/10})} /><small>0 {unit}<span>{limit} {unit}</span></small></label>;
  })}</div>
  <details className="assessment-advanced"><summary>Advanced Settings — exact values and assessment rules</summary><div className="threshold-grid">{REQUIREMENTS.map(([field,label,unit,max])=><label key={field}>{label} ({unit})<input aria-label={`Exact ${label.toLowerCase()}`} type="number" min={0} max={max} step="any" value={Number.isFinite(thresholds[field])?thresholds[field]:''} onChange={e=>onChange({...thresholds,[field]:e.target.valueAsNumber})}/></label>)}</div>
   <p>Earth interruption means a period without modeled Earth-center visibility, not a measured communications outage. Sunlight interruption means a period without modeled Sun-center visibility, not a battery discharge estimate.</p>
   <p>Favorable: all four requirements pass. Solar/Communication Priority: Conditional when the priority target passes both requirements but another requirement fails; Challenging when a priority requirement fails. Balanced: Conditional when exactly one target meets both requirements; Challenging when neither does. Missing, incomplete, stale or inconsistent data: Insufficient Data. Boundaries are inclusive. No composite score or probability is used.</p>
   <p>A 0% minimum permits no visibility; a maximum interruption longer than the interval permits full-interval blockage. Percentages use the returned summary precision of 0.01 percentage points; durations use 0.0001 hours. Exact values are retained in the PDF.</p>
  </details>
 </details>;
}
export function MissionAssessment({submitted,draft,result,busy=false,active=true,onDates,onSite,onMast,engineering=false,seed}:{submitted:AnalysisRequest|null;draft:AnalysisRequest;result:AnalysisResponse|null;busy?:boolean;active?:boolean;onDates:()=>void;onSite:()=>void;onMast:()=>void;engineering?:boolean;seed?:{id:string;profile:Profile;thresholds:Thresholds}}) {
 const [profile,setProfile]=useState<Profile>('Balanced');
 const [thresholds,setThresholds]=useState<Thresholds>({...profiles.Balanced});
 useEffect(()=>{if(seed){setProfile(seed.profile);setThresholds({...seed.thresholds});}},[seed]);
 const [resolved,setResolved]=useState<{key:string;value:Assessment}|null>(null);
 const [error,setError]=useState('');const [downloading,setDownloading]=useState(false);const [downloadNote,setDownloadNote]=useState('');
 const controller=useRef<AbortController|null>(null);
 const envelope=useMemo<MissionEnvelope>(()=>assessmentEnvelope(submitted,draft,result,profile,thresholds),[submitted,draft,result,profile,thresholds]);
 const key=useMemo(()=>JSON.stringify(envelope),[envelope]);const current=useRef(key);current.current=key;
 const block=exportBlockReason(submitted,draft,result,busy) || (!validThresholds(thresholds)?'Use percentages from 0 to 100 and nonnegative maximum interruption hours (up to 100,000).':'');
 const assessment=resolved?.key===key?resolved.value:null;
 useEffect(()=>{
  setError('');setDownloadNote('');setDownloading(false);controller.current?.abort();
  if(block || !active)return;
  const abort=new AbortController();let live=true;
  const timer=setTimeout(()=>{getMissionAssessment(envelope,abort.signal).then(value=>{if(live && current.current===key)setResolved({key,value});}).catch(err=>{if(live && !abort.signal.aborted)setError(err?.message || 'Assessment is unavailable.');});},200);
  return ()=>{live=false;clearTimeout(timer);abort.abort();controller.current?.abort();};
 },[key,block,active]);
 const reason=block || error || (assessment && !assessment.exportable?assessment.reason:'');
 const save=async()=>{
  if(reason || !assessment?.exportable)return;
  const capturedKey=key;const snapshot=JSON.parse(JSON.stringify(envelope)) as MissionEnvelope;
  const abort=new AbortController();controller.current=abort;setDownloading(true);setDownloadNote('');
  try{
   const blob=await downloadMissionPdf(snapshot,abort.signal);
   if(abort.signal.aborted || current.current!==capturedKey)return;
   const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='LunaRIDGE-mission-report.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setDownloadNote('PDF generated for the submitted scenario and the assessment settings shown above.');
  }catch(err:any){if(!abort.signal.aborted && current.current===capturedKey)setDownloadNote(`PDF unavailable: ${err?.message || 'Report generation failed.'}`);}
  finally{if(current.current===capturedKey)setDownloading(false);}
 };
 const unavailable:Assessment={label:'Insufficient Data',profile,thresholds,requirements:[],reason:reason || 'No verified assessment is available.',exportable:false};
 return <section className="mission-assessment" aria-label="Mission suitability assessment">
  <div className="assessment-toolbar"><label>Assessment profile<select value={profile} onChange={e=>{const next=e.target.value as Profile;setProfile(next);setThresholds({...profiles[next]});}}>{Object.keys(profiles).map(name=><option key={name}>{name}</option>)}</select></label><button className="primary-action" disabled={!!reason || !assessment?.exportable || downloading || !active} aria-describedby="report-export-status" onClick={save}>{downloading?'Generating PDF…':'Download PDF'}</button></div>
  <p className="profile-help">{PROFILE_HELP[profile]} <span>Switching profiles loads different requirements, not different NASA results.</span></p>
  {reason ? <AssessmentVerdict assessment={unavailable} /> : assessment ? <AssessmentVerdict assessment={assessment} /> : <p role="status">Checking geometric requirements against the submitted result…</p>}
  {assessment?.label==='Challenging' && !reason && <p className="profile-explanation">A verdict can stay Challenging across all profiles: changing priorities cannot improve visibility, and each profile still needs its priority requirements to pass.</p>}
  <p id="report-export-status" className="text-sm text-slate-300" role="status">{reason || (!assessment?'Report download becomes available after consistency checks.':'PDF includes this analysis and your current requirements.')}</p>
  {downloadNote && <p role="status" className="notice">{downloadNote}</p>}
  <RequirementControls thresholds={thresholds} onChange={setThresholds} elapsedHours={result?.time_range?.elapsed_hours} />
  {submitted && result && <div className="assessment-next"><span>{reason?'Edit the scientific inputs, then rerun analysis.':assessment?.label==='Favorable'?'Requirements met. Review limitations before planning operations.':'To investigate unmet requirements, edit the scenario and rerun.'}</span><div><button onClick={onDates}>Edit dates</button><button onClick={onSite}>Edit location</button>{(engineering || assessment?.requirements.some(r=>!r.passed)) && <button onClick={onMast}>Edit mast height</button>}</div></div>}
 </section>;
}
