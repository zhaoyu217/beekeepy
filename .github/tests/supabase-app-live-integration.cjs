const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const {chromium}=require("playwright");
const root=path.resolve("mobile/dist");
const report={checks:[],pageErrors:[],accounts:[]};
const tag=crypto.randomUUID().slice(0,8);
const mime={
  ".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",".json":"application/json",
  ".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon",
  ".woff":"font/woff",".woff2":"font/woff2"
};
let server,browser;
const contexts=[];
function check(name,pass,detail={}){
  report.checks.push({name,pass:!!pass,detail});
  if(!pass)throw new Error(name+": "+JSON.stringify(detail));
}
async function makePage(label){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  contexts.push(context);
  const page=await context.newPage();
  page.on("pageerror",e=>report.pageErrors.push(label+": "+String(e.stack||e)));
  page.on("console",msg=>{
    if(msg.type()==="error"&&!/fonts\.googleapis|gstatic/.test(msg.text()))
      report.consoleErrors=(report.consoleErrors||[]).concat(label+": "+msg.text()).slice(-30);
  });
  await page.goto("http://127.0.0.1:"+server.address().port+"/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#authEmail",{timeout:30000});
  return page;
}
async function waitForAuth(page,userId=null){
  await page.waitForFunction((id)=>{
    return typeof currentSession!=="undefined" &&
      !!currentSession?.user &&
      (!id || currentSession.user.id===id) &&
      typeof cloudReady!=="undefined" && cloudReady &&
      !document.querySelector(".auth-page");
  },userId,{timeout:45000});
}
async function signup(page,label){
  const email="qa-app-"+label+"-"+tag+"@example.invalid";
  const password=crypto.randomBytes(24).toString("base64url")+"Aa9!";
  await page.click("#authModeSwitch");
  await page.waitForSelector("#authName");
  await page.fill("#authName","HiveDash App QA "+label);
  await page.fill("#authEmail",email);
  await page.fill("#authPassword",password);
  await page.click("#authSubmit");
  try{await waitForAuth(page)}catch(e){
    const visible=await page.locator("#view").innerText().catch(()=>"(view unavailable)");
    throw new Error("App sign-up did not complete for "+label+". Visible page: "+visible.slice(0,800)+"; "+e);
  }
  const account=await page.evaluate(()=>({
    id:currentSession.user.id,
    email:currentSession.user.email,
    cloudReady,
    cloudStatus:cloudStatusText()
  }));
  report.accounts.push({label,email,password:"[not logged]",id:account.id});
  return {label,email,password,id:account.id};
}
async function signin(page,account){
  await page.waitForSelector("#authEmail",{timeout:20000});
  await page.fill("#authEmail",account.email);
  await page.fill("#authPassword",account.password);
  await page.click("#authSubmit");
  await waitForAuth(page,account.id);
}
async function signout(page){
  await page.evaluate(()=>signOutCloud());
  await page.waitForFunction(()=>typeof currentSession!=="undefined"&&!currentSession?.user&&!!document.querySelector("#authEmail"),null,{timeout:20000});
}
async function saveMarker(page,marker){
  const result=await page.evaluate(value=>{
    const s=state();
    s.meta=s.meta||{};
    s.meta.qaMarker=value;
    s.meta.userId=currentSession.user.id;
    return save(s);
  },marker);
  check("App accepted local state update "+marker,result===true,{result});
  await page.waitForFunction(async ({marker})=>{
    if(!currentSession?.user)return false;
    const {data,error}=await supabaseClient.from("app_state")
      .select("payload,updated_at").eq("user_id",currentSession.user.id).maybeSingle();
    return !error&&data?.payload?.meta?.qaMarker===marker;
  },{marker},{timeout:25000});
  return await page.evaluate(()=>({userId:currentSession.user.id,marker:state().meta?.qaMarker,cloudStatus:cloudStatusText()}));
}
async function currentState(page){
  return await page.evaluate(()=>({
    userId:currentSession?.user?.id||null,
    email:currentSession?.user?.email||null,
    marker:state().meta?.qaMarker||null,
    cloudReady,
    cloudStatus:cloudStatusText(),
    realtimeState:realtimeChannel?.state||null
  }));
}
async function waitMarker(page,marker){
  await page.waitForFunction(value=>state().meta?.qaMarker===value,marker,{timeout:20000});
}
async function main(){
  server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    const file=path.resolve(root,"."+ (pathname==="/"?"/index.html":pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
    try{
      const data=fs.readFileSync(file);
      res.writeHead(200,{"Content-Type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store"});
      res.end(data);
    }catch{
      res.writeHead(404);res.end("Not found: "+pathname);
    }
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    browser=await chromium.launch({args:["--no-sandbox"]});
    const pageA=await makePage("A");
    const A=await signup(pageA,"a");
    check("Account A enters authenticated app",!!A.id,await currentState(pageA));
    const aInitial=await saveMarker(pageA,"APP_A_INITIAL");
    check("App A writes real cloud state",aInitial.marker==="APP_A_INITIAL",aInitial);

    const pageB=await makePage("B");
    const B=await signup(pageB,"b");
    check("Account B enters authenticated app",!!B.id,await currentState(pageB));
    const bInitial=await saveMarker(pageB,"APP_B_INITIAL");
    check("App B writes real cloud state",bInitial.marker==="APP_B_INITIAL",bInitial);

    const bIsolation=await pageB.evaluate(async aId=>{
      const local=state();
      const {data,error}=await supabaseClient.from("app_state")
        .select("user_id,payload").eq("user_id",aId).maybeSingle();
      return {localMarker:local.meta?.qaMarker||null,foreignRow:data,error:error?.message||null};
    },A.id);
    check("App B cannot read A cloud row and has no A local marker",
      bIsolation.foreignRow===null&&bIsolation.localMarker!=="APP_A_INITIAL",
      bIsolation);

    const aIsolation=await pageA.evaluate(async bId=>{
      const local=state();
      const {data,error}=await supabaseClient.from("app_state")
        .select("user_id,payload").eq("user_id",bId).maybeSingle();
      return {localMarker:local.meta?.qaMarker||null,foreignRow:data,error:error?.message||null};
    },B.id);
    check("App A cannot read B cloud row and has no B local marker",
      aIsolation.foreignRow===null&&aIsolation.localMarker==="APP_A_INITIAL",
      aIsolation);

    const crossWrite=await pageA.evaluate(async bId=>{
      const {data,error}=await supabaseClient.from("app_state")
        .update({payload:{meta:{qaMarker:"A_TRIED_TO_WRITE_B"}}})
        .eq("user_id",bId).select("user_id");
      return {data,error:error?.message||null};
    },B.id);
    check("App A cannot update B row",!crossWrite.error&&Array.isArray(crossWrite.data)&&crossWrite.data.length===0,crossWrite);

    // Switch the same browser installation from A to B and back.
    await signout(pageA);
    await signin(pageA,B);
    const switchedToB=await currentState(pageA);
    check("Same app instance switches from A to B without exposing A data",
      switchedToB.userId===B.id&&switchedToB.marker==="APP_B_INITIAL",switchedToB);
    await signout(pageA);
    await signin(pageA,A);
    const switchedBackA=await currentState(pageA);
    check("Same app instance switches back to A and restores A data",
      switchedBackA.userId===A.id&&switchedBackA.marker==="APP_A_INITIAL",switchedBackA);

    // A second device/browser session for A must receive A updates, while B must not.
    const pageA2=await makePage("A2");
    await signin(pageA2,A);
    const a2Initial=await currentState(pageA2);
    check("Second A device loads A's cloud state",
      a2Initial.userId===A.id&&a2Initial.marker==="APP_A_INITIAL",a2Initial);

    await saveMarker(pageB,"APP_B_REMOTE_UPDATE");
    await waitMarker(pageB,"APP_B_REMOTE_UPDATE");
    const a2AfterB=await currentState(pageA2);
    check("A device does not receive B account updates",
      a2AfterB.userId===A.id&&a2AfterB.marker==="APP_A_INITIAL",a2AfterB);

    await saveMarker(pageA,"APP_A_REMOTE_UPDATE");
    await pageA2.waitForFunction(()=>state().meta?.qaMarker==="APP_A_REMOTE_UPDATE",null,{timeout:20000});
    const a2AfterA=await currentState(pageA2);
    check("Second A device receives A's real Realtime cloud update",
      a2AfterA.userId===A.id&&a2AfterA.marker==="APP_A_REMOTE_UPDATE",a2AfterA);
    const bAfterA=await currentState(pageB);
    check("B device does not receive A account updates",
      bAfterA.userId===B.id&&bAfterA.marker==="APP_B_REMOTE_UPDATE",bAfterA);

    // Simulate a genuine browser network outage on A's app instance.
    await pageA.context().setOffline(true);
    await pageA.waitForFunction(()=>navigator.onLine===false,null,{timeout:10000});
    const offlineMarker="APP_A_OFFLINE_PENDING";
    const offlineLocal=await pageA.evaluate(marker=>{
      const s=state();
      s.meta.qaMarker=marker;
      const saved=save(s);
      return {saved,online:navigator.onLine,marker:state().meta?.qaMarker||null,status:cloudStatusText()};
    },offlineMarker);
    check("A can save locally while offline",
      offlineLocal.saved===true&&offlineLocal.online===false&&
      offlineLocal.marker===offlineMarker&&offlineLocal.status==="Offline",
      offlineLocal);
    await pageA.waitForTimeout(1000);

    const remoteBeforeReconnect=await pageA2.evaluate(async()=>{
      const {data,error}=await supabaseClient.from("app_state")
        .select("payload").eq("user_id",currentSession.user.id).maybeSingle();
      return {marker:data?.payload?.meta?.qaMarker||null,error:error?.message||null};
    });
    check("Offline change is not falsely reported as already uploaded",
      remoteBeforeReconnect.marker==="APP_A_REMOTE_UPDATE"&&!remoteBeforeReconnect.error,
      remoteBeforeReconnect);
    const a2BeforeReconnect=await currentState(pageA2);
    check("Other A device keeps last confirmed cloud version while A is offline",
      a2BeforeReconnect.marker==="APP_A_REMOTE_UPDATE",a2BeforeReconnect);

    await pageA.context().setOffline(false);
    await pageA.waitForFunction(()=>navigator.onLine===true,null,{timeout:10000});
    await pageA.waitForFunction(async marker=>{
      const {data,error}=await supabaseClient.from("app_state")
        .select("payload").eq("user_id",currentSession.user.id).maybeSingle();
      return !error&&data?.payload?.meta?.qaMarker===marker&&cloudStatusText()==="Synced";
    },offlineMarker,{timeout:30000});
    await pageA2.waitForFunction(marker=>state().meta?.qaMarker===marker,offlineMarker,{timeout:30000});
    await pageA2.waitForFunction(()=>cloudStatusText()==="Synced",null,{timeout:20000});
    const afterReconnect=await currentState(pageA);
    check("Offline A changes upload automatically after network reconnect",
      afterReconnect.marker===offlineMarker&&afterReconnect.cloudStatus==="Synced",
      afterReconnect);
    const a2AfterReconnect=await currentState(pageA2);
    check("Offline A changes reach the second A device through Realtime",
      a2AfterReconnect.marker===offlineMarker,a2AfterReconnect);
    const bAfterReconnect=await currentState(pageB);
    check("Offline A recovery does not leak into B account",
      bAfterReconnect.userId===B.id&&bAfterReconnect.marker==="APP_B_REMOTE_UPDATE",
      bAfterReconnect);

    check("No uncaught browser JavaScript errors",report.pageErrors.length===0,report.pageErrors);
    check("No unexpected browser console errors",(report.consoleErrors||[]).length===0,report.consoleErrors||[]);
  }catch(err){
    report.failure=String(err.stack||err);
    process.exitCode=1;
  }finally{
    console.log("SUPABASE_APP_LIVE_INTEGRATION_REPORT "+JSON.stringify(report));
    for(const context of contexts){try{await context.close()}catch{}}
    try{await browser?.close()}catch{}
    try{await new Promise(resolve=>server?.close(resolve))}catch{}
  }
}
main().catch(err=>{console.error(err);process.exitCode=1});
