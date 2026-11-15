import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {createServer} from 'vite';

test('assessment presentation explains labels, requirement results and non-probability scope',async()=>{
 const server=await createServer({cacheDir:'node_modules/.vite-tests/assessment.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
 const {AssessmentVerdict,MissionAssessment}=await server.ssrLoadModule('/src/components/MissionAssessment.tsx');
 const thresholds={earth_min_percent:50,sun_min_percent:50,earth_max_blackout_hours:24,sun_max_blackout_hours:24};
 for(const label of ['Favorable','Conditional','Challenging','Insufficient Data']){
 const html=render(React.createElement(AssessmentVerdict,{assessment:{label,profile:'Balanced',thresholds,reason:'Synthetic component test',exportable:label!=='Insufficient Data',requirements:[{key:'sun_visibility',target:'sun',title:'Sun center visibility',actual:0,threshold:50,relation:'>=',unit:'%',passed:false,primary:true}]}}));
 for(const value of [label,'FAIL','Sunlight available','0.00','not a probability','battery charging','0 of 1 requirements met','requirement-primary'])assert.ok(html.includes(value),value);
 }
 const request={latitude:-89.9,longitude:0,start_time:'2026-11-06T00:00:00',stop_time:'2026-11-07T12:00:00'};
 const empty=render(React.createElement(MissionAssessment,{submitted:null,draft:request,result:null,onDates:()=>{},onSite:()=>{},onMast:()=>{}}));
 for(const text of ['Insufficient Data','Download PDF','disabled','Run an analysis','Solar Priority','Communication Priority','Balanced','Minimum Earth visibility','No composite score','not different NASA results','Advanced Settings','Maximum tolerable Earth communication interruption'])assert.ok(empty.includes(text),text);
 }finally{await server.close();}
});

test('assessment-only edits preserve the frozen science and update the export envelope; science edits invalidate it',async()=>{
 const server=await createServer({cacheDir:'node_modules/.vite-tests/assessment.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
 const {assessmentEnvelope,exportBlockReason}=await server.ssrLoadModule('/src/utils/assessment.ts');
 const req=JSON.parse(await readFile(new URL('../../docs/validation-step13/baseline.json',import.meta.url),'utf8')).haworth492.input;
 const result=JSON.parse(await readFile(new URL('../../docs/validation-step13/haworth492-analysis.json',import.meta.url),'utf8'));result.submitted_scenario=req;
 const before=JSON.stringify({req,result});
 const defaults={earth_min_percent:50,sun_min_percent:50,earth_max_blackout_hours:24,sun_max_blackout_hours:24};
 for(const profile of ['Solar Priority','Communication Priority','Balanced']) {
   const edited={...defaults,earth_min_percent:20,earth_max_blackout_hours:360};
   const env=assessmentEnvelope(req,{...req,start_time:req.start_time.slice(0,16)},result,profile,edited);
   assert.equal(exportBlockReason(req,env.draft_scenario,result),'');
   assert.equal(env.result,result);assert.equal(env.scenario,req);assert.equal(env.draft_scenario,req);
   assert.equal(env.settings.profile,profile);assert.deepEqual(env.settings.thresholds,edited);
   edited.earth_min_percent=99;assert.equal(env.settings.thresholds.earth_min_percent,20);
 }
 for(const change of [{latitude:-88},{longitude:12},{start_time:'2026-11-07T00:00'},{stop_time:'2026-11-27T12:00'},{observer_height_m:20},{step_size:'2h'},{horizon_max_distance_km:100},{horizon_azimuth_step_deg:2}]) {
   const draft={...req,...change};const env=assessmentEnvelope(req,draft,result,'Balanced',defaults);
   assert.match(exportBlockReason(req,env.draft_scenario,result),/Scientific inputs changed/);
 }
 assert.equal(JSON.stringify({req,result}),before);
 }finally{await server.close();}
});

test('requirement sliders and exact controls preserve precision and clearly separate priority rows',async()=>{
 const server=await createServer({cacheDir:'node_modules/.vite-tests/assessment.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try {
 const {RequirementControls,AssessmentVerdict,PROFILE_HELP}=await server.ssrLoadModule('/src/components/MissionAssessment.tsx');
 const thresholds={earth_min_percent:20.1234,sun_min_percent:0,earth_max_blackout_hours:360,sun_max_blackout_hours:500};
 let next;const tree=RequirementControls({thresholds,onChange:value=>next=value,elapsedHours:492});
 const inputs=[];const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='input')inputs.push(node);React.Children.forEach(node.props?.children,walk);};walk(tree);
 assert.equal(inputs.filter(n=>n.props.type==='range').length,4);
 const numeric=inputs.filter(n=>n.props.type==='number');assert.equal(numeric[0].props.value,20.1234);
 numeric[0].props.onChange({target:{valueAsNumber:20.56789}});assert.equal(next.earth_min_percent,20.56789);
 assert.equal(next.sun_max_blackout_hours,500);assert.equal(thresholds.earth_min_percent,20.1234);
 const html=render(React.createElement(AssessmentVerdict,{assessment:{label:'Conditional',reason:'test',requirements:[{key:'earth_visibility',actual:20,threshold:10,unit:'%',relation:'>=',passed:true,primary:true},{key:'sun_visibility',actual:0,threshold:50,unit:'%',relation:'>=',passed:false,primary:false}]}}));
 for(const text of ['1 of 2 requirements met','requirement-primary','requirement-secondary','Priority','Secondary','✓','×'])assert.ok(html.includes(text));
 assert.match(PROFILE_HELP['Solar Priority'],/Sunlight/);assert.match(PROFILE_HELP['Communication Priority'],/Earth/);assert.match(PROFILE_HELP.Balanced,/equal/);
 }finally{await server.close();}
});

test('Simple View discloses exact science and avoids repeated percentage and interruption cards',async()=>{
 const server=await createServer({cacheDir:'node_modules/.vite-tests/assessment.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try {
 const {ResultSummary}=await server.ssrLoadModule('/src/components/MissionExplorer.tsx');
 const result=JSON.parse(await readFile(new URL('../../docs/validation-step13/haworth492-analysis.json',import.meta.url),'utf8'));
 const simple=render(React.createElement(ResultSummary,{result,radiusKm:50,engineering:false}));
 assert.ok(simple.includes('137.4'));assert.ok(simple.includes('h visible'));assert.ok(simple.includes('Why is this 0%?'));
 assert.ok(!simple.includes('Longest Earth-visibility blackout'));assert.ok(!simple.includes('27.9<small'));
 assert.ok(simple.includes('Scenario details'));assert.ok(simple.includes('2026-11-26T12:00:00Z'));
 assert.ok(!/<details[^>]*open/.test(simple));assert.ok(simple.includes('Haworth radius sensitivity'));
 const engineering=render(React.createElement(ResultSummary,{result,radiusKm:50,engineering:true}));
 assert.ok(engineering.includes('Longest Earth-visibility blackout'));assert.ok(engineering.includes('27.9'));
 }finally{await server.close();}
});

test('export eligibility blocks no data, stale, incomplete and old-provenance results',async()=>{
 const server=await createServer({cacheDir:'node_modules/.vite-tests/assessment.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
 const {exportBlockReason,validThresholds}=await server.ssrLoadModule('/src/utils/assessment.ts');
 const baseline=JSON.parse(await readFile(new URL('../../docs/validation-step13/baseline.json',import.meta.url),'utf8')).haworth492;
 const req=baseline.input;const result=JSON.parse(await readFile(new URL('../../docs/validation-step13/haworth492-analysis.json',import.meta.url),'utf8'));result.submitted_scenario=req;
 assert.equal(exportBlockReason(req,req,result),'');
 assert.match(exportBlockReason(req,{...req,observer_height_m:20},result),/stale/);
 assert.match(exportBlockReason(req,req,null),/Run an analysis/);
 assert.match(exportBlockReason(req,req,{...result,status:'incomplete'}),/incomplete/);
 assert.match(exportBlockReason(req,req,{...result,submitted_scenario:undefined}),/provenance/);
 assert.match(exportBlockReason(req,req,result,true),/running/);
 assert.equal(validThresholds({earth_min_percent:100,sun_min_percent:0,earth_max_blackout_hours:0,sun_max_blackout_hours:492}),true);
 assert.equal(validThresholds({earth_min_percent:100.01,sun_min_percent:0,earth_max_blackout_hours:0,sun_max_blackout_hours:492}),false);
 assert.equal(validThresholds({earth_min_percent:50,sun_min_percent:50,earth_max_blackout_hours:NaN,sun_max_blackout_hours:24}),false);
 }finally{await server.close();}
});
