/* Test auth:true routes with a synthetic session. No actual credentials or data. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve('mobile/dist');
const fakeSupabase="\nwindow.__STUB_SESSION={access_token:\"test-token\",refresh_token:\"test-refresh\",token_type:\"bearer\",expires_at:4102444800,\n user:{id:\"test-user-999\",email:\"qa@example.invalid\",app_metadata:{},user_metadata:{name:\"QA User\"}}};\nwindow.__CLOUD_WRITES__=[];window.__UPSERT_DELAY_NEXT__=0;window.__SELECT_DELAY_NEXT__=0;\nwindow.supabase={createClient:()=>({\n auth:{\n   async getSession(){return {data:{session:window.__STUB_SESSION},error:null}},\n   onAuthStateChange(fn){window.__EMIT_AUTH_EVENT__=fn;return {data:{subscription:{unsubscribe(){}}}}},\n   async refreshSession(){return {data:{session:window.__STUB_SESSION},error:null}}\n },\n from(){return {\n   select(){return {eq(){return {async maybeSingle(){const delay=window.__SELECT_DELAY_NEXT__||0;window.__SELECT_DELAY_NEXT__=0;if(delay)await new Promise(r=>setTimeout(r,delay));return {data:null,error:null}}}}}},\n   async upsert(row){window.__CLOUD_WRITES__.push(JSON.parse(JSON.stringify(row)));const delay=window.__UPSERT_DELAY_NEXT__||0;window.__UPSERT_DELAY_NEXT__=0;if(delay)await new Promise(r=>setTimeout(r,delay));return {data:null,error:null}}\n }},\n channel(){return {on(){return this},subscribe(fn){fn(\"SUBSCRIBED\");return this}}},\n removeChannel(){}\n})};\n";
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
    check('Session-loss route shows sign-in instead of frozen view',before.auth===false&&after.hash==='#home'&&after.loginVisible&&!report.staleUiReproduced,report.sessionLoss);
    await page.evaluate(()=>{window.__EMIT_AUTH_EVENT__('USER_UPDATED',window.__STUB_SESSION);window.render();});
    await page.waitForTimeout(120);
    const reactivated=await page.evaluate(()=>({auth:isAuthenticated(),page:location.hash,top:document.querySelector('#topbar')?.innerText?.slice(0,50)}));
    check('Session restored in synthetic test',reactivated.auth===true,reactivated);
    await page.evaluate(()=>window.__EMIT_AUTH_EVENT__('TOKEN_REFRESHED',null));
    const control=await page.evaluate(()=>({
      auth:isAuthenticated(),
      hash:location.hash,
      loginVisible:!!document.querySelector('.auth-page'),
      navVisible:!document.getElementById('bottomnav').classList.contains('hidden')
    }));
    check('Session loss immediately renders sign-in and hides app navigation',
      !control.auth&&control.loginVisible&&!control.navVisible,control);

    // Account A queues a debounced write, then signs out before the 450ms timer.
    // Account B must never receive A's snapshot, and A's unsynced local copy must survive.
    await page.evaluate(async()=>{
      await window.__EMIT_AUTH_EVENT__('SIGNED_IN',window.__STUB_SESSION);
    });
    await page.waitForTimeout(120);
    await page.evaluate(()=>{
      window.__CLOUD_WRITES__.length=0;
      const a=state();
      a.meta.syncIsolationSentinel='A_ONLY_SENTINEL';
      if(!save(a))throw new Error('Could not save A isolation fixture');
    });
    const duringSwitch=await page.evaluate(()=>{
      window.__SELECT_DELAY_NEXT__=180;
      window.__STUB_SESSION_B={
        access_token:'test-token-b',
        refresh_token:'test-refresh-b',
        token_type:'bearer',
        expires_at:4102444800,
        user:{id:'test-user-B',email:'qa-b@example.invalid',app_metadata:{},user_metadata:{name:'QA User B'}}
      };
      window.__STUB_SESSION=window.__STUB_SESSION_B;
      window.__EMIT_AUTH_EVENT__('SIGNED_IN',window.__STUB_SESSION_B);
      return {
        currentUser:currentSession?.user?.id||null,
        loginVisible:!!document.querySelector('.auth-page'),
        navHidden:document.getElementById('bottomnav').classList.contains('hidden')
      };
    });
    check('Direct account switch hides prior account UI during hydration',
      duringSwitch.currentUser==='test-user-B'&&duringSwitch.loginVisible&&duringSwitch.navHidden,
      duringSwitch);
    await page.waitForTimeout(650);
    const accountSwitch=await page.evaluate(()=>{
      const aRaw=localStorage.getItem('hivedash_v9:user:test-user-999');
      const aState=aRaw?JSON.parse(aRaw):null;
      const bState=state();
      return {
        currentUser:currentSession?.user?.id||null,
        aSentinel:aState?.meta?.syncIsolationSentinel||null,
        bSentinel:bState?.meta?.syncIsolationSentinel||null,
        writes:window.__CLOUD_WRITES__
      };
    });
    report.accountSwitch=accountSwitch;
    check('Pending A timer cannot upload A data under B identity',
      !accountSwitch.writes.some(w=>w.user_id==='test-user-B'&&w.payload?.meta?.syncIsolationSentinel==='A_ONLY_SENTINEL'),
      accountSwitch);
    check('A local unsynced snapshot remains in A account storage',
      accountSwitch.aSentinel==='A_ONLY_SENTINEL',accountSwitch);
    check('B local state does not inherit A snapshot',
      accountSwitch.currentUser==='test-user-B'&&accountSwitch.bSentinel!=='A_ONLY_SENTINEL',accountSwitch);

    // Start a B upload, switch to A while its response is delayed, and verify
    // the late B response cannot overwrite A's sync status or local state.
    await page.evaluate(()=>{
      window.__CLOUD_WRITES__.length=0;
      const b=state();
      b.meta.syncIsolationSentinel='B_ONLY_SENTINEL';
      window.__UPSERT_DELAY_NEXT__=280;
      if(!save(b))throw new Error('Could not save B in-flight fixture');
    });
    await page.waitForTimeout(480);
    const inFlightStarted=await page.evaluate(()=>window.__CLOUD_WRITES__.some(
      w=>w.user_id==='test-user-B'&&w.payload?.meta?.syncIsolationSentinel==='B_ONLY_SENTINEL'
    ));
    check('B delayed upload started with B-bound identity',inFlightStarted,window.__CLOUD_WRITES__);
    await page.evaluate(async()=>{
      await window.__EMIT_AUTH_EVENT__('SIGNED_OUT',null);
      window.__STUB_SESSION=window.__STUB_SESSION_A||{
        access_token:'test-token',
        refresh_token:'test-refresh',
        token_type:'bearer',
        expires_at:4102444800,
        user:{id:'test-user-999',email:'qa@example.invalid',app_metadata:{},user_metadata:{name:'QA User'}}
      };
      window.__STUB_SESSION_A=window.__STUB_SESSION;
      await window.__EMIT_AUTH_EVENT__('SIGNED_IN',window.__STUB_SESSION_A);
    });
    await page.evaluate(()=>setCloudStatus('A_SESSION_READY_SENTINEL'));
    await page.waitForTimeout(340);
    const lateResponse=await page.evaluate(()=>{
      const a=state();
      return {
        currentUser:currentSession?.user?.id||null,
        status:cloudStatusText(),
        aSentinel:a.meta?.syncIsolationSentinel||null,
        writes:window.__CLOUD_WRITES__
      };
    });
    report.lateResponse=lateResponse;
    check('Late B response cannot overwrite A session sync status',
      lateResponse.currentUser==='test-user-999'&&lateResponse.status==='A_SESSION_READY_SENTINEL',
      lateResponse);
    check('In-flight B snapshot remains bound to B and is not copied into A',
      lateResponse.writes.some(w=>w.user_id==='test-user-B'&&w.payload?.meta?.syncIsolationSentinel==='B_ONLY_SENTINEL')&&
      !lateResponse.writes.some(w=>w.user_id==='test-user-999'&&w.payload?.meta?.syncIsolationSentinel==='B_ONLY_SENTINEL')&&
      lateResponse.aSentinel==='A_ONLY_SENTINEL',
      lateResponse);
    check('No uncaught browser errors',report.pageErrors.length===0,report.pageErrors);
  }catch(e){report.failure=String(e.stack||e);process.exitCode=1}
  finally{console.log('AUTHENTICATED_NAVIGATION_REPORT '+JSON.stringify(report));await browser?.close();await new Promise(r=>server.close(r))}
}
main().catch(e=>{console.error(e);process.exitCode=1;server?.close()});
