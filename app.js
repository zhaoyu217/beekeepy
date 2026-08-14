
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
      <span class="google-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/>
          <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.13H3.07v2.59A10 10 0 0 0 12 22Z"/>
          <path fill="#FBBC05" d="M6.41 13.91A6.01 6.01 0 0 1 6.1 12c0-.66.11-1.3.31-1.91V7.5H3.07A10 10 0 0 0 2 12c0 1.61.39 3.13 1.07 4.5l3.34-2.59Z"/>
          <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.83 1.49l2.87-2.87C16.96 2.96 14.7 2 12 2A10 10 0 0 0 3.07 7.5l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"/>
        </svg>
      </span>
      <span>Continue with Google</span>
    </button>

    <button type="button" class="other-login-toggle" id="otherLoginToggle">
      Other sign-in options
      <span class="toggle-chevron">⌄</span>
    </button>

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
    <div class="auth-legal tiny muted">
      By continuing, you agree to the
      <button type="button" class="legal-link" id="termsLink">Terms of Service</button>
      and
      <button type="button" class="legal-link" id="privacyLink">Privacy Policy</button>.
    </div>
  `);

  document.getElementById('authSignInTab').onclick=()=>renderAuth('signin');
  document.getElementById('authSignUpTab').onclick=()=>renderAuth('signup');
  document.getElementById('authSubmit').onclick=()=>isSignUp?handleSignUp():handleSignIn();
  document.getElementById('googleLogin').onclick=()=>signInWithSocial('google');
  document.getElementById('otherLoginToggle').onclick=()=>{
    const box=document.getElementById('otherLogin');
    const hidden=box.classList.toggle('hidden');
    document.getElementById('otherLoginToggle').innerHTML=hidden
      ? 'Other sign-in options <span class="toggle-chevron">⌄</span>'
      : 'Hide other sign-in options <span class="toggle-chevron">⌃</span>';
  };
  document.getElementById('appleLogin').onclick=()=>signInWithSocial('apple');
  document.getElementById('microsoftLogin').onclick=()=>signInWithSocial('azure');
  document.getElementById('termsLink').onclick=()=>{location.hash='terms'};
  document.getElementById('privacyLink').onclick=()=>{location.hash='privacy'};
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
  const s=state(), top=idq('topbar'), bottom=idq('bottomnav');
  top.className='topbar';
  if(page==='home'){
    top.innerHTML=`<button type="button" class="iconbtn" onclick="go('settings')" aria-label="Open Settings">${icon('settings')}</button><div class="brand" aria-label="HiveDash"><span class="brand-hive">${icon('hive')}</span><span>HiveDash</span></div><button type="button" class="iconbtn" onclick="go('notifications')" aria-label="Open Notifications">${icon('bell')}${unread(s)?`<span class="badge">${unread(s)}</span>`:''}</button>`;
  }else if(page==='hives'){
    top.innerHTML=`<span></span><div class="pagebar-title">Hives</div><button type="button" class="iconbtn plusbtn" onclick="addHive()" aria-label="Add Hive">+</button>`;
  }else if(page==='actions'){
    top.innerHTML=`<span></span><div class="pagebar-title">Actions</div><span></span>`;
  }else if(page==='insights'){
    top.innerHTML=`<span></span><div class="pagebar-title">Insights</div><button type="button" class="iconbtn plusbtn" onclick="${isPro(s)?"go('analysis')":"requirePro('Health Analysis')"}" aria-label="Open Health Analysis">+</button>`;
  }else{
    top.innerHTML=`<button type="button" class="iconbtn" onclick="history.back()" aria-label="Back">‹</button><div class="pagebar-title">${page==='hive'?'Hive Detail':page==='honey'?'Harvest':page==='trend'?'Trends':page==='risk'?'Risk Prediction':page==='analysis'?'Health Analysis':page==='settings'?'Settings':page==='notifications'?'Notifications':page==='subscription'?'HiveDash Pro':page==='season'?'Season Intelligence':''}</div><span></span>`;
  }

  bottom.classList.toggle('hidden',secondary);
  bottom.innerHTML=[
    ['home','Home','home'],
    ['hives','Hives','hive'],
    ['actions','Actions','check'],
    ['insights','Insights','chart']
  ].map(([key,label,ico])=>`<button class="navitem ${page===key?'active':''}" onclick="go('${key}')" aria-label="${label}" ${page===key?'aria-current="page"':''}>${icon(ico)}<span>${label}</span>${key==='actions'&&s.actions.length?`<i class="nav-badge">${Math.min(9,s.actions.length)}</i>`:''}</button>`).join('')
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
  const s=state(),score=avgHealth(s);
  const strong=s.hives.filter(h=>h.status==='Healthy').length;
  const attention=s.hives.filter(h=>h.status==='Attention').length;
  const critical=s.hives.filter(h=>h.status==='Critical').length;
  const action=s.actions[0]||null,ah=action?hive(s,action.hiveId):null;
  const riskCards=[...s.hives].filter(h=>h.status!=='Healthy').sort((a,b)=>a.score-b.score);
  const C=2*Math.PI*44,D=C*score/100;

  r.innerHTML=`<div class="master-screen home-master">

    <section class="home-overview-master">
      <div class="master-section-title">Hive Overview <span class="mini-info">i</span></div>

      <div class="overview-grid-master">
        <div class="overview-left-master">
          <div class="health-donut-master">
            <svg viewBox="0 0 110 110" aria-hidden="true">
              <circle class="donut-track" cx="55" cy="55" r="44"/>
              <circle class="donut-progress" cx="55" cy="55" r="44" stroke-dasharray="${D} ${C-D}"/>
            </svg>
            <div class="donut-label"><strong>${score}<small>%</small></strong><b>Good</b><span>Overall Health</span></div>
          </div>
          <div class="landscape-master" aria-hidden="true">
            <img src="home_landscape_master.png" alt="">
          </div>
        </div>

        <div class="overview-stats-master">
          <button onclick="go('all-hives')"><i class="stat-icon">${icon('hive')}</i><span>Total Hives</span><b>${s.hives.length}</b></button>
          <button onclick="go('all-hives')"><i class="stat-dot green"></i><span>Strong</span><b class="green">${strong}</b></button>
          <button onclick="go('all-hives')"><i class="stat-dot amber"></i><span>Needs Attention</span><b class="amber">${attention}</b></button>
          <button onclick="go('all-hives')"><i class="stat-dot red"></i><span>Critical</span><b class="red">${critical}</b></button>
        </div>
      </div>

      <button type="button" class="view-hives-master" onclick="go('all-hives')">
        <i>${icon('hive')}</i><span><b>View All Hives</b><small>Check detailed hive status</small></span><em>›</em>
      </button>
    </section>

    <section class="master-block action-master">
      <div class="master-section-title">Action Center</div>
      ${action?`<div class="action-main-master">
        <i class="action-icon-master">${icon('check')}</i>
        <span><b>${esc(action.title)}</b><small>${esc(ah?.name||'Hive')} · Last inspection: ${ah?daysSince(ah.lastInspection):'—'} days ago</small></span>
        <button onclick="${action.type==='Inspection'?"actionForm('inspection','"+action.hiveId+"')":action.type==='Feeding'?"actionForm('feeding','"+action.hiveId+"')":"actionForm('treatment','"+action.hiveId+"')"}">${action.type==='Inspection'?'Inspect Now':action.type==='Feeding'?'Record Feeding':'Start Treatment'}</button>
      </div>
      <div class="action-foot-master"><span>▣ &nbsp;Due: <b>${esc(action.due)}</b></span><span>◷ &nbsp;Est. time: 15 min</span><button onclick="go('all-actions')">View All Actions ›</button></div>`:`<div class="empty-master">No urgent action right now.</div>`}
    </section>

    <section class="master-block">
      <div class="master-title-action"><div class="master-section-title">Risk Alerts</div><button onclick="go('hives')">View All Alerts ›</button></div>
      <div class="risk-scroll-master">
        ${(riskCards.length?riskCards:s.hives.slice(0,3)).map(h=>`<button class="risk-card-master" onclick="go('hive/${h.id}')">
          <i class="${h.status==='Critical'?'risk-red':'risk-amber'}">!</i>
          <span><b>${esc(h.name)}</b><small>${h.queen!=='Confirmed'?'Queen status unconfirmed':h.varroa>=3?'Varroa test overdue':h.honey==='Low'||h.pollen==='Low'?'Low food stores':'Review hive health'}</small></span>
          <strong class="${h.status==='Critical'?'risk-red':'risk-amber'}">${h.status==='Critical'?'High Risk':'Medium Risk'}</strong><em>›</em>
        </button>`).join('')}
      </div>
      <div class="dots-master"><i class="on"></i><i></i><i></i><i></i><i></i></div>
    </section>

    <section class="master-block">
      <div class="master-title-action"><div class="master-section-title">Season Intelligence</div><button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">Spring Build-Up ›</button></div>
      <div class="season-scroll-master">
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><i>✿</i><b>Nectar Flow</b><span>Good</span><small>Flow is strong in your area</small><em>Learn more ›</em></button>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><i>♧</i><b>Swarm Watch</b><span>Low Risk</span><small>High swarm risk in 2–4 weeks</small><em>Learn more ›</em></button>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><i>${icon('hive')}</i><b>Add Super Soon</b><span class="amber">Recommended</span><small>Prepare to add honey super</small><em>Learn more ›</em></button>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><i>◉</i><b>Varroa Rising</b><span class="amber">Elevated</span><small>Increase monitoring frequency</small><em>Learn more ›</em></button>
      </div>
      <div class="dots-master"><i class="on"></i><i></i><i></i><i></i></div>
    </section>

    <section class="quick-master">
      <div class="master-section-title">Quick Actions</div>
      <div class="quick-grid-master">
        <button onclick="actionForm('inspection')"><i>${icon('check')}</i><b>Inspection</b><small>Record hive inspection</small></button>
        <button onclick="actionForm('feeding')"><i>▣</i><b>Feeding</b><small>Record feeding activity</small></button>
        <button onclick="actionForm('treatment')"><i>✚</i><b>Treatment</b><small>Record treatment</small></button>
        <button onclick="actionForm('harvest')"><i>⌁</i><b>Harvest</b><small>Record honey harvest</small></button>
        <button onclick="moreActions()"><i>•••</i><b>More</b><small>More actions & tools</small></button>
      </div>
    </section>
  </div>`
}
function hives(r){
  const s=state(),ordered=[...s.hives];
  r.innerHTML=`<div class="master-screen hives-master">
    <div class="search-master"><span>⌕</span><input id="mainHiveSearch" placeholder="Search hives"></div>
    <div class="filter-master">
      <button class="active" data-filter="all">All (${s.hives.length})</button>
      <button data-filter="Healthy">Healthy (${s.hives.filter(h=>h.status==='Healthy').length})</button>
      <button data-filter="Attention">Attention (${s.hives.filter(h=>h.status==='Attention').length})</button>
      <button data-filter="Critical">Critical (${s.hives.filter(h=>h.status==='Critical').length})</button>
    </div>
    <div id="mainHiveList" class="hive-list-master"></div>
  </div>`;
  let filter='all';
  const draw=()=>{const q=idq('mainHiveSearch').value.toLowerCase();idq('mainHiveList').innerHTML=ordered.filter(h=>(filter==='all'||h.status===filter)&&h.name.toLowerCase().includes(q)).map(h=>hiveCard(h)).join('')};
  idq('mainHiveSearch').oninput=draw;
  r.querySelectorAll('.filter-master button').forEach(b=>b.onclick=()=>{r.querySelectorAll('.filter-master button').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;draw()});
  draw()
}
function hiveCard(h){
  const tone=h.status==='Healthy'?'good':h.status==='Attention'?'attention':'critical';
  const label=h.status==='Healthy'?'Good':h.status==='Attention'?'Needs Attention':'Critical';
  return `<button type="button" class="hive-card-master" onclick="go('hive/${h.id}')">
    <div class="mini-ring-master ${tone}" style="--p:${h.score}"><span>${h.score}%</span></div>
    <div class="hive-copy-master"><b>${esc(h.name)}</b><small>Location: ${esc(h.location||'North Field')}</small><small>Last inspection: ${fmtDate(h.lastInspection)}</small><div><span>♧ ${h.strength==='Strong'?8:h.strength==='Medium'?6:4}</span><span>✿ ${h.brood==='Excellent'?7:h.brood==='Good'?6:4}</span><span>▣ ${h.honey==='High'?3:h.honey==='Medium'?2:1}</span></div></div>
    <strong class="${tone}">${label}</strong><em>•••</em>
  </button>`
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
  const m=modal(`<div class="form-master ${type==='inspection'?'inspection-master':''}">
    <div class="form-header-master"><button type="button" onclick="closeModal(this)">‹</button><b>${type==='inspection'?'Inspection':`New ${type[0].toUpperCase()+type.slice(1)}`}</b><button type="button" id="saveActionTop">Save</button></div>
    <div class="form-hive-master"><i>${icon('hive')}</i><span><b>${esc(hive(s,selectedHive||s.hives[0]?.id)?.name||'Select hive')}</b><small>${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} · 9:30 AM</small></span></div>
    ${type==='inspection'?`<div class="quick-entry-master"><span><b>Quick Entry</b><small>Use voice or quick inputs to save time</small></span><i>♩</i></div>`:''}
    <div class="fields-master"><div class="formgroup"><label>Hive</label><select id="formHive">${hiveOptions}</select></div><div class="formgroup"><label>Date</label><input id="formDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>${fields}</div>
    <button type="button" class="btn primary block" id="saveAction">Save</button>
  </div>`);
  m.querySelector('#saveActionTop').onclick=()=>m.querySelector('#saveAction').click();
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
  const s=state(),score=avgHealth(s),strong=s.hives.filter(h=>h.status==='Healthy').length,attention=s.hives.filter(h=>h.status==='Attention').length,critical=s.hives.filter(h=>h.status==='Critical').length;
  const C=2*Math.PI*38,D=C*score/100;
  r.innerHTML=`<div class="master-screen insights-master">
    <div class="year-master"><button>This Year⌄</button></div>
    <div class="insight-tabs-master"><button class="active">Overview</button><button onclick="${isPro(s)?"go('analysis')":"requirePro('Health Analysis')"}">Colony Health</button><button onclick="${isPro(s)?"go('honey')":"requirePro('Honey Analytics')"}">Harvest</button><button onclick="${isPro(s)?"go('trend')":"requirePro('90-day trends')"}">Trends</button></div>
    <section class="insight-card-master"><div class="master-section-title">Colony Health Summary</div><div class="insight-health-master"><div class="insight-donut-master"><svg viewBox="0 0 100 100"><circle class="donut-track" cx="50" cy="50" r="38"/><circle class="donut-progress" cx="50" cy="50" r="38" stroke-dasharray="${D} ${C-D}"/></svg></div><div class="legend-master"><span><i class="green"></i>Strong <b>${Math.round(strong/Math.max(1,s.hives.length)*100)}% (${strong})</b></span><span><i class="amber"></i>Needs Attention <b>${Math.round(attention/Math.max(1,s.hives.length)*100)}% (${attention})</b></span><button onclick="${isPro(s)?"go('risk')":"requirePro('Risk Prediction')"}"><i class="red"></i>Critical <b>${Math.round(critical/Math.max(1,s.hives.length)*100)}% (${critical})</b></button></div></div></section>
    <section class="detail-section-master"><div class="master-section-title">Health Over Time</div><svg viewBox="0 0 300 110" class="trend-master"><polyline points="10,74 58,62 106,69 154,50 202,57 250,43 290,50" fill="none" stroke="#5E7350" stroke-width="2"/><polyline points="10,86 58,78 106,83 154,72 202,76 250,66 290,70" fill="none" stroke="#C5921A" stroke-width="1.5"/><polyline points="10,94 58,92 106,90 154,85 202,88 250,82 290,84" fill="none" stroke="#D94E43" stroke-width="1.5"/></svg></section>
    <section class="detail-section-master"><div class="master-section-title">Top Actions This Year</div><div class="actions-summary-master"><span>▣ Inspections <b>${s.logs.inspections.length}</b></span><span>◉ Feedings <b>${s.logs.feedings.length}</b></span><span>✚ Treatments <b>${s.logs.treatments.length}</b></span><span>⌁ Harvests <b>${s.logs.harvests.length}</b></span></div></section>
  </div>`
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
  const s=state(),total=s.logs.harvests.reduce((n,x)=>n+Number(x.weightLb||0),0),avg=s.logs.harvests.length?s.logs.harvests.reduce((n,x)=>n+Number(x.moisture||0),0)/s.logs.harvests.length:0;
  const bars=[4,6,12,25,58,82,65,90,70,43,15,6];
  r.innerHTML=`<div class="master-screen harvest-master">
    <div class="year-master"><button>This Year⌄</button></div>
    <div class="harvest-stats-master"><div><small>Total Harvest</small><b>${formatWeight(total,s)}</b></div><div><small>Total Batches</small><b>${s.logs.harvests.length}</b></div><div><small>Avg Moisture</small><b>${avg.toFixed(1)}%</b></div></div>
    <section class="detail-section-master"><div class="master-section-title">Harvest Over Time (${s.settings.units==='metric'?'kg':'lb'})</div><div class="bar-master">${bars.map((v,i)=>`<div><i style="height:${v}%"></i><span>${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}</span></div>`).join('')}</div></section>
    <section class="detail-section-master"><div class="master-title-action"><div class="master-section-title">Recent Batches</div><button>View All</button></div><div class="batch-master">${s.logs.harvests.slice().reverse().slice(0,5).map(x=>`<button onclick="go('hive/${x.hiveId}')"><span>${fmtDate(x.date)}</span><span>${esc(hive(s,x.hiveId)?.name||'Hive')}</span><b>${formatWeight(x.weightLb,s)}</b><small>${x.moisture}%</small></button>`).join('')||'<small>No harvest batches yet.</small>'}</div></section>
    <button class="floating-add-master" onclick="actionForm('harvest')">+</button>
  </div>`
}
function seasonPage(r){
  const s=state();if(!isPro(s)){subscriptionModal('Season Intelligence');go('home');return}
  r.innerHTML=`<section><button type="button" class="btn secondarybtn" onclick="go('home')">← Home</button><div class="h1" style="margin-top:12px">Season Intelligence</div><div class="tiny muted">${esc(s.settings.location)} · ${new Date().toLocaleDateString('en-US',{month:'long'})}</div></section><section class="setting"><div class="srow"><div class="scopy"><b>Monitor mites closely</b><div class="tiny muted">Prioritize colonies with elevated Varroa or overdue checks.</div></div><span class="pill warn">Priority</span></div><div class="srow"><div class="scopy"><b>Review food stores</b><div class="tiny muted">Follow up on low honey or pollen stores before the next seasonal transition.</div></div></div><div class="srow"><div class="scopy"><b>Confirm queen status</b><div class="tiny muted">Recheck colonies where queen status remains uncertain.</div></div></div></section><div class="notice">V9 uses date, location setting and hive records. Real weather/bloom APIs are still required for production-grade recommendations.</div>`
}

function hiveDetail(r,id){
  const s=state(),h=hive(s,id);if(!h){go('hives');return}
  r.innerHTML=`<div class="master-screen detail-master">
    <section class="detail-hero-master">
      <div class="detail-photo-master">
        <svg viewBox="0 0 360 110" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="dph" x1="0" x2="1"><stop offset="0" stop-color="#e8dfc6"/><stop offset="1" stop-color="#a8b487"/></linearGradient></defs>
          <rect width="360" height="110" fill="url(#dph)"/><path d="M0 78 C50 48 90 65 136 52 C186 38 229 69 276 54 C315 42 338 49 360 45 L360 110 L0 110Z" fill="#7d8c69" opacity=".55"/>
          <g transform="translate(30 35)"><rect x="0" y="18" width="38" height="29" rx="3" fill="#e8dfc7" stroke="#506040" stroke-width="1.4"/><rect x="4" y="6" width="30" height="15" rx="2" fill="#f4ebd6" stroke="#506040" stroke-width="1.4"/><path d="M-2 8 L19 -3 L40 8" fill="#9a7d51" stroke="#506040" stroke-width="1.4"/></g>
        </svg>
      </div>
      <div class="detail-name-master"><b>${esc(h.name)}</b><small>${esc(h.location||'North Field')}</small></div>
      <div class="mini-ring-master detail-ring-master ${h.status==='Healthy'?'good':h.status==='Attention'?'attention':'critical'}" style="--p:${h.score}"><span>${h.score}%</span></div>
      <div class="detail-status-master">${h.status==='Healthy'?'Good':h.status}</div>
    </section>
    <div class="detail-dates-master"><span>Last inspection: ${fmtDate(h.lastInspection)}</span><span>Next due: ${fmtDate(new Date(Date.now()+14*86400000).toISOString().slice(0,10))}</span></div>
    <div class="detail-metrics-master">
      <div><i>♛</i><b>Queen</b><small>${esc(h.queen)}</small></div><div><i>♧</i><b>Strength</b><small>${esc(h.strength)}</small></div><div><i>✿</i><b>Brood</b><small>${esc(h.brood)}</small></div><div><i>▣</i><b>Honey</b><small>${esc(h.honey)}</small></div><div><i>◌</i><b>Pollen</b><small>${esc(h.pollen)}</small></div>
    </div>
    <section class="detail-section-master"><div class="master-title-action"><div><div class="master-section-title">Recent Trend</div><small>Last 5 inspections</small></div><button onclick="go('trend')">View All</button></div><svg viewBox="0 0 300 100" class="trend-master"><polyline points="10,72 60,57 110,66 160,48 210,55 290,42" fill="none" stroke="#5E7350" stroke-width="2"/><polyline points="10,84 60,76 110,82 160,69 210,72 290,65" fill="none" stroke="#C5921A" stroke-width="1.6"/></svg></section>
    <section class="detail-section-master"><div class="master-title-action"><div class="master-section-title">Photos</div><button>View All</button></div><div class="photos-master"><div></div><div></div><div></div><button>+12</button></div></section>
    <section class="detail-section-master"><div class="master-title-action"><div class="master-section-title">Treatments & Feeding</div><button>View All</button></div><button class="record-master" onclick="actionForm('treatment','${h.id}')"><i>◉</i><span><b>${esc(s.logs.treatments.filter(x=>x.hiveId===h.id).slice(-1)[0]?.type||'Oxalic Acid (Dribble)')}</b><small>${fmtDate(s.logs.treatments.filter(x=>x.hiveId===h.id).slice(-1)[0]?.date||h.lastInspection)}</small></span><em>›</em></button></section>
    <div class="detail-actions-master"><button onclick="actionForm('inspection','${h.id}')">Inspection</button><button onclick="actionForm('feeding','${h.id}')">Feeding</button><button onclick="actionForm('treatment','${h.id}')">Treatment</button></div>
  </div>`
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
  const publicAuthRoutes=['terms','privacy'];
  const current=(location.hash||'#home').slice(1).split('/')[0];
  if(publicAuthRoutes.includes(current)){
    const view=document.getElementById('view');
    view.className='view secondary';
    document.getElementById('bottomnav').classList.add('hidden');
    infoPage(view,current==='terms'?'Terms of Service':'Privacy Policy');
    document.getElementById('topbar').innerHTML='<button type="button" class="iconbtn" onclick="history.back()" aria-label="Back">←</button><div class="brand">HiveDash</div><div></div>';
    return;
  }
  if(!CLOUD_CONFIGURED || isAuthenticated() || CLOUD_CONFIG.REQUIRE_AUTH===false)render();
});
window.addEventListener('DOMContentLoaded',initializeCloudApp);
