import test from 'node:test';
import assert from 'node:assert/strict';
import {apiBase} from '../src/utils/apiBase.ts';
test('local development and explicit production API origins',()=>{
  assert.equal(apiBase(undefined),'http://127.0.0.1:8000');
  assert.equal(apiBase('https://api.lunaridge.org/',true),'https://api.lunaridge.org');
  assert.equal(apiBase('http://127.0.0.1:8001',true,true),'http://127.0.0.1:8001');
});
test('deployment rejects missing, insecure and credential-bearing API origins',()=>{
  for(const value of [undefined,'http://127.0.0.1:8000','https://user:secret@host.org','https://host.org/api','http://remote.org','https://YOUR_BACKEND.example.invalid','https://host.org/?key=secret','file:///etc/passwd']) assert.throws(()=>apiBase(value,true));
});

test('host errors retain plain-text details, retry guidance and validation messages',async()=>{
  const {createServer}=await import('vite');
  const server=await createServer({cacheDir:'node_modules/.vite-tests/deployment',server:{middlewareMode:true,hmr:false},appType:'custom'});
  const prior=globalThis.fetch;
  try {
    const {checkBackendHealth}=await server.ssrLoadModule('/src/services/api.ts');
    globalThis.fetch=async()=>new Response('Backend is starting',{status:503,headers:{'Retry-After':'3'}});
    await assert.rejects(checkBackendHealth(),(error: any)=>error.status===503 && error.message.includes('Backend is starting') && error.message.includes('Retry after 3 seconds'));
    globalThis.fetch=async()=>Response.json({detail:[{msg:'sampling exceeds budget'}]},{status:422});
    await assert.rejects(checkBackendHealth(),(error: any)=>error.status===422 && error.message.includes('sampling exceeds budget'));
  }finally {globalThis.fetch=prior;await server.close();}
});
