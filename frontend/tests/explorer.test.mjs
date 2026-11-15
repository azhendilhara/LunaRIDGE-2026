import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('workflow navigation exposes current step and all backward destinations', async () => {
 const server=await createServer({cacheDir:'node_modules/.vite-tests/explorer.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try { const {WorkflowNav,SimpleControls}=await server.ssrLoadModule('/src/components/MissionExplorer.tsx');
 for(const step of ['explore','plan','results','compare','finder']) { const html=renderToStaticMarkup(React.createElement(WorkflowNav,{step,onNavigate:()=>{}})); assert.equal((html.match(/aria-current="step"/g)||[]).length,1); for(const label of ['Explore Moon','Plan Mission','Results','Compare','Find Opportunities']) assert.ok(html.includes(label)); }
 const html=renderToStaticMarkup(React.createElement(SimpleControls,{request:{latitude:-79,longitude:0,start_time:'2026-11-14',stop_time:'2026-11-13'},onChange:()=>{},onRun:()=>{},loading:false})); assert.ok(html.includes('disabled')); assert.ok(html.includes('end date after the start'));
 }finally{await server.close();}
});

test('interpretation uses computed values and discloses evaluated bounds',async()=>{
 const server=await createServer({cacheDir:'node_modules/.vite-tests/explorer.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{const {ResultSummary}=await server.ssrLoadModule('/src/components/MissionExplorer.tsx');
 const summary={visibility_percentage:12.5,total_visible_hours:3,total_blocked_hours:21,total_interval_hours:24,longest_blackout_hours:18};
 const result={status:'success',site:{latitude:-89.9,longitude:0,observer_height_m:2},time_range:{start_time:'2026-11-14T00:00:00Z',stop_time:'2026-11-15T00:00:00Z',requested_start_time:'2026-11-14T00:00:00Z',requested_stop_time:'2026-11-15T00:30:00Z',elapsed_hours:24,total_points:25},earth_comm:summary,solar_power:{...summary,visibility_percentage:0,total_visible_hours:0,total_blocked_hours:24,longest_blackout_hours:24}};
 const html=renderToStaticMarkup(React.createElement(ResultSummary,{result})); for(const text of ['12.5','18.0','24.0','Only the evaluated','does not establish permanent shadow']) assert.ok(html.includes(text),text);
 }finally{await server.close();}
});

test('native date input events update the submitted-scenario draft',async()=>{
 const server=await createServer({cacheDir:'node_modules/.vite-tests/explorer.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
 const {SimpleControls}=await server.ssrLoadModule('/src/components/MissionExplorer.tsx');
 const request={latitude:-87.87,longitude:-5.1,start_time:'2026-11-06T00:00',stop_time:'2026-11-26T12:00'};
 let draft=request;
 const tree=SimpleControls({request,onChange:next=>{draft=next},onRun:()=>{},loading:false});
 const inputs=[];
 const walk=node=>{if(!node || typeof node!=='object')return; if(node.type==='input' && node.props.type==='datetime-local') inputs.push(node); React.Children.forEach(node.props?.children,walk);};
 walk(tree); assert.equal(inputs.length,2);
 inputs[1].props.onInput({currentTarget:{value:'2026-11-27T12:00'}});
 assert.equal(draft.stop_time,'2026-11-27T12:00'); assert.equal(draft.start_time,request.start_time);
 assert.notEqual(JSON.stringify(draft),JSON.stringify(request));
 }finally{await server.close();}
});
