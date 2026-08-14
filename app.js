
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
    top.innerHTML=`<button type="button" class="iconbtn" onclick="history.back()" aria-label="Back">‹</button><div class="pagebar-title">${page==='hive'?'Hive Detail':page==='inspection'?'Inspection':page==='timeline'?'Timeline':page==='map'?'Map':page==='honey'?'Harvest':page==='trend'?'Trends':page==='risk'?'Risk Prediction':page==='analysis'?'Health Analysis':page==='settings'?'Settings':page==='notifications'?'Notifications':page==='subscription'?'HiveDash Pro':page==='season'?'Season Intelligence':''}</div><span></span>`;
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
  const secondary=['all-hives','hive','inspection','all-actions','settings','notifications','subscription','analysis','trend','risk','honey','season','privacy','terms','help','support'].includes(page);
  const view=idq('view');view.className=`view ${secondary?'secondary':'main'}`;

  if(page==='home')home(view);
  else if(page==='hives')hives(view);
  else if(page==='actions')actions(view);
  else if(page==='insights')insights(view);
  else if(page==='all-hives')allHives(view);
  else if(page==='hive')hiveDetail(view,id);
  else if(page==='inspection')inspectionPage(view,id);
  else if(page==='all-actions')allActions(view,id);
  else if(page==='timeline')timelinePage(view);
  else if(page==='map')mapPage(view);
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

  chrome(page,secondary);
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
        <div class="landscape-master" aria-hidden="true">
            <img src="data:image/png;base64,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" alt="">
          </div>

        <div class="overview-left-master">
          <div class="health-donut-master">
            <svg viewBox="0 0 110 110" aria-hidden="true">
              <circle class="donut-track" cx="55" cy="55" r="44"/>
              <circle class="donut-progress" cx="55" cy="55" r="44" stroke-dasharray="${D} ${C-D}"/>
            </svg>
            <div class="donut-label"><strong>${score}<small>%</small></strong><b>Good</b><span>Overall Health</span></div>
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
  r.innerHTML=`<div class="screen hives-master-locked">
    <div class="search-master-locked"><span>⌕</span><input id="mainHiveSearch" placeholder="Search hives"></div>

    <div class="hives-subnav-master"><button onclick="go('map')">Map</button></div>
    <div class="filter-master-locked">
      <button class="active" data-filter="all">All (${s.hives.length})</button>
      <button data-filter="Healthy">Healthy (${s.hives.filter(h=>h.status==='Healthy').length})</button>
      <button data-filter="Attention">Attention (${s.hives.filter(h=>h.status==='Attention').length})</button>
      <button data-filter="Critical">Critical (${s.hives.filter(h=>h.status==='Critical').length})</button>
    </div>

    <div id="mainHiveList" class="hive-list-master-locked"></div>
  </div>`;

  let filter='all';
  const draw=()=>{
    const q=idq('mainHiveSearch').value.toLowerCase();
    idq('mainHiveList').innerHTML=ordered
      .filter(h=>(filter==='all'||h.status===filter)&&h.name.toLowerCase().includes(q))
      .map(h=>hiveCard(h)).join('')
  };
  idq('mainHiveSearch').oninput=draw;
  r.querySelectorAll('.filter-master-locked button').forEach(b=>b.onclick=()=>{
    r.querySelectorAll('.filter-master-locked button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    filter=b.dataset.filter;
    draw()
  });
  draw()
}
function hiveCard(h){
  const tone=h.status==='Healthy'?'good':h.status==='Attention'?'attention':'critical';
  const label=h.status==='Healthy'?'Good':h.status==='Attention'?'Needs Attention':'Critical';
  const strength=h.strength==='Strong'?8:h.strength==='Medium'?6:4;
  const brood=h.brood==='Excellent'?7:h.brood==='Good'?6:4;
  const honey=h.honey==='High'?3:h.honey==='Medium'?2:1;

  return `<button type="button" class="hive-card-master-locked" onclick="go('hive/${h.id}')">
    <div class="hive-score-ring-locked ${tone}" style="--p:${h.score}">
      <span>${h.score}%</span>
    </div>

    <div class="hive-info-locked">
      <b>${esc(h.name)}</b>
      <small>Location: ${esc(h.location||'North Field')}</small>
      <small>Last inspection: ${fmtDate(h.lastInspection)}</small>
      <div class="hive-mini-metrics-locked">
        <span>♧ ${strength}</span><span>✿ ${brood}</span><span>▣ ${honey}</span>
      </div>
    </div>

    <strong class="hive-status-locked ${tone}">${label}</strong>
    <span class="hive-menu-locked" onclick="event.stopPropagation()">•••</span>
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
  if(type==='inspection'){go('inspection/'+(selectedHive||state().hives[0]?.id||''));return}

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


let activeInspectionHiveId=null;

function inspectionPage(r,id){
  const s=state(),h=hive(s,id)||s.hives[0];
  if(!h){go('hives');return}
  activeInspectionHiveId=h.id;

  const hiveOptions=s.hives.map(x=>`<option value="${x.id}" ${x.id===h.id?'selected':''}>${esc(x.name)}</option>`).join('');

  r.innerHTML=`<div class="screen inspection-screen">
    <section class="setting inspection-hive-summary inspection-hive-switcher">
      <div class="inspection-hive-icon">${icon('hive')}</div>

      <div class="inspection-hive-select-wrap">
        <label for="inspectionHiveSelect">Inspecting hive</label>
        <select id="inspectionHiveSelect" class="inspection-hive-select">
          ${hiveOptions}
        </select>
        <div class="tiny muted">${fmtDate(h.lastInspection)} · Inspection</div>
      </div>

      <span class="inspection-switch-chevron">⌄</span>
    </section>

    <section class="setting quick-entry-card">
      <div class="row between">
        <div><div class="h3">Quick Entry</div><div class="tiny muted">Use voice or quick inputs to save time</div></div>
        <span class="inspection-mic">♩</span>
      </div>
    </section>

    <section class="setting inspection-fields">
      <div class="inspection-field-row"><span>Queen Status</span><b id="inspQueen">Seen laying</b><em>›</em></div>
      <div class="inspection-slider-row"><span>Colony Strength</span><div class="inspection-slider"><i style="left:78%"></i></div><b>8 / 10</b><em>›</em></div>
      <div class="inspection-field-row"><span>Brood Pattern</span><b>Good</b><em>›</em></div>
      <div class="inspection-slider-row"><span>Honey Stores</span><div class="inspection-slider"><i style="left:70%"></i></div><b>7 / 10</b><em>›</em></div>
      <div class="inspection-field-row"><span>Pollen Stores</span><b>Medium</b><em>›</em></div>
      <div class="inspection-field-row"><span>Queen Cells</span><b>None</b><em>›</em></div>
      <div class="inspection-field-row"><span>Varroa Level</span><b>Low</b><em>›</em></div>
      <div class="inspection-field-row"><span>Disease / Issues</span><b>None</b><em>›</em></div>
      <div class="inspection-field-row"><span>Super On / Off</span><b>On (1 Super)</b><em>›</em></div>
      <div class="inspection-field-row"><span>Treatments</span><b>None</b><em>›</em></div>
      <div class="inspection-field-row"><span>Feeding</span><b>None</b><em>›</em></div>
      <div class="inspection-field-row"><span>Notes</span><b class="muted">Add notes...</b><em>›</em></div>
      <div class="inspection-field-row"><span>Photos</span><b>Add photos</b><em>▣</em></div>
    </section>

    <button type="button" class="btn primary block inspection-save-btn" onclick="saveInspectionPage()">Save Inspection</button>
  </div>`;

  const select=idq('inspectionHiveSelect');
  if(select){
    select.onchange=()=>{
      activeInspectionHiveId=select.value;
      go('inspection/'+select.value);
    };
  }
}

function saveInspectionPage(){
  const s=state(),h=hive(s,activeInspectionHiveId);
  if(!h){toast('Hive not found');return}
  const date=new Date().toISOString().slice(0,10);

  h.lastInspection=date;
  h.queen='Confirmed';
  h.strength='Strong';
  h.brood='Good';
  h.honey='High';
  h.pollen='Medium';

  s.logs.inspections.push({
    id:'i'+Date.now(),
    hiveId:h.id,
    date,
    score:h.score,
    queen:'Confirmed',
    strength:'Strong',
    brood:'Good',
    notes:'Inspection saved'
  });

  save(s);
  toast('Inspection saved');
  go('hive/'+h.id);
}

function insights(r){
  const s=state(),score=avgHealth(s),strong=s.hives.filter(h=>h.status==='Healthy').length,attention=s.hives.filter(h=>h.status==='Attention').length,critical=s.hives.filter(h=>h.status==='Critical').length;
  const C=2*Math.PI*38,D=C*score/100;
  r.innerHTML=`<div class="master-screen insights-master">
    <div class="year-master"><button>This Year⌄</button></div>
    <div class="insight-tabs-master"><button class="active">Overview</button><button onclick="go('timeline')">Timeline</button><button onclick="${isPro(s)?"go('analysis')":"requirePro('Health Analysis')"}">Colony Health</button><button onclick="${isPro(s)?"go('honey')":"requirePro('Honey Analytics')"}">Harvest</button><button onclick="${isPro(s)?"go('trend')":"requirePro('90-day trends')"}">Trends</button></div>
    <section class="insight-card-master"><div class="master-section-title">Colony Health Summary</div><div class="insight-health-master"><div class="insight-donut-master"><svg viewBox="0 0 100 100"><circle class="donut-track" cx="50" cy="50" r="38"/><circle class="donut-progress" cx="50" cy="50" r="38" stroke-dasharray="${D} ${C-D}"/></svg></div><div class="legend-master"><span><i class="green"></i>Strong <b>${Math.round(strong/Math.max(1,s.hives.length)*100)}% (${strong})</b></span><span><i class="amber"></i>Needs Attention <b>${Math.round(attention/Math.max(1,s.hives.length)*100)}% (${attention})</b></span><button onclick="${isPro(s)?"go('risk')":"requirePro('Risk Prediction')"}"><i class="red"></i>Critical <b>${Math.round(critical/Math.max(1,s.hives.length)*100)}% (${critical})</b></button></div></div></section>
    <section class="detail-section-master"><div class="master-section-title">Health Over Time</div><svg viewBox="0 0 300 110" class="trend-master"><polyline points="10,74 58,62 106,69 154,50 202,57 250,43 290,50" fill="none" stroke="#5E7350" stroke-width="2"/><polyline points="10,86 58,78 106,83 154,72 202,76 250,66 290,70" fill="none" stroke="#C5921A" stroke-width="1.5"/><polyline points="10,94 58,92 106,90 154,85 202,88 250,82 290,84" fill="none" stroke="#D94E43" stroke-width="1.5"/></svg></section>
    <section class="detail-section-master"><div class="master-section-title">Top Actions This Year</div><div class="actions-summary-master"><span>▣ Inspections <b>${s.logs.inspections.length}</b></span><span>◉ Feedings <b>${s.logs.feedings.length}</b></span><span>✚ Treatments <b>${s.logs.treatments.length}</b></span><span>⌁ Harvests <b>${s.logs.harvests.length}</b></span></div></section>
  </div>`
}

function timelinePage(r){
  const s=state();
  const events=[];

  s.logs.inspections.forEach(x=>events.push({
    date:x.date,time:'9:30 AM',type:'Inspection',hiveId:x.hiveId,
    title:'Inspection',desc:`Strength ${x.strength||'—'}, Queen ${x.queen||'—'}`,tone:'green'
  }));
  s.logs.feedings.forEach(x=>events.push({
    date:x.date,time:'2:15 PM',type:'Feeding',hiveId:x.hiveId,
    title:'Feeding',desc:`${x.type||'Feeding'} ${x.amount||''}`.trim(),tone:'green'
  }));
  s.logs.treatments.forEach(x=>events.push({
    date:x.date,time:'10:00 AM',type:'Treatment',hiveId:x.hiveId,
    title:'Treatment',desc:x.type||'Treatment',tone:'green'
  }));
  s.logs.harvests.forEach(x=>events.push({
    date:x.date,time:'9:00 AM',type:'Harvest',hiveId:x.hiveId,
    title:'Harvest',desc:`Harvested ${formatWeight(x.weightLb||0,s)}`,tone:'amber'
  }));

  events.sort((a,b)=>String(b.date).localeCompare(String(a.date)));

  const rows=events.slice(0,12).map((e,i)=>{
    const h=hive(s,e.hiveId);
    const dateObj=new Date(e.date+'T00:00:00');
    const month=dateObj.toLocaleDateString('en-US',{month:'short'});
    const day=dateObj.getDate();
    return `<div class="timeline-row-master">
      <div class="timeline-date-master">${i===0?`<b>${month}</b><strong>${day}</strong>`:''}</div>
      <div class="timeline-line-master"><i class="${e.tone}"></i></div>
      <button type="button" class="timeline-event-master" onclick="go('hive/${e.hiveId}')">
        <div class="timeline-event-head"><b>${e.title}</b><span>${e.time}</span></div>
        <small>${esc(h?.name||'Hive')}</small>
        <p>${esc(e.desc)}</p>
      </button>
    </div>`
  }).join('');

  r.innerHTML=`<div class="screen timeline-master-screen">
    <div class="timeline-search-master"><span>⌕</span><input placeholder="Search timeline"></div>
    <div class="timeline-filter-master">
      <button class="active">All</button>
      <button>${esc(s.hives[0]?.name||'Hive')}</button>
      <button>${esc(s.hives[1]?.name||'Hive')}</button>
      <button>All Types⌄</button>
    </div>
    <div class="timeline-list-master">${rows||'<div class="tiny muted">No timeline events yet.</div>'}</div>
  </div>`
}

function mapPage(r){
  const s=state();
  const apiaries=[
    {name:'North Field',count:s.hives.filter(h=>(h.location||'').includes('North')).length||Math.max(1,Math.ceil(s.hives.length/2)),x:28,y:28},
    {name:'East Field',count:s.hives.filter(h=>(h.location||'').includes('East')).length||1,x:72,y:42},
    {name:'West Field',count:s.hives.filter(h=>(h.location||'').includes('West')).length||1,x:20,y:58},
    {name:'South Field',count:s.hives.filter(h=>(h.location||'').includes('South')).length||1,x:63,y:68},
  ];

  r.innerHTML=`<div class="screen map-master-screen">
    <div class="map-tabs-master">
      <button class="active">Apiaries</button><button>Hives</button><button>Forage</button>
    </div>

    <section class="map-canvas-master">
      <div class="map-bg-grid"></div>
      ${apiaries.map(a=>`<button class="map-pin-master" style="left:${a.x}%;top:${a.y}%">
        <span>${icon('hive')}</span><b>${a.name}</b><small>${a.count} Hives</small>
      </button>`).join('')}
      <button class="map-locate-master">◎</button>
    </section>

    <section class="map-list-master">
      ${apiaries.slice(0,2).map(a=>`<button type="button" onclick="go('hives')">
        <span class="map-list-icon">${icon('hive')}</span>
        <span><b>${a.name}</b><small>Last inspection: ${fmtDate(s.hives[0]?.lastInspection||new Date().toISOString().slice(0,10))}</small></span>
        <strong>${a.count} hives</strong><em>›</em>
      </button>`).join('')}
    </section>
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

function hiveDetailHeroPhoto(h){
  const s=state();
  const idx=Math.max(0,s.hives.findIndex(x=>x.id===h.id));
  return `hive_detail_${(idx%3)+1}.jpg`;
}

function hiveDetail(r,id){
  const s=state(),h=hive(s,id);if(!h){go('hives');return}
  r.innerHTML=`<div class="master-screen detail-master">
    <section class="detail-hero-master">
      <div class="detail-photo-master">
        <img src="${hiveDetailHeroPhoto(h)}" alt="${esc(h.name)} hive at ${esc(h.location||'apiary')}">
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
