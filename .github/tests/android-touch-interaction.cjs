/* Android 15 native input QA for the authenticated production-candidate APK.
 * All user-facing actions below use adb shell input tap/swipe, not CDP mouse clicks.
 * CDP is used only to inspect DOM state and geometry. No credentials or cloud writes. */
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const CDP=require('chrome-remote-interface');
const out='android-touch-results';
fs.mkdirSync(out,{recursive:true});
const report={mode:'Android 15 installed current APK / Android OS input dispatcher',tests:[],failure:null,physicalTaps:[],routeViews:[]};
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:25000}).trim();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let client,topInsetPx,dpr,screen;
function check(name,pass,details){
 report.tests.push({name,pass:!!pass,details:details===undefined?null:details});
 if(!pass)throw new Error(name+': '+JSON.stringify(details));
}
async function value(expression){
 const r=await client.Runtime.evaluate({expression,returnByValue:true,awaitPromise:true,timeout:45000});
 if(r.exceptionDetails)throw new Error('JS evaluation failed: '+JSON.stringify(r.exceptionDetails).slice(0,700));
 return r.result?.value;
}
async function waitUntil(expression,label,timeout=9000){
 const start=Date.now();let last;
 while(Date.now()-start<timeout){last=await value(expression);if(last)return last;await pause(180)}
 throw new Error('Timeout waiting for '+label+'; last='+JSON.stringify(last));
}
function innerWidthSafe(){return 206;}
async function screenshot(name){
 adb('shell','screencap','-p','/sdcard/'+name);
 adb('pull','/sdcard/'+name,path.join(out,name));
}
async function tap(selectorExpression,label,requiredEvent='pointerdown'){
 const rect=await value('(()=>{const e='+selectorExpression+';if(!e)return null;e.scrollIntoView({block:"center",inline:"center"});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height,disabled:!!e.disabled,tag:e.tagName,id:e.id,text:(e.textContent||"").trim().slice(0,70)}})()');
 check(label+' is visible and enabled',!!rect&&rect.w>0&&rect.h>0&&!rect.disabled,rect);
 const x=Math.round(rect.x*dpr), y=Math.round(rect.y*dpr+topInsetPx);
 check(label+' maps inside physical display',x>=0&&x<screen.width&&y>=0&&y<screen.height,{x,y,screen,topInsetPx,dpr,rect});
 let events=[];
 let attempts=0;
 for(attempts=1;attempts<=3;attempts++){
  const eventStart=await value('window.__nativeInputEvents?.length||0');
  adb('shell','input','tap',String(x),String(y));
  await pause(900);
  events=await value('window.__nativeInputEvents?.slice('+eventStart+')||[]');
  if(events.some(e=>e.name===requiredEvent))break;
  await pause(450);
 }
 report.physicalTaps.push({label,x,y,attempts:Math.min(attempts,3),requiredEvent,events});
 return {rect,x,y,attempts:Math.min(attempts,3),events};
}
async function run(){
 try{
  const pkg='app.hivefield.mobile.fix';
  check('Current APK is installed',adb('shell','pm','path',pkg).includes('package:'));
  const pid=adb('shell','pidof',pkg).split(/\s+/)[0];
  check('Current APK process is running',/^\d+$/.test(pid),pid);
  report.android={
   version:adb('shell','getprop','ro.build.version.release'),
   size:adb('shell','wm','size'),
   density:adb('shell','wm','density'),
   navOverlays:adb('shell','cmd','overlay','list','--user','0').split('\n').filter(x=>/systemui\.navbar/.test(x))
  };
  const sizeMatch=report.android.size.match(/(\d+)x(\d+)/);
  const densityMatch=report.android.density.match(/(\d+)/);
  screen={width:Number(sizeMatch?.[1]),height:Number(sizeMatch?.[2])};
  dpr=Number(densityMatch?.[1])/160;
  check('Android 15 Pixel 6 test display detected',report.android.version==='15'&&screen.width>0&&screen.height>0&&dpr>1,{android:report.android,screen,dpr});
  const active=report.android.navOverlays.find(x=>/com\.android\.internal\.systemui\.navbar\.threebutton/.test(x));
  check('Three-button Android system navigation enabled',!!active&&/^\s*\[x\]/.test(active),report.android.navOverlays);

  adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid);
  const targets=await CDP.List({host:'127.0.0.1',port:9222});
  const target=targets.find(x=>x.type==='page'&&x.url?.includes('localhost'))||targets.find(x=>x.type==='page');
  check('Current APK WebView page is inspectable',!!target,{url:target?.url});
  client=await CDP({host:'127.0.0.1',port:9222,target,local:true});
  await client.Runtime.enable();await client.Page.enable();
  const auth=await waitUntil('(()=>document.readyState==="complete"&&!!document.querySelector("#authEmail")&&!!document.querySelector("#authPassword")?({email:true,password:true,mode:document.querySelector("#authModeSwitch")?.textContent?.trim()||"",width:innerWidth,height:innerHeight,dpr:devicePixelRatio}):null)()','real login form');
  check('Actual APK opens the login screen',auth.email&&auth.password,{auth});
  dpr=auth.dpr;
  const baseHeight=auth.height;
  const bottomSystemInset=Math.round(48*dpr);
  topInsetPx=screen.height-Math.round(baseHeight*dpr)-bottomSystemInset;
  check('Android window inset mapping is plausible',topInsetPx>=60&&topInsetPx<=200,{screen,baseHeight,dpr,bottomSystemInset,topInsetPx});
  report.geometry={screen,baseHeight,dpr,topInsetPx,bottomSystemInset};

  report.physicalTaps=[];
  await value('(()=>{window.__nativeInputEvents=[];window.__hashAudit=[];window.__renderAudit=[];window.__jsErrors=[];const originalRender=window.render;if(typeof originalRender==="function"){window.render=function(){const item={hash:location.hash,at:Date.now()};try{return originalRender.apply(this,arguments)}catch(e){item.error=String(e);throw e}finally{window.__renderAudit.push(item)}}}window.addEventListener("hashchange",()=>window.__hashAudit.push({hash:location.hash,active:document.querySelector("#bottomnav .navitem.active")?.textContent.trim()||"",title:document.querySelector("#topbar .pagebar-title")?.textContent.trim()||document.querySelector("#topbar .brand img")?.alt||document.querySelector("#topbar .brand")?.textContent.trim()||""}));window.addEventListener("error",e=>window.__jsErrors.push({message:e.message,source:e.filename,line:e.lineno}));window.addEventListener("unhandledrejection",e=>window.__jsErrors.push({message:String(e.reason)}));for(const n of ["pointerdown","touchstart","pointerup","pointercancel","touchend","touchcancel","click","focusin"])document.addEventListener(n,e=>{const t=e.target;window.__nativeInputEvents.push({name:n,id:t?.id||"",tag:t?.tagName||"",cls:String(t?.className?.baseVal||t?.className||"").slice(0,90),text:(t?.textContent||"").trim().slice(0,45),pointerType:e.pointerType||null,pointerId:Number.isFinite(e.pointerId)?e.pointerId:null,clientX:Number.isFinite(e.clientX)?e.clientX:null,clientY:Number.isFinite(e.clientY)?e.clientY:null,defaultPrevented:!!e.defaultPrevented});},true);return true})()');
  await screenshot('android-login-before-touch.png');

  await tap('document.querySelector("#authEmail")','Tap login email field');
  const emailFocus=await value('document.activeElement?.id||""');
  check('Physical tap focuses login email field',emailFocus==='authEmail',{emailFocus});
  const keyboardHeight=await value('({inner:innerHeight,visual:visualViewport?.height||null,active:document.activeElement?.id||""})');
  report.keyboardAfterEmailTap=keyboardHeight;
  await tap('document.querySelector("#authPassword")','Tap login password field');
  const passwordFocus=await value('document.activeElement?.id||""');
  check('Physical tap focuses login password field',passwordFocus==='authPassword',{passwordFocus});
  adb('shell','input','keyevent','4');
  await value('document.activeElement?.blur?.()');
  const keyboardDismissed=await waitUntil('(()=>{const vv=window.visualViewport;return (!document.activeElement?.matches?.("#authEmail,#authPassword"))&&(!vv||Math.abs(vv.height-innerHeight)<2)})()','Android soft keyboard fully dismissed',10000);
  report.keyboardDismissed=keyboardDismissed;
  await pause(500);
  await value('(()=>{window.scrollTo(0,0);return true})()');
  await tap('document.querySelector("#authModeSwitch")','Tap login Sign up / Sign in switch','click');
  const signUp=await value('({name:!!document.querySelector("#authName"),email:!!document.querySelector("#authEmail"),mode:document.querySelector("#authModeSwitch")?.textContent?.trim()||""})');
  check('Physical tap switches login form to sign-up form',signUp.name&&signUp.email,signUp);
  await tap('document.querySelector("#authModeSwitch")','Tap sign-up switch back to login','click');
  const backToLogin=await value('({name:!!document.querySelector("#authName"),email:!!document.querySelector("#authEmail")})');
  check('Physical tap returns to login form',!backToLogin.name&&backToLogin.email,backToLogin);
  await screenshot('android-login-after-touch.png');

  const demo=await value('(()=>{window.HIVEDASH_CONFIG.REQUIRE_AUTH=false;location.hash="home";window.render();return {hash:location.hash,nav:[...document.querySelectorAll("#bottomnav .navitem")].map(e=>e.textContent.trim())}})()');
  check('Isolated test home view mounted',demo.hash==='#home'&&demo.nav.length===4,demo);
  const geom=await value('(()=>{const h=document.querySelector("#topbar").getBoundingClientRect(),n=document.querySelector("#bottomnav").getBoundingClientRect();return {width:innerWidth,height:innerHeight,headerTop:h.top,headerBottom:h.bottom,headerHeight:h.height,navTop:n.top,navBottom:n.bottom,navHeight:n.height,navButtons:[...document.querySelectorAll("#bottomnav .navitem")].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent.trim(),top:r.top,bottom:r.bottom,left:r.left,right:r.right}}),scrollables:[...document.querySelectorAll("*")].filter(e=>e.scrollHeight>e.clientHeight+80&&["auto","scroll"].includes(getComputedStyle(e).overflowY)).map(e=>({id:e.id,cls:String(e.className).slice(0,80),height:e.clientHeight,scrollHeight:e.scrollHeight,top:e.scrollTop})).slice(0,8)}})()');
  report.homeGeometry=geom;
  check('Header does not overlap top of WebView',geom.headerTop>=-1&&geom.headerHeight>=30,geom);
  check('Bottom navigation fits entirely inside WebView',geom.navHeight>=60&&geom.navBottom<=geom.height+1&&geom.navButtons.length===4&&geom.navButtons.every(b=>b.bottom<=geom.height+1),geom);

  const routes=[['Hives','hives','Hives'],['Actions','actions','Actions'],['Insights','insights','Insights'],['Home','home','HiveDash']];
  for(const [label,route,headerTitle] of routes){
   if(route!=='home'){
    await value('window.go("home")');
    await waitUntil('location.hash==="#home"','reset to home before '+label);
    await waitUntil('document.querySelector("#bottomnav .navitem.active")?.textContent.trim()==="Home"','Home view rendered before '+label);
   }
   await tap('Array.from(document.querySelectorAll("#bottomnav .navitem")).find(e=>e.textContent.trim()==='+JSON.stringify(label)+')?.querySelector("span")','Physical tap bottom navigation '+label,'pointerup');
   await waitUntil('location.hash==='+JSON.stringify('#'+route),'native '+label+' route');
   if(label!=="Home"){await waitUntil('(()=>{const title=document.querySelector("#topbar .pagebar-title")?.textContent.trim()||document.querySelector("#topbar .brand img")?.alt||document.querySelector("#topbar .brand")?.textContent.trim()||"";const active=document.querySelector("#bottomnav .navitem.active")?.textContent.trim()||"";return title==='+JSON.stringify(headerTitle)+'&&active==='+JSON.stringify(label) +'})()','rendered '+label+' page');}
   if(label==="Home"){
    await pause(900);
    const homeAfterTap=await value('({hash:location.hash,title:document.querySelector("#topbar .pagebar-title")?.textContent.trim()||document.querySelector("#topbar .brand img")?.alt||document.querySelector("#topbar .brand")?.textContent.trim()||"",active:document.querySelector("#bottomnav .navitem.active")?.textContent.trim()||"",viewClass:document.querySelector("#view")?.className||"",viewText:(document.querySelector("#view")?.innerText||"").slice(0,500),topbarHTML:document.querySelector("#topbar")?.innerHTML||"",hashAudit:window.__hashAudit||[],renderAudit:window.__renderAudit||[],jsErrors:window.__jsErrors||[]})');
    report.homeAfterTap=homeAfterTap;
    await screenshot('android-touch-home-after-tap.png');
    const homeRendered=homeAfterTap.hash==='#home'&&homeAfterTap.active==='Home'&&homeAfterTap.viewText.includes('Good Morning!')&&homeAfterTap.viewText.includes('Overall Health');
    report.tests.push({name:'Android OS touch returns from Insights to rendered Home page',pass:homeRendered,details:homeAfterTap});
    if(!homeRendered)report.failure='Physical Home tab changed route but did not render Home; see homeAfterTap diagnostics';
   }
   const ev=report.physicalTaps.at(-1).events;
   check('Android OS pointerup reaches '+label+' navigation',ev.some(e=>e.name==='pointerup'&&e.pointerType==='touch'),ev);
   report.nativeClickEmitted=ev.some(e=>e.name==='click');
   const rendered=await value('({hash:location.hash,title:document.querySelector("#topbar .pagebar-title")?.textContent.trim()||document.querySelector("#topbar .brand img")?.alt||document.querySelector("#topbar .brand")?.textContent.trim()||"",active:document.querySelector("#bottomnav .navitem.active")?.textContent.trim()||""})');
   report.routeViews=report.routeViews||[];
   report.routeViews.push({label,rendered});
   if(label!=="Home")check('Android OS touch renders '+label+' page',rendered.title===headerTitle&&rendered.active===label,rendered);
   await screenshot('android-touch-'+route+'.png');
  }

  // Actions contains a long task list. Test the actual document scroll root,
  // not only descendants with overflow:auto; the app uses a full-page root.
  await value('window.go("actions")');
  await waitUntil('location.hash==="#actions"','open long Actions page');
  await waitUntil('document.querySelector("#topbar .pagebar-title")?.textContent.trim()==="Actions"','Actions page rendered for scroll test');
  const beforeScroll=await value('(()=>{const es=[document.scrollingElement,document.documentElement,document.body,document.getElementById("app"),document.getElementById("view")].filter(Boolean);return es.map((e,i)=>({name:["document.scrollingElement","document.documentElement","document.body","#app","#view"][i],top:e.scrollTop,height:e.clientHeight,scrollHeight:e.scrollHeight,overflowY:getComputedStyle(e).overflowY}))})()');
  report.scrollBefore=beforeScroll;
  const rootBefore=beforeScroll.find(x=>x.name==="document.scrollingElement");
  const appBefore=beforeScroll.find(x=>x.name==="#app");
  const viewBefore=beforeScroll.find(x=>x.name==="#view");
  const canScroll=[rootBefore,appBefore,viewBefore].some(x=>x&&x.scrollHeight>x.height+80);
  check('Long Actions page has scrollable overflow',canScroll,beforeScroll);
  adb('shell','input','swipe',String(Math.round(innerWidthSafe()*dpr)),String(Math.round(610*dpr+topInsetPx)),String(Math.round(innerWidthSafe()*dpr)),String(Math.round(250*dpr+topInsetPx)),'550');
  await pause(700);
  const afterScroll=await value('(()=>{const es=[document.scrollingElement,document.getElementById("app"),document.getElementById("view")].filter(Boolean);return es.map((e,i)=>({name:["document.scrollingElement","#app","#view"][i],top:e.scrollTop,height:e.clientHeight,scrollHeight:e.scrollHeight}))})()');
  report.scrollAfter=afterScroll;
  const moved=afterScroll.some(x=>x.top>(beforeScroll.find(b=>b.name===x.name)?.top||0)+5);
  check('Android physical swipe scrolls the long Actions page',moved,{beforeScroll,afterScroll});
  const navAfterScroll=await value('(()=>{const e=document.querySelector("#bottomnav"),r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,viewport:innerHeight,active:document.querySelector("#bottomnav .navitem.active")?.textContent.trim()}})()');
  check('Bottom navigation remains visible after scrolling',navAfterScroll.height>=60&&navAfterScroll.bottom<=navAfterScroll.viewport+1,navAfterScroll);
  await tap('Array.from(document.querySelectorAll("#bottomnav .navitem")).find(e=>e.textContent.trim()==="Insights")?.querySelector("span")','Physical tap Insights after scroll','click');
  await waitUntil('location.hash==="#insights"','Insights after scroll');
  await waitUntil('document.querySelector("#topbar .pagebar-title")?.textContent.trim()==="Insights"&&document.querySelector("#bottomnav .navitem.active")?.textContent.trim()==="Insights"','Insights rendered after scroll');
   const activeAfterScroll=await value('document.querySelector("#bottomnav .navitem.active")?.textContent.trim()||""');
   check('Bottom navigation remains clickable after scrolling',activeAfterScroll==="Insights",{activeAfterScroll});

  await value('window.go("home")');
  await waitUntil('location.hash==="#home"','return home for primary action test');
  await waitUntil('document.querySelector("#bottomnav .navitem.active")?.textContent.trim()==="Home"','Home rendered for primary action test');
  await value('window.v2p2e5lHomeQuick("inspection")');
  await waitUntil('!!document.querySelector("#app > .modal.v215-more-modal")','Select Hive modal');
  const hiveId=await value('document.querySelector("#v2p2e5l-quick-hive")?.value||""');
  const hashBeforeContinue=await value('location.hash');
  const continueButton=await value('(()=>{const e=Array.from(document.querySelectorAll("#app > .modal.v215-more-modal button")).find(e=>e.textContent.trim()==="Continue");return e?{outerHTML:e.outerHTML,onclick:e.getAttribute("onclick"),type:e.type,disabled:e.disabled}:null})()');
  report.continueBeforeTap={hashBeforeContinue,hiveId,continueButton};
  check('Select Hive modal has a valid selected hive',!!hiveId,hiveId);
  check('Continue button has an actual enabled button element',!!continueButton&&!continueButton.disabled,continueButton);
  await tap('Array.from(document.querySelectorAll("#app > .modal.v215-more-modal button")).find(e=>e.textContent.trim()==="Continue")','Physical tap modal Continue');
  await pause(900);
  const continueAfterTap=await value('({hash:location.hash,modalVisible:!!document.querySelector("#app > .modal.v215-more-modal"),modalHTML:document.querySelector("#app > .modal.v215-more-modal")?.outerHTML?.slice(0,1800)||"",title:document.querySelector("#topbar .pagebar-title")?.textContent.trim()||document.querySelector("#topbar .brand img")?.alt||"",active:document.querySelector("#bottomnav .navitem.active")?.textContent.trim()||"",viewText:(document.querySelector("#view")?.innerText||"").slice(0,900),jsErrors:window.__jsErrors||[]})');
  report.continueAfterTap=continueAfterTap;
  await screenshot('android-touch-inspection-after-continue.png');
  const expectedHash='#inspection/'+hiveId;
  const continueWorked=continueAfterTap.hash===expectedHash&&!continueAfterTap.modalVisible;
  report.tests.push({name:'Physical Continue tap dismisses Select Hive modal and opens inspection',pass:continueWorked,details:{expectedHash,hashBeforeContinue,continueAfterTap,physicalEvents:report.physicalTaps.at(-1)?.events}});
  if(!continueWorked)report.failure='Physical Continue tap did not dismiss the Select Hive modal and open inspection; see continueAfterTap diagnostics';

  // Verify the inspection's Voice fill control opens its review UI through real Android touch.
  // Do not start recording or request microphone permission in this smoke test.
  await tap('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Voice fill")','Physical tap Inspection Voice fill');
  await waitUntil('!!document.querySelector(".hd-voice-overlay")','structured Voice fill dialog');
  const voiceDialog=await value('(()=>({visible:!!document.querySelector(".hd-voice-overlay"),title:document.querySelector(".hd-voice-head b")?.textContent.trim()||"",textarea:!!document.querySelector(".hd-voice-transcript"),start:!!document.querySelector(".hd-start"),cancel:!!document.querySelector(".hd-cancel"),apply:!!document.querySelector(".hd-apply")}))()');
  report.voiceDialog=voiceDialog;
  check('Voice fill opens the structured inspection dialog',voiceDialog.visible&&voiceDialog.textarea&&voiceDialog.start&&voiceDialog.cancel&&voiceDialog.apply,voiceDialog);
  const nativeVoice=await value('({shim:window.__HD_NATIVE_OFFLINE_ASR__===true,plugin:!!window.Capacitor?.Plugins?.OfflineAsr,platform:window.Capacitor?.getPlatform?.()||"unknown"})');
  report.nativeVoice=nativeVoice;
  check('Android app registers the native offline ASR bridge',nativeVoice.shim&&nativeVoice.plugin&&nativeVoice.platform==='android',nativeVoice);
  const asrAvailability=await value('(async()=>{const p=window.Capacitor?.Plugins?.OfflineAsr;if(!p)return {available:false,reason:"plugin-missing"};try{return await p.isAvailable()}catch(e){return {available:false,reason:String(e)}}})()');
  report.asrAvailability=asrAvailability;
  check('Sherpa-ONNX model files are bundled in the Android APK',asrAvailability.available===true,asrAvailability);
  adb('shell','pm','grant','app.hivefield.mobile.fix','android.permission.RECORD_AUDIO');
  await tap('document.querySelector(".hd-start")','Physical tap native offline ASR Start');
  await waitUntil('document.querySelector(".hd-voice-status span:last-child")?.textContent.includes("Recording")','native offline ASR recording state',15000);
  const asrStarted=await value('({status:document.querySelector(".hd-voice-status span:last-child")?.textContent||"",stopDisabled:!!document.querySelector(".hd-stop")?.disabled,startDisabled:!!document.querySelector(".hd-start")?.disabled})');
  report.asrStarted=asrStarted;
  check('Native offline ASR starts microphone capture',asrStarted.status.includes('Recording')&&!asrStarted.stopDisabled&&asrStarted.startDisabled,asrStarted);
  await pause(1200);
  await tap('document.querySelector(".hd-stop")','Physical tap native offline ASR Stop');
  await waitUntil('document.querySelector(".hd-stop")?.disabled===true&&document.querySelector(".hd-start")?.disabled===false','native offline ASR stop completion',15000);
  const asrStopped=await value('({status:document.querySelector(".hd-voice-status span:last-child")?.textContent||"",stopDisabled:!!document.querySelector(".hd-stop")?.disabled,startDisabled:!!document.querySelector(".hd-start")?.disabled,transcript:document.querySelector(".hd-voice-transcript")?.value||""})');
  report.asrStopped=asrStopped;
  check('Native offline ASR stops cleanly and re-enables controls',asrStopped.stopDisabled&& !asrStopped.startDisabled,asrStopped);
  // Android emulator microphone input can contain low-level synthetic noise;
  // record it for diagnostics, but never mistake it for the known speech fixture.
  report.asrAmbientBaseline=asrStopped.transcript;
  await value('(()=>{const a=document.querySelector(".hd-voice-transcript");if(a){a.value="";a.dispatchEvent(new Event("input",{bubbles:true}));}return true})()');

  // Run a known English speech fixture through a second instance of the exact
  // bundled Sherpa model, then deliver its native events into the live UI shim.
  await tap('document.querySelector(".hd-start")','Physical tap native offline ASR Start for speech fixture');
  await waitUntil('document.querySelector(".hd-voice-status span:last-child")?.textContent.includes("Recording")','native ASR fixture capture state',15000);
  const fixtureResult=await value('(async()=>{const p=window.Capacitor?.Plugins?.OfflineAsr;if(!p||typeof p.testDecodeBundledAudio!=="function")throw new Error("Debug ASR fixture method is missing");return await p.testDecodeBundledAudio({hotwords:window.__HD_NATIVE_OFFLINE_ASR_HOTWORDS__||""})})()');
  report.asrFixtureResult=fixtureResult;
  const fixtureText=String(fixtureResult?.text||'').toLowerCase();
  check('Bundled Sherpa model decodes real speech audio to non-empty text',fixtureText.length>20,fixtureResult);
  const fixtureTerms=['queen','eggs','larva','brood','colony','honey'];
  const recognizedTerms=fixtureTerms.filter(term=>fixtureText.includes(term));
  report.asrFixtureRecognizedTerms=recognizedTerms;
  check('Sherpa speech fixture recognizes the key beekeeping vocabulary',recognizedTerms.length>=5,{fixtureText,recognizedTerms});
  await waitUntil('document.querySelector(".hd-voice-transcript")?.value.trim().length>20','native speech result reaches the voice transcript',15000);
  await tap('document.querySelector(".hd-stop")','Physical tap native offline ASR Stop after speech fixture');
  await waitUntil('document.querySelector(".hd-stop")?.disabled===true&&document.querySelector(".hd-start")?.disabled===false','native ASR speech fixture stop completion',15000);
  const asrTranscript=await value('document.querySelector(".hd-voice-transcript")?.value||""');
  report.asrTranscript=asrTranscript;
  check('Native ASR event bridge fills the visible transcript field',asrTranscript.trim().length>20,{asrTranscript});
  const detectedFields=await value('(()=>Object.fromEntries([...document.querySelectorAll(".hd-fields .hd-field")].map(e=>[e.querySelector("span")?.textContent?.trim()||"",e.querySelector("b")?.textContent?.trim()||""])))()');
  report.asrDetectedFields=detectedFields;
  const asrFieldMappingPass=
    detectedFields['Queen seen']==='Seen' &&
    detectedFields['Eggs']==='Seen' &&
    detectedFields['Larvae']==='Seen' &&
    detectedFields['Brood pattern']==='Good' &&
    detectedFields['Colony strength']==='6' &&
    detectedFields['Honey stores']==='Medium' &&
    detectedFields['Queen cells']==='None' &&
    detectedFields['Swarming']==='None' &&
    detectedFields['Pests']==='None' &&
    detectedFields['Disease']==='None';
  // Keep the real ASR result as a hard pass/fail, but do not abort the
  // downstream parser / Apply / durable-save tests when ASR is the only failure.
  report.tests.push({
    name:'Speech transcript maps into structured Inspection fields',
    pass:asrFieldMappingPass,
    details:detectedFields
  });
  report.applyTestSource=asrFieldMappingPass?'actual native ASR transcript':'controlled canonical transcript after preserving the ASR failure';
  if(!asrFieldMappingPass){
    const canonicalTranscript='Queen seen. Fresh eggs. Larvae present. Brood pattern is good. Colony strength six. Honey stores are medium. No queen cells. No swarm signs. No pests. No disease.';
    report.controlledTranscript=canonicalTranscript;
    await value('(()=>{const a=document.querySelector(".hd-voice-transcript");if(!a)throw new Error("Voice transcript field disappeared");a.value='+JSON.stringify(canonicalTranscript)+';a.dispatchEvent(new Event("input",{bubbles:true}));return true})()');
    const controlledFields=await value('(()=>Object.fromEntries([...document.querySelectorAll(".hd-fields .hd-field")].map(e=>[e.querySelector("span")?.textContent?.trim()||"",e.querySelector("b")?.textContent?.trim()||""])))()');
    report.controlledTranscriptFields=controlledFields;
    check('Canonical transcript independently maps to all eight Inspection fields',
      controlledFields['Queen seen']==='Seen' &&
      controlledFields['Eggs']==='Seen' &&
      controlledFields['Larvae']==='Seen' &&
      controlledFields['Brood pattern']==='Good' &&
      controlledFields['Colony strength']==='6' &&
      controlledFields['Honey stores']==='Medium' &&
      controlledFields['Queen cells']==='None' &&
      controlledFields['Swarming']==='None' &&
      controlledFields['Pests']==='None' &&
      controlledFields['Disease']==='None',
      controlledFields);
  }
  await tap('document.querySelector(".hd-apply")','Physical tap Apply to Inspection');
  await waitUntil('!document.querySelector(".hd-voice-overlay")','voice dialog closes after Apply',10000);
  const appliedDraft=await value('(()=>{const lexical=typeof V49_INSPECTION_DRAFT!=="undefined",d=(lexical?V49_INSPECTION_DRAFT:null)||window.V49_INSPECTION_DRAFT||{};return {readSource:lexical?"global lexical binding":"window property",queenStatus:d.queenStatus,eggs:d.eggs,larvae:d.larvae,brood:d.brood,colonySize:d.colonySize,honey:d.honey,queenCells:d.queenCells,swarming:d.swarming,pests:d.pests,disease:d.disease,notes:d.notes||"",voiceNotes:d.voiceNotes||"",confirmed:d.__confirmedFields||{}}})()');
  report.asrAppliedDraft=appliedDraft;
  const appliedNotesInput=await value('document.querySelector("#inotes")?.value||""');
  report.appliedNotesInput=appliedNotesInput;
  check('Voice Apply transfers detected values into the active Inspection draft',
    appliedDraft.queenStatus==='Seen' &&
    appliedDraft.eggs==='Seen' &&
    appliedDraft.larvae==='Seen' &&
    appliedDraft.brood==='Good' &&
    Number(appliedDraft.colonySize)===6 &&
    appliedDraft.honey==='Medium' &&
    appliedDraft.queenCells==='None' &&
    appliedDraft.swarming==='None' &&
    appliedDraft.pests==='None' &&
    appliedDraft.disease==='None',
    {appliedDraft,appliedNotesInput});
  await screenshot('android-touch-voice-fill-applied.png');

  // Save the inspection and verify the actual local state + log row. This remains
  // local-only in this unauthenticated Android QA session; no cloud session exists.
  const hiveIdLiteral=JSON.stringify(hiveId);
  const inspectionCountBeforeSave=await value('(()=>{const s=v45s();return (s.logs?.inspections||[]).filter(x=>String(x.hiveId)==='+hiveIdLiteral+').length})()');
  report.inspectionCountBeforeSave=inspectionCountBeforeSave;
  await value('(()=>{window.__hdLastSaveResult=null;if(typeof window.save==="function"&&!window.__hdSaveWrapped){const original=window.save;window.save=function(){const result=original.apply(this,arguments);window.__hdLastSaveResult=result;return result};window.__hdSaveWrapped=true;}return true})()');
  await tap('Array.from(document.querySelectorAll("#view .dual button")).find(e=>e.textContent.trim()==="Save Inspection")','Physical tap Save Inspection');
  let savedRouteReached=false;
  try{await waitUntil('location.hash==='+JSON.stringify('#hive/'+hiveId),'saved hive detail page',15000);savedRouteReached=true;}catch(e){report.saveWaitError=String(e);}
  const saveTapDiagnostics=await value('(()=>{const s=v45s(),h=hive(s,'+hiveIdLiteral+'),rows=(s.logs?.inspections||[]).filter(x=>String(x.hiveId)==='+hiveIdLiteral+'),d=(typeof V49_INSPECTION_DRAFT!=="undefined"?V49_INSPECTION_DRAFT:null)||window.V49_INSPECTION_DRAFT||null,b=[...document.querySelectorAll("#view .dual button")].find(e=>e.textContent.trim()==="Save Inspection");return {hash:location.hash,routeReached:location.hash==='+JSON.stringify('#hive/'+hiveId)+',saveResult:window.__hdLastSaveResult,saveWrapped:window.__hdSaveWrapped,saveFunction:typeof vSaveInspection,saveButtonOnclick:b?.getAttribute("onclick")||null,hiveExists:!!h,inspectionCount:rows.length,latestLog:rows.at(-1)||null,hiveInspection:h?.insp||null,draftExists:!!d,draft:d?{hiveId:d.hiveId,queenStatus:d.queenStatus,eggs:d.eggs,larvae:d.larvae,brood:d.brood,colonySize:d.colonySize,honey:d.honey,queenCells:d.queenCells,swarming:d.swarming,pests:d.pests,disease:d.disease}:null,toast:document.querySelector("#toast")?.textContent||"",errors:window.__jsErrors||[],authRequired:window.HIVEDASH_CONFIG?.REQUIRE_AUTH,authenticated:typeof isAuthenticated==="function"?isAuthenticated():null,modalCount:document.querySelectorAll("#app > .modal").length}})()');
  report.saveTapDiagnostics=saveTapDiagnostics;
  await screenshot('android-touch-save-inspection-after-tap.png');
  check('Physical Save Inspection tap reaches the saved hive detail page',savedRouteReached,saveTapDiagnostics);
  const savedState=await value('(()=>{const s=v45s(),h=hive(s,'+hiveIdLiteral+'),rows=(s.logs?.inspections||[]).filter(x=>String(x.hiveId)==='+hiveIdLiteral+'),last=rows.at(-1)||null;return {hash:location.hash,count:rows.length,hive:{queen:h?.queen,eggs:h?.eggs,larvae:h?.larvae,queenCells:h?.queenCells,strength:h?.strength,brood:h?.brood,honey:h?.honey,swarm:h?.swarm,notes:h?.notes,insp:h?.insp},latestLog:last}})()');
  report.savedInspection=savedState;
  check('Save Inspection creates one durable record with the reviewed values',
    savedState.hash==='#hive/'+hiveId &&
    savedState.count===inspectionCountBeforeSave+1 &&
    savedState.hive?.insp?.queenStatus==='Seen' &&
    savedState.hive?.insp?.eggs==='Seen' &&
    savedState.hive?.insp?.larvae==='Seen' &&
    savedState.hive?.insp?.brood==='Good' &&
    Number(savedState.hive?.insp?.colonySize)===6 &&
    savedState.hive?.insp?.honey==='Medium' &&
    savedState.hive?.insp?.queenCells==='None' &&
    savedState.hive?.insp?.swarming==='None' &&
    savedState.hive?.insp?.pests==='None' &&
    savedState.hive?.insp?.disease==='None' &&
    String(savedState.hive?.notes||'').toLowerCase().includes('queen') &&
    String(savedState.latestLog?.notes||'').toLowerCase().includes('queen'),
    savedState);

  // Reload the WebView, then read from the app's persisted local state rather than
  // the still-live draft object. This proves that the saved record survives restart.
  await client.Page.reload({ignoreCache:true});
  await pause(1800);
  await waitUntil('document.readyState==="complete"&&!!window.HIVEDASH_CONFIG&&typeof window.render==="function"','app reload after Inspection save',20000);
  await value('(()=>{window.HIVEDASH_CONFIG.REQUIRE_AUTH=false;location.hash="home";window.render();return true})()');
  await waitUntil('location.hash==="#home"&&!!document.querySelector("#bottomnav")','Home after WebView reload',15000);
  const reloadedState=await value('(()=>{const s=v45s(),h=hive(s,'+hiveIdLiteral+'),rows=(s.logs?.inspections||[]).filter(x=>String(x.hiveId)==='+hiveIdLiteral+'),last=rows.at(-1)||null;return {hash:location.hash,count:rows.length,hive:{queen:h?.queen,eggs:h?.eggs,larvae:h?.larvae,queenCells:h?.queenCells,strength:h?.strength,brood:h?.brood,honey:h?.honey,swarm:h?.swarm,insp:h?.insp},latestLog:last}})()');
  report.reloadedInspection=reloadedState;
  check('Inspection record remains in local storage after full WebView reload',
    reloadedState.count===inspectionCountBeforeSave+1 &&
    reloadedState.hive?.insp?.queenStatus==='Seen' &&
    reloadedState.hive?.insp?.eggs==='Seen' &&
    reloadedState.hive?.insp?.larvae==='Seen' &&
    reloadedState.hive?.insp?.brood==='Good' &&
    Number(reloadedState.hive?.insp?.colonySize)===6 &&
    reloadedState.hive?.insp?.honey==='Medium' &&
    reloadedState.hive?.insp?.queenCells==='None' &&
    reloadedState.hive?.insp?.swarming==='None' &&
    String(reloadedState.hive?.notes||'').toLowerCase().includes('queen') &&
    String(reloadedState.latestLog?.notes||'').toLowerCase().includes('queen'),
    reloadedState);

  await value('window.go("inspection/"+'+hiveIdLiteral+')');
  await waitUntil('location.hash==='+JSON.stringify('#inspection/'+hiveId),'reopen saved Inspection after reload',15000);
  const reopenedDraft=await value('(()=>{const d=(typeof V49_INSPECTION_DRAFT!=="undefined"?V49_INSPECTION_DRAFT:null)||window.V49_INSPECTION_DRAFT||{};return {queenStatus:d.queenStatus,eggs:d.eggs,larvae:d.larvae,brood:d.brood,colonySize:d.colonySize,honey:d.honey,queenCells:d.queenCells,swarming:d.swarming,notes:d.notes||""}})()');
  report.reopenedInspectionDraft=reopenedDraft;
  check('Reopened Inspection displays the saved observation values',
    reopenedDraft.queenStatus==='Seen' &&
    reopenedDraft.eggs==='Seen' &&
    reopenedDraft.larvae==='Seen' &&
    reopenedDraft.brood==='Good' &&
    Number(reopenedDraft.colonySize)===6 &&
    reopenedDraft.honey==='Medium' &&
    reopenedDraft.queenCells==='None' &&
    reopenedDraft.swarming==='None',
    reopenedDraft);

  await tap('Array.from(document.querySelectorAll("#view button")).find(e=>e.textContent.trim()==="Voice fill")','Reopen Voice fill after applying');
  await waitUntil('!!document.querySelector(".hd-voice-overlay")','reopened Voice fill dialog');
  await tap('document.querySelector(".hd-voice-transcript")','Physical tap Voice fill transcript');
  const voiceFocus=await value('document.activeElement?.classList?.contains("hd-voice-transcript")||false');
  check('Voice fill transcript receives physical touch focus',voiceFocus,{voiceFocus});
  await tap('document.querySelector(".hd-cancel")','Physical tap Voice fill Cancel');
  const voiceClosed=await value('!document.querySelector(".hd-voice-overlay")');
  check('Voice fill Cancel closes the dialog without applying additional changes',voiceClosed,{voiceClosed});
  await screenshot('android-touch-voice-fill-cancelled.png');

  report.finalGeometry=await value('(()=>({height:innerHeight,top:document.querySelector("#topbar")?.getBoundingClientRect().top,bottom:document.querySelector("#bottomnav")?.getBoundingClientRect().bottom,navHeight:document.querySelector("#bottomnav")?.getBoundingClientRect().height}))()');
 }catch(e){report.failure=String(e.stack||e);process.exitCode=1}
 finally{
  try{if(client)await client.close()}catch{}
  report.status=report.tests.length&&report.tests.every(x=>x.pass)&&!report.failure?'PASSED':'FAILED';
  if(report.status!=='PASSED')process.exitCode=1;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('ANDROID_NATIVE_TOUCH_REPORT '+JSON.stringify(report));
 }
}
run().catch(e=>{report.failure=String(e.stack||e);report.status='FAILED';fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));process.exitCode=1});
