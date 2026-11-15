import type {AnalysisRequest,AnalysisResponse} from '../types/api';
import type {Assessment} from './assessment';
import {scientificScenarioKey,utcDate} from './scenario';
import {usableSummary} from '../components/ScientificResults';

export type ScenarioStatus='idle'|'queued'|'loading'|'success'|'error'|'incomplete'|'canceled';
export interface ComparisonScenario {
 id:string;name:string;draft:AnalysisRequest;submitted:Readonly<AnalysisRequest>|null;
 result:AnalysisResponse|null;status:ScenarioStatus;error:string;
}
export const MAX_SCENARIOS=5;
export const MIN_SCENARIOS=2;
export function newScenario(id:string,name:string,request:AnalysisRequest):ComparisonScenario {
 return {id,name,draft:{...request},submitted:null,result:null,status:'idle',error:''};
}
export function addScenario(rows:ComparisonScenario[],row:ComparisonScenario) {return rows.length<MAX_SCENARIOS?[...rows,row]:rows;}
export function duplicateScenario(rows:ComparisonScenario[],id:string,newId:string) {
 const source=rows.find(r=>r.id===id);return source?addScenario(rows,newScenario(newId,`${source.name} copy`,source.draft)):rows;
}
export function removeScenario(rows:ComparisonScenario[],id:string) {return rows.length>MIN_SCENARIOS?rows.filter(r=>r.id!==id):rows;}
export function moveScenario(rows:ComparisonScenario[],id:string,direction:-1|1) {
 const i=rows.findIndex(r=>r.id===id),j=i+direction;if(i<0||j<0||j>=rows.length)return rows;
 const next=[...rows];[next[i],next[j]]=[next[j]!,next[i]!];return next;
}
export function editScenario(rows:ComparisonScenario[],id:string,change:Partial<Pick<ComparisonScenario,'draft'|'name'>>) {
 return rows.map(row=>row.id===id?{...row,...change,draft:change.draft?{...change.draft}:row.draft}:row);
}
export function isStale(row:ComparisonScenario) {return !!row.submitted && scientificScenarioKey(row.draft)!==scientificScenarioKey(row.submitted);}
export function validRequest(req:AnalysisRequest):boolean {
 const start=utcDate(req.start_time).getTime(),stop=utcDate(req.stop_time).getTime();
 return Number.isFinite(start)&&Number.isFinite(stop)&&start<stop &&
 [[req.latitude,-90,-80],[req.longitude,-180,360],[req.observer_height_m??2,0,100],[req.horizon_max_distance_km??50,1,150],[req.horizon_azimuth_step_deg??1,.1,45]].every(([n,min,max])=>Number.isFinite(n)&&n!>=min!&&n!<=max!) && /^[1-9]\d*\s*(m|min|h|d)$/i.test((req.step_size??'1h').trim());
}
export function usableResult(row:ComparisonScenario):row is ComparisonScenario & {result:AnalysisResponse;submitted:Readonly<AnalysisRequest>} {
 return !isStale(row) && row.status==='success' && !!row.submitted && row.result?.status==='success' && usableSummary(row.result.earth_comm)&&usableSummary(row.result.solar_power);
}
export function needsAnalysis(row:ComparisonScenario) {return !usableResult(row);}

/** One shared physical analysis at a time, including logically canceled requests.
 * Cancellation invalidates delivery, but retains the slot until the server response ends.
 */
export class ComparisonQueue {
 private versions=new Map<string,number>();
 private queue:Array<{id:string;version:number;controller:AbortController;request:Readonly<AnalysisRequest>;start:()=>void;finish:(result:AnalysisResponse)=>void;fail:(error:unknown)=>void}>=[];
 private running=false;private disposed=false;
 private activeJob:{id:string;controller:AbortController}|null=null;
 constructor(private analyze:(request:AnalysisRequest,signal?:AbortSignal)=>Promise<AnalysisResponse>){}
 invalidate(id:string) {this.versions.set(id,(this.versions.get(id)??0)+1);this.queue=this.queue.filter(job=>job.id!==id);if(this.activeJob?.id===id)this.activeJob.controller.abort();}
 enqueue(id:string,request:AnalysisRequest,callbacks:{start:()=>void;finish:(result:AnalysisResponse)=>void;fail:(error:unknown)=>void}) {
  this.invalidate(id);const version=this.versions.get(id)!;
  this.queue.push({id,version,controller:new AbortController(),request:Object.freeze({...request}),...callbacks});void this.pump();
 }
 dispose(){this.disposed=true;this.queue=[];this.versions.clear();this.activeJob?.controller.abort();}
 private async pump(){
  if(this.running||this.disposed)return;this.running=true;
  while(this.queue.length&&!this.disposed){
   const job=this.queue.shift()!;if(this.versions.get(job.id)!==job.version)continue;
   this.activeJob=job;job.start();
   try{const result=await this.analyze(job.request,job.controller.signal);if(!this.disposed&&this.versions.get(job.id)===job.version)job.finish(result);}
   catch(error){if(!this.disposed&&this.versions.get(job.id)===job.version)job.fail(error);}
   this.activeJob=null;
  }
  this.running=false;
 }
}

export interface AssessedScenario {row:ComparisonScenario & {result:AnalysisResponse;submitted:Readonly<AnalysisRequest>};assessment:Assessment;}
export function requirementDominates(a:Assessment,b:Assessment):boolean {
 const pass=new Set(a.requirements.filter(r=>r.passed).map(r=>r.key));
 const other=b.requirements.filter(r=>r.passed).map(r=>r.key);
 return other.every(key=>pass.has(key))&&pass.size>other.length;
}
/** Exact metrics at response precision; no inferred RF, power, safety or raw-hour ranking. */
export function comparisonFinding(items:AssessedScenario[],totalCount=items.length) {
 if(items.length<2)return {headline:'Analyze at least two complete scenarios',detail:'Missing, stale or unverified scenarios are excluded, never treated as zero.',timing:'',preference:''};
 const first=items[0]!.row.result.time_range;
 const sameBounds=items.every(i=>utcDate(i.row.result.time_range.start_time).getTime()===utcDate(first.start_time).getTime()&&utcDate(i.row.result.time_range.stop_time).getTime()===utcDate(first.stop_time).getTime());
 const sameDuration=items.every(i=>Math.abs(i.row.result.time_range.elapsed_hours-first.elapsed_hours)<.0001);
 const counts=items.map(i=>i.assessment.requirements.filter(r=>r.passed).length);
 const range=(pick:(i:AssessedScenario)=>number)=>{const values=items.map(pick);return `${Math.min(...values).toFixed(2)}–${Math.max(...values).toFixed(2)}`;};
 // A unique requirement-set dominator is preferred only on these configured criteria.
 const dominates=(a:AssessedScenario,b:AssessedScenario)=>requirementDominates(a.assessment,b.assessment);
 const dominant=items.filter(a=>items.every(b=>a===b||dominates(a,b)));
 const identical=items.every(i=>i.assessment.requirements.map(r=>`${r.key}:${r.passed}`).join('|')===items[0]!.assessment.requirements.map(r=>`${r.key}:${r.passed}`).join('|'));
 return {
  headline:`${Math.max(...counts)} of 4 requirements met at most · ${items.length} verified scenarios`,
  detail:`Earth visibility ranges ${range(i=>i.row.result.earth_comm.visibility_percentage)}%; sunlight ${range(i=>i.row.result.solar_power.visibility_percentage)}%. Longest Earth interruption: ${range(i=>i.row.result.earth_comm.longest_blackout_hours)} h; sunlight interruption: ${range(i=>i.row.result.solar_power.longest_blackout_hours)} h.`,
  timing:sameBounds?'Same evaluated UTC window.':`${sameDuration?'Different UTC windows of equal duration.':'Different UTC windows or durations.'} Percentages are normalized to each scenario’s evaluated interval; raw visible hours are not ranked.`,
  preference:items.length!==totalCount?'Some scenarios are not verified; no overall preference is established.':dominant.length===1?`${dominant[0]!.row.name || 'Unnamed scenario'} is preferred only by requirement-set dominance: it meets every requirement each alternative meets, plus at least one more for each alternative. This is not a universal best site.`:identical?'Tie on configured requirement satisfaction. No unique preference; inspect geometry and interruptions.':'Trade-offs: no scenario meets a strict superset of every alternative’s passed requirements. No unique preference.'
 };
}
