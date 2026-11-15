import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {createServer} from 'vite';
let server,model,ui,scenario,base,result;
before(async()=>{
 server=await createServer({cacheDir:'node_modules/.vite-tests/comparison.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
 model=await server.ssrLoadModule('/src/utils/comparison.ts');
 ui=await server.ssrLoadModule('/src/components/ComparisonWorkspace.tsx');
 scenario=await server.ssrLoadModule('/src/utils/scenario.ts');
 base=JSON.parse(await readFile(new URL('../../docs/validation-step13/baseline.json',import.meta.url),'utf8')).haworth492.input;
 result=JSON.parse(await readFile(new URL('../../docs/validation-step13/haworth492-analysis.json',import.meta.url),'utf8'));
});
after(async()=>{await server?.close();});
const completed=(id='a',change={})=>({...model.newScenario(id,id,{...base,...change}),submitted:{...base,...change},status:'success',result:structuredClone(result)});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function assessed(row,passes=[]){return {row,assessment:{label:passes.length===4?'Favorable':passes.length===2?'Conditional':'Challenging',exportable:true,requirements:['earth_visibility','earth_blackout','sun_visibility','sun_blackout'].map(key=>({key,passed:passes.includes(key)}))}};}

for(const size of [2,3,4,5])test(`${size} scenarios retain independent identities and edits`,()=>{
 let rows=[model.newScenario('1','First',base),model.newScenario('2','Second',base)];
 for(let n=3;n<=size;n++)rows=model.addScenario(rows,model.newScenario(String(n),`Scenario ${n}`,base));
 assert.equal(rows.length,size);const before=JSON.stringify(rows);
 const edited=model.editScenario(rows,'2',{draft:{...base,start_time:'2026-11-07T00:00'},name:'Later date'});
 assert.equal(edited[0],rows[0]);assert.notEqual(edited[1].draft,rows[1].draft);assert.equal(JSON.stringify(rows),before);
 assert.equal(edited[1].draft.start_time,'2026-11-07T00:00');
});
test('maximum, minimum, duplicate, removal and reorder are safe and preserve result ownership',()=>{
 let rows=[completed('a'),completed('b')];rows=model.duplicateScenario(rows,'a','c');
 assert.equal(rows[2].result,null);assert.equal(rows[2].submitted,null);assert.notEqual(rows[2].draft,rows[0].draft);
 rows=model.moveScenario(rows,'c',-1);assert.deepEqual(rows.map(r=>r.id),['a','c','b']);assert.equal(rows[2].result.earth_comm.visibility_percentage,27.93);
 rows=model.addScenario(rows,model.newScenario('d','d',base));rows=model.addScenario(rows,model.newScenario('e','e',base));
 assert.equal(model.addScenario(rows,model.newScenario('f','f',base)),rows);
 rows=model.removeScenario(rows,'c');rows=model.removeScenario(rows,'d');rows=model.removeScenario(rows,'e');
 assert.equal(rows.length,2);assert.equal(model.removeScenario(rows,'a'),rows);assert.equal(model.moveScenario(rows,'a',-1),rows);
});
test('UTC normalization, same-site different-date and different-site same/different-date identity',()=>{
 const original=scenario.scientificScenarioKey(base);
 assert.equal(original,scenario.scientificScenarioKey({...base,start_time:'2026-11-06T05:30:00+05:30',stop_time:'2026-11-26T17:30:00+05:30'}));
 for(const change of [{start_time:'2026-11-07T00:00'},{latitude:-88.5},{latitude:-88.5,stop_time:'2026-11-27T12:00'},{observer_height_m:20},{step_size:'2h'},{horizon_max_distance_km:100},{horizon_azimuth_step_deg:2}])assert.notEqual(original,scenario.scientificScenarioKey({...base,...change}));
 assert.equal(model.validRequest(base),true);for(const change of [{stop_time:base.start_time},{latitude:-79},{observer_height_m:101},{step_size:'0h'},{horizon_max_distance_km:151},{horizon_azimuth_step_deg:0},{longitude:NaN}])assert.equal(model.validRequest({...base,...change}),false);
});
test('native comparison date input events update only the edited scenario before submission',()=>{
 const rows=[completed('a'),completed('b')];let next=rows;const controls=ui.ScenarioDates({request:rows[1].draft,onChange:req=>next=model.editScenario(rows,'b',{draft:req})});
 const inputs=[];const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='input')inputs.push(node);React.Children.forEach(node.props?.children,walk);};walk(controls);
 assert.equal(inputs.length,2);assert.equal(typeof inputs[0].props.onInput,'function');assert.equal(typeof inputs[0].props.onChange,'function');
 inputs[1].props.onInput({currentTarget:{value:'2026-11-07T12:00'}});
 assert.equal(next[0],rows[0]);assert.equal(next[1].draft.stop_time,'2026-11-07T12:00');assert.equal(model.isStale(next[1]),true);
});
test('only edited scientific scenario becomes stale; names and equivalent UTC retain science',()=>{
 const rows=[completed('a'),completed('b'),completed('c')];
 const edited=model.editScenario(rows,'b',{draft:{...base,observer_height_m:20}});
 assert.deepEqual(edited.map(model.isStale),[false,true,false]);assert.deepEqual(edited.map(model.usableResult),[true,false,true]);
 assert.equal(model.isStale(model.editScenario(rows,'a',{name:'Renamed'})[0]),false);
 assert.equal(model.isStale({...rows[0],draft:{...base,start_time:base.start_time.slice(0,16)}}),false);
 for(const status of ['error','incomplete','canceled','loading','queued','idle'])assert.equal(model.usableResult({...rows[0],status}),false);
 assert.equal(model.usableResult({...rows[0],result:{...result,status:'incomplete'}}),false);
 assert.equal(model.usableResult({...rows[0],result:{...result,earth_comm:null}}),false);
});
test('queue bounds physical requests, ignores superseded responses and preserves frozen snapshots',async()=>{
 let concurrent=0,maximum=0;const pending=[],commits=[],starts=[];
 const queue=new model.ComparisonQueue(req=>{concurrent++;maximum=Math.max(maximum,concurrent);return new Promise((resolve,reject)=>pending.push({req,resolve:v=>{concurrent--;resolve(v)},reject:e=>{concurrent--;reject(e)}}));});
 const cb=id=>({start:()=>starts.push(id),finish:r=>commits.push([id,r]),fail:e=>commits.push([id,e.message])});
 const draft={...base};queue.enqueue('a',draft,cb('old'));draft.observer_height_m=20;
 assert.equal(Object.isFrozen(pending[0].req),true);assert.equal(pending[0].req.observer_height_m,2);
 queue.enqueue('a',draft,cb('new'));queue.enqueue('b',base,cb('b'));
 pending[0].resolve('old response');await tick();assert.deepEqual(commits,[]);assert.deepEqual(starts,['old','new']);
 pending[1].resolve('new response');await tick();assert.deepEqual(commits,[['new','new response']]);
 pending[2].reject(new Error('Missing DEM coverage'));await tick();assert.deepEqual(commits[1],['b','Missing DEM coverage']);assert.equal(maximum,1);queue.dispose();
});
test('canceled queued jobs never run and late completion after removal/unmount never commits',async()=>{
 let resolve;const calls=[],commits=[];const queue=new model.ComparisonQueue(req=>{calls.push(req);return new Promise(r=>resolve=r)});
 const cb={start:()=>{},finish:r=>commits.push(r),fail:e=>commits.push(e)};
 queue.enqueue('a',base,cb);queue.enqueue('b',base,cb);queue.invalidate('b');queue.invalidate('a');
 resolve(result);await tick();assert.equal(calls.length,1);assert.deepEqual(commits,[]);
 queue.enqueue('c',base,cb);queue.dispose();resolve(result);await tick();assert.deepEqual(commits,[]);
});
test('fair comparison uses requirement sets, handles ties/tradeoffs and does not rank raw hours',()=>{
 const keys=['earth_visibility','earth_blackout','sun_visibility','sun_blackout'];const a=assessed(completed('A'),keys),b=assessed(completed('B'),keys.slice(0,2));
 let finding=model.comparisonFinding([a,b]);assert.match(finding.preference,/A is preferred only by requirement-set dominance/);
 finding=model.comparisonFinding([a,a]);assert.match(finding.preference,/Tie/);
 finding=model.comparisonFinding([b,assessed(completed('C'),keys.slice(2))]);assert.match(finding.preference,/Trade-offs/);
 assert.match(model.comparisonFinding([a,b],3).preference,/not verified/);
 const longer=assessed(completed('Longer'),keys.slice(0,2));longer.row.result.time_range.stop_time='2026-12-26T12:00:00Z';longer.row.result.time_range.elapsed_hours=1212;
 longer.row.result.earth_comm.total_visible_hours=900;longer.row.result.earth_comm.visibility_percentage=10;
 finding=model.comparisonFinding([b,longer]);assert.match(finding.timing,/raw visible hours are not ranked/);assert.match(finding.preference,/Tie/);assert.ok(!finding.preference.includes('900'));
 assert.match(model.comparisonFinding([b]).headline,/at least two/);
});
test('same, different, equal-duration and overlapping UTC windows keep independent timeline bounds',async()=>{
 const a=assessed(completed('A')),b=assessed(completed('B'));
 assert.match(model.comparisonFinding([a,b]).timing,/Same evaluated UTC/);
 b.row.result.time_range.start_time='2026-11-07T00:00:00Z';b.row.result.time_range.stop_time='2026-11-27T12:00:00Z';
 assert.match(model.comparisonFinding([a,b]).timing,/equal duration/);
 const {TimelineBar}=await server.ssrLoadModule('/src/components/TimelineBar.tsx');
 const html=render(React.createElement(TimelineBar,{earthComm:result.earth_comm,solarPower:result.solar_power,timeRange:result.time_range,compact:true}));
 assert.ok(html.includes('72.066'));assert.ok(html.includes('27.933'));assert.ok(html.includes('2026-11-20T18:34:01Z'));
 b.row.result.time_range.elapsed_hours=468;assert.match(model.comparisonFinding([a,b]).timing,/raw visible hours are not ranked/);
});
test('real fixture bars show exact percentages; Engineering exposes exact science and provenance',()=>{
 const item=assessed(completed('Haworth'));
 const bars=render(React.createElement(ui.ComparisonBars,{items:[item]}));for(const text of ['27.93%','width:27.93%','aria-valuenow="0"','potential direct communication opportunity','potential solar charging opportunity'])assert.ok(bars.includes(text),text);
 const eng=render(React.createElement(ui.ScenarioEngineering,{row:item.row}));
 for(const text of ['-3484.79','354.567','137.433','2026-11-26T12:00:00Z','Exact returned summaries','Paired elevation','NASA provenance','Haworth sensitivity','0.267'])assert.ok(eng.includes(text),text);
 assert.ok(!eng.includes('Normalized visibility comparison'));
});
