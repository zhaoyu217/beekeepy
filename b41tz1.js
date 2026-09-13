/* ==============================================================
   HiveDash V2P2E5B41TZ1 — B41 Swarm Control business-date closure

   Scope ONLY:
   1) B41 New Action Due Date defaults to the selected Hive's effective
      US local calendar date, never the browser/device calendar date.
   2) B41 Pending Actual Result Completed Date and default Follow-up Date
      use the same Hive-local calendar date (+7 date-only days).
   3) Existing user-entered dates and already-saved actions/results are not
      rewritten.

   Safety:
   - No B41 business workflow, gates, persistence schema or outcome logic changes.
   - No R08/R09 decision logic changes.
   - UTC ISO timestamps remain unchanged for audit fields.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5B41TZ1__) return;
  window.__HIVEDASH_V2P2E5B41TZ1__=true;
  window.__HIVEDASH_V2P2E5B41TZ1_VERSION__='v2p2e5b41tz1-hive-local-business-date';

  const CREATE_KEY='hivedash_b41_swarm_create_draft';
  const RESULT_PREFIX='hivedash_b41_swarm_result_';
  const SEED_KEY='hivedash_b41tz1_seed_create';
  const VALID_TZ=['America/New_York','America/Chicago','America/Denver','America/Phoenix','America/Los_Angeles','America/Anchorage','Pacific/Honolulu'];
  const TZ_SUFFIX={New_York:'America/New_York',Chicago:'America/Chicago',Denver:'America/Denver',Phoenix:'America/Phoenix',Los_Angeles:'America/Los_Angeles',Anchorage:'America/Anchorage',Honolulu:'Pacific/Honolulu'};
  const STATE_TZ={
    AL:'America/Chicago',AK:'America/Anchorage',AZ:'America/Phoenix',AR:'America/Chicago',CA:'America/Los_Angeles',
    CO:'America/Denver',CT:'America/New_York',DE:'America/New_York',DC:'America/New_York',FL:'America/New_York',
    GA:'America/New_York',HI:'Pacific/Honolulu',ID:'America/Denver',IL:'America/Chicago',IN:'America/New_York',
    IA:'America/Chicago',KS:'America/Chicago',KY:'America/New_York',LA:'America/Chicago',ME:'America/New_York',
    MD:'America/New_York',MA:'America/New_York',MI:'America/New_York',MN:'America/Chicago',MS:'America/Chicago',
    MO:'America/Chicago',MT:'America/Denver',NE:'America/Chicago',NV:'America/Los_Angeles',NH:'America/New_York',
    NJ:'America/New_York',NM:'America/Denver',NY:'America/New_York',NC:'America/New_York',ND:'America/Chicago',
    OH:'America/New_York',OK:'America/Chicago',OR:'America/Los_Angeles',PA:'America/New_York',RI:'America/New_York',
    SC:'America/New_York',SD:'America/Chicago',TN:'America/Chicago',TX:'America/Chicago',UT:'America/Denver',
    VT:'America/New_York',VA:'America/New_York',WA:'America/Los_Angeles',WV:'America/New_York',WI:'America/Chicago',WY:'America/Denver'
  };
  const STATE_NAME_CODE={Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE','District of Columbia':'DC',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY'};
  const LOCALIZED_TZ={'纽约':'America/New_York','芝加哥':'America/Chicago','丹佛':'America/Denver','凤凰城':'America/Phoenix','洛杉矶':'America/Los_Angeles','安克雷奇':'America/Anchorage','檀香山':'Pacific/Honolulu','火奴鲁鲁':'Pacific/Honolulu'};

  const txt=v=>String(v??'').trim();
  const S=()=>typeof v45s==='function'?v45s():(typeof state==='function'?state():{});
  function readJson(key){try{const x=JSON.parse(localStorage.getItem(key)||'null');return x&&typeof x==='object'?x:null}catch(_){return null}}
  function writeJson(key,obj){try{localStorage.setItem(key,JSON.stringify(obj));return true}catch(_){return false}}
  function validTz(tz){
    tz=txt(tz); if(!tz) return false;
    try{new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric'}).format(new Date(0));return true}catch(_){return false}
  }
  function cleanKnownTz(raw){
    const x=txt(raw); if(!x) return '';
    if(validTz(x)) return x;
    const suffix=x.split('/').pop();
    if(TZ_SUFFIX[suffix]) return TZ_SUFFIX[suffix];
    for(const [needle,tz] of Object.entries(LOCALIZED_TZ)) if(x.includes(needle)) return tz;
    return '';
  }
  function hasLoc(loc){return !!(loc&&typeof loc==='object'&&(txt(loc.timezone)||txt(loc.stateCode)||txt(loc.state)||txt(loc.city)))}
  function effectiveLoc(s,h){
    const cur=h?.currentLocation;
    if(hasLoc(cur)) return cur;
    const api=s?.settings?.apiaryLocation;
    if(hasLoc(api)) return api;
    return {};
  }
  function stateCode(loc){
    const code=txt(loc?.stateCode).toUpperCase();
    if(STATE_TZ[code]) return code;
    const name=txt(loc?.state);
    return STATE_NAME_CODE[name]||'';
  }
  function timezoneFor(hiveId){
    const s=S(),h=(s.hives||[]).find(x=>x&&txt(x.id)===txt(hiveId))||null,loc=effectiveLoc(s,h);
    const direct=cleanKnownTz(loc?.timezone);
    if(direct) return direct;
    const code=stateCode(loc);
    if(code&&STATE_TZ[code]) return STATE_TZ[code];
    for(const raw of [s?.settings?.apiaryLocation?.timezone,s?.settings?.region?.timezone,s?.settings?.timezone]){
      const z=cleanKnownTz(raw); if(z) return z;
    }
    return 'America/Denver';
  }
  function dateInTz(tz,when){
    const d=when instanceof Date?when:new Date(when||Date.now());
    const safe=Number.isNaN(d.getTime())?new Date():d;
    const use=validTz(tz)?tz:'America/Denver';
    try{
      const p=new Intl.DateTimeFormat('en-US',{timeZone:use,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(safe);
      const get=t=>p.find(x=>x.type===t)?.value||'';
      const y=get('year'),m=get('month'),day=get('day');
      if(y&&m&&day) return `${y}-${m}-${day}`;
    }catch(_){ }
    // Never fall back to device-local calendar date for business dates.
    const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(safe);
    const get=t=>p.find(x=>x.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function localDate(hiveId,when){return dateInTz(timezoneFor(hiveId),when)}
  function addDays(iso,n){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(iso)); if(!m) return iso;
    const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+Number(n||0)));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  function deviceDate(when){
    const d=when instanceof Date?when:new Date(when||Date.now());
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function legacyToday(hiveId){try{return typeof v2p2e5Today==='function'?txt(v2p2e5Today(S(),hiveId)):''}catch(_){return ''}}
  function route(){return txt(location.hash||'').replace(/^#/,'').split('?')[0]}
  function findAction(id){const s=S();return [...(s.actions||[]),...(s.meta?.completedActions||[])].find(a=>a&&txt(a.id)===txt(id))||null}

  window.v2p2e5b41Timezone=function(hiveId){return timezoneFor(hiveId)};
  window.v2p2e5b41LocalDate=function(hiveId,when){return localDate(hiveId,when)};
  window.v2p2e5b41DateAudit=function(hiveId,when){
    const at=when instanceof Date?when:new Date(when||Date.now());
    return {hiveId:txt(hiveId),timezone:timezoneFor(hiveId),hiveLocalDate:localDate(hiveId,at),deviceDate:deviceDate(at),instant:at.toISOString()};
  };

  function seedCreateDraft(force=false){
    const d=readJson(CREATE_KEY); if(!d||!txt(d.hiveId)) return;
    const correct=localDate(d.hiveId);
    if(force || !/^\d{4}-\d{2}-\d{2}$/.test(txt(d.dueDate))){d.dueDate=correct;writeJson(CREATE_KEY,d)}
    const input=document.getElementById('b41-due');
    const display=document.getElementById('b41-due-display');
    if(input&&force) input.value=correct;
    if(display&&force&&typeof fmtDate==='function') display.textContent=fmtDate(correct);
  }
  function consumeCreateSeed(){
    let seeded=false;try{seeded=sessionStorage.getItem(SEED_KEY)==='1'}catch(_){ }
    if(!seeded) return false;
    seedCreateDraft(true);
    try{sessionStorage.removeItem(SEED_KEY)}catch(_){ }
    return true;
  }

  function pristineResult(x){
    if(!x) return true;
    return ['controlCompleted','actualMethod','swarmOutcome','queenCellOutcome','resultNotes'].every(k=>{
      const v=txt(x[k]);
      return !v || v==='Not confirmed' || v==='Not recorded';
    });
  }
  function seedResultDraft(actionId){
    const a=findAction(actionId); if(!a||txt(a.type)!=='swarm-control'||txt(a.status)==='Completed'||a.resultData) return;
    const key=RESULT_PREFIX+txt(a.id),x=readJson(key),correct=localDate(a.hiveId),correctFollow=addDays(correct,7);
    const legacy=legacyToday(a.hiveId),dev=deviceDate(),legacyFollow=addDays(legacy||dev,7),devFollow=addDays(dev,7);
    if(!x){
      writeJson(key,{controlCompleted:'Not confirmed',actualMethod:'Not recorded',swarmOutcome:'Not recorded',queenCellOutcome:'Not recorded',completedDate:correct,followUpRequired:'No',followUpDate:correctFollow,resultNotes:''});
      return;
    }
    if(!pristineResult(x)) return;
    let changed=false;
    if(!txt(x.completedDate)||txt(x.completedDate)===dev||txt(x.completedDate)===legacy){if(txt(x.completedDate)!==correct){x.completedDate=correct;changed=true}}
    if(!txt(x.followUpDate)||txt(x.followUpDate)===devFollow||txt(x.followUpDate)===legacyFollow){if(txt(x.followUpDate)!==correctFollow){x.followUpDate=correctFollow;changed=true}}
    if(changed) writeJson(key,x);
  }
  function syncResultDom(actionId){
    const x=readJson(RESULT_PREFIX+txt(actionId)); if(!x) return;
    const date=txt(x.completedDate),follow=txt(x.followUpDate);
    const di=document.getElementById('b41-result-date'),dd=document.getElementById('b41-result-date-display');
    const fi=document.getElementById('b41-result-follow-date'),fd=document.getElementById('b41-result-follow-date-display');
    if(di&&date) di.value=date;
    if(dd&&date) dd.textContent=date.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$2/$3/$1');
    if(fi&&follow) fi.value=follow;
    if(fd&&follow) fd.textContent=follow.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$2/$3/$1');
  }


  const baseOpen=window.b41OpenSwarmAction;
  if(typeof baseOpen==='function'){
    window.b41OpenSwarmAction=function(){
      try{sessionStorage.setItem(SEED_KEY,'1')}catch(_){ }
      return baseOpen.apply(this,arguments);
    };
    try{b41OpenSwarmAction=window.b41OpenSwarmAction}catch(_){ }
  }
  const baseR09Open=window.v2p2e5r09OpenSwarmControl;
  if(typeof baseR09Open==='function'){
    window.v2p2e5r09OpenSwarmControl=function(){
      try{sessionStorage.setItem(SEED_KEY,'1')}catch(_){ }
      return baseR09Open.apply(this,arguments);
    };
  }

  const baseSet=window.b41SetDraft;
  if(typeof baseSet==='function'){
    window.b41SetDraft=function(key,val){
      const before=readJson(CREATE_KEY)||{},oldHive=txt(before.hiveId),oldDue=txt(before.dueDate);
      const wasAuto=!oldDue || oldDue===localDate(oldHive) || oldDue===legacyToday(oldHive) || oldDue===deviceDate();
      const ret=baseSet.apply(this,arguments);
      if(key==='hiveId'&&wasAuto&&txt(val)){
        const after=readJson(CREATE_KEY)||{};after.hiveId=txt(val);after.dueDate=localDate(val);writeJson(CREATE_KEY,after);
        const input=document.getElementById('b41-due'),display=document.getElementById('b41-due-display');
        if(input) input.value=after.dueDate;
        if(display) display.textContent=after.dueDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$2/$3/$1');
      }
      return ret;
    };
    try{b41SetDraft=window.b41SetDraft}catch(_){ }
  }

  const baseRender=window.render;
  if(typeof baseRender==='function'){
    window.render=function(){
      const r=route(),parts=r.split('/');
      if(parts[0]==='swarm-action'){
        if(parts[1]==='new') consumeCreateSeed();
        else if(parts[1]) seedResultDraft(parts[1]);
      }
      const ret=baseRender.apply(this,arguments);
      if(parts[0]==='swarm-action'&&parts[1]&&parts[1]!=='new') syncResultDom(parts[1]);
      return ret;
    };
    try{render=window.render}catch(_){ }
  }

  // If loaded while a B41 page is already open, correct only pristine auto defaults.
  try{
    const parts=route().split('/');
    if(parts[0]==='swarm-action'&&parts[1]&&parts[1]!=='new'){seedResultDraft(parts[1]);setTimeout(()=>syncResultDom(parts[1]),0)}
  }catch(_){ }

  console.log('V2P2E5B41TZ1 LOADED | B41 dates use Hive-local business date');
})();
