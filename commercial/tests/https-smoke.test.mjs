import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:https';
import {request} from 'node:https';
import {once} from 'node:events';
import {openStore} from '../server/db.mjs';
import {createCommercialApp} from '../server/app.mjs';
import {encodeAdminPassword,totpAt} from '../server/auth.mjs';
let openssl=true;
try{execFileSync('openssl',['version'],{stdio:'ignore'})}catch{openssl=false}
const TIME=1795400000;
async function httpsRequest(port,path,{method='GET',body=null,headers={}}={}){
 const raw=body===null?null:Buffer.from(JSON.stringify(body));
 const h={'origin':`https://127.0.0.1:${port}`,...headers};
 if(raw){h['content-type']='application/json';h['content-length']=raw.length;}
 return new Promise((resolve,reject)=>{
  const req=request({host:'127.0.0.1',port,path,method,rejectUnauthorized:false,headers:h},res=>{
    const chunks=[];res.on('data',d=>chunks.push(d));res.on('end',()=>resolve({code:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));});
  req.on('error',reject);if(raw)req.write(raw);req.end();
 });
}
test('real HTTPS: health, admin HTML/CSS, signed session, CSRF rejection', {skip:!openssl?'OpenSSL unavailable':false},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'beekeepy-qa-https-'));
 const key=join(dir,'key.pem'),cert=join(dir,'cert.pem');
 let server,store;
 try{
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
  store=openStore();const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const app=createCommercialApp({store,env:{BEE_ADMIN_PASSWORD_SCRYPT:encodeAdminPassword('QA-only-strong'),BEE_ADMIN_TOTP_SECRET:secret},clock:()=>TIME*1000});
  server=createServer({key:readFileSync(key),cert:readFileSync(cert)},app.handler);
  server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
  let r=await httpsRequest(port,'/healthz');assert.equal(r.code,200);assert.equal(JSON.parse(r.body).production_ready,false);
  r=await httpsRequest(port,'/admin/');assert.equal(r.code,200);assert.match(r.body,/中文管理员后台/);
  r=await httpsRequest(port,'/admin.css');assert.equal(r.code,200);assert.match(r.headers['content-type'],/text\/css/);
  r=await httpsRequest(port,'/api/admin/summary');assert.equal(r.code,401);
  const login=await httpsRequest(port,'/api/admin/login',{method:'POST',body:{password:'QA-only-strong',totp:totpAt(secret,Math.floor(TIME/30))}});
  assert.equal(login.code,200);assert.match(login.headers['set-cookie'][0],/Secure; SameSite=Strict/);
  const token=/beekeepy_qa_admin=([^;]+)/.exec(login.headers['set-cookie'][0])[1];
  r=await httpsRequest(port,'/api/admin/summary',{headers:{cookie:`beekeepy_qa_admin=${token}`}});
  assert.equal(r.code,200);assert.equal(JSON.parse(r.body).users,0);
  r=await httpsRequest(port,'/api/admin/tickets/status',{method:'POST',headers:{cookie:`beekeepy_qa_admin=${token}`},body:{ticket_id:'ticket_test',status:'closed'}});
  assert.equal(r.code,401,'POST without CSRF must not pass');
 }finally{if(server)await new Promise(resolve=>server.close(resolve));store?.close();rmSync(dir,{recursive:true,force:true});}
});
