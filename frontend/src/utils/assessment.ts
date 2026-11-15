import type {AnalysisRequest, AnalysisResponse} from '../types/api';
import {scientificScenarioKey} from './scenario';
export type Profile = 'Solar Priority' | 'Communication Priority' | 'Balanced';
export interface Thresholds {earth_min_percent:number; sun_min_percent:number; earth_max_blackout_hours:number; sun_max_blackout_hours:number;}
export interface MissionEnvelope {scenario:AnalysisRequest|null; draft_scenario:AnalysisRequest; result:AnalysisResponse|null; settings:{profile:Profile;thresholds:Thresholds};}
export interface Requirement {key:string;target:string;title:string;actual:number;threshold:number;relation:string;unit:string;passed:boolean;primary:boolean;}
export interface Assessment {label:'Favorable'|'Conditional'|'Challenging'|'Insufficient Data';profile:Profile;thresholds:Thresholds;requirements:Requirement[];reason:string;exportable:boolean;}
export function exportBlockReason(submitted:AnalysisRequest|null,draft:AnalysisRequest,result:AnalysisResponse|null,busy=false):string {
 if(busy)return 'Analysis is still running. Wait for a completed scenario.';
 if(!submitted || !result)return 'Run an analysis before assessing or downloading a report.';
 if(scientificScenarioKey(submitted)!==scientificScenarioKey(draft))return 'Scientific inputs changed. This result is stale; rerun analysis before downloading.';
 if(result.status!=='success')return 'Coverage or analysis is incomplete. No suitability judgment or PDF is available.';
 if(!result.submitted_scenario)return 'This result lacks submitted-scenario provenance. Restart the updated backend and rerun analysis.';
 if(!result.data || result.data.length<2 || result.data.length!==result.time_range?.total_points)return 'Complete sampled diagnostics are required before export.';
 return '';
}
/** Requirements never mutate the frozen scientific scenario. Equivalent UTC text uses its submitted representation. */
export function assessmentEnvelope(submitted:AnalysisRequest|null,draft:AnalysisRequest,result:AnalysisResponse|null,profile:Profile,thresholds:Thresholds):MissionEnvelope {
 return {scenario:submitted,draft_scenario:submitted && scientificScenarioKey(submitted)===scientificScenarioKey(draft)?submitted:draft,result,settings:{profile,thresholds:{...thresholds}}};
}
export function validThresholds(t:Thresholds):boolean {
 return [t.earth_min_percent,t.sun_min_percent].every(n=>Number.isFinite(n)&&n>=0&&n<=100) && [t.earth_max_blackout_hours,t.sun_max_blackout_hours].every(n=>Number.isFinite(n)&&n>=0&&n<=100000);
}
