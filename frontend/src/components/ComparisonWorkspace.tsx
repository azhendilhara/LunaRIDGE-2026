import React,{useEffect,useMemo,useRef,useState} from 'react';
import profiles from '../../../shared/mission_profiles.json';
import type {AnalysisRequest,AnalysisResponse} from '../types/api';
import type {Assessment,Profile,Thresholds} from '../utils/assessment';
import {assessmentEnvelope,validThresholds} from '../utils/assessment';
import {scientificScenarioKey,utcDate} from '../utils/scenario';
import {ComparisonQueue,MAX_SCENARIOS,MIN_SCENARIOS,newScenario,addScenario,duplicateScenario,removeScenario,moveScenario,editScenario,isStale,validRequest,usableResult,needsAnalysis,comparisonFinding} from '../utils/comparison';
import type {ComparisonScenario,AssessedScenario} from '../utils/comparison';
import {importEvaluatedCandidate} from '../utils/opportunity';
import type {CandidateTransfer} from '../utils/opportunity';
import {getMissionAssessment,runVisibilityAnalysis} from '../services/api';
import {LUNAR_SOUTH_POLE_PRESETS} from '../constants/presets';
import {SitePicker} from './MissionExplorer';
import {AssessmentVerdict,PROFILE_HELP,RequirementControls} from './MissionAssessment';
import {InteractiveLunarMap} from './InteractiveLunarMap';
import {SearchRadiusNotice,usableSummary} from './ScientificResults';
import {TimelineBar} from './TimelineBar';
import {ElevationChart} from './ElevationChart';
import {ClearanceChart} from './ClearanceChart';
import {WindowsTable} from './WindowsTable';

interface Props {baseRequest:AnalysisRequest;mode?:'simple'|'engineering';onChangeRequest?:(request:AnalysisRequest)=>void;incoming?:CandidateTransfer|null;onCount?:(count:number)=>void;}
const displayTime=(text:string)=>{const time=utcDate(text);return Number.isFinite(time.getTime())?time.toISOString().slice(0,19):text;};
const labels:Record<string,string>={earth_visibility:'Earth visibility',sun_visibility:'Sunlight',earth_blackout:'Earth interruption',sun_blackout:'Sunlight interruption'};
export function ScenarioDates({request,onChange}:{request:AnalysisRequest;onChange:(request:AnalysisRequest)=>void}) {
 return <div className="scenario-dates">{(['start_time','stop_time'] as const).map((field,i)=><label key={field}>{i?'Mission end · UTC':'Mission start · UTC'}<input type="datetime-local" step="1" value={displayTime(request[field])} onInput={e=>onChange({...request,[field]:e.currentTarget.value})} onChange={e=>onChange({...request,[field]:e.target.value})}/></label>)}</div>;
}
export function scenarioState(row:ComparisonScenario) {
 if(isStale(row))return 'Stale — scientific inputs changed; recalculate this scenario.';
 return {idle:'Not analyzed',queued:'Queued',loading:'Analyzing NASA / LOLA data…',success:'Analysis complete',error:'Analysis failed',incomplete:'Incomplete data — unknown, not zero',canceled:'Canceled — no new result accepted'}[row.status];
}
export function ComparisonBars({items}:{items:AssessedScenario[]}) {
 return <section className="comparison-bars" aria-label="Normalized visibility comparison">{(['earth','sun'] as const).map(target=><div key={target}><h3>{target==='earth'?'Earth visibility — potential direct communication opportunity':'Sunlight availability — potential solar charging opportunity'}</h3>{items.map(({row})=>{
 const value=(target==='earth'?row.result.earth_comm:row.result.solar_power).visibility_percentage;
 return <div className="comparison-bar-row" key={row.id}><span>{row.name || 'Unnamed scenario'}</span><div role="meter" aria-label={`${row.name} ${target} visibility`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className={`comparison-meter ${target}`}><span style={{width:`${value}%`}} /></div><strong>{value.toFixed(2)}%</strong></div>;
 })}<p>{target==='earth'?'Geometry does not guarantee RF connectivity.':'Sunlight does not quantify electrical energy or battery charging.'}</p></div>)}</section>;
}
export function ScenarioEngineering({row}:{row:AssessedScenario['row']}) {
 const [open,setOpen]=useState(false);const r=row.result,t=r.time_range;
 return <section className="scenario-engineering" aria-label={`${row.name} engineering results`}><h3>{row.name || 'Unnamed scenario'} · engineering record</h3><dl className="engineering-facts">
 <dt>Coordinates (east-positive)</dt><dd>{r.site.latitude}°, {r.site.longitude}°</dd><dt>Actual DEM ground / total observer altitude</dt><dd>{r.site.ground_elevation_m} m / {r.site.total_altitude_m} m</dd><dt>Requested UTC</dt><dd>{t.requested_start_time} → {t.requested_stop_time}</dd><dt>Evaluated UTC</dt><dd>{t.start_time} → {t.stop_time}</dd><dt>Evaluated interval / samples</dt><dd>{t.elapsed_hours} h / {t.total_points}</dd><dt>Mast / time sampling</dt><dd>{r.site.observer_height_m} m / {row.submitted.step_size ?? '1h'}</dd><dt>Terrain radius / azimuth spacing</dt><dd>{row.submitted.horizon_max_distance_km ?? 50} km / {row.submitted.horizon_azimuth_step_deg ?? 1}°</dd></dl>
 <table className="scenario-metric-table"><caption>Exact returned summaries</caption><thead><tr><th>Metric</th><th>Earth</th><th>Sun</th></tr></thead><tbody>{(['visibility_percentage','total_visible_hours','total_blocked_hours','longest_window_hours','longest_blackout_hours','full_disk_visible_hours','partial_limb_hours','fully_blocked_hours','window_count'] as const).map(key=><tr key={key}><th>{({visibility_percentage:'Center visible (%)',total_visible_hours:'Visible (h)',total_blocked_hours:'Blocked (h)',longest_window_hours:'Longest visible window (h)',longest_blackout_hours:'Longest interruption (h)',full_disk_visible_hours:'Whole disk visible (h)',partial_limb_hours:'Partial limb (h)',fully_blocked_hours:'Whole disk blocked (h)',window_count:'Center-visible windows'})[key]}</th><td>{r.earth_comm[key]}</td><td>{r.solar_power[key]}</td></tr>)}</tbody></table>
 <SearchRadiusNotice site={r.site} radiusKm={row.submitted.horizon_max_distance_km} />
 <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>Paired elevation, terrain clearance and complete windows</summary>{open && <><ElevationChart data={r.data}/><ClearanceChart data={r.data}/><WindowsTable earthWindows={r.earth_comm.windows} solarWindows={r.solar_power.windows}/></>}</details>
 <details><summary>Submitted settings, methods and NASA provenance</summary><pre>{JSON.stringify(row.submitted,null,2)}</pre><ul>{r.scientific_model_notes.map(note=><li key={note}>{note}</li>)}</ul><p>{r.earth_comm.transition_estimation_method} {r.earth_comm.sampling_uncertainty_note}</p><p>Approximate fixed mean disk radii: Earth 0.95°, Sun 0.267°. Partial-limb durations are not additional center-visible hours. This is not a full-disk energy model.</p><p><a href="https://ssd.jpl.nasa.gov/horizons/manual.html" target="_blank" rel="noreferrer">NASA JPL Horizons methods</a> · <a href="https://pgda.gsfc.nasa.gov/products/90" target="_blank" rel="noreferrer">NASA LRO/LOLA terrain and citations</a></p></details>
 </section>;
}

export function ComparisonWorkspace({baseRequest,mode='simple',incoming,onCount}:Props) {
 const [rows,setRows]=useState<ComparisonScenario[]>(()=>{
  const other=LUNAR_SOUTH_POLE_PRESETS[2]!;
  return [newScenario('scenario-1','Mission Planner copy',baseRequest),newScenario('scenario-2','Alternative location',{...baseRequest,latitude:other.latitude,longitude:other.longitude})];
 });
 const nextId=useRef(3);const makeId=()=>`scenario-${nextId.current++}`;
 const queue=useRef<ComparisonQueue|null>(null);
 useEffect(()=>{const runner=new ComparisonQueue(runVisibilityAnalysis);queue.current=runner;return ()=>runner.dispose();},[]);
 const [profile,setProfile]=useState<Profile>('Balanced');const [thresholds,setThresholds]=useState<Thresholds>({...profiles.Balanced});
 const [assessments,setAssessments]=useState<Record<string,{key:string;value?:Assessment;error?:string}>>({});
 const saved=useRef(assessments);saved.current=assessments;
 const [retry,setRetry]=useState(0);const [mapId,setMapId]=useState<string|null>(null);const [notice,setNotice]=useState('');
 const imported=useRef(new Set<string>());
 useEffect(()=>{onCount?.(rows.length);},[rows.length,onCount]);
 useEffect(()=>{
  if(!incoming||imported.current.has(incoming.id))return;
  imported.current.add(incoming.id);const result=importEvaluatedCandidate(rows,incoming,makeId());
  setRows(result.rows);setNotice(result.error||'Added evaluated Opportunity Finder candidate with its exact submitted settings and response. Shared comparison requirements are applied without new science.');
 },[incoming,rows]);
 useEffect(()=>{if(mapId){const frame=requestAnimationFrame(()=>{const map=document.getElementById('comparison-site-map');map?.focus();map?.scrollIntoView({block:'start'});});return ()=>cancelAnimationFrame(frame);}},[mapId]);
 const assessmentKeys=useMemo(()=>Object.fromEntries(rows.filter(usableResult).map(row=>[row.id,JSON.stringify(assessmentEnvelope(row.submitted,row.draft,row.result,profile,thresholds))])),[rows,profile,thresholds]);
 useEffect(()=>{
  if(!validThresholds(thresholds))return;
  const abort=new AbortController();let live=true;
  const timer=setTimeout(()=>{void(async()=>{
   for(const row of rows.filter(usableResult)){
    const key=assessmentKeys[row.id]!;if(saved.current[row.id]?.key===key&&saved.current[row.id]?.value)continue;
    try{const value=await getMissionAssessment(assessmentEnvelope(row.submitted,row.draft,row.result,profile,thresholds),abort.signal);if(!live)return;setAssessments(old=>({...old,[row.id]:{key,value}}));}
    catch(error:any){if(!live||abort.signal.aborted)return;setAssessments(old=>({...old,[row.id]:{key,error:error?.message || 'Assessment unavailable'} }));}
   }
  })();},200);
  return ()=>{live=false;clearTimeout(timer);abort.abort();};
 },[rows,profile,thresholds,assessmentKeys,retry]);
 const assessmentFor=(row:ComparisonScenario)=>{const item=assessments[row.id];return validThresholds(thresholds)&&item?.key===assessmentKeys[row.id]?item:undefined;};
 const verified:AssessedScenario[]=rows.filter(usableResult).flatMap(row=>{const value=assessmentFor(row)?.value;return value?.exportable?[{row,assessment:value}]:[];});
 const finding=comparisonFinding(verified,rows.length);
 const active=rows.some(row=>row.status==='queued'||row.status==='loading');
 const update=(id:string,request:AnalysisRequest)=>{
  const row=rows.find(r=>r.id===id);const changed=!!row&&scientificScenarioKey(row.draft)!==scientificScenarioKey(request);
  if(changed)queue.current?.invalidate(id);
  setRows(old=>editScenario(old,id,{draft:request}).map(r=>changed&&r.id===id&&(r.status==='loading'||r.status==='queued')?{...r,status:'canceled'}:r));
 };
 const cancel=(id:string)=>{queue.current?.invalidate(id);setRows(old=>old.map(row=>row.id===id?{...row,status:'canceled',error:''}:row));};
 const run=(selected=rows.filter(needsAnalysis))=>{
  setNotice('');
  for(const row of selected){
   if(!validRequest(row.draft)){setNotice('Choose a valid comparison end date after the start date, supported coordinates and scientific settings. Invalid scenarios were not submitted.');continue;}
   if(row.status==='loading'||row.status==='queued')continue;
   const snapshot=Object.freeze({...row.draft});
   setRows(old=>old.map(r=>r.id===row.id?{...r,submitted:snapshot,result:null,status:'queued',error:''}:r));
   queue.current?.enqueue(row.id,snapshot,{
    start:()=>setRows(old=>old.map(r=>r.id===row.id?{...r,status:'loading'}:r)),
    finish:(result:AnalysisResponse)=>setRows(old=>old.map(r=>r.id===row.id?{...r,result,status:result.status==='success'&&usableSummary(result.earth_comm)&&usableSummary(result.solar_power)?'success':'incomplete',error:''}:r)),
    fail:(error:any)=>setRows(old=>old.map(r=>r.id===row.id?{...r,status:'error',error:error?.detail||error?.message||'Analysis failed. Check coverage or connectivity, then retry.'}:r))
   });
  }
 };
 const add=(copyMain=false)=>{const id=makeId();setRows(old=>addScenario(old,newScenario(id,copyMain?'Mission Planner copy':`Scenario ${old.length+1}`,copyMain?baseRequest:old[0]!.draft)));setNotice(copyMain?'Copied all current Mission Planner inputs. Nothing was analyzed automatically.':'Scenario added with the first scenario’s inputs; edit dates/location before analyzing.');};
 const mapRow=rows.find(row=>row.id===mapId);
 return <div className="comparison-workspace">
  <header className="comparison-toolbar"><div><span className="eyebrow">MISSION COMPARISON</span><h2>Compare places. Explore dates.</h2><p>Choose 2–5 scenarios. Each keeps its own site, dates and scientific settings.</p></div><div className="comparison-actions"><button className="secondary-action" disabled={rows.length>=MAX_SCENARIOS} onClick={()=>add()}>Add Scenario</button><button className="secondary-action" disabled={rows.length>=MAX_SCENARIOS} onClick={()=>add(true)}>Copy Mission Planner</button><button className="primary-action" disabled={!rows.some(r=>needsAnalysis(r)&&validRequest(r.draft)&&r.status!=='queued'&&r.status!=='loading')} onClick={()=>run()}>Run Comparison</button></div></header>
  <p className="comparison-status" role="status">{rows.length} scenarios · {verified.length} verified · {rows.filter(r=>r.status==='queued'||r.status==='loading').length} queued/running. One analysis request runs at a time. Valid results are reused.</p>
  {notice&&<p role="status" className="notice">{notice}</p>}
  {active&&<p className="text-sm">Canceling ignores that response; an already running server calculation retains its queue slot until it finishes.</p>}
  <section className="comparison-criteria"><div><label>Shared assessment profile<select value={profile} onChange={e=>{const p=e.target.value as Profile;setProfile(p);setThresholds({...profiles[p]});}}>{Object.keys(profiles).map(p=><option key={p}>{p}</option>)}</select></label><p>{PROFILE_HELP[profile]} All scenarios use the same requirements. Changing these does not rerun NASA calculations.</p></div><RequirementControls thresholds={thresholds} onChange={setThresholds} elapsedHours={Math.max(24,...rows.map(r=>r.result?.time_range?.elapsed_hours || 0))}/>{!validThresholds(thresholds)&&<p role="alert">Use finite percentages from 0–100 and interruption limits from 0–100,000 h.</p>}</section>
  <section className="comparison-finding" aria-label="Comparison finding"><span className="eyebrow">WHAT THIS COMPARISON SHOWS</span><h2>{finding.headline}</h2><p>{finding.detail}</p>{finding.timing&&<p>{finding.timing}</p>}{finding.preference&&<p>{finding.preference}</p>}<details><summary>How preference is determined</summary><p>No score or raw-hours ranking is used. A unique preference requires a strict superset of passed requirements over every other verified scenario. A count alone cannot break a trade-off. Each requirement is evaluated with the same configured thresholds; profiles determine the existing verdict rules. Different dates describe different opportunities, not a controlled site-only experiment. This is geometry-based planning, not RF reliability, electrical energy, landing safety or mission-success probability.</p></details></section>
  {mode==='simple'&&verified.length>0&&<ComparisonBars items={verified}/>}
  <div className="comparison-scenarios">{rows.map((row,index)=>{
   const a=assessmentFor(row),assessment=a?.value;const verifiedRow=verified.find(i=>i.row.id===row.id);
   const label=!usableResult(row)?'Insufficient Data':assessment?.label || (a?.error?'Insufficient Data':'Checking requirements…');
   return <article className="comparison-scenario" key={row.id} aria-label={`Scenario ${index+1} configuration`}>
    <div className="scenario-card-heading"><span className="scenario-number">0{index+1}</span><label>Scenario name<input value={row.name} maxLength={80} onChange={e=>setRows(old=>editScenario(old,row.id,{name:e.target.value}))}/></label></div>
    <div className="scenario-edit-actions"><button disabled={index===0} aria-label={`Move scenario ${index+1} up`} onClick={()=>setRows(old=>moveScenario(old,row.id,-1))}>↑ Up</button><button disabled={index===rows.length-1} aria-label={`Move scenario ${index+1} down`} onClick={()=>setRows(old=>moveScenario(old,row.id,1))}>↓ Down</button><button disabled={rows.length>=MAX_SCENARIOS} onClick={()=>{const id=makeId();setRows(old=>duplicateScenario(old,row.id,id));}}>Duplicate</button><button disabled={rows.length<=MIN_SCENARIOS} onClick={()=>{queue.current?.invalidate(row.id);setRows(old=>removeScenario(old,row.id));if(mapId===row.id)setMapId(null);}}>Remove</button></div>
    <p role="status" className={`scenario-state state-${isStale(row)?'stale':row.status}`}>{scenarioState(row)}</p>
    <details className="scenario-editor" open={!row.submitted||isStale(row)||row.status==='error'}><summary>Edit site, dates and settings</summary>
     <SitePicker request={row.draft} onChange={request=>update(row.id,request)}/><button className="text-action" onClick={()=>setMapId(mapId===row.id?null:row.id)}>Choose on map</button>
     <ScenarioDates request={row.draft} onChange={request=>update(row.id,request)}/>
     <details><summary>Advanced scientific inputs</summary><div className="scenario-advanced">{([['latitude','Latitude (°)',-90,-80],['longitude','Longitude (° east-positive)',-180,360],['observer_height_m','Observer mast height (m)',0,100],['horizon_max_distance_km','Terrain search radius (km)',1,150],['horizon_azimuth_step_deg','Horizon azimuth resolution (°)',.1,45]] as const).map(([field,name,min,max])=><label key={field}>{name}<input type="number" step="any" min={min} max={max} value={Number.isFinite(row.draft[field])?row.draft[field]:''} onChange={e=>update(row.id,{...row.draft,[field]:e.target.valueAsNumber})}/></label>)}<label>Time sampling<input value={row.draft.step_size??'1h'} onChange={e=>update(row.id,{...row.draft,step_size:e.target.value})} placeholder="1h"/></label></div><p>UTC fields use UTC, regardless of your computer timezone. Sampling supports integer m/min/h/d intervals. Presets are approximate exploratory coordinates, not certified landing sites. Terrain coverage is checked during analysis.</p></details>
     <div className="scenario-copy"><button onClick={()=>{update(row.id,{...baseRequest});setNotice(`Copied all current Mission Planner inputs into ${row.name || 'this scenario'}.`);}}>Replace with Mission Planner</button><button disabled={index===0} onClick={()=>update(row.id,{...row.draft,start_time:rows[0]!.draft.start_time,stop_time:rows[0]!.draft.stop_time})}>Use first scenario’s dates</button></div>
    </details>
    {!validRequest(row.draft)&&<p role="alert">Choose a valid comparison end date after the start date. Use supported coordinates, mast, terrain and sampling settings.</p>}
    {row.error&&<p role="alert" className="error-notice">{row.error} Missing data are unknown, not zero. Change the site/radius or check the connection, then retry.</p>}
    <div className="scenario-run"><button className="secondary-action" disabled={!validRequest(row.draft)||row.status==='queued'||row.status==='loading'} onClick={()=>run([row])}>{isStale(row)?'Recalculate scenario':row.status==='error'||row.status==='incomplete'?'Retry scenario':'Analyze scenario'}</button>{(row.status==='queued'||row.status==='loading')&&<button onClick={()=>cancel(row.id)}>Cancel</button>}</div>
    <div className={`scenario-verdict verdict-${label.toLowerCase().replaceAll(' ','-')}`}><h3>{label}</h3>{assessment?.exportable&&<p>{assessment.requirements.filter(r=>r.passed).length} of 4 requirements met</p>}{a?.error&&<><p role="alert">{a.error}</p><button onClick={()=>setRetry(n=>n+1)}>Retry assessment</button></>}{assessment&&!assessment.exportable&&<p>{assessment.reason}</p>}</div>
    {verifiedRow&&<><div className="scenario-interruptions"><p>Earth interruption <strong>{row.result!.earth_comm.longest_blackout_hours.toFixed(2)} h</strong></p><p>Sunlight interruption <strong>{row.result!.solar_power.longest_blackout_hours.toFixed(2)} h</strong></p><p>Evaluated <strong>{row.result!.time_range.elapsed_hours.toFixed(2)} h</strong></p></div><div className="requirement-chips">{assessment!.requirements.map(r=><span key={r.key} className={r.passed?'met':'unmet'} title={`${r.actual} ${r.unit}; required ${r.relation} ${r.threshold} ${r.unit}`} aria-label={`${labels[r.key]} ${r.passed?'passed':'failed'}: ${r.actual} ${r.unit}; required ${r.relation} ${r.threshold} ${r.unit}`}><span aria-hidden="true">{r.passed?'✓':'×'}</span> {labels[r.key]}</span>)}</div><details><summary>Actual values against requirements</summary><AssessmentVerdict assessment={assessment!}/></details><p className="independent-utc">Evaluated UTC: {row.result!.time_range.start_time} → {row.result!.time_range.stop_time}. This timeline uses its own interval.</p><TimelineBar earthComm={row.result!.earth_comm} solarPower={row.result!.solar_power} timeRange={row.result!.time_range} compact={mode==='simple'}/>{mode==='simple'?<details><summary>Scientific limitations{Math.abs(row.result!.site.latitude+87.87)<.01?' · check Haworth radius sensitivity':''}</summary><SearchRadiusNotice site={row.result!.site} radiusKm={row.submitted!.horizon_max_distance_km}/></details>:<ScenarioEngineering row={verifiedRow.row}/>}</>}
   </article>;
  })}</div>
  {mapRow&&<section id="comparison-site-map" tabIndex={-1} className="comparison-map" aria-label={`Map selection for ${mapRow.name}`}><div><h3>Choose location for {mapRow.name || 'this scenario'}</h3><button className="secondary-action" onClick={()=>setMapId(null)}>Close map</button></div><InteractiveLunarMap selectedLat={mapRow.draft.latitude} selectedLon={mapRow.draft.longitude} onSelectSite={(latitude,longitude)=>update(mapRow.id,{...mapRow.draft,latitude,longitude})}/></section>}
  <p className="comparison-limitations">Finite observation windows do not establish permanent shadow. Terrain beyond each search radius and events between samples remain uncertain. Approximate presets are not certified landing sites. Expand each scenario’s limitations for Haworth sensitivity where applicable.</p>
 </div>;
}
