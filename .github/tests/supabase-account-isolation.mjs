import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const configText=fs.readFileSync("config.js","utf8");
const url=configText.match(/SUPABASE_URL:\s*"([^"]+)"/)?.[1];
const key=configText.match(/SUPABASE_PUBLISHABLE_KEY:\s*"([^"]+)"/)?.[1];
const report={checks:[],createdAccounts:[],details:{}};
const tag=crypto.randomUUID().slice(0,8);
const created=[];
function check(name,pass,detail={}){
  report.checks.push({name,pass:!!pass,detail});
  if(!pass)throw new Error(name+" failed: "+JSON.stringify(detail));
}
async function readJson(response){
  const text=await response.text();
  try{return text?JSON.parse(text):null}catch{return text}
}
async function authRequest(path,body){
  const response=await fetch(url+path,{
    method:"POST",
    headers:{"apikey":key,"Content-Type":"application/json"},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(20000)
  });
  const data=await readJson(response);
  if(!response.ok)throw new Error("Auth request "+path+" returned "+response.status+": "+JSON.stringify(data));
  return data;
}
async function restRequest(path,token,init={}){
  const response=await fetch(url+path,{
    ...init,
    headers:{
      "apikey":key,
      "Authorization":"Bearer "+token,
      ...(init.headers||{})
    },
    signal:AbortSignal.timeout(20000)
  });
  const data=await readJson(response);
  return {status:response.status,ok:response.ok,data};
}
async function createAccount(label){
  const email="qa-"+label+"-"+tag+"@example.invalid";
  const password=crypto.randomBytes(24).toString("base64url")+"Aa9!";
  const signup=await authRequest("/auth/v1/signup",{
    email,password,data:{name:"HiveDash isolation QA "+label}
  });
  const user=signup.user||signup;
  if(!user?.id)throw new Error("Signup did not return a user id for "+label);
  created.push({label,email,id:user.id});
  report.createdAccounts.push({label,email,id:user.id});
  const login=await authRequest("/auth/v1/token?grant_type=password",{email,password});
  if(!login.access_token||!login.refresh_token||login.user?.id!==user.id){
    throw new Error("Password sign-in did not return a session for "+label);
  }
  return {label,email,id:user.id,access:login.access_token,refresh:login.refresh_token};
}
function rowFor(user,marker){
  const now=new Date().toISOString();
  return {
    user_id:user.id,
    payload:{
      meta:{userId:user.id,updatedAt:now},
      user:{email:user.email,name:"HiveDash isolation QA "+user.label,plan:"Free"},
      qa_marker:marker
    },
    updated_at:now
  };
}
async function upsert(user,marker){
  const result=await restRequest(
    "/rest/v1/app_state?on_conflict=user_id",
    user.access,
    {method:"POST",headers:{
      "Content-Type":"application/json",
      "Prefer":"resolution=merge-duplicates,return=representation"
    },body:JSON.stringify(rowFor(user,marker))}
  );
  if(!result.ok)throw new Error("Own-row upsert failed for "+user.label+": "+JSON.stringify(result));
  return result.data;
}
async function rowsFor(user,filter=""){
  const suffix=filter?"&"+filter:"";
  const result=await restRequest("/rest/v1/app_state?select=user_id,payload,updated_at"+suffix,user.access);
  if(!result.ok)throw new Error("Own-row read failed for "+user.label+": "+JSON.stringify(result));
  return result.data;
}
async function waitFor(fn,ms=12000){
  const start=Date.now();
  while(Date.now()-start<ms){
    if(fn())return true;
    await new Promise(r=>setTimeout(r,100));
  }
  return false;
}
async function subscribe(client,name,events){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error("Realtime subscription timed out: "+name))}},15000);
    const channel=client.channel("qa-"+tag+"-"+name)
      .on("postgres_changes",{event:"*",schema:"public",table:"app_state"},payload=>events.push(payload))
      .subscribe(status=>{
        if(status==="SUBSCRIBED"&&!settled){settled=true;clearTimeout(timer);resolve(channel)}
        if((status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")&&!settled){
          settled=true;clearTimeout(timer);reject(new Error("Realtime "+name+" status: "+status));
        }
      });
  });
}

let clientA=null,clientB=null,channelA=null,channelB=null;
async function main(){
  check("Test branch uses isolated beekeepy-test URL",
    url==="https://awapkkzqjubqfnqkqfbr.supabase.co",{url});
  check("Publishable key is configured",
    typeof key==="string"&&key.startsWith("sb_publishable_"),
    {prefix:key?.slice(0,14),length:key?.length});

  const settingsResponse=await fetch(url+"/auth/v1/settings",{
    headers:{apikey:key},signal:AbortSignal.timeout(20000)
  });
  const settings=await readJson(settingsResponse);
  check("Supabase Auth settings endpoint responds",
    settingsResponse.status===200,{status:settingsResponse.status});
  report.details.auth={
    mailer_autoconfirm:settings.mailer_autoconfirm??null,
    disable_signup:settings.disable_signup??null
  };
  check("Email confirmation is disabled for test signups",
    settings.mailer_autoconfirm===true,
    {mailer_autoconfirm:settings.mailer_autoconfirm,
     instruction:"If false, save the Confirm email toggle as OFF in beekeepy-test."});
  check("New user signups are allowed",
    settings.disable_signup===false,{disable_signup:settings.disable_signup});

  const A=await createAccount("a");
  const B=await createAccount("b");
  report.details.userIds={A:A.id,B:B.id};

  const aWrite=await upsert(A,"A_INITIAL");
  const bWrite=await upsert(B,"B_INITIAL");
  check("A can write its own app_state row",Array.isArray(aWrite)&&aWrite.length===1,
    {returnedRows:Array.isArray(aWrite)?aWrite.length:null});
  check("B can write its own app_state row",Array.isArray(bWrite)&&bWrite.length===1,
    {returnedRows:Array.isArray(bWrite)?bWrite.length:null});

  const aRows=await rowsFor(A);
  const bRows=await rowsFor(B);
  check("A can read its own row and no other account rows",
    aRows.length===1&&aRows[0].user_id===A.id&&aRows[0].payload.qa_marker==="A_INITIAL",
    {visibleUserIds:aRows.map(x=>x.user_id),markers:aRows.map(x=>x.payload?.qa_marker)});
  check("B can read its own row and no other account rows",
    bRows.length===1&&bRows[0].user_id===B.id&&bRows[0].payload.qa_marker==="B_INITIAL",
    {visibleUserIds:bRows.map(x=>x.user_id),markers:bRows.map(x=>x.payload?.qa_marker)});

  const aReadB=await rowsFor(A,"user_id=eq."+encodeURIComponent(B.id));
  const bReadA=await rowsFor(B,"user_id=eq."+encodeURIComponent(A.id));
  check("A cannot read B row",aReadB.length===0,{rows:aReadB.length});
  check("B cannot read A row",bReadA.length===0,{rows:bReadA.length});

  const aPatchB=await restRequest(
    "/rest/v1/app_state?user_id=eq."+encodeURIComponent(B.id),
    A.access,
    {method:"PATCH",headers:{
      "Content-Type":"application/json","Prefer":"return=representation"
    },body:JSON.stringify({payload:{qa_marker:"A_TRIED_TO_OVERWRITE_B"}})}
  );
  check("A cannot modify B row",
    aPatchB.ok&&Array.isArray(aPatchB.data)&&aPatchB.data.length===0,
    {status:aPatchB.status,returnedRows:Array.isArray(aPatchB.data)?aPatchB.data.length:null,body:aPatchB.data});

  const bAfterPatch=await rowsFor(B);
  check("B data remains unchanged after A attempted cross-account update",
    bAfterPatch.length===1&&bAfterPatch[0].payload.qa_marker==="B_INITIAL",
    {marker:bAfterPatch[0]?.payload?.qa_marker});

  const aDeleteB=await restRequest(
    "/rest/v1/app_state?user_id=eq."+encodeURIComponent(B.id),
    A.access,
    {method:"DELETE",headers:{"Prefer":"return=representation"}}
  );
  check("A cannot delete B row",
    aDeleteB.ok&&Array.isArray(aDeleteB.data)&&aDeleteB.data.length===0,
    {status:aDeleteB.status,returnedRows:Array.isArray(aDeleteB.data)?aDeleteB.data.length:null});

  const bAfterDelete=await rowsFor(B);
  check("B row still exists after A attempted cross-account delete",
    bAfterDelete.length===1&&bAfterDelete[0].payload.qa_marker==="B_INITIAL",
    {marker:bAfterDelete[0]?.payload?.qa_marker});

  const aUpdate=await upsert(A,"A_UPDATED");
  const bUpdate=await upsert(B,"B_UPDATED");
  const aFinal=await rowsFor(A),bFinal=await rowsFor(B);
  check("A can update its own row",aFinal.length===1&&aFinal[0].payload.qa_marker==="A_UPDATED",
    {marker:aFinal[0]?.payload?.qa_marker});
  check("B can update its own row",bFinal.length===1&&bFinal[0].payload.qa_marker==="B_UPDATED",
    {marker:bFinal[0]?.payload?.qa_marker});

  clientA=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
  clientB=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
  const [sessionA,sessionB]=await Promise.all([
    clientA.auth.setSession({access_token:A.access,refresh_token:A.refresh}),
    clientB.auth.setSession({access_token:B.access,refresh_token:B.refresh})
  ]);
  if(sessionA.error||sessionB.error)throw new Error("Could not set realtime test sessions: "+JSON.stringify({A:sessionA.error,B:sessionB.error}));

  const eventsA=[],eventsB=[];
  channelA=await subscribe(clientA,"A",eventsA);
  channelB=await subscribe(clientB,"B",eventsB);
  check("Both authenticated Realtime subscriptions connect",!!channelA&&!!channelB,{A:!!channelA,B:!!channelB});

  const bRealtime={...rowFor(B,"B_REALTIME"),updated_at:new Date(Date.now()+1000).toISOString()};
  bRealtime.payload.meta.updatedAt=bRealtime.updated_at;
  const bRealtimeWrite=await clientB.from("app_state").upsert(bRealtime,{onConflict:"user_id"});
  if(bRealtimeWrite.error)throw new Error("B realtime update failed: "+bRealtimeWrite.error.message);
  const bGotOwn=await waitFor(()=>eventsB.some(e=>e.new?.user_id===B.id&&e.new?.payload?.qa_marker==="B_REALTIME"));
  await new Promise(r=>setTimeout(r,1500));
  check("B receives its own Realtime change",bGotOwn,{events:eventsB.map(e=>e.new?.user_id)});
  check("A does not receive B Realtime data",
    !eventsA.some(e=>e.new?.user_id===B.id),
    {events:eventsA.map(e=>e.new?.user_id)});

  const aRealtime={...rowFor(A,"A_REALTIME"),updated_at:new Date(Date.now()+2000).toISOString()};
  aRealtime.payload.meta.updatedAt=aRealtime.updated_at;
  const aRealtimeWrite=await clientA.from("app_state").upsert(aRealtime,{onConflict:"user_id"});
  if(aRealtimeWrite.error)throw new Error("A realtime update failed: "+aRealtimeWrite.error.message);
  const aGotOwn=await waitFor(()=>eventsA.some(e=>e.new?.user_id===A.id&&e.new?.payload?.qa_marker==="A_REALTIME"));
  await new Promise(r=>setTimeout(r,1500));
  check("A receives its own Realtime change",aGotOwn,{events:eventsA.map(e=>e.new?.user_id)});
  check("B does not receive A Realtime data",
    !eventsB.some(e=>e.new?.user_id===A.id),
    {events:eventsB.map(e=>e.new?.user_id)});

  report.details.realtime={eventsA:eventsA.length,eventsB:eventsB.length};
}
main().catch(err=>{
  report.failure=String(err.stack||err);
  process.exitCode=1;
}).finally(async()=>{
  try{if(channelA)await clientA.removeChannel(channelA)}catch{}
  try{if(channelB)await clientB.removeChannel(channelB)}catch{}
  try{if(clientA)await clientA.auth.signOut({scope:"local"})}catch{}
  try{if(clientB)await clientB.auth.signOut({scope:"local"})}catch{}
  console.log("SUPABASE_ACCOUNT_ISOLATION_REPORT "+JSON.stringify(report));
});
