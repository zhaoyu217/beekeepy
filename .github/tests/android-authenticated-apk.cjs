/* Android 15 actual APK + real Supabase test. */
const fs=require("node:fs");
const crypto=require("node:crypto");
const CDP=require("chrome-remote-interface");
const child=require("node:child_process");
const configText=fs.readFileSync("config.js","utf8");
const projectUrl=configText.match(/SUPABASE_URL:\s*"([^"]+)"/)?.[1];
const publishableKey=configText.match(/SUPABASE_PUBLISHABLE_KEY:\s*"([^"]+)"/)?.[1];
const report={mode:"Android 15 emulator / real APK / live Supabase",checks:[],accounts:[],cleanup:{rowsDeleted:false},pageErrors:[]};
const tag=crypto.randomUUID().slice(0,8);
const adb=(...args)=>child.execFileSync("adb",args,{encoding:"utf8",timeout:20000}).trim();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let client,A=null,B=null;
function check(name,pass,detail={}){report.checks.push({name,pass:!!pass,detail});if(!pass)throw new Error(name+": "+JSON.stringify(detail))}
async function evaluate(expression){
 const r=await client.Runtime.evaluate({expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw new Error("WebView JS exception: "+JSON.stringify(r.exceptionDetails).slice(0,900));
 return r.result?.value;
}
async function waitUntil(expression,label,timeout=30000){
 const start=Date.now();let last;
 while(Date.now()-start<timeout){last=await evaluate(expression);if(last)return last;await pause(180)}
 throw new Error("Timed out waiting for "+label+"; last="+JSON.stringify(last));
}
async function fill(id,value){
 const expression='(()=>{const e=document.getElementById('+JSON.stringify(id)+');if(!e)return false;e.value='+JSON.stringify(value)+';e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return true})()';
 const ok=await evaluate(expression);if(!ok)throw new Error("Missing input "+id);
}
async function submitSignup(label){
 const email="qa-apk-"+label+"-"+tag+"@example.invalid";
 const password=crypto.randomBytes(24).toString("base64url")+"Aa9!";
 await evaluate('document.querySelector("#authModeSwitch")?.click()');
 await waitUntil('!!document.querySelector("#authName")',"sign-up form");
 await fill("authName","HiveDash APK QA "+label.toUpperCase());
 await fill("authEmail",email);
 await fill("authPassword",password);
 await evaluate('document.querySelector("#authSubmit")?.click()');
 const session=await waitUntil(
  '(()=>typeof currentSession!=="undefined"&&currentSession?.user?.id&&cloudReady&&!document.querySelector(".auth-page")?({id:currentSession.user.id,email:currentSession.user.email,access:currentSession.access_token}):null)()',
  "authenticated sign-up "+label,45000);
 report.accounts.push({label,email,id:session.id});
 return {label,email,password,id:session.id,access:session.access};
}
async function signIn(account){
 await waitUntil('!!document.querySelector("#authEmail")',"sign-in form",20000);
 await fill("authEmail",account.email);await fill("authPassword",account.password);
 await evaluate('document.querySelector("#authSubmit")?.click()');
 const session=await waitUntil(
  '(()=>typeof currentSession!=="undefined"&&currentSession?.user?.id&&cloudReady&&!document.querySelector(".auth-page")?({id:currentSession.user.id,access:currentSession.access_token}):null)()',
  "sign-in "+account.label,45000);
 if(session.id!==account.id)throw new Error("Wrong account signed in");
}
async function signOut(){
 await evaluate("signOutCloud()");
 await waitUntil('typeof currentSession!=="undefined"&&!currentSession?.user&&!!document.querySelector("#authEmail")',"sign-out",20000);
}
async function saveMarker(marker){
 const result=await evaluate('(()=>{const s=state();s.meta=s.meta||{};s.meta.qaMarker='+JSON.stringify(marker)+';s.meta.userId=currentSession.user.id;return save(s)})()');
 check("App accepts local state "+marker,result===true,{result});
}
async function remoteRow(user){
 const r=await fetch(projectUrl+"/rest/v1/app_state?select=user_id,payload,updated_at&user_id=eq."+encodeURIComponent(user.id),{
  headers:{apikey:publishableKey,Authorization:"Bearer "+user.access},signal:AbortSignal.timeout(15000)});
 const text=await r.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}
 if(!r.ok)throw new Error("Cloud read failed "+r.status+": "+String(text).slice(0,500));
 return Array.isArray(data)?data[0]||null:null;
}
async function waitRemoteMarker(user,marker,timeout=25000){
 const start=Date.now();let row=null;
 while(Date.now()-start<timeout){row=await remoteRow(user);if(row?.payload?.meta?.qaMarker===marker)return row;await pause(250)}
 throw new Error("Cloud marker did not arrive: "+marker+"; got="+row?.payload?.meta?.qaMarker);
}
async function main(){
 check("APK test config targets beekeepy-test",projectUrl==="https://awapkkzqjubqfnqkqfbr.supabase.co",{projectUrl});
 check("APK uses a public publishable key",typeof publishableKey==="string"&&publishableKey.startsWith("sb_publishable_"),{prefix:publishableKey?.slice(0,14)});
 const settingsResponse=await fetch(projectUrl+"/auth/v1/settings",{headers:{apikey:publishableKey}});
 const settings=await settingsResponse.json();
 check("Test project allows instant email sign-up",settings.mailer_autoconfirm===true&&settings.disable_signup===false,{mailer_autoconfirm:settings.mailer_autoconfirm,disable_signup:settings.disable_signup});
 const pkg="app.hivefield.mobile.fix";
 check("APK is installed on Android 15 emulator",adb("shell","pm","path",pkg).includes("package:"));
 const pid=adb("shell","pidof",pkg).split(/\s+/)[0];
 check("APK process is running",/^\d+$/.test(pid),{pid});
 report.android={version:adb("shell","getprop","ro.build.version.release"),size:adb("shell","wm","size"),density:adb("shell","wm","density")};
 adb("forward","tcp:9222","localabstract:webview_devtools_remote_"+pid);
 const targets=await CDP.List({host:"127.0.0.1",port:9222});
 const target=targets.find(x=>x.type==="page"&&x.url?.includes("localhost"))||targets.find(x=>x.type==="page");
 check("APK WebView exposes a live page",!!target,{url:target?.url});
 client=await CDP({host:"127.0.0.1",port:9222,target,local:true});
 await client.Runtime.enable();await client.Page.enable();await client.Network.enable();
 client.Runtime.exceptionThrown(({exceptionDetails})=>report.pageErrors.push(exceptionDetails?.text||exceptionDetails?.exception?.description||"WebView exception"));
 const boot=await waitUntil(
  '(()=>document.readyState==="complete"&&typeof supabaseClient!=="undefined"&&!!document.querySelector("#authEmail")?({ready:document.readyState,authForm:true,configured:CLOUD_CONFIGURED,requireAuth:CLOUD_CONFIG.REQUIRE_AUTH}):null)()',
  "real app authentication screen",30000);
 report.boot=boot;
 check("Real APK starts in authentication mode",boot.authForm&&boot.configured===true&&boot.requireAuth===true,boot);
 A=await submitSignup("a");
 check("Real APK creates and signs in account A",!!A.id,{userId:A.id});
 await saveMarker("APK_A_INITIAL");
 const aInitial=await waitRemoteMarker(A,"APK_A_INITIAL");
 check("Real APK A data reaches live Supabase",aInitial?.payload?.meta?.qaMarker==="APK_A_INITIAL",{marker:aInitial?.payload?.meta?.qaMarker});
 await signOut();
 B=await submitSignup("b");
 check("Real APK creates and signs in account B",!!B.id&&B.id!==A.id,{userId:B.id});
 await saveMarker("APK_B_INITIAL");
 const bInitial=await waitRemoteMarker(B,"APK_B_INITIAL");
 check("Real APK B data reaches live Supabase",bInitial?.payload?.meta?.qaMarker==="APK_B_INITIAL",{marker:bInitial?.payload?.meta?.qaMarker});
 const bForeign=await evaluate('(async()=>{const {data,error}=await supabaseClient.from("app_state").select("user_id,payload").eq("user_id",'+JSON.stringify(A.id)+').maybeSingle();return {data,error:error?.message||null,localMarker:state().meta?.qaMarker||null}})()');
 check("Real APK B cannot read A cloud row",bForeign.data===null&&bForeign.localMarker!=="APK_A_INITIAL",bForeign);
 await signOut();await signIn(A);
 const aForeign=await evaluate('(async()=>{const {data,error}=await supabaseClient.from("app_state").select("user_id,payload").eq("user_id",'+JSON.stringify(B.id)+').maybeSingle();return {data,error:error?.message||null,localMarker:state().meta?.qaMarker||null}})()');
 check("Real APK A cannot read B cloud row",aForeign.data===null&&aForeign.localMarker==="APK_A_INITIAL",aForeign);
 const crossUpdate=await evaluate('(async()=>{const {data,error}=await supabaseClient.from("app_state").update({payload:{meta:{qaMarker:"APK_A_TAMPERED_B"}}}).eq("user_id",'+JSON.stringify(B.id)+').select("user_id");return {data,error:error?.message||null}})()');
 check("Real APK A cannot update B cloud row",!crossUpdate.error&&Array.isArray(crossUpdate.data)&&crossUpdate.data.length===0,crossUpdate);
 const nav=await evaluate('[...document.querySelectorAll("#bottomnav .navitem")].map(x=>x.textContent.trim())');
 check("Real APK shows all four bottom navigation tabs",Array.isArray(nav)&&nav.length===4,{nav});
 for(const route of ["hives","actions","insights","home"]){
  await evaluate("go("+JSON.stringify(route)+")");
  const current=await waitUntil("location.hash==="+JSON.stringify("#"+route),"route "+route,8000);
  check("Real APK authenticated navigation "+route,current===true,{route});
 }
 await saveMarker("APK_A_ONLINE_BASE");await waitRemoteMarker(A,"APK_A_ONLINE_BASE");
 await client.Network.emulateNetworkConditions({offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 const offline=await waitUntil("navigator.onLine===false","Android WebView offline state",10000);
 check("Android WebView reports offline",offline===true,{offline});
 await saveMarker("APK_A_OFFLINE_PENDING");await pause(1200);
 const beforeReconnect=await remoteRow(A);
 check("Offline APK change is not falsely uploaded",beforeReconnect?.payload?.meta?.qaMarker==="APK_A_ONLINE_BASE",{remoteMarker:beforeReconnect?.payload?.meta?.qaMarker||null});
 await client.Network.emulateNetworkConditions({offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 const online=await waitUntil("navigator.onLine===true","Android WebView network restoration",15000);
 check("Android WebView returns online",online===true,{online});
 await waitRemoteMarker(A,"APK_A_OFFLINE_PENDING",30000);
 await waitUntil('cloudStatusText()==="Synced"',"cloud sync status after reconnect",20000);
 check("Real APK automatically uploads offline changes after reconnect",true,{marker:"APK_A_OFFLINE_PENDING"});
 check("No uncaught JavaScript exceptions in real APK",report.pageErrors.length===0,{pageErrors:report.pageErrors});
 let cleanup=true;
 for(const user of [A,B]){
  if(!user)continue;
  const response=await fetch(projectUrl+"/rest/v1/app_state?user_id=eq."+encodeURIComponent(user.id),{
   method:"DELETE",headers:{apikey:publishableKey,Authorization:"Bearer "+user.access,Prefer:"return=representation"}});
  if(!response.ok)cleanup=false;
 }
 report.cleanup.rowsDeleted=cleanup;
 check("This Android test run's app_state rows are removed",cleanup,{rowsDeleted:cleanup});
}
main().catch(error=>{report.failure=String(error.stack||error);process.exitCode=1}).finally(async()=>{
 if(client){try{await client.close()}catch{}}
 report.status=report.checks.every(x=>x.pass)?"PASSED":"FAILED";
 fs.writeFileSync("android-auth-results/report.json",JSON.stringify(report,null,2));
 console.log("ANDROID_AUTHENTICATED_APK_REPORT "+JSON.stringify(report));
});
