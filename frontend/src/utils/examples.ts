import type {AnalysisRequest,AnalysisResponse,TargetSummary} from '../types/api';
import type {Assessment,Profile,Thresholds} from './assessment';
import type {CandidateTransfer} from './opportunity';
import {safeTransfer} from './opportunity';
export interface ExampleMission {
 id:string;name:string;scenario:AnalysisRequest;settings:{profile:Profile;thresholds:Thresholds};assessment:Assessment;
 earth:TargetSummary;sun:TargetSummary;evaluated:AnalysisResponse['time_range'];
 source:{path:string;sha256:string;baseline_sha256:string;dem_sha256:string;dem:string;validation_scope:string;adapter:string;response_url:string;response_sha256:string};
}
export interface ExampleCatalog {version:number;requirements_note:string;items:ExampleMission[];}
export function verifiedExampleTransfer(example:ExampleMission,result:AnalysisResponse):CandidateTransfer {
 const transfer={id:`example:${example.id}`,name:example.name,scenario:{...example.scenario},result,settings:{profile:example.settings.profile,thresholds:{...example.settings.thresholds}}};
 if(!safeTransfer(transfer)||!example.assessment.exportable||JSON.stringify(result.earth_comm)!==JSON.stringify(example.earth)||JSON.stringify(result.solar_power)!==JSON.stringify(example.sun))throw new Error('The saved example does not match its recorded scenario/results. Run a new bounded search.');
 return transfer;
}
export async function loadExample(example:ExampleMission,signal?:AbortSignal):Promise<CandidateTransfer> {
 if(!/^\/examples\/[a-z0-9-]+\.json$/.test(example.source.response_url))throw new Error('Invalid example source path.');
 const response=await fetch(example.source.response_url,{signal});if(!response.ok)throw new Error('The saved example file is unavailable. Try a new bounded search.');
 const bytes=await response.arrayBuffer();const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==example.source.response_sha256)throw new Error('Example checksum verification failed. No result was opened.');
 return verifiedExampleTransfer(example,JSON.parse(new TextDecoder().decode(bytes)));
}
