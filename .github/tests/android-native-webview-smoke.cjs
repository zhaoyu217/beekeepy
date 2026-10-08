/* Android 15 actual installed APK: inspect the WebView page target directly.
 * Chrome-remote-interface avoids Playwright's browser-level CDP commands,
 * which Android WebView 124 does not support. No account credentials or writes. */
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const CDP=require('chrome-remote-interface');
const out='native-smoke-results';
fs.mkdirSync(out,{recursive:true});
const report={mode:'Android 15 installed APK / direct WebView page CDP',tests:[],failure:null};
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:20000}).trim();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function check(name,pass,details){
  report.tests.push({name,pass:!!pass,details:details===undefined?null:details});
  if(!pass)throw Error(name+': '+JSON.stringify(details));
}
let client;
async function run(){
  try{
    const pkg='app.hivefield.mobile.fix';
    check('APK installed',adb('shell','pm','path',pkg).includes('package:'));
    const pid=adb('shell','pidof',pkg).split(/\s+/)[0];
    check('APK process running',/^\d+$/.test(pid),pid);
    report.android={version:adb('shell','getprop','ro.build.version.release'),size:adb('shell','wm','size'),density:adb('shell','wm','density')};
    try{
      report.android.navOverlays=adb('shell','cmd','overlay','list','--user','0').split('\n').filter(x=>/systemui\.navbar/.test(x));
    }catch(err){report.android.navOverlayError=String(err).slice(0,350)}
    if(process.env.HIVE_REQUIRE_THREEBUTTON==='1'){
      const active=(report.android.navOverlays||[]).find(x=>/com\.android\.internal\.systemui\.navbar\.threebutton/.test(x));
      check('Android 15 three-button navigation is actually enabled',!!active&&/^\s*\[x\]/.test(active),report.android.navOverlays);
    }

    report.sockets=[];
    try{report.sockets=adb('shell','cat','/proc/net/unix').split('\n').filter(x=>/webview_devtools_remote/.test(x)).slice(0,5)}catch(e){report.socketsError=String(e).slice(0,250)}
    adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid);
    report.forward=adb('forward','--list');
    report.targets=await CDP.List({host:'127.0.0.1',port:9222});
    check('WebView exposes a debuggable page',report.targets.some(x=>x.type==='page'),report.targets.map(x=>({type:x.type,url:x.url})));
    const target=report.targets.find(x=>x.type==='page'&&x.url&&x.url.includes('localhost'))||report.targets.find(x=>x.type==='page');
    client=await CDP({host:'127.0.0.1',port:9222,target:target,local:true});
    check('Direct WebView page CDP connection',!!client,target?.url);
    await client.Runtime.enable();
    await client.Page.enable();
    async function value(expression){
      const reply=await client.Runtime.evaluate({expression,returnByValue:true,awaitPromise:true});
      if(reply.exceptionDetails)throw Error('JS evaluation failed: '+JSON.stringify(reply.exceptionDetails).slice(0,600));
      return reply.result?.value;
    }
    async function shot(name){
      const s=await client.Page.captureScreenshot({format:'png',fromSurface:true});
      fs.writeFileSync(path.join(out,name),Buffer.from(s.data,'base64'));
    }
    async function waitUntil(expression,label,timeout=9000){
      const since=Date.now();let last;
      while(Date.now()-since<timeout){last=await value(expression);if(last)return;await pause(180)}
      throw Error('Timeout waiting for '+label+', last='+JSON.stringify(last));
    }
    async function tap(expression,label){
      const rect=await value('(()=>{const e='+expression+';if(!e)return null;e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height,disabled:!!e.disabled}})()');
      check(label+' clickable bounds',!!rect&&rect.w>0&&rect.h>0&&!rect.disabled,rect);
      await client.Input.dispatchMouseEvent({type:'mouseMoved',x:rect.x,y:rect.y});
      await client.Input.dispatchMouseEvent({type:'mousePressed',x:rect.x,y:rect.y,button:'left',clickCount:1});
      await client.Input.dispatchMouseEvent({type:'mouseReleased',x:rect.x,y:rect.y,button:'left',clickCount:1});
      await pause(220);
    }
    const initial=await value('({go:typeof window.go,r08:typeof window.v2p2e5r08Evaluate,r10:typeof window.HiveDashTaskEngineCoreV1?.evaluateSplitVerification,auth:!!document.querySelector("#view .auth-view"),ready:document.readyState})');
    report.initial=initial;
    check('Real APK JavaScript navigation loaded',initial.go==='function',initial);
    check('Real APK R08 and R10 hooks loaded',initial.r08==='function'&&initial.r10==='function',initial);
    const demo=await value('(()=>{window.HIVEDASH_CONFIG.REQUIRE_AUTH=false;location.hash="home";window.render();return {hash:location.hash,nav:document.querySelectorAll("#bottomnav .navitem").length}})()');
    check('Isolated demo home mounted',demo.hash==='#home'&&demo.nav===4,demo);
    await shot('android-home.png');
    report.geometry=await value('(()=>{const h=document.querySelector("#topbar").getBoundingClientRect(),n=document.querySelector("#bottomnav").getBoundingClientRect();return {innerWidth,innerHeight,devicePixelRatio,headerTop:h.top,headerHeight:h.height,navBottom:n.bottom,navHeight:n.height,buttonBottoms:[...document.querySelectorAll("#bottomnav .navitem")].map(e=>e.getBoundingClientRect().bottom),safeTop:getComputedStyle(document.documentElement).getPropertyValue("--hd-android-safe-top"),safeBottom:getComputedStyle(document.documentElement).getPropertyValue("--hd-android-safe-bottom")}})()');
    const g=report.geometry;
    check('Native header visible',g.headerHeight>30,g);
    check('Native bottom navigation visible and inside WebView',g.navHeight>=60&&g.buttonBottoms.length===4&&g.buttonBottoms.every(v=>v<=g.innerHeight+1),g);
    for(const [label,route] of [['Hives','hives'],['Actions','actions'],['Insights','insights'],['Home','home']]){
      await tap('Array.from(document.querySelectorAll("#bottomnav .navitem")).find(e=>e.textContent.trim()==="'+label+'")','Tap '+label);
      await waitUntil('location.hash==="#'+route+'"',label+' route');
      check('Native navigation '+label,true,route);
    }
    await value('window.v2p2e5lHomeQuick("inspection")');
    await waitUntil('!!document.querySelector("#app > .modal.v215-more-modal")','Select Hive modal');
    const hiveId=await value('document.querySelector("#v2p2e5l-quick-hive")?.value||""');
    check('Native Select Hive has selectable hive',!!hiveId,hiveId);
    await shot('android-select-hive.png');
    await tap('Array.from(document.querySelectorAll("#app > .modal.v215-more-modal button")).find(e=>e.textContent.trim()==="Continue")','Tap Continue');
    await waitUntil('location.hash==="#inspection/'+hiveId+'"','Continue navigation');
    check('Native Continue enters correct Inspection',true,'inspection/'+hiveId);
    check('Select Hive modal dismissed',!(await value('!!document.querySelector("#app > .modal.v215-more-modal")')));
    await shot('android-inspection.png');

    // Native OS-driven tap diagnostic. ADB 'input tap' traverses Android's
    // input dispatcher and WebView touch handling, unlike CDP mouse events.
    await value('window.go("home")');
    await waitUntil('location.hash==="#home"','diagnostic Home route');
    await pause(400);
    await value('(()=>{window.__androidTouchEvents=[];for(const name of ["touchstart","pointerdown","click"])document.addEventListener(name,e=>{const t=e.target;window.__androidTouchEvents.push({name,target:t?.tagName,cls:String(t?.className?.baseVal||t?.className||"").slice(0,180),text:(t?.textContent||"").trim().slice(0,60),x:e.touches?.[0]?.clientX??e.clientX??null,y:e.touches?.[0]?.clientY??e.clientY??null,cancelled:e.defaultPrevented});},true);return true})()');
    const screenWidth=Number((report.android.size.match(/(\d+)x(\d+)/)||[])[1]);
    const screenHeight=Number((report.android.size.match(/(\d+)x(\d+)/)||[])[2]);
    const centerHives=(await value('(()=>{const e=[...document.querySelectorAll("#bottomnav .navitem")].find(x=>x.textContent.trim()==="Hives"),r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()'));
    const pixelX=Math.round(centerHives.x*g.devicePixelRatio);
    report.realTouches={screenWidth,screenHeight,webviewHivesCenter:centerHives,physicalX:pixelX,attempts:[]};
    for(const candidateY of [Math.round(centerHives.y*g.devicePixelRatio)+45,Math.round(screenHeight*0.88),Math.round(screenHeight*0.91)]){
      await value('window.go("home")');
      await waitUntil('location.hash==="#home"','reset route before physical touch');
      await pause(250);
      const pre=await value('window.__androidTouchEvents.length');
      adb('shell','input','tap',String(pixelX),String(candidateY));
      await pause(500);
      const after=await value('({hash:location.hash,newEvents:window.__androidTouchEvents.slice('+pre+').slice(-12)})');
      report.realTouches.attempts.push({pixelX,pixelY:candidateY,result:after});
      if(after.hash==='#hives')break;
    }
    await shot('native-os-tap-after.png');
    report.realTouches.delivered=report.realTouches.attempts.some(a=>a.result.newEvents.some(e=>e.name==="touchstart"||e.name==="pointerdown"));
    report.realTouches.navigated=report.realTouches.attempts.some(a=>a.result.hash==='#hives');
    // Record observations; do not label coordinate guesses as device pass.
    check('Android OS touch reaches WebView',report.realTouches.delivered,report.realTouches);
    check('Android OS touch activates Hives',report.realTouches.navigated,report.realTouches);

    // Native IME and Supabase authenticated flows require later device-specific tests.
  }catch(err){report.failure=String(err.stack||err);process.exitCode=1}
  finally{
    try{if(client)await client.close()}catch(_){}
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log('ANDROID_NATIVE_REPORT '+JSON.stringify(report));
  }
}
run().catch(e=>{report.failure=String(e);process.exitCode=1});
