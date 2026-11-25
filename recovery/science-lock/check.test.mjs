import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspect} from './check.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(callback){
  const root=mkdtempSync(path.join(os.tmpdir(),'beekeepy-science-lock-'));
  const data=Buffer.from('immutable-science');
  writeFileSync(path.join(root,'v45.js'),data);
  const lock={scienceFiles:{'v45.js':sha(data)},laterObservedSha256:{'2026-11-21':{'v45.js':sha(data)}}};
  const lockFile=path.join(root,'lock.json');
  writeFileSync(lockFile,JSON.stringify(lock));
  try{callback(root,lockFile);}finally{rmSync(root,{recursive:true,force:true});}
}
test('true byte-identical source passes',()=>fixture((root,manifestPath)=>{
  const a=inspect({root,manifestPath});
  assert.equal(a.matched,1);assert.equal(a.passed,true);assert.equal(a.historicalStatus,'NOT_VERIFIED_AS_2026-11-23');
}));
test('modified science bytes are rejected',()=>fixture((root,manifestPath)=>{
  writeFileSync(path.join(root,'v45.js'),'updated-unapproved');
  const a=inspect({root,manifestPath});assert.equal(a.passed,false);
  assert.equal(a.errors[0].status,'SHA256_MISMATCH');
}));
test('missing science file is rejected',()=>fixture((root,manifestPath)=>{
  rmSync(path.join(root,'v45.js'));
  const a=inspect({root,manifestPath});assert.equal(a.passed,false);
  assert.equal(a.errors[0].status,'MISSING');
}));
test('dated later audit fingerprints do not constitute recovered code',()=>fixture((root,manifestPath)=>{
  const a=inspect({root,manifestPath,profile:'observed-20261121'});
  assert.equal(a.passed,true);assert.equal(a.referenceDate,'2026-11-21');
  assert.equal(a.historicalStatus,'NOT_VERIFIED_AS_2026-11-23');
}));
test('unsafe manifest paths are refused',()=>fixture((root,manifestPath)=>{
  writeFileSync(manifestPath,JSON.stringify({scienceFiles:{'../escape.js':sha('x')}}));
  assert.throws(()=>inspect({root,manifestPath}),/Malformed manifest/);
}));
