import type {AnalysisRequest,AnalysisResponse} from '../types/api';
import type {Assessment,Profile,Thresholds} from './assessment';
import {assessmentEnvelope,exportBlockReason,validThresholds} from './assessment';
import {scientificScenarioKey,utcDate} from './scenario';
import {ComparisonQueue,validRequest,requirementDominates,MAX_SCENARIOS,newScenario} from './comparison';
import type {ComparisonScenario} from './comparison';
import {LUNAR_SOUTH_POLE_PRESETS} from '../constants/presets';

export const SEARCH_LIMITS=Object.freeze({candidates:6,missionHours:720,horizonDays:90,samples:2000,terrainSamples:1000000});
export type SearchMode='sites'|'dates';
export interface SearchInputs {mode:SearchMode;science:AnalysisRequest;selected:string[];includeCurrent:boolean;current:AnalysisRequest;earliest:string;latest:string;durationHours:number;strideHours:number;}
export interface SearchCandidate {id:string;name:string;request:Readonly<AnalysisRequest>;}
export type CandidateStatus='queued'|'running'|'success'|'incomplete'|'failed'|'canceled'|'skipped';
export interface SearchRecord extends SearchCandidate {status:CandidateStatus;result:AnalysisResponse|null;error:string;}
export interface SearchSnapshot {id:string;createdUtc:string;key:string;mode:SearchMode;scope:string;candidates:readonly SearchCandidate[];}
export interface CandidateTransfer {id:string;name:string;scenario:Readonly<AnalysisRequest>;result:AnalysisResponse;settings:{profile:Profile;thresholds:Thresholds};}

/** Reject impossible calendar dates before using the project's UTC parser. */
export function searchUtc(text:string):number {
 const match=/^(\d{4})-(\d{2})-(\d{2})(?:T| |$)/.exec(text.trim());
 if(!match)return NaN;
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
 const leap=year%4===0&&(year%100!==0||year%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 if(month<1||month>12||day<1||day>days[month-1]!)return NaN;
 return utcDate(text).getTime();
}
const iso=(ms:number)=>new Date(ms).toISOString();
export function enumerateWindows(earliest:string,latest:string,durationHours:number,strideHours:number) {
 const start=searchUtc(earliest),end=searchUtc(latest),duration=durationHours*3600000,stride=strideHours*3600000;
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error('Choose valid earliest/latest UTC bounds with the end after the start.');
 if((end-start)/86400000>SEARCH_LIMITS.horizonDays)throw new Error('Date-search horizon is limited to 90 days.');
 if(!Number.isFinite(durationHours)||durationHours<1||durationHours>SEARCH_LIMITS.missionHours)throw new Error('Mission duration must be 1–720 hours.');
 if(!Number.isFinite(strideHours)||strideHours<1||strideHours>2160)throw new Error('Candidate start spacing must be 1–2160 hours.');
 if(start%1000!==0||end%1000!==0||Math.abs(duration/1000-Math.round(duration/1000))>1e-7||Math.abs(stride/1000-Math.round(stride/1000))>1e-7)throw new Error('Use whole-second UTC bounds, mission duration and start spacing; subsecond searches are not supported.');
 if(duration>end-start)throw new Error('The mission duration does not fit inside the search horizon.');
 const count=Math.floor((end-start-duration)/stride)+1;
 if(count>SEARCH_LIMITS.candidates)throw new Error(`This grid contains ${count} windows; the limit is 6. Increase start spacing or narrow the horizon. No windows were silently omitted.`);
 return Array.from({length:count},(_,i)=>({start_time:iso(start+i*stride),stop_time:iso(start+i*stride+duration)}));
}
export function scienceBudget(request:AnalysisRequest) {
 if(!validRequest(request)||!Number.isFinite(searchUtc(request.start_time))||!Number.isFinite(searchUtc(request.stop_time)))throw new Error('Use supported coordinates, valid UTC dates, mast height, sampling and terrain settings.');
 const hours=(searchUtc(request.stop_time)-searchUtc(request.start_time))/3600000;
 if(searchUtc(request.start_time)%1000!==0||searchUtc(request.stop_time)%1000!==0)throw new Error('Use whole-second UTC mission bounds for searches.');
 if(hours>SEARCH_LIMITS.missionHours)throw new Error('Each mission window is limited to 720 hours (30 days).');
 const step=/^([1-9]\d*)\s*(m|min|h|d)$/i.exec((request.step_size??'1h').trim())!;
 const stepMs=Number(step[1])*({m:60000,min:60000,h:3600000,d:86400000}[step[2]!.toLowerCase()]!);
 const stepHours=stepMs/3600000;
 const intervals=(searchUtc(request.stop_time)-searchUtc(request.start_time))/stepMs;
 if(Math.abs(intervals-Math.round(intervals))>1e-8)throw new Error('Sampling must divide the full mission duration exactly. Choose a step that includes the mission end.');
 const samples=Math.round(intervals)+1;
 if(samples<2||stepHours>hours)throw new Error('Sampling must produce at least two time points within the mission.');
 if(samples>SEARCH_LIMITS.samples)throw new Error(`Estimated ${samples} time points exceeds the 2,000-point search budget per candidate. Increase the sampling interval.`);
 // Match the existing inclusive 0–360° ray grid, including its endpoint tolerance.
 const terrainSamples=(Math.floor((360+.001)/(request.horizon_azimuth_step_deg??1))+1)*Math.ceil((request.horizon_max_distance_km??50)*1000/80);
 if(terrainSamples>SEARCH_LIMITS.terrainSamples)throw new Error('Terrain grid exceeds 1,000,000 estimated ray samples per candidate. Increase azimuth spacing or reduce radius.');
 return {samples,terrainSamples};
}
export function searchCoverageIssue(request:AnalysisRequest,result:AnalysisResponse):string {
 const basic=exportBlockReason(request,request,result);if(basic)return basic;
 const start=searchUtc(request.start_time),end=searchUtc(request.stop_time);
 if(start%1000!==0||end%1000!==0)return 'Whole-second requested bounds are required for this search.';
 if(searchUtc(result.time_range.start_time)!==start||searchUtc(result.time_range.stop_time)!==end)return 'Evaluated UTC bounds do not cover the full requested mission window.';
 let expected:number;try{expected=scienceBudget(request).samples;}catch(error:any){return error.message;}
 if(result.data.length!==expected)return 'The response is missing expected time-grid samples; no complete mission assessment is supported.';
 const spacing=(end-start)/(expected-1);
 if(result.data.some((point,index)=>searchUtc(point.timestamp)!==start+index*spacing))return 'Sample timestamps do not match the complete requested time grid.';
 return '';
}
export function buildCandidates(input:SearchInputs):SearchCandidate[] {
 let candidates:SearchCandidate[];
 if(input.mode==='sites'){
  if(input.selected.some(id=>!LUNAR_SOUTH_POLE_PRESETS.some(p=>p.id===id)))throw new Error('An unknown preset was selected.');
  candidates=LUNAR_SOUTH_POLE_PRESETS.filter(p=>input.selected.includes(p.id)).map(p=>({id:p.id,name:`${p.name} · approximate label`,request:Object.freeze({...input.science,latitude:p.latitude,longitude:p.longitude})}));
  if(input.includeCurrent)candidates.push({id:'current-map',name:'Current Mission Planner / map coordinates',request:Object.freeze({...input.science,latitude:input.current.latitude,longitude:input.current.longitude})});
 }else candidates=enumerateWindows(input.earliest,input.latest,input.durationHours,input.strideHours).map((window,i)=>({id:`date-${i+1}`,name:`Start ${window.start_time}`,request:Object.freeze({...input.science,...window})}));
 if(candidates.length===0)throw new Error('Select at least one candidate.');
 if(candidates.length>SEARCH_LIMITS.candidates)throw new Error('Select at most 6 candidates. Nothing was truncated.');
 if(new Set(candidates.map(c=>scientificScenarioKey(c.request))).size!==candidates.length)throw new Error('Two selected entries have identical coordinates and settings. Deselect one to avoid duplicate analysis.');
 for(const candidate of candidates)scienceBudget(candidate.request);
 return candidates;
}
export function searchKey(input:SearchInputs) {
 const candidates=buildCandidates(input);
 return JSON.stringify({mode:input.mode,grid:input.mode==='dates'?[iso(searchUtc(input.earliest)),iso(searchUtc(input.latest)),input.durationHours,input.strideHours]:null,candidates:candidates.map(c=>[c.id,scientificScenarioKey(c.request)])});
}
export function snapshotSearch(input:SearchInputs,id:string):SearchSnapshot {
 const candidates=buildCandidates(input).map(c=>Object.freeze({...c,request:Object.freeze({...c.request})}));
 return Object.freeze({id,createdUtc:new Date().toISOString(),key:searchKey(input),mode:input.mode,scope:input.mode==='sites'?`${candidates.length} selected coordinates only; not all lunar sites.`:`Stepped start grid: ${input.strideHours} h, ${iso(searchUtc(input.earliest))} to ${iso(searchUtc(input.latest))}; ${input.durationHours} h missions. Not every possible start time.`,candidates:Object.freeze(candidates)});
}
export function progressOf(rows:SearchRecord[]) {
 return {total:rows.length,completed:rows.filter(r=>r.status==='success').length,running:rows.filter(r=>r.status==='running').length,queued:rows.filter(r=>r.status==='queued').length,failed:rows.filter(r=>r.status==='failed'||r.status==='incomplete').length,skipped:rows.filter(r=>r.status==='skipped'||r.status==='canceled').length};
}
function freezeTree<T>(value:T):T {
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freezeTree);Object.freeze(value);}
 return value;
}
export class OpportunityRunner {
 private queue:ComparisonQueue;private runId='';private records:SearchRecord[]=[];private listener:(records:SearchRecord[])=>void=()=>{};
 constructor(analyze:(request:AnalysisRequest,signal?:AbortSignal)=>Promise<AnalysisResponse>){this.queue=new ComparisonQueue(analyze);}
 private publish(){this.listener([...this.records]);}
 private set(id:string,change:Partial<SearchRecord>){this.records=this.records.map(r=>r.id===id?{...r,...change}:r);this.publish();}
 start(snapshot:SearchSnapshot,listener:(records:SearchRecord[])=>void){
  this.cancel();this.runId=snapshot.id;this.listener=listener;this.records=snapshot.candidates.map(c=>({...c,status:'queued',result:null,error:''}));this.publish();
  this.schedule(this.records);
 }
 private schedule(records:SearchRecord[]){
  const run=this.runId;
  for(const record of records){const jobId=`${run}:${record.id}`;
   this.queue.enqueue(jobId,record.request,{start:()=>{if(run===this.runId)this.set(record.id,{status:'running'});},finish:result=>{
    if(run!==this.runId)return;
    const reason=searchCoverageIssue(record.request,result);
    this.set(record.id,{result:freezeTree(result),status:reason?'incomplete':'success',error:reason});
   },fail:(error:any)=>{if(run===this.runId)this.set(record.id,{status:'failed',error:typeof error?.detail==='string'?error.detail:error?.message||'Analysis failed. Check NASA availability or terrain coverage, then retry.'});}});
  }
 }
 cancel(){
  for(const row of this.records)this.queue.invalidate(`${this.runId}:${row.id}`);
  this.records=this.records.map(row=>row.status==='queued'?{...row,status:'skipped',error:'Not submitted: search canceled.'}:row.status==='running'?{...row,status:'canceled',error:'Response ignored; server calculation may continue.'}:row);this.publish();
 }
 retryFailed(){const retry=this.records.filter(r=>r.status==='failed'||r.status==='incomplete');this.records=this.records.map(r=>retry.some(c=>c.id===r.id)?{...r,status:'queued',result:null,error:''}:r);this.publish();this.schedule(retry);}
 dispose(){this.queue.dispose();this.listener=()=>{};}
}
export interface EvaluatedCandidate {record:SearchRecord;assessment:Assessment;}
export function opportunitySummary(items:EvaluatedCandidate[],total:number,ready:boolean) {
 const noneMet=ready&&items.length>0&&items.every(i=>i.assessment.requirements.some(r=>!r.passed));
 const dominant=items.length>1&&items.length===total?items.filter(a=>items.every(b=>a===b||requirementDominates(a.assessment,b.assessment))):[];
 const same=items.length>1&&items.every(i=>JSON.stringify(i.assessment.requirements.map(r=>[r.key,r.passed]))===JSON.stringify(items[0]!.assessment.requirements.map(r=>[r.key,r.passed])));
 return {headline:!ready?'Search / assessment in progress':!items.length?'No candidate has verified data yet':noneMet?'No evaluated candidate met all configured requirements':`${items.filter(i=>i.assessment.requirements.every(r=>r.passed)).length} evaluated candidate(s) met all configured requirements`,preference:!ready?'Current assessments must finish before a preference is stated.':items.length!==total?'Some candidates are unavailable or unverified; no overall preference is established.':dominant.length===1?`Most favorable among evaluated candidates under these requirements: ${dominant[0]!.record.name}. It meets every requirement each alternative meets, plus at least one more for each alternative. This is not a universal optimum.`:items.length===1?'Only one candidate was evaluated; no alternatives were compared.':same?'Tie on passed requirements. No unique preference; inspect actual visibility and interruptions.':'Trade-offs: no candidate strictly dominates every alternative’s passed requirements. No unique preference.'};
}
export function dominanceTiers(items:EvaluatedCandidate[]):Map<string,number> {
 const tiers=new Map<string,number>();let left=[...items],tier=1;
 while(left.length){const front=left.filter(a=>!left.some(b=>a!==b&&requirementDominates(b.assessment,a.assessment)));for(const item of front)tiers.set(item.record.id,tier);left=left.filter(item=>!front.includes(item));tier++;}
 return tiers;
}
export function candidateTransfer(record:SearchRecord,assessment:Assessment|undefined,profile:Profile,thresholds:Thresholds,id:string):CandidateTransfer|null {
 if(record.status!=='success'||!record.result||!assessment?.exportable||!validThresholds(thresholds)||searchCoverageIssue(record.request,record.result))return null;
 // Assessment and transfer must describe the exact same current requirements.
 if(assessment.profile!==profile||(Object.keys(thresholds) as Array<keyof Thresholds>).some(key=>assessment.thresholds[key]!==thresholds[key]))return null;
 return {id,name:record.name,scenario:Object.freeze({...record.request}),result:record.result,settings:{profile,thresholds:{...thresholds}}};
}
export function assessmentKey(record:SearchRecord,profile:Profile,thresholds:Thresholds) {return JSON.stringify(assessmentEnvelope(record.request,record.request,record.result,profile,thresholds));}
export function safeTransfer(transfer:CandidateTransfer):boolean {
 return validThresholds(transfer.settings.thresholds)&&!searchCoverageIssue(transfer.scenario,transfer.result)&&!!transfer.result.submitted_scenario&&scientificScenarioKey(transfer.result.submitted_scenario)===scientificScenarioKey(transfer.scenario);
}
export function importEvaluatedCandidate(rows:ComparisonScenario[],transfer:CandidateTransfer,id:string) {
 if(rows.length>=MAX_SCENARIOS)return {rows,error:'Comparison is full (5 scenarios). Remove one before adding this candidate.'};
 if(!safeTransfer(transfer))return {rows,error:'Candidate transfer is missing complete matching scenario provenance.'};
 const request=Object.freeze({...transfer.scenario});
 return {rows:[...rows,{...newScenario(id,transfer.name,request),submitted:request,result:transfer.result,recordedExample:transfer.id.startsWith('example:'),status:'success' as const}],error:''};
}
