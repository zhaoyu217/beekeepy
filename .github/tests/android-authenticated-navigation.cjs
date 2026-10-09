/* Test auth:true routes with a synthetic session. No actual credentials or data. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve('mobile/dist');
const fakeSupabase="\nwindow.__STUB_SESSION={access_token:\"test-token\",refresh_token:\"test-refresh\",token_type:\"bearer\",expires_at:4102444800,\n user:{id:\"test-user-999\",email:\"qa@example.invalid\",app_metadata:{},user_metadata:{name:\"QA User\"}}};\nwindow.supabase={createClient:()=>({\n auth:{\n   async getSession(){return {data:{session:window.__STUB_SESSION},error:null}},\n   onAuthStateChange(fn){window.__EMIT_AUTH_EVENT__=fn;return {data:{subscription:{unsubscribe(){}}}}},\n   async refreshSession(){return {data:{session:window.__STUB_SESSION},error:null}}\n },\n from(){return {\n   select(){return {eq(){return {async maybeSingle(){return {data:null,error:null}}}}}},\n   async upsert(){return {data:null,error:null}}\n }},\n channel(){return {on(){return this},subscribe(fn){fn(\"SUBSCRIBED\");return this}}},\n removeChannel(){}\n})};\n";
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
const report={checks:[],pageErrors:[]};
let browser,server;
function check(name,ok,detail){report.checks.push({name,pass:!!ok,detail});if(!ok)throw Error(name+': '+JSON.stringify(detail))}
async function main(){
  server=http.createServer((req,res)=>{
    let u=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(u==='/config.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end('window.HIVEDASH_CONFIG={SUPABASE_URL:"https://example.supabase.co",SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fake_qasession",REQUIRE_AUTH:true};');return}
    if(u==='/vendor/supabase.min.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(fakeSupabase);return}
    const file=path.resolve(root,'.'+(u==='/'?'/index.html':u));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
    try{let data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data)}catch(e){res.writeHead(404);res.end('Not found')}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    browser=await chromium.launch({args:['--no-sandbox']});
    const page=await browser.newPage();
    page.on('pageerror',e=>report.pageErrors.push(String(e)));
    await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1600);
    const boot=await page.evaluate(()=>({authenticated:isAuthenticated(),requireAuth:CLOUD_CONFIG.REQUIRE_AUTH,configured:CLOUD_CONFIGURED,hash:location.hash,nav:document.querySelectorAll('#bottomnav .navitem').length,view:document.querySelector('#view')?.innerText?.slice(0,200)}));
    report.boot=boot;
    check('Auth-required config active',boot.requireAuth===true&&boot.configured===true,boot);
    check('Fake signed-in session renders nav',boot.authenticated&&boot.nav===4,boot);
    await page.evaluate(()=>go('hives'));
    await page.waitForTimeout(250);
    const signedIn=await page.evaluate(()=>({hash:location.hash,text:document.querySelector('#view')?.innerText?.slice(0,200)}));
    check('Auth-required navigation redraws page',signedIn.hash==='#hives'&&/Hives/i.test(signedIn.text),signedIn);
    await page.evaluate(()=>window.__EMIT_AUTH_EVENT__('TOKEN_REFRESHED',null));
    const before=await page.evaluate(()=>({auth:isAuthenticated(),view:document.querySelector('#view')?.innerText?.slice(0,260)}));
    await page.evaluate(()=>go('home'));
    await page.waitForTimeout(300);
    const after=await page.evaluate(()=>({auth:isAuthenticated(),hash:location.hash,view:document.querySelector('#view')?.innerText?.slice(0,260),loginVisible:!!document.querySelector('.auth-page')}));
    report.sessionLoss={before,after};
    report.staleUiReproduced=before.auth===false&&after.hash==='#home'&&!after.loginVisible&&before.view===after.view;
    check('Session-loss navigation freeze reproduced',report.staleUiReproduced,report.sessionLoss);
  }catch(e){report.failure=String(e.stack||e);process.exitCode=1}
  finally{console.log('AUTHENTICATED_NAVIGATION_REPORT '+JSON.stringify(report));await browser?.close();await new Promise(r=>server.close(r))}
}
main().catch(e=>{console.error(e);process.exitCode=1;server?.close()});
