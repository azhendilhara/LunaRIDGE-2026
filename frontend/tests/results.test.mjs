import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {createServer} from 'vite';
const load=async name=>JSON.parse(await readFile(new URL(`../../docs/validation-step13/${name}-analysis.json`,import.meta.url),'utf8'));

test('result findings, zero causes, missing diagnostics and comparison use real evidence',async()=>{
 const server=await createServer({cacheDir:'node_modules/.vite-tests/results.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
 const {MissionFinding,VisibilityCard,ComparisonFinding,SearchRadiusNotice}=await server.ssrLoadModule('/src/components/ScientificResults.tsx');
 const n=await load('nobile36'), d=await load('degerlache492'), h=await load('haworth492');
 const card=(r,target)=>render(React.createElement(VisibilityCard,{result:r,target}));
 let html=card(d,'sun'); for(const text of ['Why is this 0%?','2.5222','-1.3472','paired','above the horizontal']) assert.ok(html.includes(text),text);
 html=card(n,'earth');assert.ok(html.includes('both'));assert.ok(html.includes('below the horizontal'));
 html=card(h,'sun');assert.ok(html.includes('some sampled times'));
 html=card({...d,data:[]},'sun');assert.ok(html.includes('diagnostics are unavailable'));assert.ok(!html.includes('-1.3472'));
 html=card({...d,status:'incomplete'},'sun');assert.ok(html.includes('Unavailable'));assert.ok(!html.includes('Why is this 0%?'));
 html=card({...d,solar_power:null},'sun');assert.ok(html.includes('Unavailable'));assert.ok(!html.includes('0.0%'));
 html=render(React.createElement(MissionFinding,{result:h}));assert.ok(html.includes('137.4'));assert.ok(html.includes('Finding'));assert.ok(html.includes('Operational implications'));
 html=render(React.createElement(ComparisonFinding,{a:d,b:h}));assert.ok(html.includes('137.4 more hours'));assert.ok(html.includes('neither site'));assert.ok(html.includes('354.6'));assert.ok(!html.includes('winner'));
 html=render(React.createElement(ComparisonFinding,{a:d,b:d}));assert.ok(html.includes('equal')); 
 html=render(React.createElement(ComparisonFinding,{a:d,b:{...h,time_range:{...h.time_range,stop_time:'2026-11-27T00:00:00Z'}}}));assert.ok(html.includes('unavailable'));assert.ok(!html.includes('more hours'));
 html=render(React.createElement(SearchRadiusNotice,{site:h.site,radiusKm:25}));assert.ok(html.includes('25 km'));assert.ok(html.includes('27.34%'));assert.ok(html.includes('Step 13'));
 // A rounded percentage of zero is not proof of exactly zero visible duration.
 html=card({...d,solar_power:{...d.solar_power,total_visible_hours:0.001,visibility_percentage:0}},'sun');assert.ok(!html.includes('Why is this 0%?'));assert.ok(html.includes('below display precision'));
 }finally{await server.close();}
});
