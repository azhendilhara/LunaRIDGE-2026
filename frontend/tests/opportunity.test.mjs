import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {createServer} from 'vite';
let server,m,ui,api,base,result,thresholds;
before(async()=>{
 server=await createServer({cacheDir:'node_modules/.vite-tests/opportunity.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
 m=await server.ssrLoadModule('/src/utils/opportunity.ts');ui=await server.ssrLoadModule('/src/components/OpportunityFinder.tsx');api=await server.ssrLoadModule('/src/services/api.ts');
 base=JSON.parse(await readFile(new URL('../../docs/validation-step13/baseline.json',import.meta.url),'utf8')).haworth492.input;
 result=JSON.parse(await readFile(new URL('../../docs/validation-step13/haworth492-analysis.json',import.meta.url),'utf8'));result.submitted_scenario=base;
 thresholds={earth_min_percent:20,sun_min_percent:50,earth_max_blackout_hours:360,sun_max_blackout_hours:24};
});
after(async()=>{await server?.close();});
const input=(change={})=>({mode:'sites',science:{...base},selected:['haworth-edge','de-gerlache-rim','nobile-rim'],includeCurrent:false,current:base,earliest:'2026-11-06T00:00',latest:'2026-11-13T00:00',durationHours:36,strideHours:24,...change});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function assessment(passed=[],label='Challenging') {return {profile:'Balanced',thresholds:{...thresholds},label,reason:'Deterministic test only',exportable:label!=='Insufficient Data',requirements:['earth_visibility','earth_blackout','sun_visibility','sun_blackout'].map(key=>({key,title:key,actual:0,threshold:0,relation:'>=',unit:'%',primary:true,passed:passed.includes(key)}))};}
function record(id='a'){return {id,name:id,request:Object.freeze({...base}),result:structuredClone(result),status:'success',error:''};}

test('site selection preserves exact coordinates, rejects oversized, unknown and duplicate scopes',()=>{
 const candidates=m.buildCandidates(input());assert.equal(candidates.length,3);
 const haworth=candidates.find(c=>c.id==='haworth-edge');assert.equal(haworth.request.latitude,-87.87);assert.equal(haworth.request.longitude,-5.1);assert.match(haworth.name,/approximate/);
 assert.equal(Object.isFrozen(haworth.request),true);
 assert.throws(()=>m.buildCandidates(input({selected:[]})),/at least one/);
 assert.throws(()=>m.buildCandidates(input({selected:['unknown']})),/unknown/);
 assert.throws(()=>m.buildCandidates(input({includeCurrent:true})),/identical/);
 assert.throws(()=>m.buildCandidates(input({selected:[],includeCurrent:true,current:{...base,latitude:-79}})),/supported coordinates/);
 const list=['shackleton-rim','connecting-ridge','malapert-mountain','de-gerlache-rim','haworth-edge','nobile-rim','amundsen-rim'];
 assert.throws(()=>m.buildCandidates(input({selected:list})),/at most 6/);
 assert.equal(m.buildCandidates(input({selected:list.slice(0,6)})).length,6);
});
test('stepped date grid is contained, chronological, explicit, and rejects excess scope without truncation',()=>{
 const windows=m.enumerateWindows('2026-11-19T00:00','2026-11-23T00:00',36,24);
 assert.equal(windows.length,3);assert.deepEqual(windows[2],{start_time:'2026-11-21T00:00:00.000Z',stop_time:'2026-11-22T12:00:00.000Z'});
 assert.deepEqual(m.enumerateWindows('2026-11-19T05:30+05:30','2026-11-23T05:30+05:30',36,24),windows);
 assert.equal(m.enumerateWindows('2026-11-19','2026-11-20T12:00',36,24).length,1);
 for(const args of [['2026-01-01','2026-01-20',36,1],['2026-01-01','2027-01-01',36,2160],['2026-01-02','2026-01-01',36,24],['2026-01-01','2026-01-02',36,24],['2026-01-01','2026-01-04',NaN,24],['2026-01-01','2026-01-04',36,0]])assert.throws(()=>m.enumerateWindows(...args));
});
test('UTC leap-day, month/year rollover and invalid calendar dates are handled exactly',()=>{
 assert.deepEqual(m.enumerateWindows('2024-02-28T12:00','2024-03-02T00:00',36,24),[
 {start_time:'2024-02-28T12:00:00.000Z',stop_time:'2024-03-01T00:00:00.000Z'},
 {start_time:'2024-02-29T12:00:00.000Z',stop_time:'2024-03-02T00:00:00.000Z'}]);
 const year=m.enumerateWindows('2026-12-31T12:00','2027-01-03T00:00',36,24);assert.equal(year[0].stop_time,'2027-01-02T00:00:00.000Z');assert.equal(year.at(-1).stop_time,'2027-01-03T00:00:00.000Z');
 assert.ok(Number.isNaN(m.searchUtc('2026-02-29T00:00')));assert.ok(Number.isNaN(m.searchUtc('2100-02-29T00:00')));assert.ok(Number.isNaN(m.searchUtc('2026-04-31T00:00')));
 assert.ok(Number.isFinite(m.searchUtc('2000-02-29T00:00')));
});
test('sampling, duration and combined terrain budgets reject costly analyses before scheduling',()=>{
 assert.equal(m.scienceBudget(base).samples,493);
 assert.equal(m.scienceBudget(base).terrainSamples,225625);
 for(const change of [{step_size:'1m'},{horizon_max_distance_km:150,horizon_azimuth_step_deg:.1},{step_size:'0h'},{step_size:'999d'},{step_size:'1d'},{stop_time:'2027-01-01T00:00'},{observer_height_m:101}])assert.throws(()=>m.scienceBudget({...base,...change}));
});
test('partial evaluated bounds, missing or irregular samples and subsecond grids cannot produce complete search judgments',()=>{
 assert.equal(m.searchCoverageIssue(base,result),'');
 const partial=structuredClone(result);partial.time_range.stop_time=partial.data.at(-2).timestamp;
 assert.match(m.searchCoverageIssue(base,partial),/full requested mission/);
 const missing=structuredClone(result);missing.data.splice(4,1);missing.time_range.total_points--;
 assert.match(m.searchCoverageIssue(base,missing),/missing expected/);
 const irregular=structuredClone(result);irregular.data[4].timestamp=irregular.data[3].timestamp;
 assert.match(m.searchCoverageIssue(base,irregular),/complete requested time grid/);
 assert.throws(()=>m.enumerateWindows('2026-11-19T00:00:00.500Z','2026-11-23',36,24),/Whole-second|whole-second/);
});
test('snapshots retain exact science, normalize timezone identity and are independent of requirements',()=>{
 const draft=input();const run=m.snapshotSearch(draft,'Run A'),key=run.key;draft.science.observer_height_m=20;draft.selected=[];
 assert.equal(run.candidates.length,3);assert.equal(run.candidates[0].request.observer_height_m,2);assert.equal(Object.isFrozen(run.candidates),true);
 assert.equal(key,m.searchKey(input({science:{...base,start_time:'2026-11-06T05:30+05:30'}})));
 assert.notEqual(key,m.searchKey(input({science:{...base,observer_height_m:20}})));
 assert.equal(key,m.searchKey({...input(),profile:'Solar Priority',thresholds:{earth_min_percent:99}}));
});
test('runner reports partial NASA/DEM failures and incomplete results without assigning zero or retrying successes',async()=>{
 let calls=0,last=[];const runner=new m.OpportunityRunner(async req=>{calls++;if(req.latitude===-88.5)throw new Error('DEMO TEST: missing DEM coverage');return {...structuredClone(result),submitted_scenario:req,status:req.latitude===-85.25?'incomplete':'success'};});
 runner.start(m.snapshotSearch(input(),'Run partial'),rows=>last=rows);await tick();await tick();
 assert.deepEqual(m.progressOf(last),{total:3,completed:1,running:0,queued:0,failed:2,skipped:0});
 assert.equal(last.find(r=>r.status==='failed').result,null);assert.match(last.find(r=>r.status==='incomplete').error,/incomplete/);
 assert.equal(Object.isFrozen(last.find(r=>r.status==='success').result.data),true);
 runner.retryFailed();await tick();await tick();assert.equal(calls,5);assert.equal(last.find(r=>r.status==='success').result.earth_comm.visibility_percentage,27.93);runner.dispose();
});
test('cancel and supersede stop unsent jobs; old responses cannot overwrite a new run',async()=>{
 const pending=[],published=[];let active=0,maximum=0;
 const runner=new m.OpportunityRunner((req,signal)=>{active++;maximum=Math.max(maximum,active);return new Promise(resolve=>pending.push({req,signal,resolve:value=>{active--;resolve(value);}}));});
 runner.start(m.snapshotSearch(input(),'old'),rows=>published.push(['old',rows]));assert.equal(pending.length,1);
 runner.cancel();assert.equal(pending[0].signal.aborted,true);assert.equal(m.progressOf(published.at(-1)[1]).skipped,3);
 runner.start(m.snapshotSearch(input({selected:['haworth-edge']}),'new'),rows=>published.push(['new',rows]));assert.equal(pending.length,1);
 pending[0].resolve(result);await tick();assert.equal(pending.length,2);assert.equal(published.at(-1)[0],'new');
 pending[1].resolve(structuredClone(result));await tick();assert.equal(m.progressOf(published.at(-1)[1]).completed,1);assert.equal(maximum,1);runner.dispose();
});
test('page-wide API gate serializes other workflows and skips canceled requests waiting for its slot',async()=>{
 const previous=globalThis.fetch;const pending=[],calls=[];
 globalThis.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return new Promise(resolve=>pending.push(()=>resolve(new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}}))));};
 try {
 const a=api.runVisibilityAnalysis(base);await tick();const abort=new AbortController();const b=api.runVisibilityAnalysis({...base,observer_height_m:20},abort.signal);const bChecked=b.catch(error=>error.name);const c=api.runVisibilityAnalysis({...base,observer_height_m:30});abort.abort();
 assert.equal(calls.length,1);pending[0]();await a;await tick();assert.equal(await bChecked,'AbortError');assert.equal(calls.length,2);assert.equal(calls[1].observer_height_m,30);pending[1]();await c;
 }finally{globalThis.fetch=previous;}
});
test('requirement tiers preserve ties/tradeoffs and unique preference requires verified strict dominance',()=>{
 const keys=['earth_visibility','earth_blackout','sun_visibility','sun_blackout'];const a={record:record('A'),assessment:assessment(keys)},b={record:record('B'),assessment:assessment(keys.slice(0,2))},c={record:record('C'),assessment:assessment(keys.slice(2))};
 const tiers=m.dominanceTiers([a,b,c]);assert.deepEqual([...tiers.values()],[1,2,2]);
 assert.match(m.opportunitySummary([a,b,c],3,true).preference,/Most favorable among evaluated candidates under these requirements: A/);
 assert.match(m.opportunitySummary([b,c],2,true).preference,/Trade-offs/);assert.match(m.opportunitySummary([b,{...b,record:record('D')}],2,true).preference,/Tie/);
 assert.match(m.opportunitySummary([b,c],2,true).headline,/No evaluated candidate met all configured requirements/);
 assert.match(m.opportunitySummary([a,b],3,true).preference,/unavailable/);assert.match(m.opportunitySummary([a],1,true).preference,/Only one/);
 assert.match(m.opportunitySummary([],0,true).headline,/No candidate has verified data/);
});
test('assessment-only edits generate no science calls and transfers preserve exact validated data and capacity',async()=>{
 let calls=0,last=[];const runner=new m.OpportunityRunner(async req=>{calls++;return {...structuredClone(result),submitted_scenario:req};});runner.start(m.snapshotSearch(input({selected:['haworth-edge']}),'Run transfer'),rows=>last=rows);await tick();
 const r=last[0],before=JSON.stringify(r.result);const a=assessment(['earth_visibility','earth_blackout'],'Conditional');const transfer=m.candidateTransfer(r,a,'Balanced',thresholds,'transfer-1');assert.ok(transfer);assert.equal(m.safeTransfer(transfer),true);
 for(const min of [0,20,50,70])m.assessmentKey(r,'Solar Priority',{...thresholds,sun_min_percent:min});assert.equal(calls,1);
 const {newScenario}=await server.ssrLoadModule('/src/utils/comparison.ts');const rows=[newScenario('1','1',base),newScenario('2','2',base)];const imported=m.importEvaluatedCandidate(rows,transfer,'3');assert.equal(imported.rows.length,3);assert.equal(imported.rows[0],rows[0]);assert.equal(imported.rows[2].result,r.result);assert.deepEqual(imported.rows[2].submitted,transfer.scenario);assert.equal(Object.isFrozen(imported.rows[2].submitted),true);assert.equal(JSON.stringify(r.result),before);
 assert.equal(m.importEvaluatedCandidate([...rows,...rows,...rows].slice(0,5),transfer,'6').rows.length,5);
 assert.equal(m.safeTransfer({...transfer,scenario:{...base,observer_height_m:20}}),false);
 assert.equal(m.candidateTransfer({...r,status:'failed'},a,'Balanced',thresholds,'bad'),null);
 assert.equal(m.candidateTransfer(r,{...a,thresholds:{...thresholds,earth_min_percent:99}},'Balanced',thresholds,'bad'),null);
 runner.dispose();
});
test('native date fields update the search model and cards preserve unknown, geometry qualifiers and real values',()=>{
 let changed;const tree=ui.DateSearchControls({earliest:'2026-11-19T00:00',latest:'2026-11-23T00:00',durationHours:36,onChange:v=>changed=v});const inputs=[];const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='input')inputs.push(node);React.Children.forEach(node.props?.children,walk);};walk(tree);
 inputs[0].props.onInput({currentTarget:{value:'2026-12-31T12:00'}});assert.deepEqual(changed,{earliest:'2026-12-31T12:00'});
 for(const label of ['Favorable','Conditional','Challenging']){const r=record(),a=assessment([],label);const html=render(React.createElement(ui.FinderCandidateCard,{record:r,item:{record:r,assessment:a},tier:1,disabled:false,comparisonFull:false,onOpen:()=>{},onCompare:()=>{}}));for(const text of [label,'27.93%','potential direct communication opportunity','potential solar charging opportunity','354.57','Open in Mission Planner','Add to comparison','2026-11-26T12:00:00Z'])assert.ok(html.includes(text),text);}
 const missing=render(React.createElement(ui.FinderCandidateCard,{record:{...record(),result:null,status:'failed',error:'Missing DEM'},disabled:true,comparisonFull:false,onOpen:()=>{},onCompare:()=>{}}));assert.match(missing,/Insufficient Data/);assert.ok(!missing.includes('0.00%'));assert.ok(!missing.includes('Open in Mission Planner'));
 const empty=render(React.createElement(ui.OpportunityFinder,{baseRequest:base,comparisonCount:2,onOpen:()=>{},onCompare:()=>{}}));for(const text of ['I know my dates','I know my site','Start Search','3 candidates ready','Advanced Settings','not NASA recommendations','no results are preloaded'])assert.ok(empty.includes(text),text);
});
