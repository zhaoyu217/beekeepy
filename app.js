
const STORAGE_KEY='hivedash_v9';
const FREE_HIVE_LIMIT=3;


/* =========================================================
   HiveDash V13 — Supabase Auth + Cloud Sync
   ========================================================= */

const CLOUD_CONFIG=window.HIVEDASH_CONFIG||{};
const CLOUD_CONFIGURED=
  typeof window.supabase!=='undefined' &&
  /^https:\/\/.+\.supabase\.co$/.test(CLOUD_CONFIG.SUPABASE_URL||'') &&
  typeof CLOUD_CONFIG.SUPABASE_PUBLISHABLE_KEY==='string' &&
  CLOUD_CONFIG.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');

let supabaseClient=null;
let currentSession=null;
let cloudReady=false;
let syncTimer=null;
let realtimeChannel=null;
let lastRemoteUpdatedAt='';
let suppressCloudSave=false;
let cloudStatus='Offline';

if(CLOUD_CONFIGURED){
  supabaseClient=window.supabase.createClient(
    CLOUD_CONFIG.SUPABASE_URL,
    CLOUD_CONFIG.SUPABASE_PUBLISHABLE_KEY,
    {
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true
      }
    }
  );
}

function isAuthenticated(){return !!currentSession?.user}
function currentCloudUser(){return currentSession?.user||null}
function cloudStatusText(){return cloudStatus}

function setCloudStatus(value){
  cloudStatus=value;
  const el=document.getElementById('cloudStatusValue');
  if(el)el.textContent=value;
}

function scheduleCloudSave(nextState){
  if(!CLOUD_CONFIGURED || !cloudReady || !isAuthenticated() || suppressCloudSave)return;
  clearTimeout(syncTimer);
  setCloudStatus('Saving…');
  syncTimer=setTimeout(()=>pushCloudState(nextState),450);
}

async function pushCloudState(nextState){
  if(!supabaseClient || !isAuthenticated())return;
  try{
    const payload=clone(nextState);
    payload.user={
      ...payload.user,
      email:currentSession.user.email||payload.user?.email||'',
      name:currentSession.user.user_metadata?.name||payload.user?.name||'Beekeeper'
    };
    const updatedAt=new Date().toISOString();
    const {error}=await supabaseClient
      .from('app_state')
      .upsert(
        {user_id:currentSession.user.id,payload,updated_at:updatedAt},
        {onConflict:'user_id'}
      );
    if(error)throw error;
    lastRemoteUpdatedAt=updatedAt;
    setCloudStatus('Synced');
  }catch(err){
    console.error('HiveDash cloud save failed',err);
    setCloudStatus('Sync error');
    toast('Cloud sync failed');
  }
}

async function loadCloudState(){
  if(!supabaseClient || !isAuthenticated())return false;
  setCloudStatus('Syncing…');
  const {data,error}=await supabaseClient
    .from('app_state')
    .select('payload,updated_at')
    .eq('user_id',currentSession.user.id)
    .maybeSingle();

  if(error){
    console.error('HiveDash cloud load failed',error);
    setCloudStatus('Sync error');
    throw error;
  }

  if(data?.payload && Object.keys(data.payload).length){
    suppressCloudSave=true;
    const remote=clone(data.payload);
    remote.user={
      ...(remote.user||{}),
      email:currentSession.user.email||remote.user?.email||'',
      name:currentSession.user.user_metadata?.name||remote.user?.name||'Beekeeper'
    };
    localStorage.setItem(STORAGE_KEY,JSON.stringify(remote));
    suppressCloudSave=false;
    lastRemoteUpdatedAt=data.updated_at||'';
    setCloudStatus('Synced');
    return true;
  }

  const local=state();
  local.user={
    ...(local.user||{}),
    email:currentSession.user.email||local.user?.email||'',
    name:currentSession.user.user_metadata?.name||local.user?.name||'Beekeeper'
  };
  localStorage.setItem(STORAGE_KEY,JSON.stringify(local));
  await pushCloudState(local);
  return false;
}

function stopRealtimeSync(){
  if(realtimeChannel && supabaseClient){
    supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel=null;
  }
}

function startRealtimeSync(){
  stopRealtimeSync();
  if(!supabaseClient || !isAuthenticated())return;
  realtimeChannel=supabaseClient
    .channel(`hivedash-state-${currentSession.user.id}`)
    .on(
      'postgres_changes',
      {
        event:'*',
        schema:'public',
        table:'app_state',
        filter:`user_id=eq.${currentSession.user.id}`
      },
      payload=>{
        if(payload.eventType==='DELETE')return;
        const row=payload.new;
        if(!row?.payload || row.updated_at===lastRemoteUpdatedAt)return;
        lastRemoteUpdatedAt=row.updated_at||'';
        suppressCloudSave=true;
        const remote=clone(row.payload);
        remote.user={
          ...(remote.user||{}),
          email:currentSession.user.email||remote.user?.email||'',
          name:currentSession.user.user_metadata?.name||remote.user?.name||'Beekeeper'
        };
        localStorage.setItem(STORAGE_KEY,JSON.stringify(remote));
        suppressCloudSave=false;
        setCloudStatus('Synced');
        if(!document.querySelector('.modal'))render();
      }
    )
    .subscribe(status=>{
      if(status==='SUBSCRIBED')setCloudStatus('Synced');
    });
}

function authShell(inner){
  return `<div class="auth-page">
    <div class="auth-brand"><div class="auth-logo">⬡</div><div><div class="auth-title">HiveDash</div><div class="tiny muted">Your apiary, synced everywhere.</div></div></div>
    <div class="auth-card">${inner}</div>
  </div>`;
}

function renderCloudSetup(){
  document.getElementById('topbar').innerHTML='<div></div><div class="brand">HiveDash</div><div></div>';
  document.getElementById('bottomnav').classList.add('hidden');
  const view=document.getElementById('view');
  view.className='view secondary';
  view.innerHTML=authShell(`
    <div class="h2">Connect Supabase</div>
    <div class="small muted" style="margin-top:6px">Cloud login and sync are built into this version, but your Supabase project credentials have not been added yet.</div>
    <div class="notice" style="margin-top:12px">
      Open <b>config.js</b> and replace <b>SUPABASE_URL</b> and <b>SUPABASE_PUBLISHABLE_KEY</b>. Then run <b>supabase-schema.sql</b> in the Supabase SQL Editor.
    </div>
  `);
}


function oauthRedirectUrl(){
  if(location.protocol==='http:' || location.protocol==='https:'){
    return location.origin+location.pathname;
  }
  return '';
}

async function signInWithSocial(provider){
  if(!supabaseClient)return;
  const redirectTo=oauthRedirectUrl();
  if(!redirectTo){
    renderAuth('signin','Social login requires HiveDash to be opened from an http/https website, not directly from a local file.');
    return;
  }
  const options={redirectTo};
  if(provider==='azure')options.scopes='email';
  const {error}=await supabaseClient.auth.signInWithOAuth({provider,options});
  if(error)renderAuth('signin',error.message);
}

function socialLoginSection(){
  return `
    <button type="button" class="social-btn google" id="googleLogin">
      <span class="social-icon">G</span><span>Continue with Google</span>
    </button>
    <button type="button" class="other-login-toggle" id="otherLoginToggle">Other sign-in options</button>
    <div class="other-login hidden" id="otherLogin">
      <button type="button" class="social-btn apple" id="appleLogin">
        <span class="social-icon"></span><span>Continue with Apple</span>
      </button>
      <button type="button" class="social-btn microsoft" id="microsoftLogin">
        <span class="social-icon microsoft-mark"><i></i><i></i><i></i><i></i></span><span>Continue with Microsoft</span>
      </button>
    </div>
    <div class="auth-divider"><span>or use email</span></div>
  `;
}

function renderAuth(mode='signin',message=''){
  document.getElementById('topbar').innerHTML='<div></div><div class="brand">HiveDash</div><div></div>';
  document.getElementById('bottomnav').classList.add('hidden');
  const view=document.getElementById('view');
  view.className='view secondary';

  const isSignUp=mode==='signup';
  view.innerHTML=authShell(`
    <div class="auth-tabs">
      <button type="button" class="auth-tab ${!isSignUp?'active':''}" id="authSignInTab">Sign In</button>
      <button type="button" class="auth-tab ${isSignUp?'active':''}" id="authSignUpTab">Create Account</button>
    </div>
    ${message?`<div class="notice" style="margin-bottom:12px">${esc(message)}</div>`:''}
    ${socialLoginSection()}
    ${isSignUp?`<div class="formgroup"><label>Name</label><input id="authName" maxlength="60" autocomplete="name" placeholder="Your name"></div>`:''}
    <div class="formgroup"><label>Email</label><input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com"></div>
    <div class="formgroup"><label>Password</label><input id="authPassword" type="password" minlength="8" autocomplete="${isSignUp?'new-password':'current-password'}" placeholder="At least 8 characters"></div>
    <button type="button" class="btn primary block" id="authSubmit">${isSignUp?'Create Account':'Sign In'}</button>
    ${!isSignUp?`<button type="button" class="auth-link" id="forgotPassword">Forgot password?</button>`:''}
    <div class="auth-security"><span>☁️</span><div><b>Cloud sync enabled</b><div class="tiny muted">Your account only has access to its own HiveDash data.</div></div></div>
  `);

  document.getElementById('authSignInTab').onclick=()=>renderAuth('signin');
  document.getElementById('authSignUpTab').onclick=()=>renderAuth('signup');
  document.getElementById('authSubmit').onclick=()=>isSignUp?handleSignUp():handleSignIn();
  document.getElementById('googleLogin').onclick=()=>signInWithSocial('google');
  document.getElementById('otherLoginToggle').onclick=()=>{
    const box=document.getElementById('otherLogin');
    box.classList.toggle('hidden');
    document.getElementById('otherLoginToggle').textContent=box.classList.contains('hidden')?'Other sign-in options':'Hide other sign-in options';
  };
  document.getElementById('appleLogin').onclick=()=>signInWithSocial('apple');
  document.getElementById('microsoftLogin').onclick=()=>signInWithSocial('azure');
  if(!isSignUp)document.getElementById('forgotPassword').onclick=handlePasswordReset;
}

async function handleSignIn(){
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  if(!email||!password){renderAuth('signin','Enter your email and password.');return}
  const button=document.getElementById('authSubmit');
  button.disabled=true;button.textContent='Signing in…';
  const {error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error){renderAuth('signin',error.message);return}
}

async function handleSignUp(){
  const name=document.getElementById('authName').value.trim();
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  if(!name||!email||password.length<8){renderAuth('signup','Enter your name, a valid email, and a password with at least 8 characters.');return}
  const button=document.getElementById('authSubmit');
  button.disabled=true;button.textContent='Creating account…';
  const {data,error}=await supabaseClient.auth.signUp({
    email,
    password,
    options:{data:{name}}
  });
  if(error){renderAuth('signup',error.message);return}
  if(!data.session){
    renderAuth('signin','Account created. Check your email to confirm your address, then sign in.');
  }
}

async function handlePasswordReset(){
  const email=document.getElementById('authEmail').value.trim();
  if(!email){renderAuth('signin','Enter your email first, then choose Forgot password.');return}
  const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(error){renderAuth('signin',error.message);return}
  renderAuth('signin','Password reset email sent.');
}

async function signOutCloud(){
  if(!supabaseClient)return;
  stopRealtimeSync();
  setCloudStatus('Signing out…');
  await supabaseClient.auth.signOut();
}

async function initializeCloudApp(){
  if(!CLOUD_CONFIGURED){
    if(CLOUD_CONFIG.REQUIRE_AUTH!==false)renderCloudSetup();
    else{if(!location.hash)location.hash='home';render()}
    return;
  }

  const {data:{session}}=await supabaseClient.auth.getSession();
  currentSession=session;

  supabaseClient.auth.onAuthStateChange(async(event,session)=>{
    currentSession=session;
    if(event==='SIGNED_OUT'){
      cloudReady=false;
      stopRealtimeSync();
      renderAuth('signin');
      return;
    }
    if(event==='SIGNED_IN' || event==='INITIAL_SESSION'){
      if(session){
        try{
          await loadCloudState();
          cloudReady=true;
          startRealtimeSync();
          if(!location.hash)location.hash='home';
          render();
        }catch(err){
          cloudReady=false;
          renderAuth('signin','Signed in, but cloud data could not be loaded. Check the Supabase schema and RLS setup.');
        }
      }
    }
  });

  if(!session){
    renderAuth('signin');
    return;
  }

  try{
    await loadCloudState();
    cloudReady=true;
    startRealtimeSync();
    if(!location.hash)location.hash='home';
    render();
  }catch(err){
    renderAuth('signin','Cloud data could not be loaded. Check the Supabase schema and RLS setup.');
  }
}

const DEFAULT_STATE={
  user:{name:'Alex',email:'beekeeper@example.com',plan:'Free'},
  settings:{
    apiaryName:'Backyard Apiary',
    location:'Colorado, USA',
    timezone:'America/Denver',
    units:'imperial',
    hiveType:'Langstroth',
    inspectionCycle:7,
    notifications:{inspection:true,treatment:true,queen:true,swarm:true,weather:true},
    seasonIntel:true,
    aiRecommendations:true,
    photoAnalysis:false,
    voiceNotes:false,
    cloudBackup:false
  },
  hives:[
    {id:'h1',name:'Hive #1',score:92,status:'Healthy',queen:'Confirmed',eggs:true,larvae:true,queenCells:false,brood:'Excellent',strength:'Strong',honey:'High',pollen:'High',varroa:1,shb:false,waxMoth:false,disease:false,swarm:false,superStatus:'Installed',lastInspection:'2026-08-06',notes:'Strong colony.'},
    {id:'h2',name:'Hive #2',score:78,status:'Attention',queen:'Not confirmed',eggs:true,larvae:true,queenCells:false,brood:'Good',strength:'Medium',honey:'Medium',pollen:'Medium',varroa:2,shb:false,waxMoth:false,disease:false,swarm:false,superStatus:'Installed',lastInspection:'2026-07-26',notes:'Queen not confirmed.'},
    {id:'h3',name:'Hive #3',score:65,status:'Critical',queen:'Confirmed',eggs:true,larvae:true,queenCells:false,brood:'Fair',strength:'Medium',honey:'Low',pollen:'Low',varroa:4,shb:false,waxMoth:false,disease:false,swarm:false,superStatus:'Installed',lastInspection:'2026-07-08',notes:'Mite level elevated.'}
  ],
  actions:[],
  notifications:[
    {id:'n1',title:'Hive #3 needs attention',body:'Varroa follow-up is recommended.',read:false,target:'#hive/h3'},
    {id:'n2',title:'Queen status',body:'Hive #2 queen has not been confirmed.',read:false,target:'#hive/h2'}
  ],
  logs:{inspections:[],feedings:[],treatments:[],harvests:[]}
};

function clone(v){return JSON.parse(JSON.stringify(v))}
function state(){
  const raw=localStorage.getItem(STORAGE_KEY);
  if(!raw){localStorage.setItem(STORAGE_KEY,JSON.stringify(DEFAULT_STATE));return clone(DEFAULT_STATE)}
  try{
    const s=JSON.parse(raw);
    s.actions=generateActions(s);
    if(currentSession?.user){
      s.user={
        ...(s.user||{}),
        email:currentSession.user.email||s.user?.email||'',
        name:currentSession.user.user_metadata?.name||s.user?.name||'Beekeeper'
      };
    }
    return s;
  }catch(e){return clone(DEFAULT_STATE)}
}
function save(s){s.actions=generateActions(s);localStorage.setItem(STORAGE_KEY,JSON.stringify(s));scheduleCloudSave(s)}
function resetState(){
  const fresh=clone(DEFAULT_STATE);
  if(currentSession?.user){
    fresh.user={
      ...fresh.user,
      email:currentSession.user.email||'',
      name:currentSession.user.user_metadata?.name||'Beekeeper'
    };
  }
  localStorage.setItem(STORAGE_KEY,JSON.stringify(fresh));
  if(cloudReady)scheduleCloudSave(fresh);
  location.hash='home';
  render();
}

function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function idq(id){return document.getElementById(id)}
function fmtDate(d){if(!d)return'—';return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
function daysSince(date){return Math.floor((Date.now()-new Date(date+'T12:00:00').getTime())/86400000)}
function hive(s,id){return s.hives.find(h=>h.id===id)}
function unread(s){return s.notifications.filter(n=>!n.read).length}
function avgHealth(s){return Math.round(s.hives.reduce((n,h)=>n+h.score,0)/Math.max(1,s.hives.length))}
function isPro(s){return s.user.plan==='Pro'}
function statusPill(status){return `<span class="pill ${status==='Critical'?'danger':status==='Attention'?'warn':''}">${esc(status)}</span>`}
function toast(msg){const t=idq('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1500)}
function modal(html){const el=document.createElement('div');el.className='modal';el.innerHTML=`<div class="modalpanel">${html}</div>`;el.addEventListener('click',e=>{if(e.target===el)el.remove()});document.body.appendChild(el);return el}
function closeModal(el){el.closest('.modal').remove()}
function go(hash){location.hash=hash}
function requirePro(feature){
  const s=state();
  if(isPro(s))return true;
  subscriptionModal(feature);
  return false;
}
function subscriptionModal(feature='this feature'){
  const s=state(),m=modal(`<div class="modalhead"><div class="h2">Unlock HiveDash Pro</div><button type="button" class="iconbtn" onclick="closeModal(this)">✕</button></div>
  <div class="setting"><div class="small muted">Upgrade to use ${esc(feature)}.</div><div class="h2" style="margin-top:10px">$59.99 / year</div><div class="small" style="margin-top:6px">Unlimited hives · Health Analysis · Risk Prediction · Season Intelligence · Reports · Cloud features</div><button type="button" class="btn primary block" id="upgradeBtn" style="margin-top:12px">Upgrade Demo</button></div>
  <div class="notice">Prototype billing only. Production must validate entitlement from a billing provider.</div>`);
  m.querySelector('#upgradeBtn').onclick=()=>{s.user.plan='Pro';save(s);m.remove();toast('Pro enabled in demo');render()}
}

function icon(name){
  const icons={
    settings:'<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19 13.5v-3l-2-.7a7.4 7.4 0 0 0-.8-1.8l.9-1.9-2.2-2.2-1.9.9a7.4 7.4 0 0 0-1.8-.8L10.5 2h-3l-.7 2a7.4 7.4 0 0 0-1.8.8l-1.9-.9L.9 6.1 1.8 8a7.4 7.4 0 0 0-.8 1.8l-2 .7v3l2 .7a7.4 7.4 0 0 0 .8 1.8l-.9 1.9 2.2 2.2 1.9-.9a7.4 7.4 0 0 0 1.8.8l.7 2h3l.7-2a7.4 7.4 0 0 0 1.8-.8l1.9.9 2.2-2.2-.9-1.9a7.4 7.4 0 0 0 .8-1.8Z" transform="translate(2.5 0) scale(.8)"/></svg>',
    bell:'<svg class="icon" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    home:'<svg class="icon" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/></svg>',
    hive:'<svg class="icon" viewBox="0 0 24 24"><path d="M8 3h8l4 5-2 12H6L4 8l4-5Z"/><path d="M6 8h12M7 12h10M7 16h10"/></svg>',
    check:'<svg class="icon" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12a9 9 0 1 1-5.3-8.2"/></svg>',
    chart:'<svg class="icon" viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/></svg>'
  };return icons[name]
}

function chrome(page,secondary){
  const s=state();
  idq('topbar').innerHTML=`<button type="button" class="iconbtn" onclick="go('settings')" aria-label="Open Settings">${icon('settings')}</button><div class="brand" aria-label="HiveDash">HiveDash</div><button type="button" class="iconbtn" onclick="go('notifications')" aria-label="Open Notifications">${icon('bell')}${unread(s)?`<span class="badge" aria-label="${unread(s)} unread notifications">${unread(s)}</span>`:''}</button>`;
  idq('bottomnav').classList.toggle('hidden',secondary);
  idq('bottomnav').innerHTML=[
    ['home','Home','home'],
    ['hives','Hives','hive'],
    ['actions','Actions','check'],
    ['insights','Insights','chart']
  ].map(([key,label,ico])=>`<button class="navitem ${page===key?'active':''}" onclick="go('${key}')" aria-label="${label}" ${page===key?'aria-current="page"':''}>${icon(ico)}<span>${label}</span></button>`).join('')
}

function generateActions(s){
  const list=[];
  for(const h of s.hives){
    const overdue=daysSince(h.lastInspection)-Number(s.settings.inspectionCycle||7);
    if(overdue>0)list.push({id:`inspect-${h.id}`,hiveId:h.id,type:'Inspection',priority:overdue>14?'High':'Medium',title:'Inspection overdue',reason:`Last inspection ${daysSince(h.lastInspection)} days ago.`,due:'Now',status:'Pending'});
    if(h.varroa>=3)list.push({id:`varroa-${h.id}`,hiveId:h.id,type:'Treatment',priority:'High',title:'Varroa follow-up',reason:`Latest Varroa result is ${h.varroa}%.`,due:'Now',status:'Pending'});
    if(h.queen!=='Confirmed')list.push({id:`queen-${h.id}`,hiveId:h.id,type:'Inspection',priority:'Medium',title:'Confirm queen status',reason:'Queen has not been confirmed.',due:'Next check',status:'Pending'});
    if(h.honey==='Low'||h.pollen==='Low')list.push({id:`food-${h.id}`,hiveId:h.id,type:'Feeding',priority:'Medium',title:'Review food stores',reason:'Honey or pollen stores are low.',due:'Soon',status:'Pending'});
  }
  const rank={High:3,Medium:2,Routine:1};
  return list.sort((a,b)=>rank[b.priority]-rank[a.priority])
}

function calculateHealth(h){
  let score=100,why=[];
  if(h.queen!=='Confirmed'){score-=15;why.push(['Queen status',-15])}
  if(!h.eggs){score-=10;why.push(['No eggs recorded',-10])}
  if(h.brood==='Fair'){score-=10;why.push(['Brood quality',-10])}
  if(h.brood==='Poor'){score-=20;why.push(['Brood quality',-20])}
  if(h.strength==='Weak'){score-=15;why.push(['Weak colony',-15])}
  if(h.honey==='Low'){score-=10;why.push(['Low honey stores',-10])}
  if(h.pollen==='Low'){score-=7;why.push(['Low pollen stores',-7])}
  if(h.varroa>=3){score-=25;why.push(['Varroa level',-25])}else if(h.varroa>=2){score-=10;why.push(['Varroa level',-10])}
  if(h.disease){score-=20;why.push(['Disease flag',-20])}
  if(h.swarm){score-=8;why.push(['Swarm signs',-8])}
  const overdue=daysSince(h.lastInspection)-7;
  if(overdue>14){score-=8;why.push(['Inspection overdue',-8])}else if(overdue>0){score-=4;why.push(['Inspection overdue',-4])}
  score=Math.max(0,Math.min(100,score));
  return {score,why,status:score>=85?'Healthy':score>=70?'Attention':'Critical'}
}

function formatWeight(lb,s){
  if(s.settings.units==='metric')return `${(Number(lb)*0.453592).toFixed(1)} kg`;
  return `${Number(lb).toFixed(1)} lb`
}
function formatTemp(f,s){return s.settings.units==='metric'?`${Math.round((f-32)*5/9)}°C`:`${Math.round(f)}°F`}

function render(){
  const raw=(location.hash||'#home').slice(1),parts=raw.split('/'),page=parts[0],id=parts[1];
  const secondary=['all-hives','hive','all-actions','settings','notifications','subscription','analysis','trend','risk','honey','season','privacy','terms','help','support'].includes(page);
  const view=idq('view');view.className=`view ${secondary?'secondary':'main'}`;
  if(page==='home')home(view);
  else if(page==='hives')hives(view);
  else if(page==='actions')actions(view);
  else if(page==='insights')insights(view);
  else if(page==='all-hives')allHives(view);
  else if(page==='hive')hiveDetail(view,id);
  else if(page==='all-actions')allActions(view,id);
  else if(page==='settings')settings(view);
  else if(page==='notifications')notifications(view);
  else if(page==='subscription')subscriptionPage(view);
  else if(page==='analysis')healthAnalysis(view);
  else if(page==='trend')trendPage(view);
  else if(page==='risk')riskPage(view);
  else if(page==='honey')honeyPage(view);
  else if(page==='season')seasonPage(view);
  else if(page==='privacy')infoPage(view,'Privacy Policy');
  else if(page==='terms')infoPage(view,'Terms of Service');
  else if(page==='help')infoPage(view,'Help Center');
  else if(page==='support')infoPage(view,'Contact Support');
  else{go('home');return}
  chrome(page,secondary)
}

function home(r){
 const s=state(),score=avgHealth(s),stat=score>=85?'Healthy':score>=70?'Attention':'Critical',a=s.actions[0],h=a?hive(s,a.hiveId):null;
 const ordered=[...s.hives].sort((a,b)=>b.score-a.score),healthy=s.hives.filter(x=>x.status==='Healthy').length,attention=s.hives.filter(x=>x.status==='Attention').length,critical=s.hives.filter(x=>x.status==='Critical').length;
 const c=2*Math.PI*52,d=(score/100)*c;
 r.innerHTML=`<div class="screen home-screen">
  <section class="home-greeting"><div><div class="h2">Good morning, Beekeeper 👋</div><div class="tiny muted">Your apiary ${stat==='Healthy'?'looks good today.':'needs some attention today.'}</div></div><div class="weather-chip"><strong>☀️ 72°F</strong><span>Sunny</span></div></section>
  <section class="card pad card-button" onclick="go('hives')"><div class="row between"><div><div class="h3">Apiary Health</div><div class="tiny muted">Overall colony status</div></div>${statusPill(stat)}</div><div class="health-modern"><div class="health-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" stroke="#ECEFEA" stroke-width="11" fill="none"/><defs><linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D94E43"/><stop offset="30%" stop-color="#E6A117"/><stop offset="65%" stop-color="#86A658"/><stop offset="100%" stop-color="#176B55"/></linearGradient></defs><circle cx="60" cy="60" r="52" stroke="url(#ringGrad)" stroke-width="11" fill="none" stroke-linecap="round" stroke-dasharray="${d} ${c-d}"/></svg><div class="score-center"><div><strong>${score}</strong><span>${stat==='Healthy'?'Good':stat==='Attention'?'Needs Attention':'High Risk'}</span></div></div></div><div class="health-mini-grid"><div class="health-mini"><strong>${s.hives.length}</strong><span>Total Hives</span></div><div class="health-mini"><strong>${healthy}</strong><span>Healthy</span></div><div class="health-mini attn"><strong>${attention}</strong><span>Needs Attention</span></div><div class="health-mini crit"><strong>${critical}</strong><span>Critical</span></div></div></div></section>
  <section><div class="row between"><div class="h3">Today</div><button type="button" class="pill" onclick="go('all-actions')">View all</button></div><div class="card pad today-card" style="margin-top:7px">${a?`<div class="task-hero row"><div class="task-icon">⚠️</div><div class="grow"><div class="h3">${esc(h.name)} needs an inspection</div><div class="tiny muted">${esc(a.reason)}</div></div><span class="chev">›</span></div><button type="button" class="btn primary block" style="margin-top:9px" onclick="actionForm('inspection','${a.hiveId}')">Start Inspection</button>`:`<div class="small">No urgent tasks today.</div>`}</div></section>
  <section><div class="row between"><div class="h3">Your Hives</div><button type="button" class="pill" onclick="go('all-hives')">View all</button></div><div class="hive-strip" style="margin-top:7px">${ordered.slice(0,4).map(x=>`<button type="button" class="hive-mini" onclick="go('hive/${x.id}')"><div class="tiny"><b>${esc(x.name)}</b></div><div class="num">${x.score}</div><div class="status" style="color:${x.status==='Healthy'?'#2F8B64':x.status==='Attention'?'#E6A117':'#D94E43'}">${x.status}</div><div class="bee">🏠</div></button>`).join('')}</div></section>
  <section><div class="h3">This Week</div><div class="week-grid" style="margin-top:7px"><button type="button" class="week-card card-button" onclick="go('all-actions/inspection')"><div class="tiny">🔎 Inspections</div><strong>${s.actions.filter(x=>x.type==='Inspection').length}</strong><span>Due this week</span></button><button type="button" class="week-card card-button" onclick="go('all-actions/feeding')"><div class="tiny">🥣 Feedings</div><strong>${s.actions.filter(x=>x.type==='Feeding').length}</strong><span>Due this week</span></button><button type="button" class="week-card card-button" onclick="go('all-actions/treatment')"><div class="tiny">🧪 Treatments</div><strong>${s.actions.filter(x=>x.type==='Treatment').length}</strong><span>Due this week</span></button></div></section>
  <section class="card pad season-modern card-button" onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><div class="row between"><div><div class="h3">Seasonal Insight</div><div class="tiny muted">Late Summer</div></div><span class="pill warn">${isPro(s)?'Season':'PRO'}</span></div><div class="row" style="margin-top:9px"><span style="font-size:22px">🍃</span><div class="grow"><div class="small"><b>Watch mite levels</b></div><div class="tiny muted">Ensure adequate food stores before the next transition.</div></div><span class="chev">›</span></div></section>
 </div>`
}

function hives(r){
 const s=state(),ordered=[...s.hives].sort((a,b)=>a.score-b.score);
 r.innerHTML=`<div class="screen hives-screen"><section class="row between"><div><div class="h1">My Hives</div><div class="tiny muted">${s.hives.length} colonies</div></div><button type="button" class="btn primary" onclick="addHive()">+ Add Hive</button></section><section class="searchbox"><input id="mainHiveSearch" placeholder="Search hives..."></section><section id="mainHiveList" class="hivelist"></section><section><button type="button" class="btn secondarybtn block" onclick="go('all-hives')">View All Hives</button></section></div>`;
 const draw=()=>{const q=idq('mainHiveSearch').value.toLowerCase();idq('mainHiveList').innerHTML=ordered.filter(h=>h.name.toLowerCase().includes(q)).slice(0,4).map(h=>hiveCard(h)).join('')};idq('mainHiveSearch').oninput=draw;draw()
}
function hiveCard(h){
 const qc=h.queen==='Confirmed'?'':'dangertext',vc=h.varroa>=3?'dangertext':h.varroa>=2?'warntext':'',fc=(h.honey==='Low'||h.pollen==='Low')?'dangertext':'';
 return `<div class="card hivecard card-button" onclick="go('hive/${h.id}')"><div class="hivethumb">🏠</div><div><div class="row"><span style="width:8px;height:8px;border-radius:50%;background:${h.status==='Healthy'?'#2F8B64':h.status==='Attention'?'#E6A117':'#D94E43'}"></span><div class="h3">${esc(h.name)}</div></div><div class="hive-facts"><div class="fact">Queen <b class="${qc}">${esc(h.queen)}</b></div><div class="fact">Varroa <b class="${vc}">${h.varroa>=3?'High':h.varroa>=2?'Moderate':'Low'}</b></div><div class="fact">Food Stores <b class="${fc}">${h.honey==='Low'||h.pollen==='Low'?'Low':'Good'}</b></div><div class="fact">Strength <b>${esc(h.strength)}</b></div></div></div><div><div class="hive-score">${h.score}</div><div class="tiny" style="color:${h.status==='Healthy'?'#2F8B64':h.status==='Attention'?'#E6A117':'#D94E43'};text-align:right;font-weight:800">${h.status}</div></div><div class="hive-footer">Last inspected ${daysSince(h.lastInspection)} days ago <span style="float:right">›</span></div></div>`
}

function addHive(){
  const s=state();
  if(!isPro(s)&&s.hives.length>=FREE_HIVE_LIMIT){subscriptionModal('more than 3 hives');return}
  const m=modal(`<div class="modalhead"><div class="h2">Add Hive</div><button type="button" class="iconbtn" onclick="closeModal(this)">✕</button></div>
  <div class="formgroup"><label>Hive Name</label><input id="newHiveName" maxlength="40" placeholder="Hive #4"></div>
  <div class="formgroup"><label>Hive Type</label><select id="newHiveType"><option>Langstroth</option><option>Flow Hive</option><option>Top Bar</option></select></div>
  <button type="button" class="btn primary block" id="saveHive">Create Hive</button>`);
  m.querySelector('#saveHive').onclick=()=>{
    const name=m.querySelector('#newHiveName').value.trim()||`Hive #${s.hives.length+1}`;
    const h={id:'h'+Date.now(),name,score:80,status:'Attention',queen:'Not confirmed',eggs:false,larvae:false,queenCells:false,brood:'Good',strength:'Medium',honey:'Medium',pollen:'Medium',varroa:0,shb:false,waxMoth:false,disease:false,swarm:false,superStatus:'None',lastInspection:new Date().toISOString().slice(0,10),notes:'New hive.'};
    s.hives.push(h);save(s);m.remove();toast('Hive added');render()
  }
}

function allHives(r){
  const s=state();
  r.innerHTML=`<section class="row between"><div><button type="button" class="btn secondarybtn" onclick="go('hives')">← Hives</button><div class="h1" style="margin-top:12px">All Hives</div></div><button type="button" class="btn primary" onclick="addHive()">+ Add</button></section>
  <section class="searchrow"><input id="hiveSearch" placeholder="Search hives"><select id="hiveFilter"><option>All</option><option>Healthy</option><option>Attention</option><option>Critical</option></select></section>
  <section id="allHiveList"></section>`;
  const draw=()=>{
    const q=idq('hiveSearch').value.toLowerCase(),f=idq('hiveFilter').value;
    const list=s.hives.filter(h=>(f==='All'||h.status===f)&&h.name.toLowerCase().includes(q)).sort((a,b)=>a.score-b.score);
    idq('allHiveList').innerHTML=list.map(h=>`<div style="margin-bottom:8px">${hiveCard(h)}</div>`).join('')||'<div class="setting small muted">No matching hives.</div>'
  };
  idq('hiveSearch').oninput=draw;idq('hiveFilter').onchange=draw;draw()
}

function actions(r){
 const s=state();
 const today=s.actions.filter(a=>a.due==='Now').slice(0,3);
 const top=today.length?today:s.actions.slice(0,3);
 const upcoming=s.actions.filter(a=>a.due!=='Now').slice(0,2);
 r.innerHTML=`<div class="screen actions-screen">
  <section><div class="h1">Actions</div><div class="tiny muted">What needs your attention</div></section>
  <section class="tabs"><button type="button" class="tab active">Today</button><button type="button" class="tab" onclick="go('all-actions/upcoming')">Upcoming</button><button type="button" class="tab" onclick="go('all-actions/completed')">Completed</button></section>
  <section class="actionlist">${top.length?top.map(a=>actionCard(s,a)).join(''):'<div class="card pad small muted">No actions for today.</div>'}</section>
  <section><div class="row between"><div class="h3">Upcoming</div><button type="button" class="pill" onclick="go('all-actions/upcoming')">View all</button></div>
   <div class="upcoming-list">${upcoming.length?upcoming.map(a=>{const h=hive(s,a.hiveId);return `<button type="button" class="card pad row card-button" style="width:100%;text-align:left" onclick="${a.type==='Inspection'?"actionForm('inspection','"+a.hiveId+"')":a.type==='Feeding'?"actionForm('feeding','"+a.hiveId+"')":"actionForm('treatment','"+a.hiveId+"')"}"><span>${a.type==='Inspection'?'🔎':a.type==='Feeding'?'🥣':'🧪'}</span><div class="grow"><div class="small"><b>${esc(a.title)}</b></div><div class="tiny muted">${esc(h?.name||'Hive')} · ${esc(a.due)}</div></div><span class="chev">›</span></button>`}).join(''):'<div class="card pad small muted">No upcoming actions.</div>'}</div>
  </section>
 </div>`
}
function actionCard(s,a){
 const h=hive(s,a.hiveId),kind=a.priority==='High'?'high':'medium',cta=a.type==='Inspection'?'Start':'Record';
 return `<div class="actioncard ${kind}"><div class="row between"><span class="pill ${a.priority==='High'?'danger':'warn'}">${a.priority==='High'?'HIGH PRIORITY':'MEDIUM'}</span><span class="chev">›</span></div><div class="action-title">${a.type==='Inspection'?'Inspect':a.type==='Feeding'?'Feed':a.type==='Treatment'?'Treat':'Review'} ${esc(h?.name||'Hive')}</div><div class="action-reason">${esc(a.title)} · ${esc(a.reason)}</div><button type="button" class="btn ${a.priority==='High'?'primary':'goldbtn'} block action-button" onclick="${a.type==='Inspection'?"actionForm('inspection','"+a.hiveId+"')":a.type==='Feeding'?"actionForm('feeding','"+a.hiveId+"')":"actionForm('treatment','"+a.hiveId+"')"}">${cta} →</button></div>`
}

function allActions(r,mode='all'){
 const s=state(),normalized=(mode||'all').toLowerCase();
 let title='All Actions',items=s.actions;
 if(normalized==='today'){title='Today';items=s.actions.filter(a=>a.due==='Now')}
 else if(normalized==='upcoming'){title='Upcoming';items=s.actions.filter(a=>a.due!=='Now')}
 else if(['inspection','feeding','treatment'].includes(normalized)){title=normalized[0].toUpperCase()+normalized.slice(1)+' Actions';items=s.actions.filter(a=>a.type.toLowerCase()===normalized)}
 if(normalized==='completed'){
  const logs=[
   ...s.logs.inspections.map(x=>({date:x.date,type:'Inspection',hiveId:x.hiveId,detail:x.notes||'Inspection recorded'})),
   ...s.logs.feedings.map(x=>({date:x.date,type:'Feeding',hiveId:x.hiveId,detail:`${x.type} · ${x.amount}`})),
   ...s.logs.treatments.map(x=>({date:x.date,type:'Treatment',hiveId:x.hiveId,detail:x.type})),
   ...s.logs.harvests.map(x=>({date:x.date,type:'Harvest',hiveId:x.hiveId,detail:formatWeight(x.weightLb,s)}))
  ].sort((a,b)=>new Date(b.date)-new Date(a.date));
  r.innerHTML=`<section><button type="button" class="btn secondarybtn" onclick="go('actions')">← Actions</button><div class="h1" style="margin-top:12px">Completed</div><div class="tiny muted">Recorded work history</div></section><section class="setting">${logs.length?logs.map(x=>`<div class="srow card-button" onclick="go('hive/${x.hiveId}')"><div class="scopy"><div class="row"><span class="pill">${esc(x.type)}</span><b>${esc(hive(s,x.hiveId)?.name||'Hive')}</b></div><div class="small" style="margin-top:5px">${fmtDate(x.date)}</div><div class="tiny muted">${esc(x.detail)}</div></div><span class="chev">›</span></div>`).join(''):'<div class="small muted">No completed records yet.</div>'}</section>`;return
 }
 r.innerHTML=`<section><button type="button" class="btn secondarybtn" onclick="go('actions')">← Actions</button><div class="h1" style="margin-top:12px">${esc(title)}</div><div class="tiny muted">Generated from hive records and settings</div></section><section class="setting">${items.length?items.map(a=>{const h=hive(s,a.hiveId);return `<div class="srow"><div class="scopy"><div class="row"><span class="pill ${a.priority==='High'?'danger':'warn'}">${a.priority}</span><b>${esc(h?.name||'Hive')}</b></div><div class="small" style="margin-top:5px">${esc(a.title)}</div><div class="tiny muted">${esc(a.reason)} · ${esc(a.due)}</div></div><button type="button" class="btn secondarybtn" onclick="${a.type==='Inspection'?"actionForm('inspection','"+a.hiveId+"')":a.type==='Feeding'?"actionForm('feeding','"+a.hiveId+"')":"actionForm('treatment','"+a.hiveId+"')"}">Start</button></div>`}).join(''):'<div class="small muted">No matching actions.</div>'}</section>`
}
function moreActions(){
  const m=modal(`<div class="modalhead"><div class="h2">Record Action</div><button type="button" class="iconbtn" onclick="closeModal(this)">✕</button></div><div class="quick"><button type="button" class="qbtn" onclick="closeModal(this);actionForm('treatment')"><span class="emo">🧪</span><b>Treatment</b></button><button type="button" class="qbtn" onclick="closeModal(this);actionForm('harvest')"><span class="emo">🍯</span><b>Harvest</b></button><button type="button" class="qbtn" onclick="closeModal(this);actionForm('inspection')"><span class="emo">🔎</span><b>Inspection</b></button></div>`)
}

function actionForm(type,selectedHive){
  const s=state(),hiveOptions=s.hives.map(h=>`<option value="${h.id}" ${h.id===selectedHive?'selected':''}>${esc(h.name)}</option>`).join('');
  let fields='';
  if(type==='inspection')fields=`
    <div class="formgroup"><label>Queen Status</label><select id="queen"><option>Confirmed</option><option>Not confirmed</option><option>Queen cells observed</option></select></div>
    <div class="row"><label style="flex:1"><input id="eggs" type="checkbox" style="width:auto;min-height:auto"> Eggs present</label><label style="flex:1"><input id="larvae" type="checkbox" style="width:auto;min-height:auto"> Larvae present</label></div>
    <div class="formgroup"><label>Brood Quality</label><select id="brood"><option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option></select></div>
    <div class="formgroup"><label>Colony Strength</label><select id="strength"><option>Strong</option><option>Medium</option><option>Weak</option></select></div>
    <div class="row"><div class="formgroup grow"><label>Honey Stores</label><select id="honey"><option>High</option><option>Medium</option><option>Low</option></select></div><div class="formgroup grow"><label>Pollen Stores</label><select id="pollen"><option>High</option><option>Medium</option><option>Low</option></select></div></div>
    <div class="formgroup"><label>Varroa %</label><input id="varroa" type="number" min="0" max="10" step=".1" value="1"></div>
    <div class="row"><label style="flex:1"><input id="shb" type="checkbox" style="width:auto;min-height:auto"> Small hive beetle</label><label style="flex:1"><input id="waxMoth" type="checkbox" style="width:auto;min-height:auto"> Wax moth</label></div>
    <div class="row"><label style="flex:1"><input id="disease" type="checkbox" style="width:auto;min-height:auto"> Disease concern</label><label style="flex:1"><input id="swarm" type="checkbox" style="width:auto;min-height:auto"> Swarm signs</label></div>
    <div class="formgroup"><label>Super Status</label><select id="superStatus"><option>Installed</option><option>Added today</option><option>Removed today</option><option>None</option></select></div>
    <div class="formgroup"><label>Notes</label><textarea id="notes" maxlength="1000" placeholder="Quick field note..."></textarea></div>`;
  if(type==='feeding')fields=`<div class="formgroup"><label>Feed Type</label><select id="feedType"><option>1:1 Syrup</option><option>2:1 Syrup</option><option>Pollen Patty</option></select></div><div class="formgroup"><label>Amount</label><input id="feedAmount" maxlength="40" placeholder="${s.settings.units==='metric'?'2 L':'2 gallons'}"></div>`;
  if(type==='treatment')fields=`<div class="formgroup"><label>Treatment Type</label><select id="treatmentType"><option>Oxalic Acid</option><option>Formic Acid</option><option>Apivar</option><option>Other</option></select></div><div class="notice">Follow the product label and applicable local rules. HiveDash does not replace label instructions.</div>`;
  if(type==='harvest')fields=`<div class="formgroup"><label>Weight (${s.settings.units==='metric'?'kg':'lb'})</label><input id="harvestWeight" type="number" step=".1"></div><div class="formgroup"><label>Frames</label><input id="harvestFrames" type="number"></div><div class="formgroup"><label>Moisture %</label><input id="harvestMoisture" type="number" step=".1"></div>`;
  const m=modal(`<div class="modalhead"><div class="h2">New ${type[0].toUpperCase()+type.slice(1)}</div><button type="button" class="iconbtn" onclick="closeModal(this)">✕</button></div><div class="formgroup"><label>Hive</label><select id="formHive">${hiveOptions}</select></div><div class="formgroup"><label>Date</label><input id="formDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>${fields}<button type="button" class="btn primary block" id="saveAction">Save</button>`);
  m.querySelector('#saveAction').onclick=()=>{
    const hiveId=m.querySelector('#formHive').value,date=m.querySelector('#formDate').value,h=hive(s,hiveId);
    if(type==='inspection'){
      Object.assign(h,{
        queen:m.querySelector('#queen').value,
        eggs:m.querySelector('#eggs').checked,
        larvae:m.querySelector('#larvae').checked,
        brood:m.querySelector('#brood').value,
        strength:m.querySelector('#strength').value,
        honey:m.querySelector('#honey').value,
        pollen:m.querySelector('#pollen').value,
        varroa:Number(m.querySelector('#varroa').value||0),
        shb:m.querySelector('#shb').checked,
        waxMoth:m.querySelector('#waxMoth').checked,
        disease:m.querySelector('#disease').checked,
        swarm:m.querySelector('#swarm').checked,
        superStatus:m.querySelector('#superStatus').value,
        notes:m.querySelector('#notes').value,
        lastInspection:date
      });
      const result=calculateHealth(h);h.score=result.score;h.status=result.status;s.logs.inspections.push({id:'i'+Date.now(),hiveId,date,...clone(h),why:result.why});
    }else if(type==='feeding'){
      s.logs.feedings.push({id:'f'+Date.now(),hiveId,date,type:m.querySelector('#feedType').value,amount:m.querySelector('#feedAmount').value})
    }else if(type==='treatment'){
      s.logs.treatments.push({id:'t'+Date.now(),hiveId,date,type:m.querySelector('#treatmentType').value})
    }else if(type==='harvest'){
      let weight=Number(m.querySelector('#harvestWeight').value||0);if(s.settings.units==='metric')weight=weight/0.453592;
      s.logs.harvests.push({id:'hv'+Date.now(),hiveId,date,weightLb:weight,frames:Number(m.querySelector('#harvestFrames').value||0),moisture:Number(m.querySelector('#harvestMoisture').value||0)})
    }
    save(s);m.remove();toast('Saved');render()
  }
}

function insights(r){
 const s=state(),worst=[...s.hives].sort((a,b)=>a.score-b.score)[0],pro=isPro(s),pts=[28,40,32,48,43,57,51,63,68,65,73,78,82,79,87,94],poly=pts.map((v,i)=>`${(i/(pts.length-1))*300},${150-(v/100)*125}`).join(' ');
 r.innerHTML=`<div class="screen insights-screen"><section><div class="h1">Insights</div><div class="tiny muted">Understand your apiary</div></section><section class="insight-hero card-button" onclick="${pro?"go('trend')":"requirePro('90-day trends')"}"><div class="row between"><div><div class="h2">Your apiary is improving</div><div class="tiny muted">+6% over the last 30 days</div></div><span>ⓘ</span></div><svg class="line-chart" viewBox="0 0 300 160" preserveAspectRatio="none"><polyline points="${poly}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><polyline points="0,150 ${poly} 300,150" fill="rgba(255,255,255,.08)" stroke="none"/></svg><div class="tiny muted">Jul 15　　　　　 Jul 29　　　　　 Aug 12　　　　　 Today</div></section><section><div class="row between"><div class="h3">What changed</div><button type="button" class="pill" onclick="${pro?"go('analysis')":"requirePro('Health Analysis')"}">View details</button></div><div class="card pad what-changed" style="margin-top:7px">${s.hives.map((h,i)=>{const t=i===0?'up':i===2?'down':'stable',label=t==='up'?'↑ Improving':t==='down'?'↓ Declining':'→ Stable',delta=t==='up'?'+12%':t==='down'?'-8%':'0%';return `<div class="change-row card-button" onclick="go('hive/${h.id}')"><div class="small"><b>${esc(h.name)}</b></div><div class="tiny ${t}">${label}</div><div class="tiny"><b>${delta}</b></div></div>`}).join('')}</div></section><section><div class="h3">Watch next</div><div class="card pad watch-card row" style="margin-top:7px"><span style="font-size:21px">⚠️</span><div class="grow"><div class="small"><b>Varroa risk increasing</b></div><div class="tiny muted">2 colonies need monitoring.</div></div><button type="button" class="pill" onclick="${pro?"go('risk')":"requirePro('Risk Prediction')"}">View hives</button></div></section><section class="card pad intel-card ${pro?'':'locked'}"><div class="row between"><div class="h3">HiveDash Intelligence</div><span class="protag">PRO</span></div><div class="small" style="margin-top:9px">Based on your inspections and seasonal conditions, check <b>${esc(worst.name)}</b> within the next 3 days.</div><button type="button" class="btn primary block" style="margin-top:10px" onclick="${pro?"go('analysis')":"requirePro('Health Analysis')"}">View recommendation →</button></section></div>`
}

function healthAnalysis(r){
  const s=state();if(!isPro(s)){subscriptionModal('Health Analysis');go('insights');return}
  r.innerHTML=`<section><button type="button" class="btn secondarybtn" onclick="go('insights')">← Insights</button><div class="h1" style="margin-top:12px">Health Analysis</div><div class="tiny muted">Transparent rule-based explanation</div></section>
  ${s.hives.map(h=>{const res=calculateHealth(h);return `<section class="setting card-button" onclick="go('hive/${h.id}')"><div class="row between"><div><div class="h2">${esc(h.name)}</div><div class="tiny muted">${res.why.length?res.why.map(x=>`${esc(x[0])} ${x[1]}`).join(' · '):'No major negative signals'}</div></div>${statusPill(res.status)}</div><div class="score" style="margin-top:8px">${res.score}%</div></section>`}).join('')}`
}
function trendPage(r){
  const s=state();if(!isPro(s)){subscriptionModal('Health Trends');go('insights');return}
  r.innerHTML=`<section><button type="button" class="btn secondarybtn" onclick="go('insights')">← Insights</button><div class="h1" style="margin-top:12px">Health Trend</div></section><section class="setting">${s.hives.map(h=>`<div class="srow"><div class="scopy"><b>${esc(h.name)}</b><div class="track" style="margin-top:6px"><div class="progress" style="width:${h.score}%"></div></div></div><b>${h.score}%</b></div>`).join('')}</section>`
}
function riskPage(r){
  const s=state();if(!isPro(s)){subscriptionModal('Risk Prediction');go('insights');return}
  r.innerHTML=`<section><button type="button" class="btn secondarybtn" onclick="go('insights')">← Insights</button><div class="h1" style="margin-top:12px">Risk Prediction</div><div class="tiny muted">Current prototype uses transparent rules, not a black-box model.</div></section><section class="setting">${s.hives.map(h=>{const reasons=[];if(h.varroa>=3)reasons.push('Varroa elevated');if(h.queen!=='Confirmed')reasons.push('Queen uncertainty');if(h.honey==='Low'||h.pollen==='Low')reasons.push('Low food stores');const level=h.varroa>=3?'High':reasons.length?'Medium':'Low';return `<div class="srow card-button" onclick="go('hive/${h.id}')"><div class="scopy"><b>${esc(h.name)}</b><div class="tiny muted">${reasons.length?esc(reasons.join(' · ')):'No major current rule-based signal'}</div></div><span class="pill ${level==='High'?'danger':level==='Medium'?'warn':''}">${level}</span></div>`}).join('')}</section>`
}
function honeyPage(r){
  const s=state(),total=s.logs.harvests.reduce((n,x)=>n+Number(x.weightLb||0),0);
  r.innerHTML=`<section><button type="button" class="btn secondarybtn" onclick="go('insights')">← Insights</button><div class="h1" style="margin-top:12px">Honey Analytics</div></section><section class="setting"><div class="srow"><b>Total Logged Harvest</b><b>${formatWeight(total,s)}</b></div><div class="srow"><b>Harvest Batches</b><b>${s.logs.harvests.length}</b></div>${s.logs.harvests.map(x=>`<div class="srow"><div class="scopy"><b>${fmtDate(x.date)}</b><div class="tiny muted">${esc(hive(s,x.hiveId)?.name||'Hive')} · ${x.frames} frames · ${x.moisture}% moisture</div></div><b>${formatWeight(x.weightLb,s)}</b></div>`).join('')}</section><button type="button" class="btn primary block" onclick="actionForm('harvest')">Record Harvest</button>`
}
function seasonPage(r){
  const s=state();if(!isPro(s)){subscriptionModal('Season Intelligence');go('home');return}
  r.innerHTML=`<section><button type="button" class="btn secondarybtn" onclick="go('home')">← Home</button><div class="h1" style="margin-top:12px">Season Intelligence</div><div class="tiny muted">${esc(s.settings.location)} · ${new Date().toLocaleDateString('en-US',{month:'long'})}</div></section><section class="setting"><div class="srow"><div class="scopy"><b>Monitor mites closely</b><div class="tiny muted">Prioritize colonies with elevated Varroa or overdue checks.</div></div><span class="pill warn">Priority</span></div><div class="srow"><div class="scopy"><b>Review food stores</b><div class="tiny muted">Follow up on low honey or pollen stores before the next seasonal transition.</div></div></div><div class="srow"><div class="scopy"><b>Confirm queen status</b><div class="tiny muted">Recheck colonies where queen status remains uncertain.</div></div></div></section><div class="notice">V9 uses date, location setting and hive records. Real weather/bloom APIs are still required for production-grade recommendations.</div>`
}

function hiveDetail(r,id){
  const s=state(),h=hive(s,id);if(!h){go('hives');return}
  const result=calculateHealth(h);
  r.innerHTML=`<section><button type="button" class="btn secondarybtn" onclick="go('hives')">← Hives</button><div class="row between" style="margin-top:12px"><div><div class="h1">${esc(h.name)}</div><div class="tiny muted">Full colony record</div></div>${statusPill(h.status)}</div></section>
  <section class="setting"><div class="row between"><div><div class="h2">Health Score</div><div class="tiny muted">${result.why.length?result.why.map(x=>`${esc(x[0])} ${x[1]}`).join(' · '):'No major negative signals'}</div></div><div class="score">${h.score}%</div></div><div class="track" style="margin-top:8px"><div class="progress" style="width:${h.score}%"></div></div></section>
  <section><div class="sectionlabel">Health Details</div><div class="setting">
    <div class="srow"><b>Queen</b><b>${esc(h.queen)}</b></div><div class="srow"><b>Eggs / Larvae</b><b>${h.eggs?'Eggs ✓':'Eggs —'} · ${h.larvae?'Larvae ✓':'Larvae —'}</b></div><div class="srow"><b>Brood</b><b>${esc(h.brood)}</b></div><div class="srow"><b>Colony Strength</b><b>${esc(h.strength)}</b></div><div class="srow"><b>Honey / Pollen</b><b>${esc(h.honey)} / ${esc(h.pollen)}</b></div><div class="srow"><b>Varroa</b><b>${h.varroa}%</b></div><div class="srow"><b>Pests / Disease</b><b>${h.shb?'SHB ':''}${h.waxMoth?'Wax Moth ':''}${h.disease?'Disease':'None'}</b></div><div class="srow"><b>Swarm Signs</b><b>${h.swarm?'Yes':'No'}</b></div><div class="srow"><b>Super</b><b>${esc(h.superStatus)}</b></div>
  </div></section>
  <section><div class="sectionlabel">Timeline</div><div class="setting">${timelineRows(s,h.id)}</div></section>
  <section class="quick"><button type="button" class="qbtn" onclick="actionForm('inspection','${h.id}')"><span class="emo">🔎</span><b>Inspection</b></button><button type="button" class="qbtn" onclick="actionForm('feeding','${h.id}')"><span class="emo">🥣</span><b>Feeding</b></button><button type="button" class="qbtn" onclick="actionForm('treatment','${h.id}')"><span class="emo">🧪</span><b>Treatment</b></button></section>`
}
function timelineRows(s,hiveId){
  const rows=[
    ...s.logs.inspections.filter(x=>x.hiveId===hiveId).map(x=>({date:x.date,type:'Inspection',detail:x.notes||'Inspection saved'})),
    ...s.logs.feedings.filter(x=>x.hiveId===hiveId).map(x=>({date:x.date,type:'Feeding',detail:`${x.type} · ${x.amount}`})),
    ...s.logs.treatments.filter(x=>x.hiveId===hiveId).map(x=>({date:x.date,type:'Treatment',detail:x.type})),
    ...s.logs.harvests.filter(x=>x.hiveId===hiveId).map(x=>({date:x.date,type:'Harvest',detail:formatWeight(x.weightLb,s)}))
  ].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!rows.length)return `<div class="srow"><div class="scopy"><b>${fmtDate(hive(s,hiveId).lastInspection)} · Inspection</b><div class="tiny muted">${esc(hive(s,hiveId).notes)}</div></div></div>`;
  return rows.map(x=>`<div class="srow"><div class="scopy"><b>${fmtDate(x.date)} · ${esc(x.type)}</b><div class="tiny muted">${esc(x.detail)}</div></div></div>`).join('')
}

function settings(r){
  const s=state(),x=s.settings;
  r.innerHTML=`<section><div class="h1">Settings</div><div class="tiny muted">Account, apiary, alerts and preferences</div></section>
  <div class="sectionlabel">Account</div><section class="setting"><div class="srow"><div class="scopy"><b>${esc(s.user.name)}</b><div class="tiny muted">${esc(s.user.email)}</div></div><span class="pill">${esc(s.user.plan)}</span></div><div class="srow card-button" onclick="go('subscription')"><div class="scopy"><b>Subscription</b><div class="tiny muted">Free / Pro plans</div></div><span class="chev">›</span></div></section>

  <div class="sectionlabel">Apiary Settings</div><section class="setting"><div class="formgroup"><label>Apiary Name</label><input id="apiaryName" maxlength="60" value="${esc(x.apiaryName)}"></div><div class="formgroup"><label>Location</label><input id="location" maxlength="80" value="${esc(x.location)}"></div><div class="formgroup"><label>Time Zone</label><input id="timezone" maxlength="60" value="${esc(x.timezone)}"></div><div class="formgroup"><label>Default Hive Type</label><select id="hiveType"><option ${x.hiveType==='Langstroth'?'selected':''}>Langstroth</option><option ${x.hiveType==='Flow Hive'?'selected':''}>Flow Hive</option><option ${x.hiveType==='Top Bar'?'selected':''}>Top Bar</option></select></div><div class="formgroup"><label>Default Inspection Cycle</label><select id="inspectionCycle"><option value="7" ${x.inspectionCycle==7?'selected':''}>7 days</option><option value="14" ${x.inspectionCycle==14?'selected':''}>14 days</option><option value="21" ${x.inspectionCycle==21?'selected':''}>21 days</option></select></div></section>

  <div class="sectionlabel">Notifications</div><section class="setting">${Object.entries({inspection:'Inspection Reminders',treatment:'Treatment Follow-up',queen:'Queen Alerts',swarm:'Swarm Risk Alerts',weather:'Weather Alerts'}).map(([k,v])=>`<div class="srow"><b>${v}</b><label class="switch"><input data-notif="${k}" type="checkbox" ${x.notifications[k]?'checked':''}><span class="slider"></span></label></div>`).join('')}</section>

  <div class="sectionlabel">Preferences</div><section class="setting"><div class="formgroup"><label>Units</label><select id="units"><option value="imperial" ${x.units==='imperial'?'selected':''}>US / Imperial (°F, lb, mi)</option><option value="metric" ${x.units==='metric'?'selected':''}>Metric (°C, kg, km)</option></select></div><div class="srow"><div class="scopy"><b>Language</b><div class="tiny muted">English only in V9 to avoid a non-working language selector.</div></div><b>English</b></div></section>

  <div class="sectionlabel">Smart Features</div><section class="setting"><div class="srow"><div class="scopy"><b>Health Recommendations</b><div class="tiny muted">Advanced analysis requires Pro.</div></div><label class="switch"><input id="aiRecommendations" type="checkbox" ${x.aiRecommendations?'checked':''}><span class="slider"></span></label></div><div class="srow"><div class="scopy"><b>Photo Analysis</b><div class="tiny muted">Not connected yet.</div></div><span class="pill warn">Coming Soon</span></div><div class="srow"><div class="scopy"><b>Voice Notes</b><div class="tiny muted">Not connected yet.</div></div><span class="pill warn">Coming Soon</span></div><div class="srow"><div class="scopy"><b>Cloud Backup</b><div class="tiny muted">Automatically saved to your HiveDash cloud account.</div></div><span class="pill">Enabled</span></div></section>

  <div class="sectionlabel">Beekeeping Store</div><section class="setting shop"><div class="h2">Shop Beekeeping Equipment</div><div class="small muted" style="margin-top:4px">Bee hives, Flow Frames, components and accessories.</div><div class="tiny muted" style="margin-top:3px">Powered by SkogHive</div><button type="button" class="btn goldbtn" style="margin-top:10px" onclick="window.open('https://www.skoghive.com','_blank','noopener')">Visit Store ↗</button></section>

  <div class="sectionlabel">Cloud Account</div><section class="setting">
  <div class="srow"><div class="scopy"><b>Signed in as</b><div class="tiny muted">${esc(currentCloudUser()?.email||s.user.email)}</div></div><span class="pill">Online</span></div>
  <div class="srow"><div class="scopy"><b>Cloud Sync</b><div class="tiny muted">Hive data syncs across signed-in devices.</div></div><b id="cloudStatusValue">${esc(cloudStatusText())}</b></div>
  <div class="srow card-button" onclick="signOutCloud()"><div class="scopy"><b style="color:#94382F">Sign Out</b><div class="tiny muted">Keep cloud data and sign out on this device.</div></div><span class="chev">›</span></div>
 </section>

  <div class="sectionlabel">Data & Backup</div><section class="setting"><div class="srow card-button" onclick="exportData()"><div class="scopy"><b>Export Data</b><div class="tiny muted">Download a JSON backup</div></div><span class="chev">›</span></div><div class="srow card-button" onclick="if(confirm('Reset demo data?'))resetState()"><b style="color:#92372F">Reset Demo Data</b><span class="chev">›</span></div></section>

  <div class="sectionlabel">Privacy & Support</div><section class="setting"><div class="srow card-button" onclick="go('privacy')"><b>Privacy Policy</b><span class="chev">›</span></div><div class="srow card-button" onclick="go('terms')"><b>Terms of Service</b><span class="chev">›</span></div><div class="srow card-button" onclick="go('help')"><b>Help Center</b><span class="chev">›</span></div><div class="srow card-button" onclick="go('support')"><b>Contact Support</b><span class="chev">›</span></div></section>
  <button type="button" class="btn primary block" id="saveSettings">Save Settings</button>`;

  idq('saveSettings').onclick=()=>{
    x.apiaryName=idq('apiaryName').value.trim();x.location=idq('location').value.trim();x.timezone=idq('timezone').value.trim();x.hiveType=idq('hiveType').value;x.inspectionCycle=Number(idq('inspectionCycle').value);x.units=idq('units').value;x.aiRecommendations=idq('aiRecommendations').checked;document.querySelectorAll('[data-notif]').forEach(el=>x.notifications[el.dataset.notif]=el.checked);save(s);toast('Settings saved')
  }
}
function exportData(){
  const s=state(),blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='hivedash-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)
}

function subscriptionPage(r){
  const s=state();
  r.innerHTML=`<section><button type="button" class="btn secondarybtn" onclick="go('settings')">← Settings</button><div class="h1" style="margin-top:12px">HiveDash Plans</div></section><section class="setting"><div class="row between"><div><div class="h2">Free</div><div class="small muted">Up to ${FREE_HIVE_LIMIT} hives · Basic records · Basic reminders</div></div>${s.user.plan==='Free'?'<span class="pill">Current</span>':''}</div><button type="button" class="btn secondarybtn block" data-plan="Free" style="margin-top:10px">Choose Free</button></section><section class="setting"><div class="row between"><div><div class="h2">HiveDash Pro</div><div class="small muted">Unlimited hives · Health Analysis · Risk Prediction · Season Intelligence · Advanced trends · Reports</div></div>${s.user.plan==='Pro'?'<span class="pill">Current</span>':'<span class="pill warn">Recommended</span>'}</div><div class="h2" style="margin-top:10px">$59.99 / year</div><button type="button" class="btn primary block" data-plan="Pro" style="margin-top:10px">Choose Pro</button></section><div class="notice">Prototype billing only. Production must validate paid entitlement from Stripe/Paddle/RevenueCat/App Store billing.</div>`;
  document.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{s.user.plan=b.dataset.plan;save(s);toast('Plan changed in demo');render()})
}

function notifications(r){
  const s=state();
  r.innerHTML=`<section><div class="h1">Notifications</div><div class="tiny muted">Alerts, reminders and seasonal updates</div></section><section>${s.notifications.length?s.notifications.map(n=>`<div class="setting card-button" style="opacity:${n.read?.65:1}" onclick="openNotification('${n.id}')"><div class="row"><div class="grow"><div class="h3">${esc(n.title)}</div><div class="small muted">${esc(n.body)}</div></div><span class="chev">›</span></div></div>`).join(''):'<div class="setting small muted">No notifications.</div>'}</section><button type="button" class="btn secondarybtn block" onclick="markAllRead()">Mark All Read</button>`
}
function openNotification(id){const s=state(),n=s.notifications.find(x=>x.id===id);if(!n)return;n.read=true;save(s);location.hash=(n.target||'#notifications').replace(/^#/,'')}
function markAllRead(){const s=state();s.notifications.forEach(n=>n.read=true);save(s);toast('All read');render()}

function infoPage(r,title){
  const copy={
    'Privacy Policy':'This route is working. Replace this prototype copy with the final privacy policy before launch.',
    'Terms of Service':'This route is working. Replace this prototype copy with the final terms before launch.',
    'Help Center':'Help topics should cover inspections, hive records, treatments, subscriptions, notifications, export and account management.',
    'Contact Support':'Connect this route to the final support email or support form before launch.'
  }[title];
  r.innerHTML=`<section><button type="button" class="btn secondarybtn" onclick="go('settings')">← Settings</button><div class="h1" style="margin-top:12px">${esc(title)}</div></section><section class="setting body">${esc(copy)}</section>`
}

window.addEventListener('hashchange',()=>{
  if(!CLOUD_CONFIGURED || isAuthenticated() || CLOUD_CONFIG.REQUIRE_AUTH===false)render();
});
window.addEventListener('DOMContentLoaded',initializeCloudApp);
