import {LUNAR_SOUTH_POLE_PRESETS} from '../constants/presets';
import {MissionFinding,VisibilityCard,SearchRadiusNotice} from './ScientificResults';
import React from 'react';
import type { AnalysisRequest, AnalysisResponse } from '../types/api';
export type Step = 'explore' | 'plan' | 'results' | 'compare' | 'finder';
const STEPS: [Step,string][] = [['explore','Explore Moon'],['plan','Plan Mission'],['results','Results'],['compare','Compare'],['finder','Find Opportunities']];
export function WorkflowNav({step, onNavigate}: {step: Step; onNavigate: (step: Step) => void}) {
  return <nav aria-label="Mission workflow" className="workflow-nav">{STEPS.map(([value,label],i) => <button key={value} aria-current={step === value ? 'step' : undefined} onClick={() => onNavigate(value)}><span>0{i+1}</span> {label}</button>)}</nav>;
}
export function SitePicker({request,onChange}: {request:AnalysisRequest;onChange:(request:AnalysisRequest)=>void}) {
 const selected=LUNAR_SOUTH_POLE_PRESETS.find(p=>Math.abs(p.latitude-request.latitude)<0.00001 && Math.abs(p.longitude-request.longitude)<0.00001);
 return <div className="site-picker"><label>Choose a site preset<select data-scenario-field="site" value={selected?.id || 'custom'} onChange={e=>{const site=LUNAR_SOUTH_POLE_PRESETS.find(p=>p.id===e.target.value);if(site)onChange({...request,latitude:site.latitude,longitude:site.longitude});}}><option value="custom">Custom map location</option>{LUNAR_SOUTH_POLE_PRESETS.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><p className="selected-site">{selected?.name || 'Custom map location'}<br /><span>{Math.abs(request.latitude).toFixed(4)}°S · {request.longitude.toFixed(4)}° east-positive</span></p><p className="text-sm text-slate-400">Preset names are illustrative. Terrain coverage and visibility are checked when you analyze.</p></div>;
}
export function SimpleControls({request,onChange,onRun,loading}: {request: AnalysisRequest; onChange:(request:AnalysisRequest)=>void; onRun:()=>void; loading:boolean}) {
  const valid = Number.isFinite(request.latitude) && request.latitude >= -90 && request.latitude <= -80 && Number.isFinite(request.longitude) && request.longitude >= -180 && request.longitude <= 360 && !!request.start_time && !!request.stop_time && request.start_time < request.stop_time;
  return <section className="scenario-card"><span className="eyebrow">YOUR MISSION</span><h2>Set the scene</h2><p>Choose a site and mission dates. All dates are UTC.</p><SitePicker request={request} onChange={onChange} /><details className="coordinate-details"><summary>Enter precise coordinates (optional)</summary><div className="grid grid-cols-2 gap-3 mt-5">
    <label>Latitude (°)<input type="number" min={-90} max={-80} step="0.001" value={Number.isFinite(request.latitude)?request.latitude:''} onChange={e=>onChange({...request,latitude:e.target.valueAsNumber})}/></label>
    <label>Longitude (°E)<input type="number" min={-180} max={360} step="0.001" value={Number.isFinite(request.longitude)?request.longitude:''} onChange={e=>onChange({...request,longitude:e.target.valueAsNumber})}/></label>
  </div></details>{(['start_time','stop_time'] as const).map((field,i)=><label key={field} className="block mt-4">{i===0?'Mission start':'Mission end'} · UTC<input data-scenario-field={i===0?'date':undefined} type="datetime-local" value={request[field].slice(0,16)} onInput={e=>onChange({...request,[field]:e.currentTarget.value})} onChange={e=>onChange({...request,[field]:e.target.value})}/></label>)}
  <p className="text-sm text-slate-400 mt-4">Mast: {request.observer_height_m ?? 2} m · Sampling: {request.step_size || '1h'}. Open Engineering View to adjust these settings.</p>
  {!valid && <p role="status" className="text-amber-200 mt-3">Use latitude −90 to −80°, longitude −180 to 360°, and an end date after the start.</p>}
  <button className="primary-action w-full mt-5" disabled={!valid || loading} onClick={onRun}>{loading?'Calculating…':'Analyze Mission →'}</button></section>;
}
export function ResultSummary({result:r,radiusKm,engineering=true}: {result:AnalysisResponse;radiusKm?:number;engineering?:boolean}) {
  if (!r?.time_range || !r?.site) return <section className="result-summary"><MissionFinding result={r} /><p>Evaluated scenario metadata are unavailable. No site-specific interpretation can be shown.</p></section>;
  const t=r.time_range;
  return <section className="result-summary" aria-label="Computed mission results">
    <p className="window-headline">{Math.abs(r.site.latitude).toFixed(2)}°S, {r.site.longitude.toFixed(2)}° east-positive · {t.elapsed_hours.toFixed(1)} evaluated hours</p>
    <div className="summary-grid"><VisibilityCard result={r} target="earth" compact={!engineering} /><VisibilityCard result={r} target="sun" compact={!engineering} /></div>
    <details className="notice"><summary>Scenario details · exact UTC bounds and scientific finding</summary><MissionFinding result={r} />
      <p>{Math.abs(r.site.latitude).toFixed(4)}°S, {r.site.longitude.toFixed(4)}° east-positive · mast {r.site.observer_height_m} m</p>
      <p>Evaluated: {t.start_time} → {t.stop_time} · {t.elapsed_hours.toFixed(1)} hours · {t.total_points} samples</p>
      {(t.requested_start_time && (t.requested_start_time!==t.start_time || t.requested_stop_time!==t.stop_time)) && <p>Requested: {t.requested_start_time} → {t.requested_stop_time}. Only the evaluated sample interval contributes to these results.</p>}
    </details>
    <p className="compact-limit">Finite-window geometry, not permanent shadow. Terrain beyond {Number.isFinite(radiusKm)?`${radiusKm} km`:'the configured radius'} is not evaluated.</p>
    <details className="science-disclosure" open={engineering || undefined}><summary>{Math.abs(r.site.latitude+87.87)<0.01 && Math.abs(r.site.longitude+5.1)<0.01?'Haworth radius sensitivity — review before planning':'Scientific limitations and terrain radius'}</summary><SearchRadiusNotice site={r.site} radiusKm={radiusKm} /></details>
  </section>;
}
export function Glossary(){return <details className="glossary"><summary>Understand the terms</summary><div className="flex flex-wrap gap-2 mt-3">{Object.entries({DTE:'Direct-to-Earth: a direct geometric view toward Earth, without an orbital relay.', 'Terrain horizon':'The skyline formed by the highest modeled terrain obstruction in each direction.', 'Angular clearance':'Target elevation minus terrain horizon; a positive value places its center above the skyline.', 'Mast height':'Instrument height above local ground, added to the DEM elevation.', 'Sunlight availability':'The fraction of the evaluated interval with the Sun’s center above modeled terrain; not electrical power.', 'Geometric visibility':'A target’s center clears the modeled terrain; this does not guarantee an RF link.'}).map(([term,text])=><span className="term" key={term}><button type="button" aria-describedby={'term-'+term.replaceAll(' ','-')}>{term} ⓘ</button><span role="tooltip" id={'term-'+term.replaceAll(' ','-')}>{text}</span></span>)}</div></details>}
