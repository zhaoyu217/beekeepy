
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


const MASTER_ASSETS={
  homeLandscape:"data:image/jpeg;base64,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",
  detailHero:"data:image/jpeg;base64,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",
  comb1:"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAyAD4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9TttDL3zXA+Nfjv8ADH4e+KLDwb4t8QSWWp6jbpdoos5pIoYHn8hZZpUUpChl+Tc5AzW14X8feFPGvh2PxX4b123u9Km3bbgt5YXa5Q7g2CvzKQM4zSsO50e0+tKFOCTWLB4r8N3Oqahotv4k02TUNJihnvrVbpDLbRygmN5Fz8qsASCetaUV5A0ywC5hLsm9UEiliv8AeAznHvSsFyYqc9acFJpSMnPrSjikFxm1s9aNp9f1p+eM0uBmgLnjfjT9nfQviB8YbX4h+L7ua70m10GDSU0qG7uLdJpkvXuN04jZVniIZR5UgKkqcgg149J+wpcaRHb3Hh/xFoIkWKOXU9OvNPlk07XriPUbq5jW/jDfvYhHdBAMHDQxnBUbR9VeJvFXh3wlZNqXiXWbTTbRf+WtxIFHTt61xGoftIfs/wBhardX3xg8MQROcK0l+oBOOlTKrCHxNIqMZP4UeE237DfiDSLe3ksPEfhjWJY7DQBeJrGnTNHqc+ni4R7a42sWe0dJ0ZVbcVa3iyGA46H4G/speKvhF8UNF8XzeN9P1Gz07w6ukXrtBNJdXsgRFVFMpYW8Me07fLf5l2h0yNx9OsP2nf2c9RkENr8a/CkshHCLqKZ79ifatSD44fBu8LNZ/E7w7MIwWcpfIdoHUn6YNZyxdFbzX3opUaklflf3Hoa896Xgc1xMHxj+FVwqmDx7pEu5N4KTggr6jHao2+NHwrRZXl8d6SiQoZJGabARR1J9q0dSEVdtEKEpOyR3OQO9KTzweK8z/wCGi/gSbNL6P4q6A0EjlEcXIwzDqBXc6D4g0XxNpcOs+H9VttRsZxmO4t5A6N+NTCtTqaQkn6O45U5w+JNHzJ+0f430y3+I954b1i9ezS10WKaKaSMtEBJv3rgc5PGfb6V8pfEPwhreq6dBf/D/AE+fXdIsbmd5cL5UswZR5nlxNl3jQKRuByS3FfTH7RWpaRefGS/8NXtnY3VxLpMLxqY83KAxNlo224z0wM9zXF+C/D2r2Xg6Cx8PW0DXums4WTUUKQWpjDsd7ADGHyQT1646V8zj8WniHQqv3ddP+CevhMP+69rFa/10PmHw/wCF9OTxDfa9rl7cx2q3gktEiGJpZljONgK8BD1B6nr0r08/CmLxLYwap4b8SXtkmp+WkxmJWPGX3AyKgwV5GB9/HXmuhm+FXh3xDeWF34g1u+uW8R6k8DazabBaQFkcyTbmUeYWYMCDgKQK6W4n0bwt4WfVpPiBOX07TLzRbK78hLe0tYEJWJ0t8HzZmCsSwOeM9DXzssRCcE21fRK/l/n+ex7UcNKMnGK030/rocB4T+J2heFJdT8Ew6zfSrb5W11DU42hWdcsDHGGA8tSwwoPGBnOKs2nieHxdfTeGbGGdkKBryYuPLW23kER95t5GMgYA56V4/4k8SxaXpEg1DxNqOuae0bGO8v2E0LSsrJG5mkUMplTKNFjMe3OcnNcZ4T8fx+H7TS/G1sTqeuabMlnb2ltIwijgjQqVlOP9VjhAv3sZbJNbSqYucHQlN8u33rvZf8AA9CVh8NF+1jHXdfLyPqwQaDp+tSWC2UNl9njVbKV3KwAAHdlsYyDwGOWNfQ/7Jfihtc1vXbFNRuryOCyhaSWRFSGeQSFQ8YHXj5ST1xXyDqvjHwV4ksdPufE1nfrGLTzRptjIINp5O2RyPnIyMH14Fe6/wDBPCW4uPFfjiZtQhaMW1urWjczwHzG27mx8w2459Qa3ynMo1sdTpQVle21ujObHYGVLDzqTd3vv5owv293exv/ABpqNkxt7pdE01RPEdkgG88bhzWFr+o6hN4T8BWs19cPDqFnYNeRtKxW4JTkyDOHP1zRRXncUf7wv8T/ACR3ZD/C+78zTgAM0tqQDDFc6oUjP3UJ64HQZrxL9pmWS3+J+l2VvI0VvKHmeJDtRnUkKxUcEgdD1oory8p/35ej/Q9HGfwV/XVnlGkImpeK9VstRUXVv/akzeVMN6ZMbZO08ZNb2m6TpSa3ewpplosaztIEEKhQyrw2MdR2NFFe/mP2/VHm4PaHozAvJJJnvzNIzn7WD8xzyM4NfU3/AASdlln8a/ECWaV5HfS7QszMST+/k6k0UVvw9/Fh6/oY5t/Dn6f5H//Z",
  comb2:"data:image/jpeg;base64,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",
  comb3:"data:image/jpeg;base64,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",
  timeline1:"data:image/jpeg;base64,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",
  timeline2:"data:image/jpeg;base64,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",
  map:"data:image/jpeg;base64,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"
};

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
  const s=state(),top=idq('topbar'),bottom=idq('bottomnav');
  top.className='topbar';

  const back=`<button type="button" class="iconbtn backbtn" onclick="history.back()" aria-label="Back">‹</button>`;
  const filterIcon=`<button type="button" class="iconbtn filterbtn" aria-label="Filter">⌑</button>`;

  if(page==='home'){
    top.innerHTML=`<button type="button" class="iconbtn" onclick="go('settings')" aria-label="Settings">${icon('settings')}</button>
      <div class="brand"><span class="brand-hive">${icon('hive')}</span><span>HiveDash</span></div>
      <button type="button" class="iconbtn" onclick="go('notifications')" aria-label="Notifications">${icon('bell')}${unread(s)?`<span class="badge">${unread(s)}</span>`:''}</button>`;
  }else if(page==='hives'){
    top.innerHTML=`<button type="button" class="iconbtn" onclick="go('settings')" aria-label="Settings">${icon('settings')}</button>
      <div class="pagebar-title">Hives</div>
      <button type="button" class="iconbtn plusbtn" onclick="addHive()" aria-label="Add Hive">+</button>`;
  }else if(page==='hive'){
    top.innerHTML=`${back}<div class="pagebar-title">Hive Detail</div><button type="button" class="iconbtn menu-btn">•••</button>`;
  }else if(page==='inspection'){
    top.innerHTML=`${back}<div class="pagebar-title">Inspection</div><button type="button" class="save-head-btn" onclick="saveInspectionPage()">Save</button>`;
  }else if(page==='timeline'){
    top.innerHTML=`${back}<div class="pagebar-title">Timeline</div>${filterIcon}`;
  }else if(page==='honey'){
    top.innerHTML=`${back}<div class="pagebar-title">Harvest</div><button type="button" class="iconbtn plusbtn" onclick="actionForm('harvest')">+</button>`;
  }else if(page==='map'){
    top.innerHTML=`${back}<div class="pagebar-title">Map</div>${filterIcon}`;
  }else if(page==='insights'){
    top.innerHTML=`${back}<div class="pagebar-title">Insights</div><button type="button" class="iconbtn plusbtn" onclick="${isPro(s)?"go('analysis')":"requirePro('Health Analysis')"}">+</button>`;
  }else if(page==='actions'){
    top.innerHTML=`<span></span><div class="pagebar-title">Actions</div><span></span>`;
  }else{
    top.innerHTML=`${back}<div class="pagebar-title">${page==='settings'?'Settings':page==='notifications'?'Notifications':page==='subscription'?'HiveDash Pro':page==='season'?'Season Intelligence':page==='trend'?'Trends':page==='risk'?'Risk Prediction':page==='analysis'?'Health Analysis':''}</div><span></span>`;
  }

  const locked=['home','hives','hive','inspection','timeline','honey','map','insights','actions'];
  bottom.classList.toggle('hidden',!locked.includes(page));

  const active = page==='map'||page==='hive'?'hives':page==='inspection'?'actions':page==='timeline'||page==='honey'?'insights':page;
  bottom.innerHTML=[
    ['home','Home','home'],
    ['hives','Hives','hive'],
    ['actions','Actions','check'],
    ['insights','Insights','chart']
  ].map(([key,label,ico])=>`<button class="navitem ${active===key?'active':''}" onclick="go('${key}')">${icon(ico)}<span>${label}</span>${key==='actions'&&s.actions.length?`<i class="nav-badge">${Math.min(9,s.actions.length)}</i>`:''}</button>`).join('')+`<i class="home-indicator"></i>`;
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
  const view=idq('view');
  const locked=['home','hives','hive','inspection','timeline','honey','map','insights','actions'];
  const secondary=!locked.includes(page);
  view.className=`view ${secondary?'secondary':'main'}`;

  if(page==='home')home(view);
  else if(page==='hives')hives(view);
  else if(page==='actions')actions(view);
  else if(page==='insights')insights(view);
  else if(page==='all-hives')allHives(view);
  else if(page==='hive')hiveDetail(view,id);
  else if(page==='inspection')inspectionPage(view,id);
  else if(page==='timeline')timelinePage(view);
  else if(page==='map')mapPage(view);
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
  else if(page==='support')infoPage(view,'Support');
  else {location.hash='home';return}
  chrome(page,secondary);
}
function home(r){
  const s=state(),score=avgHealth(s);
  const strong=s.hives.filter(h=>h.status==='Healthy').length;
  const attention=s.hives.filter(h=>h.status==='Attention').length;
  const critical=s.hives.filter(h=>h.status==='Critical').length;
  const action=s.actions[0]||null,ah=action?hive(s,action.hiveId):null;
  const riskCards=[...s.hives].filter(h=>h.status!=='Healthy').sort((a,b)=>a.score-b.score);
  const allRisks=(riskCards.length?riskCards:s.hives).slice(0,4);
  const C=2*Math.PI*44,D=C*score/100;

  r.innerHTML=`<div class="screen home-locked">
    <section class="home-card overview-card">
      <div class="section-title">Hive Overview <span class="info-dot">i</span></div>
      <div class="overview-lock">
        <img class="overview-landscape" src="${MASTER_ASSETS.homeLandscape}" alt="">
        <div class="home-score">
          <svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="44" class="ring-track"/><circle cx="55" cy="55" r="44" class="ring-progress" stroke-dasharray="${D} ${C-D}"/></svg>
          <div><strong>${score}<small>%</small></strong><b>Good</b><span>Overall Health</span></div>
        </div>
        <div class="overview-metrics">
          <button onclick="go('all-hives')"><i class="metric-hive">${icon('hive')}</i><span>Total Hives</span><b>${s.hives.length}</b></button>
          <button onclick="go('all-hives')"><i class="dot g"></i><span>Strong</span><b class="g">${strong}${s.hives.length?` <em>(${Math.round(strong/s.hives.length*100)}%)</em>`:''}</b></button>
          <button onclick="go('all-hives')"><i class="dot a"></i><span>Needs Attention</span><b class="a">${attention}${s.hives.length?` <em>(${Math.round(attention/s.hives.length*100)}%)</em>`:''}</b></button>
          <button onclick="go('all-hives')"><i class="dot r"></i><span>Critical</span><b class="r">${critical}${s.hives.length?` <em>(${Math.round(critical/s.hives.length*100)}%)</em>`:''}</b></button>
        </div>
      </div>
      <button class="view-all-hives" onclick="go('all-hives')"><i>${icon('hive')}</i><span><b>View All Hives</b><small>Check detailed hive status</small></span><em>›</em></button>
    </section>

    <section class="home-section action-center-lock">
      <div class="section-title">Action Center</div>
      ${action?`<div class="action-lock">
        <i class="action-symbol">${icon('check')}</i>
        <span><b>${esc(action.title)}</b><small>${esc(ah?.name||'Hive')} · Last inspection: ${ah?daysSince(ah.lastInspection):'—'} days ago</small></span>
        <button onclick="${action.type==='Inspection'?"go('inspection/"+action.hiveId+"')":action.type==='Feeding'?"actionForm('feeding','"+action.hiveId+"')":"actionForm('treatment','"+action.hiveId+"')"}">${action.type==='Inspection'?'Inspect Now':action.type==='Feeding'?'Record Feeding':'Start Treatment'}</button>
      </div><div class="action-meta-lock"><span>▣ &nbsp;Due: <b>${esc(action.due)}</b></span><span>◷ &nbsp;Est. time: 15 min</span><button onclick="go('all-actions')">View All Actions ›</button></div>`:'<div class="empty-note">No urgent action right now.</div>'}
    </section>

    <section class="home-section">
      <div class="title-action"><div class="section-title">Risk Alerts</div><button onclick="go('hives')">View All Alerts ›</button></div>
      <div class="risk-master-scroll">
        ${allRisks.map(h=>`<button class="risk-master-card" onclick="go('hive/${h.id}')"><i class="${h.status==='Critical'?'red':'amber'}">!</i><span><b>${esc(h.name)}</b><small>${h.queen!=='Confirmed'?'Queen status unconfirmed':h.varroa>=3?'Varroa test overdue':h.honey==='Low'||h.pollen==='Low'?'Low food stores':'Review hive health'}</small></span><strong class="${h.status==='Critical'?'red':'amber'}">${h.status==='Critical'?'High Risk':'Medium Risk'}</strong><em>›</em></button>`).join('')}
      </div>
      <div class="pager-dots"><i class="active"></i><i></i><i></i><i></i><i></i></div>
    </section>

    <section class="home-section">
      <div class="title-action"><div class="section-title">Season Intelligence</div><button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">Spring Build-Up ›</button></div>
      <div class="season-master-row">
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><i>✿</i><b>Nectar Flow</b><span>Good</span><small>Flow is strong in your area</small><em>Learn more ›</em></button>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><i>♧</i><b>Swarm Watch</b><span>Low Risk</span><small>High swarm risk in 2–4 weeks</small><em>Learn more ›</em></button>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><i>${icon('hive')}</i><b>Add Super Soon</b><span class="amber">Recommended</span><small>Prepare to add honey super</small><em>Learn more ›</em></button>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><i>◉</i><b>Varroa Rising</b><span class="amber">Elevated</span><small>Increase monitoring frequency</small><em>Learn more ›</em></button>
      </div>
      <div class="pager-dots"><i class="active"></i><i></i><i></i><i></i></div>
    </section>

    <section class="home-section quick-lock">
      <div class="section-title">Quick Actions</div>
      <div class="quick-row-lock">
        <button onclick="go('inspection/${s.hives[0]?.id||''}')"><i>${icon('check')}</i><b>Inspection</b><small>Record hive inspection</small></button>
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
  r.innerHTML=`<div class="screen hives-locked">
    <div class="search-lock"><span>⌕</span><input id="mainHiveSearch" placeholder="Search hives"></div>
    <div class="filter-lock">
      <button class="active" data-filter="all">All (${s.hives.length})</button>
      <button data-filter="Healthy">Healthy (${s.hives.filter(h=>h.status==='Healthy').length})</button>
      <button data-filter="Attention">Attention (${s.hives.filter(h=>h.status==='Attention').length})</button>
      <button data-filter="Critical">Critical (${s.hives.filter(h=>h.status==='Critical').length})</button>
    </div>
    <div id="mainHiveList" class="hive-list-lock"></div>
  </div>`;
  let filter='all';
  const draw=()=>{const q=idq('mainHiveSearch').value.toLowerCase();idq('mainHiveList').innerHTML=ordered.filter(h=>(filter==='all'||h.status===filter)&&h.name.toLowerCase().includes(q)).map(h=>hiveCard(h)).join('')};
  idq('mainHiveSearch').oninput=draw;
  r.querySelectorAll('.filter-lock button').forEach(b=>b.onclick=()=>{r.querySelectorAll('.filter-lock button').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;draw()});
  draw()
}
function hiveCard(h){
  const tone=h.status==='Healthy'?'good':h.status==='Attention'?'attention':'critical';
  const label=h.status==='Healthy'?'Good':h.status==='Attention'?'Needs Attention':'Critical';
  return `<button type="button" class="hive-card-lock" onclick="go('hive/${h.id}')">
    <div class="small-score-ring ${tone}" style="--p:${h.score}"><span>${h.score}%</span></div>
    <div class="hive-copy-lock"><b>${esc(h.name)}</b><small>Location: ${esc(h.location||'North Field')}</small><small>Last inspection: ${fmtDate(h.lastInspection)}, 2025</small><div><span>♧ ${h.strength==='Strong'?8:h.strength==='Medium'?6:4}</span><span>✿ ${h.brood==='Excellent'?7:h.brood==='Good'?6:4}</span><span>▣ ${h.honey==='High'?3:h.honey==='Medium'?2:1}</span></div></div>
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


let activeInspectionHive=null;
function inspectionPage(r,id){
  const s=state(),h=hive(s,id)||s.hives[0];activeInspectionHive=h?.id||null;
  if(!h){r.innerHTML='<div class="small muted">No hive available.</div>';return}
  r.innerHTML=`<div class="screen inspection-locked">
    <section class="inspection-hive-card"><i>${icon('hive')}</i><span><b>${esc(h.name)}</b><small>May 10, 2025 · 9:30 AM</small></span></section>
    <section class="quick-entry"><span><b>Quick Entry</b><small>Use voice or quick inputs to save time</small></span><i>♩</i></section>
    <section class="inspection-list">
      <button><span>Queen Status</span><b>Seen laying</b><em>›</em></button>
      <div class="slider-row"><span>Colony Strength</span><i><u style="left:78%"></u></i><b>8 / 10</b><em>›</em></div>
      <button><span>Brood Pattern</span><b>Good</b><em>›</em></button>
      <div class="slider-row"><span>Honey Stores</span><i><u style="left:70%"></u></i><b>7 / 10</b><em>›</em></div>
      <button><span>Pollen Stores</span><b>Medium</b><em>›</em></button>
      <button><span>Queen Cells</span><b>None</b><em>›</em></button>
      <button><span>Varroa Level</span><b>Low</b><em>›</em></button>
      <button><span>Disease / Issues</span><b>None</b><em>›</em></button>
      <button><span>Super On / Off</span><b>On (1 Super)</b><em>›</em></button>
      <button><span>Treatments</span><b>None</b><em>›</em></button>
      <button><span>Feeding</span><b>None</b><em>›</em></button>
      <button><span>Notes</span><b class="placeholder">Add notes...</b><em>›</em></button>
      <button><span>Photos</span><b>Add photos</b><em>▣</em></button>
    </section>
  </div>`
}
function saveInspectionPage(){
  const s=state(),h=hive(s,activeInspectionHive);if(!h)return;
  const date=new Date().toISOString().slice(0,10);
  h.lastInspection=date;
  s.logs.inspections.push({id:'i'+Date.now(),hiveId:h.id,date,score:h.score,queen:h.queen,strength:h.strength,brood:h.brood,notes:'Inspection saved'});
  save(s);toast('Saved');go('hive/'+h.id)
}

function insights(r){
  const s=state(),strong=s.hives.filter(h=>h.status==='Healthy').length,attention=s.hives.filter(h=>h.status==='Attention').length,critical=s.hives.filter(h=>h.status==='Critical').length;
  r.innerHTML=`<div class="screen insights-locked">
    <div class="year-select"><button>This Year⌄</button></div>
    <div class="insight-tabs"><button class="active">Overview</button><button>Colony Health</button><button onclick="go('honey')">Harvest</button><button onclick="go('trend')">Trends</button></div>
    <section class="colony-summary"><b>Colony Health Summary</b><div class="summary-grid"><div class="summary-ring"><i></i></div><div class="legend"><span><i class="g"></i>Strong <b>50% (${strong||2})</b></span><span><i class="a"></i>Needs Attention <b>25% (${attention||1})</b></span><span><i class="r"></i>Critical <b>25% (${critical||1})</b></span></div></div></section>
    <section class="health-over-time"><b>Health Over Time</b><svg viewBox="0 0 320 120"><polyline points="10,48 50,65 90,45 130,60 170,40 210,55 250,35 310,50" fill="none" stroke="#5E7350" stroke-width="2"/><polyline points="10,75 50,65 90,78 130,68 170,73 210,52 250,60 310,65" fill="none" stroke="#C5921A" stroke-width="1.7"/><polyline points="10,85 50,82 90,72 130,83 170,70 210,80 250,67 310,74" fill="none" stroke="#D94B43" stroke-width="1.7"/></svg><div class="months"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span></div></section>
    <section class="top-actions"><b>Top Actions This Year</b><div><span>▣ Inspections</span><strong>24</strong></div><div><span>◉ Feedings</span><strong>18</strong></div><div><span>✚ Treatments</span><strong>7</strong></div><div><span>⌁ Harvests</span><strong>12</strong></div></section>
  </div>`
}
function timelinePage(r){
  const s=state(),h1=s.hives[0],h2=s.hives[1];
  r.innerHTML=`<div class="screen timeline-locked">
    <div class="timeline-search"><span>⌕</span><input placeholder="Search timeline"></div>
    <div class="timeline-filters"><button class="active">All</button><button>${esc(h1?.name||'Oak Meadow')}</button><button>${esc(h2?.name||'Pine Ridge')}</button><button>All Types⌄</button></div>
    <div class="timeline-month">May 2025</div>
    <div class="event"><div class="event-date">May 10</div><i class="event-dot green">▣</i><button onclick="go('hive/${h1?.id||''}')"><b>Inspection</b><span>9:30 AM</span><small>${esc(h1?.name||'Oak Meadow')}</small><p>Strength 8/10, Queen seen laying.<br>Added 1 super.</p><img src="${MASTER_ASSETS.timeline1}"></button></div>
    <div class="event"><div class="event-date">May 5</div><i class="event-dot green">▣</i><button><b>Feeding</b><span>2:15 PM</span><small>${esc(h1?.name||'Oak Meadow')}</small><p>1:1 Super Syrup<br>2 Liters</p></button></div>
    <div class="event"><div class="event-date">Apr 28</div><i class="event-dot green">▣</i><button><b>Treatment</b><span>10:00 AM</span><small>${esc(h1?.name||'Oak Meadow')}</small><p>Oxalic Acid (Dribble)<br>Varroa treatment</p></button></div>
    <div class="event"><div class="event-date">Apr 20</div><i class="event-dot green">⌂</i><button><b>Inspection</b><span>11:30 AM</span><small>${esc(s.hives[2]?.name||'Sunset Hill')}</small><p>Queen not seen, queen cells found.<br>Monitor closely.</p><img src="${MASTER_ASSETS.timeline1}"></button></div>
    <div class="timeline-month">April 2025</div>
    <div class="event"><div class="event-date">Apr 15</div><i class="event-dot amber">⌁</i><button><b>Harvest</b><span>9:00 AM</span><small>${esc(h2?.name||'Pine Ridge')}</small><p>Harvested 2 supers<br>Total: 48 lb</p><img src="${MASTER_ASSETS.timeline2}"></button></div>
  </div>`
}
function mapPage(r){
  const s=state();
  r.innerHTML=`<div class="screen map-locked">
    <div class="map-tabs"><button class="active">Apiaries</button><button>Hives</button><button>Forage</button></div>
    <section class="map-image-wrap"><img src="${MASTER_ASSETS.map}" alt="Apiary map"><button class="locate">◇</button></section>
    <section class="apiary-list">
      <button onclick="go('hives')"><i>${icon('hive')}</i><span><b>North Field</b><small>Last inspection: May 10, 2025</small></span><strong>${Math.max(1,Math.ceil(s.hives.length/2))} hives</strong><em>›</em></button>
      <button onclick="go('hives')"><i>${icon('hive')}</i><span><b>East Field</b><small>Last inspection: Apr 28, 2025</small></span><strong>${Math.max(1,Math.floor(s.hives.length/2))} hives</strong><em>›</em></button>
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
  const s=state(),total=s.logs.harvests.reduce((n,x)=>n+Number(x.weightLb||0),0),avg=s.logs.harvests.length?s.logs.harvests.reduce((n,x)=>n+Number(x.moisture||0),0)/s.logs.harvests.length:17.2;
  const bars=[2,3,5,38,78,60,88,70,3,2,2,2];
  r.innerHTML=`<div class="screen harvest-locked">
    <div class="year-select"><button>This Year⌄</button></div>
    <div class="harvest-kpis"><div><small>Total Harvest</small><b>${Math.round(total)||248} lb</b></div><div><small>Total Batches</small><b>${s.logs.harvests.length||12}</b></div><div><small>Avg Moisture</small><b>${avg.toFixed(1)}%</b></div></div>
    <section class="harvest-chart-section"><b>Harvest Over Time (lb)</b><div class="bars">${bars.map((v,i)=>`<div><i style="height:${v}%"></i><span>${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}</span></div>`).join('')}</div><div class="pager-dots"><i class="active"></i><i></i><i></i></div></section>
    <section class="recent-batches"><div class="detail-section-head"><b>Recent Batches</b><button>View All</button></div>
      <div><span>▣ &nbsp;May 12, 2025</span><span>${esc(s.hives[0]?.name||'Oak Meadow')}</span><b>28 lb</b><small>16.8%</small></div>
      <div><span>▣ &nbsp;May 6, 2025</span><span>${esc(s.hives[1]?.name||'Pine Ridge')}</span><b>24 lb</b><small>17.1%</small></div>
      <div><span>▣ &nbsp;May 1, 2025</span><span>${esc(s.hives[0]?.name||'Oak Meadow')}</span><b>26 lb</b><small>16.5%</small></div>
    </section>
  </div>`
}
function seasonPage(r){
  const s=state();if(!isPro(s)){subscriptionModal('Season Intelligence');go('home');return}
  r.innerHTML=`<section><button type="button" class="btn secondarybtn" onclick="go('home')">← Home</button><div class="h1" style="margin-top:12px">Season Intelligence</div><div class="tiny muted">${esc(s.settings.location)} · ${new Date().toLocaleDateString('en-US',{month:'long'})}</div></section><section class="setting"><div class="srow"><div class="scopy"><b>Monitor mites closely</b><div class="tiny muted">Prioritize colonies with elevated Varroa or overdue checks.</div></div><span class="pill warn">Priority</span></div><div class="srow"><div class="scopy"><b>Review food stores</b><div class="tiny muted">Follow up on low honey or pollen stores before the next seasonal transition.</div></div></div><div class="srow"><div class="scopy"><b>Confirm queen status</b><div class="tiny muted">Recheck colonies where queen status remains uncertain.</div></div></div></section><div class="notice">V9 uses date, location setting and hive records. Real weather/bloom APIs are still required for production-grade recommendations.</div>`
}

function hiveDetail(r,id){
  const s=state(),h=hive(s,id);if(!h){go('hives');return}
  r.innerHTML=`<div class="screen detail-locked">
    <section class="detail-hero-lock">
      <img src="${MASTER_ASSETS.detailHero}" alt="">
      <div class="detail-name"><b>${esc(h.name)}</b><small>${esc(h.location||'North Field')}</small></div>
      <div class="small-score-ring detail-score ${h.status==='Healthy'?'good':h.status==='Attention'?'attention':'critical'}" style="--p:${h.score}"><span>${h.score}%</span></div>
      <div class="detail-good">${h.status==='Healthy'?'Good':h.status}</div>
    </section>
    <div class="detail-dates"><span>Last inspection: ${fmtDate(h.lastInspection)}, 2025</span><span>Next due: May 24, 2025</span></div>
    <div class="detail-metrics">
      <div><i>♛</i><b>Queen</b><small>${h.queen==='Confirmed'?'Good':h.queen}</small></div>
      <div><i>♧</i><b>Strength</b><small>${h.strength==='Strong'?'8 / 10':h.strength}</small></div>
      <div><i>✿</i><b>Brood</b><small>${h.brood}</small></div>
      <div><i>▣</i><b>Honey</b><small>${h.honey==='High'?'7 / 10':h.honey}</small></div>
      <div><i>▣</i><b>Pollen</b><small>${h.pollen}</small></div>
    </div>
    <section class="detail-section"><div class="detail-section-head"><span><b>Recent Trend</b><small>Last 5 inspections</small></span><button onclick="go('trend')">View All</button></div>
      <svg class="detail-chart" viewBox="0 0 320 105"><polyline points="18,62 65,45 112,58 160,42 207,48 255,35 302,43" fill="none" stroke="#5E7350" stroke-width="2"/><polyline points="18,77 65,66 112,73 160,63 207,68 255,56 302,61" fill="none" stroke="#C5921A" stroke-width="1.7"/><polyline points="18,52 65,55 112,46 160,54 207,45 255,48 302,41" fill="none" stroke="#91A982" stroke-width="1.4"/></svg>
    </section>
    <section class="detail-section"><div class="detail-section-head"><b>Photos</b><button>View All</button></div><div class="detail-photos"><img src="${MASTER_ASSETS.comb1}"><img src="${MASTER_ASSETS.comb2}"><img src="${MASTER_ASSETS.comb3}"><button>+12</button></div></section>
    <section class="detail-section"><div class="detail-section-head"><b>Treatments & Feeding</b><button>View All</button></div><button class="treatment-row" onclick="actionForm('treatment','${h.id}')"><i>◉</i><span><b>${esc(s.logs.treatments.filter(x=>x.hiveId===h.id).slice(-1)[0]?.type||'Oxalic Acid (Dribble)')}</b><small>Apr 29, 2025</small></span><em>›</em></button></section>
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
