import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {createServer} from 'vite';
const serverFor=()=>createServer({cacheDir:'node_modules/.vite-tests/judge-workflow.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
function find(tree,predicate){let found;const walk=node=>{if(!node || typeof node!=='object')return;if(predicate(node))found=node;React.Children.forEach(node.props?.children,walk);};walk(tree);return found;}

test('preset selection changes only the site and keeps mission dates and settings',async()=>{
 const server=await serverFor();try{
 const {SitePicker,SimpleControls}=await server.ssrLoadModule('/src/components/MissionExplorer.tsx');
 const request={latitude:-89.9,longitude:0,start_time:'2026-11-06T00:00',stop_time:'2026-11-26T12:00',observer_height_m:0,step_size:'10m',horizon_max_distance_km:100};let next;
 const tree=SitePicker({request,onChange:value=>{next=value}});find(tree,node=>node.type==='select').props.onChange({target:{value:'haworth-edge'}});
 assert.deepEqual(next,{...request,latitude:-87.87,longitude:-5.1});
 const html=render(React.createElement(SimpleControls,{request,onChange:()=>{},onRun:()=>{},loading:false}));assert.ok(html.includes('Enter precise coordinates (optional)'));assert.ok(!html.includes('<details open'));assert.ok(html.includes('Choose a site preset'));
 }finally{await server.close();}
});

test('comparison exposes named site/date choices and blocks invalid date ranges',async()=>{
 const server=await serverFor();try{
 const {LandingSiteComparison}=await server.ssrLoadModule('/src/components/LandingSiteComparison.tsx');
 const request={latitude:-87.87,longitude:-5.1,start_time:'2026-11-06T00:00',stop_time:'2026-11-26T12:00',observer_height_m:0,step_size:'1h'};
 const html=render(React.createElement(LandingSiteComparison,{baseRequest:request,onChangeRequest:()=>{}}));
 for(const text of ['Shared assessment profile','Mission start','Mission end','Scenario 1 configuration','Scenario 2 configuration','Advanced scientific inputs','Run Comparison','Copy Mission Planner'])assert.ok(html.includes(text),text);
 const invalid=render(React.createElement(LandingSiteComparison,{baseRequest:{...request,stop_time:'2026-11-01T00:00'},onChangeRequest:()=>{}}));
 assert.ok(invalid.includes('Choose a valid comparison end date'));assert.ok(invalid.includes('disabled=""'));
 }finally{await server.close();}
});

test('default app is map-first and exposes implemented navigation destinations without future-feature placeholders',async()=>{
 const server=await serverFor();const prior=globalThis.window;globalThis.window={location:{search:''}};
 try{
 const {App}=await server.ssrLoadModule('/src/App.tsx');const html=render(React.createElement(App));
 for(const label of ['Explore Moon','Plan Mission','Results','Compare','Find Opportunities','NASA LOLA Lunar South Pole Shaded Relief'])assert.ok(html.includes(label),label);
 assert.ok(html.indexOf('NASA LOLA Lunar South Pole Shaded Relief')<html.indexOf('Where will you explore?'));
 assert.ok(!html.includes('Science Lab'));assert.ok(!html.includes('Try Example Mission'));
 }finally{globalThis.window=prior;await server.close();}
});
