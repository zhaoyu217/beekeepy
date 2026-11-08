import fs from "node:fs";

const configText=fs.readFileSync("config.js","utf8");
const url=configText.match(/SUPABASE_URL:\s*"([^"]+)"/)?.[1];
const key=configText.match(/SUPABASE_PUBLISHABLE_KEY:\s*"([^"]+)"/)?.[1];

const report={checks:[],details:{}};
function check(name,pass,detail={}){
  report.checks.push({name,pass:!!pass,detail});
  if(!pass)throw new Error(name+" failed: "+JSON.stringify(detail));
}
async function request(path,init={}){
  return fetch(url+path,{
    ...init,
    headers:{
      apikey:key,
      ...(init.headers||{})
    },
    signal:AbortSignal.timeout(20000)
  });
}

async function main(){
  check("Test branch points only to beekeepy-test",
    url==="https://awapkkzqjubqfnqkqfbr.supabase.co",
    {url});

  check("Publishable key format",
    typeof key==="string"&&key.startsWith("sb_publishable_"),
    {prefix:key?.slice(0,14),length:key?.length});

  const settingsResponse=await request("/auth/v1/settings");
  const settingsText=await settingsResponse.text();
  let settings={};
  try{settings=JSON.parse(settingsText)}catch{}
  check("Supabase Auth settings endpoint responds",
    settingsResponse.status===200,
    {status:settingsResponse.status,body:settingsText.slice(0,800)});

  report.details.auth={
    mailer_autoconfirm:settings.mailer_autoconfirm??null,
    disable_signup:settings.disable_signup??null,
    external:settings.external??null
  };

  const tableResponse=await request("/rest/v1/app_state?select=user_id&limit=1");
  const tableText=await tableResponse.text();
  let tableBody={};
  try{tableBody=JSON.parse(tableText)}catch{}
  const bodyString=typeof tableBody==="object"?JSON.stringify(tableBody):tableText;
  const denied=[401,403].includes(tableResponse.status) &&
    /permission denied|not allowed|insufficient privilege|42501/i.test(bodyString);
  check("Anonymous role cannot read app_state",
    denied,
    {status:tableResponse.status,body:bodyString.slice(0,1000)});

  check("No missing-table/schema-cache error",
    !(tableResponse.status===404 || /PGRST205|Could not find the table/i.test(bodyString)),
    {status:tableResponse.status,body:bodyString.slice(0,1000)});

  console.log("SUPABASE_LIVE_SMOKE_REPORT "+JSON.stringify(report));
}
main().catch(err=>{
  report.failure=String(err.stack||err);
  console.log("SUPABASE_LIVE_SMOKE_REPORT "+JSON.stringify(report));
  process.exitCode=1;
});
