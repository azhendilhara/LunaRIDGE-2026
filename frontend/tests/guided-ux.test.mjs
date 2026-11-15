import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
let server,examples,ui,errors,model,api;
const catalog=JSON.parse(await readFile(new URL('../public/examples/catalog.json',import.meta.url),'utf8'));
before(async()=>{server=await createServer({cacheDir:'node_modules/.vite-tests/guided-ux',server:{middlewareMode:true,hmr:false},appType:'custom'});examples=await server.ssrLoadModule('/src/utils/examples.ts');ui=await server.ssrLoadModule('/src/components/ComparisonWorkspace.tsx');errors=await server.ssrLoadModule('/src/utils/requestErrors.ts');model=await server.ssrLoadModule('/src/utils/comparison.ts');api=await server.ssrLoadModule('/src/services/api.ts');});
after(async()=>await server.close());
const payload=async item=>JSON.parse(await readFile(new URL(`../public/examples/${item.id}.json`,import.meta.url),'utf8'));
async function assessed(item=catalog.items[0]){const result=await payload(item);return {row:{id:item.id,name:item.name,draft:item.scenario,submitted:item.scenario,result,status:'success',error:''},assessment:item.assessment};}
test('saved examples carry exact source/response hashes and safe Planner/Compare transfers',async()=>{
 for(const item of catalog.items){
  const bytes=await readFile(new URL(`../public/examples/${item.id}.json`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.source.response_sha256);
  const value=examples.verifiedExampleTransfer(item,JSON.parse(bytes));assert.equal(value.settings.profile,item.settings.profile);assert.deepEqual(value.scenario,item.scenario);
  const imported=model.newScenario('first','First',item.scenario);const {importEvaluatedCandidate}=await server.ssrLoadModule('/src/utils/opportunity.ts');
  const result=importEvaluatedCandidate([imported],value,'added');assert.equal(result.error,'');assert.equal(result.rows[1].result,value.result);assert.equal(result.rows[1].recordedExample,true);
  const wrong=structuredClone(value.result);wrong.submitted_scenario.longitude+=1;assert.throws(()=>examples.verifiedExampleTransfer(item,wrong));
 }
});
test('loading a saved response uses only its static path and rejects corrupt bytes',async()=>{
 const old=globalThis.fetch,item=catalog.items[0],calls=[];try{
  const bytes=await readFile(new URL(`../public/examples/${item.id}.json`,import.meta.url));
  globalThis.fetch=async url=>{calls.push(url);return new Response(bytes);};
  const value=await examples.loadExample(item);assert.equal(value.id,`example:${item.id}`);assert.deepEqual(calls,[item.source.response_url]);
  globalThis.fetch=async()=>new Response('{}');await assert.rejects(examples.loadExample(item),/checksum/);
 }finally{globalThis.fetch=old;}
});
test('Simple comparison shows actual bars and requirements; schedules and diagnostics stay in Engineering',async()=>{
 const item=await assessed();const html=render(React.createElement(ui.SimpleComparisonResult,{item}));
 for(const text of ['27.93%','width:27.93%','354.57 h','492.00 h','Earth visibility','not met','Planning limitations'])assert.ok(html.includes(text),text);
 for(const text of ['MISSION AVAILABILITY TIMELINES','Exact returned summaries','Paired elevation','Submitted settings'])assert.ok(!html.includes(text),text);
 const engineering=render(React.createElement(ui.ScenarioEngineering,{row:item.row}));assert.ok(engineering.includes('Exact returned summaries'));assert.ok(engineering.includes('NASA provenance'));
 const initial=render(React.createElement(ui.ComparisonWorkspace,{baseRequest:item.row.draft,mode:'simple'}));assert.ok(initial.includes('Mission context'));assert.ok(!initial.includes('class="scenario-editor" open'));
});
test('beginner difference does not invent a winner and preserves fair unequal-duration conclusions',async()=>{
 const a=await assessed(catalog.items[0]),b=await assessed(catalog.items[1]);assert.match(ui.simpleDifference([a,b]),/27.93 percentage points/);assert.match(ui.simpleDifference([a,b]),/sunlight is the same/);
 assert.match(model.comparisonFinding([a,b]).timing,/raw visible hours are not ranked/);assert.match(model.comparisonFinding([a,b],3).preference,/not verified/);
 const five=Array.from({length:5},(_,i)=>({...a,row:{...a.row,id:String(i)}}));assert.match(model.comparisonFinding(five).preference,/Tie/);
});
test('homepage offers three real actions without pretending saved constraints are favorable',async()=>{
 const {RecommendedMissions}=await server.ssrLoadModule('/src/components/RecommendedMissions.tsx');
 const html=render(React.createElement(RecommendedMissions,{active:true,onPlan(){},onSearch(){},onOpen(){},onCompare(){},comparisonFull:false}));
 for(const label of ['Discover Recommended Mission Opportunities','Explore evaluated example missions','Plan my own mission','Find new opportunities','not a NASA recommendation'])assert.ok(html.includes(label),label);
 assert.equal(catalog.items.filter(i=>i.assessment.label==='Favorable').length,0);
});
test('busy, upstream, coverage, rate and offline failures stay distinct without automatic retries',async()=>{
 assert.match(errors.describeApiFailure(503,'compute slot busy','3'),/Scientific engine busy.*Retry after 3 seconds/);
 assert.match(errors.describeApiFailure(503,'NASA Horizons requested cooldown','60'),/NASA ephemeris service unavailable/);
 assert.match(errors.describeApiFailure(422,'LOLA DEM coverage incomplete',null),/unknown, not zero/);
 assert.match(errors.describeApiFailure(502,'unexpected response',null,'NASA JPL Horizons Error'),/NASA ephemeris service unavailable/);
 assert.match(errors.describeApiFailure(429,'quota reached','60'),/Request limit reached/);
 const old=globalThis.fetch;let calls=0;try{globalThis.fetch=async()=>{calls++;throw new TypeError('Failed to fetch');};await assert.rejects(api.checkBackendHealth(),/Cannot reach the scientific backend/);assert.equal(calls,1);}finally{globalThis.fetch=old;}
});
