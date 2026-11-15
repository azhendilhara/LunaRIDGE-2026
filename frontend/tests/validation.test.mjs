import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('recorded Haworth timeline widths and offsets match actual evaluated windows',async()=>{
 const data=JSON.parse(await readFile(new URL('../../docs/validation-step13/haworth492-analysis.json',import.meta.url),'utf8'));
 const server=await createServer({cacheDir:'node_modules/.vite-tests/validation.test',server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
 const {TimelineBar}=await server.ssrLoadModule('/src/components/TimelineBar.tsx');
 const html=renderToStaticMarkup(React.createElement(TimelineBar,{earthComm:data.earth_comm,solarPower:data.solar_power,timeRange:data.time_range}));
 let totalWidth=0;
 for(const w of data.earth_comm.windows){const left=(Date.parse(w.start_time)-Date.parse(data.time_range.start_time))/3600000/492*100; const width=Math.min(100-left,w.duration_hours/492*100); assert.ok(html.includes(`left:${left}%`));assert.ok(html.includes(`width:${width}%`));totalWidth+=width;}
 assert.ok(Math.abs(totalWidth-data.earth_comm.visibility_percentage)<0.01);
 assert.ok(html.includes('NO SUNLIGHT IN EVALUATED INTERVAL'));
 }finally{await server.close();}
});
