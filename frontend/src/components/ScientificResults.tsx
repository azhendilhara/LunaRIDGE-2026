import React from 'react';
import type {AnalysisResponse, SiteInfo, TargetSummary} from '../types/api';
const finite = (n:unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const hours = (n:number) => n > 0 && n < 0.05 ? 'less than 0.1' : n.toFixed(1);
const summaryFor = (r:AnalysisResponse, target:'earth'|'sun') => target==='earth'?r?.earth_comm:r?.solar_power;
export function usableSummary(s:TargetSummary | null | undefined): s is TargetSummary {
 return !!s && [s.visibility_percentage,s.total_visible_hours,s.total_blocked_hours,s.longest_blackout_hours,s.total_interval_hours].every(n=>finite(n) && n>=0) && s.total_interval_hours>0 && s.visibility_percentage<=100 && Math.abs(s.total_visible_hours+s.total_blocked_hours-s.total_interval_hours)<0.001;
}
export function MissionFinding({result:r}:{result:AnalysisResponse}) {
 const e=r?.earth_comm, s=r?.solar_power;
 const valid=r?.status==='success' && usableSummary(e) && usableSummary(s);
 const headline = !valid ? 'Mission finding unavailable' : e.total_visible_hours===0 && s.total_visible_hours===0 ? 'No Earth-center or Sun-center visibility was calculated for this interval.' : s.total_visible_hours===0 ? 'Earth has visible windows; no Sun-center visibility was calculated.' : e.total_visible_hours===0 ? 'The Sun has visible windows; no Earth-center visibility was calculated.' : 'Both targets have visible windows in this interval.';
 return <div className="mission-finding"><span className="eyebrow">MAIN MISSION FINDING</span><h2>{headline}</h2>
 {valid ? <p><strong>Finding:</strong> Earth-center visibility totals {hours(e.total_visible_hours)} hours; Sun-center visibility totals {hours(s.total_visible_hours)} hours in this evaluated interval.</p> : <p>No finding is inferred from missing or incomplete result data.</p>}
 <p><strong>Limitations:</strong> This is sampled, finite-radius terrain geometry. Short events between samples may be missed; this interval does not establish permanent shadow.</p>
 <p><strong>Operational implications:</strong> Use these intervals to investigate mission needs; RF connectivity requires a link budget, and electrical generation requires a power model.</p></div>;
}
function ZeroExplanation({result:r,target}:{result:AnalysisResponse;target:'earth'|'sun'}) {
 const pts=r?.data?.map(p=>p?.[target]);
 const valid=pts?.length>1 && pts.length===r.time_range?.total_points && pts.every(p=>p && [p.elevation_deg,p.horizon_elevation_deg,p.clearance_deg].every(finite) && Math.abs(p.elevation_deg-p.horizon_elevation_deg-p.clearance_deg)<0.000001);
 if(!valid) return <details className="zero-explanation"><summary>Why is this 0%?</summary><p>Sample diagnostics are unavailable or incomplete. A numerical cause cannot be established without paired target elevation, terrain skyline and clearance for all evaluated samples.</p></details>;
 const range=(key:'elevation_deg'|'horizon_elevation_deg'|'clearance_deg')=>`${Math.min(...pts.map(p=>p[key])).toFixed(4)}° to ${Math.max(...pts.map(p=>p[key])).toFixed(4)}°`;
 const below=pts.filter(p=>p.elevation_deg<=0).length;
 const raised=pts.filter(p=>p.horizon_elevation_deg>0 && p.clearance_deg<=0).length;
 const blocked=pts.every(p=>p.clearance_deg<=0);
 return <details className="zero-explanation"><summary>Why is this 0%?</summary>
 {blocked ? <p>The target’s center did not clear its paired terrain skyline at any sampled time. {below===pts.length?'It was below the horizontal at every sampled time.':below>0?'It was below the horizontal at some sampled times.':'It was above the horizontal at all sampled times, but terrain still blocked its center.'} {below>0 && raised>0 ? 'The samples show both below-horizontal directions and obstruction by terrain above the horizontal; these conditions can overlap.' : raised>0 ? 'Terrain above the horizontal obstructed the target.' : 'A below-horizontal direction alone is not the visibility rule: clearance against the terrain skyline determines visibility.'}</p> : <p>The zero summary conflicts with positive sampled clearance. These diagnostics do not support a zero-visibility conclusion; rerun analysis or inspect Engineering View.</p>}
 <dl><dt>Target elevation</dt><dd>{range('elevation_deg')}</dd><dt>Terrain skyline at the target’s sampled azimuths</dt><dd>{range('horizon_elevation_deg')}</dd><dt>Paired angular clearance (target minus skyline)</dt><dd>{range('clearance_deg')}</dd></dl>
 <p>These extrema come from actual paired samples; subtracting unrelated elevation and skyline extrema would not give the clearance range. The zero refers to target-center visibility, not necessarily the whole disk.</p>
 </details>;
}
export function VisibilityCard({result:r,target,compact=false}:{result:AnalysisResponse;target:'earth'|'sun';compact?:boolean}) {
 const s=summaryFor(r,target); const valid=r?.status==='success' && usableSummary(s);
 const title=target==='earth'?'Geometric Earth visibility':'Sunlight availability';
 return <article className={`visibility-card ${target}`} aria-label={title}><h3>{target==='earth'?'Earth visibility — potential direct communication opportunity':'Sunlight availability — potential solar charging opportunity'}</h3>{!compact && <p className="text-sm text-slate-400">{title} · target-center geometry</p>}
 {valid ? <>{compact ? <strong className="visibility-percent">{hours(s.total_visible_hours)}<small> h visible</small></strong> : <strong className="visibility-percent">{s.visibility_percentage===0 && s.total_visible_hours>0 ? '<0.01' : s.visibility_percentage.toFixed(1)}<small>%</small></strong>}
 <dl>{!compact && <><dt>Visible hours</dt><dd>{hours(s.total_visible_hours)} h</dd></>}<dt>Blocked hours</dt><dd>{hours(s.total_blocked_hours)} h</dd>{!compact && <><dt>{target==='earth'?'Longest Earth-visibility blackout':'Longest Sun-center blocked interval'}</dt><dd>{hours(s.longest_blackout_hours)} h</dd></>}</dl>
 {s.visibility_percentage===0 && s.total_visible_hours>0 && <p>Nonzero visibility below display precision; this is not an exact zero.</p>}
 {s.total_visible_hours===0 && s.visibility_percentage===0 && <ZeroExplanation result={r} target={target} />}
 </> : <><strong>Unavailable</strong><p>Missing or incomplete analysis is unknown, not zero visibility. Complete data are required before a percentage can be interpreted.</p></>}
 <p className="text-sm text-slate-400">{target==='earth'?'Earth-center geometry does not guarantee an RF connection.':'Sunlight does not quantify electrical energy, battery charging or solar electrical output.'}</p></article>;
}
export function SearchRadiusNotice({site,radiusKm}:{site?:SiteInfo;radiusKm?:number}) {
 const haworth=site && Math.abs(site.latitude+87.87)<0.01 && Math.abs(((site.longitude+5.1+180)%360+360)%360-180)<0.01;
 return <aside className="notice radius-notice" aria-label="Model limitations"><strong>Terrain search-radius limitation</strong><p>{finite(radiusKm)?`This submitted scenario searches ${radiusKm} km from the site.`:'The submitted search radius is unavailable in this result; check the submitted settings in Engineering View.'} Terrain farther away is not evaluated. Results apply only to the evaluated UTC interval and sampling settings, not permanent conditions.</p>
 {haworth && <p><strong>Haworth sensitivity:</strong> Step 13’s recorded 492-hour scenario produced 27.34% sunlight with a 25 km search, but 0% at 50 and 100 km. These are prior validation results, not a sensitivity run for your current dates. Earth visibility also varied with radius; the default radius was not demonstrated to be converged.</p>}</aside>;
}
export function ComparisonFinding({a,b,labelA='Site A',labelB='Site B'}:{a:AnalysisResponse;b:AnalysisResponse;labelA?:string;labelB?:string}) {
 const aligned=a?.status==='success' && b?.status==='success' && a.time_range?.start_time===b.time_range?.start_time && a.time_range?.stop_time===b.time_range?.stop_time && [a.earth_comm,a.solar_power,b.earth_comm,b.solar_power].every(usableSummary);
 const nameA='Site A', nameB='Site B';
 const difference=(va:number,vb:number,topic:string)=>Math.abs(va-vb)<0.00005?`${topic} is equal (${hours(va)} h each).`:`${vb>va?nameB:nameA} has ${hours(Math.abs(vb-va))} more hours of ${topic} (${nameA}: ${hours(va)} h; ${nameB}: ${hours(vb)} h).`;
 return <section className="mission-finding" aria-label="Scenario-specific comparison"><span className="eyebrow">COMPARISON FINDING</span><h3>{aligned?'Different windows, different tradeoffs':'Comparison finding unavailable'}</h3>
 {aligned ? <><p>Site A: {labelA}. Site B: {labelB}.</p><p>{difference(a.earth_comm.total_visible_hours,b.earth_comm.total_visible_hours,'Earth-center visibility')}</p><p>{difference(a.solar_power.total_visible_hours,b.solar_power.total_visible_hours,'Sun-center visibility')}</p><p>Longest Earth-visibility blackout: {nameA} {hours(a.earth_comm.longest_blackout_hours)} h; {nameB} {hours(b.earth_comm.longest_blackout_hours)} h. Difference: {hours(Math.abs(a.earth_comm.longest_blackout_hours-b.earth_comm.longest_blackout_hours))} h.</p><p>Longest Sun-center blocked interval: {nameA} {hours(a.solar_power.longest_blackout_hours)} h; {nameB} {hours(b.solar_power.longest_blackout_hours)} h. Difference: {hours(Math.abs(a.solar_power.longest_blackout_hours-b.solar_power.longest_blackout_hours))} h.</p><p className="text-sm">Common evaluated UTC interval: {a.time_range.start_time} → {a.time_range.stop_time}.</p></> : <p>Complete results over the same evaluated UTC bounds are required; no difference is inferred from missing data or mismatched intervals.</p>}
 <p>Without stated mission priorities, neither site is universally preferable. Geometric Earth and Sun visibility do not establish relay suitability, ice deposits or landing safety.</p></section>;
}
