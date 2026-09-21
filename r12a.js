/* ==============================================================
   V2P2E5R12A — R12 / S24 ROBBING PREVENTION CORE

   CURRENT LAUNCH MAPPING (authoritative for this build):
   - Catalog rule R12 = Robbing-risk prevention
   - Catalog task S24 = Robbing Prevention

   Safety / scope contract:
   - The historical 2026-09-08 design file mapped launch R12 to Winter Prep/S29,
     but the later launch catalog mapping frozen by the project maps R12 -> S24.
     This module follows the later frozen mapping and does not rewrite S29.
   - Robbing risk is not inferred from a universal U.S. calendar. Automatic
     triggering requires a validated regional dearth profile plus explicit
     current colony vulnerability evidence.
   - v1.0 regional profiles are intentionally narrow: Northeast (Penn State),
     Mississippi (MSU Extension), and California (existing UC Davis dearth
     context already used by the adaptive inspection rule).
   - Weak-colony screening reuses the already-frozen HiveDash Health model lower
     colony-size band (<4/10). That cutoff is a HiveDash heuristic, not an
     Extension-published robbing threshold.
   - R12 first asks for targeted evidence. It does not claim robbing is occurring
     from season or colony size alone.
   - Management is B-level confirmation. HiveDash can explain evidence-backed
     prevention options, but the beekeeper chooses what was actually done.
   - A prevention record does not equal biological resolution. New targeted
     evidence is required for PASS; persistent signs return to management review.
   ============================================================== */
(function v2p2e5r12aRobbingPrevention(){
  if(window.__HIVEDASH_V2P2E5R12A__)return;
  window.__HIVEDASH_V2P2E5R12A__=true;

  const CORE_RULE_ID='HD-R12-ROBBING-PREVENTION';
  const RULE_VERSION='HD-R12-v1.0-2026-09-21';
  const MIGRATION_VERSION='V2P2E5R12A';
  const CATALOG_RULE_ID='R12';
  const CATALOG_TASK_ID='S24';
  const VERSION='v2p2e5r12a-r12-s24-robbing-prevention-core';
  const DRAFT_PREFIX='hivedash:v2p2e5r12:robbing-draft:';

  const base=window.HiveDashTaskEngineCoreV1;
  if(!base||typeof base.normalizeTaskProjection!=='function'||typeof base.buildContextSnapshot!=='function'){
    console.error('V2P2E5R12A requires HiveDashTaskEngineCoreV1');return;
  }

  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const iso=v=>/^\d{4}-\d{2}-\d{2}$/.test(txt(v).slice(0,10))?txt(v).slice(0,10):'';
  const esc=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const js=v=>txt(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ');
  const S=()=>{try{return typeof v45s==='function'?v45s():state()}catch(_){return null}};
  const active=s=>{try{return typeof v224ActiveTrackedHives==='function'?v224ActiveTrackedHives(s):(s?.hives||[]).filter(h=>h&&!h.archived&&!['combined','archived'].includes(low(h.lifecycleStatus||h.status)))}catch(_){return (s?.hives||[]).filter(Boolean)}};
  const hiveBy=(s,id)=>active(s).find(h=>txt(h.id)===txt(id))||null;
  const todayFor=(s,h)=>{try{return typeof v2p2e5Today==='function'?txt(v2p2e5Today(s,h?.id||'')):typeof v2p1bDateInHiveTimezone==='function'?txt(v2p1bDateInHiveTimezone(s,h)):new Date().toISOString().slice(0,10)}catch(_){return new Date().toISOString().slice(0,10)}};
  const addDays=(d,n)=>{const x=iso(d);if(!x)return'';const dt=new Date(x+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+Number(n||0));return dt.toISOString().slice(0,10)};
  const stamp=v=>{const n=Date.parse(txt(v));return Number.isFinite(n)?n:0};
  const orderMs=x=>stamp(x?.recordedAt)||stamp(x?.completedAt)||stamp(x?.updatedAt)||stamp(x?.createdAt)||stamp(iso(x?.date)?iso(x.date)+'T12:00:00Z':'')||0;
  const month=d=>Number(iso(d).slice(5,7)||0);
  const NORTHEAST=new Set(['CT','ME','MA','NH','RI','VT','NJ','NY','PA']);
  const unknown=v=>['','not assessed','not checked','not confirmed','unknown','not recorded','—','-','n/a'].includes(low(v));

  const SOURCES=Object.freeze({
    PENN_STATE:Object.freeze({id:'PSU-ROBBING-LATE-SUMMER',authority:'Penn State Extension',title:'Honey Bee Management Throughout the Seasons',summary:'During late-summer nectar dearth, strong colonies may rob smaller or weaker colonies; limiting inspections and robbing screens can reduce risk.',url:'https://extension.psu.edu/honey-bee-management-throughout-the-seasons'}),
    MSU:Object.freeze({id:'MSU-ROBBING-DEARTH',authority:'Mississippi State University Extension',title:'Mississippi Beekeeping',summary:'Robbing is more common during food dearth; exposed honey/syrup and prolonged opening can trigger robbing. Prevention is easier than stopping an established frenzy.',url:'https://extension.msstate.edu/publications/mississippi-beekeeping'}),
    MSU_BEGIN:Object.freeze({id:'MSU-INTERNAL-FEEDING',authority:'Mississippi State University Extension',title:'Beginning Beekeeping in Mississippi',summary:'Entrance feeders can attract robbers; placing syrup inside the hive reduces robbing exposure.',url:'https://extension.msstate.edu/publications/beginning-beekeeping-mississippi'}),
    CA:Object.freeze({id:'CA-LIMITED-DEARTH-WINTER',authority:'California Master Beekeeper Program, UC Davis',title:'California seasonal dearth context',summary:'California guidance limits inspections during nectar-dearth periods; this profile is reused from the frozen adaptive-inspection rule.',url:'https://cambp.ucdavis.edu/sites/g/files/dgvnsk2526/files/inline-files/backyard-beekeeper-ca.pdf'}),
    HIVE_DASH_WEAK:Object.freeze({id:'HIVEDASH-WEAK-COLONY-BAND',authority:'HiveDash Health & Decision Model v1.0',title:'Existing weak-colony screen',summary:'Colony size below 4/10 reuses the frozen HiveDash lower strength band. This is a product heuristic, not an Extension robbing threshold.'})
  });

  function inspections(s,hid){return (Array.isArray(s?.logs?.inspections)?s.logs.inspections:[]).map((r,index)=>({r,index})).filter(x=>x.r&&txt(x.r.hiveId)===txt(hid)&&x.r.legacySnapshot!==true).sort((a,b)=>orderMs(b.r)-orderMs(a.r)||b.index-a.index)}
  function latestInspection(s,hid){return inspections(s,hid)[0]||null}
  function checks(s,hid,episode=''){return (Array.isArray(s?.logs?.robbingEvaluations)?s.logs.robbingEvaluations:[]).filter(x=>x&&txt(x.hiveId)===txt(hid)&&txt(x.coreRuleId)===CORE_RULE_ID&&(!episode||txt(x.episodeId)===txt(episode))).slice().sort((a,b)=>orderMs(b)-orderMs(a))}
  function preventions(s,hid,episode=''){return (Array.isArray(s?.logs?.robbingPreventions)?s.logs.robbingPreventions:[]).filter(x=>x&&txt(x.hiveId)===txt(hid)&&txt(x.coreRuleId)===CORE_RULE_ID&&(!episode||txt(x.episodeId)===txt(episode))).slice().sort((a,b)=>orderMs(b)-orderMs(a))}

  function regionalDearthProfile(s,h){
    const c=base.buildContextSnapshot(s,h.id)||{},state=txt(c?.location?.stateCode).toUpperCase(),today=todayFor(s,h),m=month(today);
    if(NORTHEAST.has(state)&&[7,8,9].includes(m))return {id:'NE-LATE-SUMMER-DEARTH',state,season:'Northeastern late-summer dearth context',authority:SOURCES.PENN_STATE,confidence:'DERIVED_REGIONAL'};
    if(state==='MS'&&([7,8].includes(m)||[11,12,1,2,3].includes(m)))return {id:'MS-DEARTH-PERIOD',state,season:'Mississippi dearth period',authority:SOURCES.MSU,confidence:'AUTHORITY_WINDOW'};
    if(state==='CA'&&[8,9,10].includes(m))return {id:'CA-DEARTH-PERIOD',state,season:'California nectar-dearth context',authority:SOURCES.CA,confidence:'EXISTING_REGIONAL_PROFILE'};
    return null;
  }

  function weakSignal(insp){
    const raw=insp?.r?.colonySize??insp?.r?.strength;
    if(raw===null||raw===undefined||txt(raw)==='')return {known:false,weak:false,value:null};
    const n=Number(raw);if(!Number.isFinite(n))return {known:false,weak:false,value:null};
    return {known:true,weak:n<4,value:n};
  }

  function triggerSignal(s,h){
    const profile=regionalDearthProfile(s,h);if(!profile)return null;
    const insp=latestInspection(s,h.id);if(!insp)return null;
    const weak=weakSignal(insp);if(!weak.known||!weak.weak)return null;
    return {profile,inspection:insp.r,inspectionIndex:insp.index,weak};
  }
  const episodeId=(h,sig)=>`r12-robbing-${txt(h.id)}-${txt(sig?.inspection?.id||sig?.inspectionIndex||sig?.profile?.id||'evidence')}`;

  function resultOf(row){
    if(!row)return 'NONE';
    const signs=low(row.robbingSigns),exposed=low(row.exposedFood),defense=low(row.entranceDefense),vuln=low(row.colonyVulnerability);
    if(['active robbing','suspicious activity'].includes(signs)||exposed==='yes'||defense==='limited'||vuln==='weak')return 'FAIL';
    if(signs==='none seen'&&exposed==='no'&&defense==='adequate'&&vuln==='not weak')return 'PASS';
    return 'INCONCLUSIVE';
  }

  function evidencePayload(s,h,sig,episode,extra={}){
    const c=base.buildContextSnapshot(s,h.id)||{};
    return {episodeId:episode,sourceInspectionId:txt(sig.inspection?.id),sourceInspectionDate:iso(sig.inspection?.date),colonySize:sig.weak.value,
      weakColonyScreen:sig.weak.weak?'Weak':'Not weak',weakScreenAuthority:SOURCES.HIVE_DASH_WEAK.id,
      dearthProfileId:sig.profile.id,dearthSeason:sig.profile.season,dearthAuthority:sig.profile.authority.authority,dearthAuthorityId:sig.profile.authority.id,
      stateCode:txt(c?.location?.stateCode).toUpperCase(),city:txt(c?.location?.city),timezone:txt(c?.location?.timezone),colonyPhase:txt(c?.colonyPhase)||'Uncertain',...extra};
  }

  function taskBase(s,h,sig,episode,title,stage,due,priority){
    return {id:`scientific-r12-${stage}-${h.id}-${txt(sig.inspection?.id||sig.inspectionIndex)}`,hiveId:h.id,type:'Robbing Prevention',title,status:'Pending',priority:priority||'Medium',due:due||todayFor(s,h),dueDate:iso(due||todayFor(s,h)),date:iso(due||todayFor(s,h)),source:'scientific-engine',systemGenerated:true,reasonCode:'robbing',intentKey:stage==='evidence'?'robbing-risk-check':stage==='follow-up'?'robbing-verification':'robbing-prevention',workflowStage:stage,executionRoute:'',coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,ruleEngineOwner:'HiveDashTaskEngineCoreV1',ruleMigrationVersion:MIGRATION_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,episodeId:episode,evidenceChain:evidencePayload(s,h,sig,episode)};
  }

  function evaluateR12(s,h){
    const none=(status,reason)=>({assessment:{status},decision:{type:'NO_TASK',reason},verification:{result:'NONE'},outcome:{status:'NO_TASK'},task:null,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID});
    if(!s||!h)return none('NO_HIVE','hive-unavailable');
    const sig=triggerSignal(s,h);if(!sig)return none('NO_VALIDATED_ROBBING_TRIGGER','no-regional-dearth-plus-current-weak-colony-evidence');
    const episode=episodeId(h,sig),today=todayFor(s,h),rows=checks(s,h.id,episode),latest=rows[0]||null,result=resultOf(latest),plans=preventions(s,h.id,episode),plan=plans[0]||null;
    const common={hiveId:h.id,episodeId:episode,trigger:sig,latestRobbingEvaluation:latest||null,latestPrevention:plan||null,verificationResult:result};

    if(plan&&(!latest||orderMs(latest)<=orderMs(plan))){
      const due=addDays(iso(plan.date)||today,1),a=taskBase(s,h,sig,episode,'Verify robbing risk','follow-up',due,'High');
      a.id=`scientific-r12-followup-${h.id}-${txt(sig.inspection?.id||sig.inspectionIndex)}`;a.executionRoute=`robbing-evaluation/${encodeURIComponent(h.id)}/${encodeURIComponent(episode)}/follow-up`;
      a.systemWhy='Robbing-prevention steps were recorded for this episode. Confirm current robbing signs, exposed food, entrance defense, and colony vulnerability; completed management does not prove the risk is resolved.';
      a.evidenceChain={...a.evidenceChain,preventionId:txt(plan.id),preventionDate:iso(plan.date),selectedMeasures:Array.isArray(plan.measures)?plan.measures:[],verificationResult:'PENDING'};
      return {assessment:{status:'POST_PREVENTION_VERIFICATION_REQUIRED',...common},decision:{type:'AUTO_CREATE',reason:'prevention-record-needs-verification',automationLevel:'A_AUTO'},verification:{result:'PENDING'},outcome:{status:'FOLLOW_UP_REQUIRED'},task:a,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    }
    if(!latest){
      const a=taskBase(s,h,sig,episode,'Assess robbing risk','evidence',today,'Medium');a.executionRoute=`robbing-evaluation/${encodeURIComponent(h.id)}/${encodeURIComponent(episode)}/initial`;
      a.systemWhy='A validated regional dearth context overlaps with current weak-colony evidence. Record a targeted robbing-risk check before choosing prevention steps; HiveDash is not claiming that robbing is already occurring.';
      return {assessment:{status:'ROBBING_RISK_EVIDENCE_REQUIRED',...common},decision:{type:'AUTO_CREATE',reason:'dearth-plus-weak-colony-needs-targeted-check',automationLevel:'A_AUTO'},verification:{result:'PENDING'},outcome:{status:'EVIDENCE_REQUIRED'},task:a,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    }
    if(result==='PASS')return {assessment:{status:'ROBBING_RISK_CONTROLLED',...common},decision:{type:'NO_TASK',reason:'targeted-robbing-evidence-clear'},verification:{result:'PASS'},outcome:{status:'RESOLVED'},task:null,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    if(result==='FAIL'){
      const high=['active robbing','suspicious activity'].includes(low(latest.robbingSigns)),a=taskBase(s,h,sig,episode,'Review robbing prevention','management-review',today,high?'High':'Medium');
      a.id=`scientific-r12-management-${h.id}-${txt(sig.inspection?.id||sig.inspectionIndex)}`;a.executionRoute=`r12-robbing-review/${encodeURIComponent(h.id)}/${encodeURIComponent(episode)}`;
      a.systemWhy='Targeted evidence shows current robbing vulnerability or signs. Review prevention measures; HiveDash will not claim a robbing event from season alone or automatically record a management action.';
      a.evidenceChain={...a.evidenceChain,robbingEvaluationId:txt(latest.id),evaluationDate:iso(latest.date),robbingSigns:txt(latest.robbingSigns),exposedFood:txt(latest.exposedFood),entranceDefense:txt(latest.entranceDefense),colonyVulnerability:txt(latest.colonyVulnerability),verificationResult:'FAIL'};
      return {assessment:{status:'ROBBING_RISK_CONFIRMED',...common},decision:{type:'RECOMMEND_CONFIRM',reason:'targeted-robbing-evidence-needs-prevention',automationLevel:'B_RECOMMEND_CONFIRM'},verification:{result:'FAIL'},outcome:{status:'MANAGEMENT_REVIEW'},task:a,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    }
    const stage=low(latest.stage)==='follow-up'?'follow-up':'evidence',a=taskBase(s,h,sig,episode,stage==='follow-up'?'Robbing verification still needed':'Robbing-risk check still needed',stage,today,'Medium');
    a.executionRoute=`robbing-evaluation/${encodeURIComponent(h.id)}/${encodeURIComponent(episode)}/${stage==='follow-up'?'follow-up':'initial'}`;a.systemWhy='The latest targeted robbing check is incomplete. Missing evidence is not treated as safe or resolved.';
    return {assessment:{status:'ROBBING_EVIDENCE_INCONCLUSIVE',...common},decision:{type:'AUTO_CREATE',reason:'targeted-robbing-evidence-incomplete',automationLevel:'A_AUTO'},verification:{result:'INCONCLUSIVE'},outcome:{status:'EVIDENCE_REQUIRED'},task:a,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
  }

  function projectTask(ev,s){if(!ev?.task)return null;let task;try{task=base.normalizeTaskProjection(ev.task,s,{evidence:new Map(),context:new Map()})}catch(_){task={...ev.task}};return {...task,coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,ruleEngineOwner:'HiveDashTaskEngineCoreV1',ruleMigrationVersion:MIGRATION_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,episodeId:ev.task.episodeId,evidenceChain:ev.task.evidenceChain,assessmentType:ev.assessment?.status||'',decisionType:ev.decision?.type||'',automationLevel:ev.decision?.automationLevel||'',verificationStatus:ev.verification?.result||'PENDING',ruleEvaluation:{assessment:ev.assessment,decision:ev.decision,verification:ev.verification,outcome:ev.outcome}}}

  const ruleDefinition=Object.freeze({id:CORE_RULE_ID,version:RULE_VERSION,engineOwner:'HiveDashTaskEngineCoreV1',migrationVersion:MIGRATION_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,title:'Robbing-risk prevention',category:'ROBBING_PREVENTION',automation:'A_AUTO_EVIDENCE_THEN_B_RECOMMEND_CONFIRM',evidenceInputs:Object.freeze(['structured hive location','hive-local date','latest real Inspection colony size','targeted Robbing Risk Check','Robbing Prevention record']),authorityRules:SOURCES,policy:Object.freeze({noNationwideDearthCalendar:true,regionProfileRequired:true,seasonAloneDoesNotEqualRobbing:true,weakBandReusesFrozenHealthModel:true,preventionDoesNotEqualResolution:true,targetedVerificationRequired:true}),evaluate:(s,hiveId)=>{const h=hiveBy(s,hiveId);return evaluateR12(s,h)}});
  try{if(typeof base.registerRule==='function')base.registerRule(ruleDefinition)}catch(err){console.error('V2P2E5R12A rule registration failed',err)}
  window.v2p2e5r12Evaluate=function(hiveId){const s=S(),h=hiveBy(s,hiveId);return evaluateR12(s,h)};
  window.V2P2E5R12A_ROBBING_RULE=ruleDefinition;

  const TASK_CACHE=new Map();
  const prevGenerate=window.generateActions||(typeof generateActions==='function'?generateActions:null);
  if(typeof prevGenerate==='function'){
    window.generateActions=function(s){
      let out=(prevGenerate(s)||[]).filter(a=>txt(a?.coreRuleId)!==CORE_RULE_ID),seen=new Set(out.map(a=>txt(a.id)||`${txt(a.hiveId)}|${txt(a.intentKey)}|${txt(a.title)}`)),next=new Map();
      for(const h of active(s)){const ev=evaluateR12(s,h),task=projectTask(ev,s);if(!task)continue;const k=txt(task.id)||`${txt(task.hiveId)}|${txt(task.intentKey)}|${txt(task.title)}`;if(seen.has(k))continue;seen.add(k);out.push(task);next.set(txt(task.id),task)}
      TASK_CACHE.clear();for(const [id,t] of next)TASK_CACHE.set(id,t);return out;
    };try{generateActions=window.generateActions}catch(_){ }
  }
  const isR12TaskId=id=>/^scientific-r12-/.test(txt(id));
  function findTask(id){const key=txt(id),c=TASK_CACHE.get(key);if(c&&txt(c.coreRuleId)===CORE_RULE_ID)return c;const s=S();try{return (typeof generateActions==='function'?(generateActions(s)||[]):[]).find(a=>a&&txt(a.id)===key&&txt(a.coreRuleId)===CORE_RULE_ID)||null}catch(_){return null}}
  function findTaskFor(hid,episode,stage=''){const s=S();try{return (typeof generateActions==='function'?(generateActions(s)||[]):[]).find(a=>a&&txt(a.hiveId)===txt(hid)&&txt(a.coreRuleId)===CORE_RULE_ID&&txt(a.episodeId)===txt(episode)&&(!stage||low(a.workflowStage)===low(stage)))||null}catch(_){return null}}

  const draftKey=(hid,episode,stage)=>DRAFT_PREFIX+[txt(hid),txt(episode),low(stage)==='follow-up'?'follow-up':'initial'].map(encodeURIComponent).join('|');
  function readDraft(hid,episode,stage){try{return JSON.parse(sessionStorage.getItem(draftKey(hid,episode,stage))||'null')||{}}catch(_){return {}}}
  function writeDraft(hid,episode,stage,patch){try{const k=draftKey(hid,episode,stage),cur=readDraft(hid,episode,stage);sessionStorage.setItem(k,JSON.stringify({...cur,...patch,updatedAt:Date.now()}))}catch(_){}}
  function clearDraft(hid,episode,stage){try{sessionStorage.removeItem(draftKey(hid,episode,stage))}catch(_){}}
  const opts=(items,current)=>items.map(v=>`<option${txt(v)===txt(current)?' selected':''}>${esc(v)}</option>`).join('');
  window.v2p2e5r12DraftSet=(hid,episode,stage,field,value)=>writeDraft(hid,episode,stage,{[txt(field)]:txt(value)});
  window.v2p2e5r12Cancel=(hid,episode,stage)=>{clearDraft(hid,episode,stage);go('actions')};

  function renderEvaluation(hid,episode,stage){
    const normalized=stage==='follow-up'?'follow-up':'initial',s=S(),h=hiveBy(s,hid),a=findTaskFor(hid,episode,normalized==='follow-up'?'follow-up':'evidence');
    if(!h||!a)return `<div class="vs"><section class="vc"><div class="vhead"><b>Robbing-risk check no longer required</b></div><p>New evidence or a changed workflow state has resolved or replaced this task.</p><button class="primary" onclick="go('actions')">Back to Actions</button></section></div>`;
    const e=a.evidenceChain||{},d=readDraft(hid,episode,normalized),signs=txt(d.robbingSigns)||'Not assessed',food=txt(d.exposedFood)||'Not assessed',def=txt(d.entranceDefense)||'Not assessed',vuln=txt(d.colonyVulnerability)||'Not assessed',notes=txt(d.notes);
    return `<div class="vs v2p2e5r12-page"><section class="vc"><div class="vhead"><b>${normalized==='follow-up'?'Robbing Risk Verification':'Robbing Risk Check'} · targeted evidence</b><span class="v2p2e5r12-pill">R12 · S24</span></div><p class="muted">Record only what you observe now. A regional dearth profile is context, not proof that robbing is occurring.</p></section>
      <section class="vc"><div class="vhead"><b>Current context</b></div><div class="v2p2e5r12-grid"><span>Hive<b>${esc(h.name||hid)}</b></span><span>Dearth context<b>${esc(e.dearthSeason||'Not recorded')}</b></span><span>Colony size reference<b>${esc(e.colonySize??'Not recorded')} / 10</b></span><span>Region<b>${esc([e.city,e.stateCode].filter(Boolean).join(', ')||'Not recorded')}</b></span><span>Authority<b>${esc(e.dearthAuthority||'Not recorded')}</b></span><span>Source inspection<b>${esc(e.sourceInspectionDate||'Not recorded')}</b></span></div></section>
      <section class="vc v2p2e5r12-check"><label><span>Robbing Signs</span><select id="r12-signs" onchange="v2p2e5r12DraftSet('${js(hid)}','${js(episode)}','${normalized}','robbingSigns',this.value)">${opts(['Not assessed','None seen','Suspicious activity','Active robbing'],signs)}</select></label><label><span>Exposed Honey / Syrup</span><select id="r12-food" onchange="v2p2e5r12DraftSet('${js(hid)}','${js(episode)}','${normalized}','exposedFood',this.value)">${opts(['Not assessed','No','Yes'],food)}</select><small>Include spills or feeding exposed at/near the entrance.</small></label><label><span>Entrance Defense</span><select id="r12-defense" onchange="v2p2e5r12DraftSet('${js(hid)}','${js(episode)}','${normalized}','entranceDefense',this.value)">${opts(['Not assessed','Adequate','Limited'],def)}</select></label><label><span>Current Colony Vulnerability</span><select id="r12-vuln" onchange="v2p2e5r12DraftSet('${js(hid)}','${js(episode)}','${normalized}','colonyVulnerability',this.value)">${opts(['Not assessed','Not weak','Weak'],vuln)}</select><small>Use what you observe now; the colony-size value above is reference only.</small></label></section>
      <section class="vc"><label class="v2p2e5r12-note"><span>Notes</span><textarea id="r12-notes" placeholder="Optional current robbing context" oninput="v2p2e5r12DraftSet('${js(hid)}','${js(episode)}','${normalized}','notes',this.value)">${esc(notes)}</textarea></label></section><div class="v2p2e5r12-actions"><button class="secondary" onclick="v2p2e5r12Cancel('${js(hid)}','${js(episode)}','${normalized}')">Cancel</button><button class="primary" onclick="v2p2e5r12SaveEvaluation('${js(hid)}','${js(episode)}','${normalized}')">Save Robbing Check</button></div></div>`;
  }

  window.v2p2e5r12SaveEvaluation=function(hid,episode,stage){
    const s=S(),h=hiveBy(s,hid),a=findTaskFor(hid,episode,low(stage)==='follow-up'?'follow-up':'evidence');if(!h||!a)return toast('This R12 robbing task is no longer active');
    const row={id:'robbing-eval-'+Date.now(),hiveId:txt(hid),date:todayFor(s,h),episodeId:txt(episode),sourceTaskId:txt(a.id),stage:low(stage)==='follow-up'?'follow-up':'initial',robbingSigns:txt(document.getElementById('r12-signs')?.value),exposedFood:txt(document.getElementById('r12-food')?.value),entranceDefense:txt(document.getElementById('r12-defense')?.value),colonyVulnerability:txt(document.getElementById('r12-vuln')?.value),notes:txt(document.getElementById('r12-notes')?.value),recordedAt:new Date().toISOString(),coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    if([row.robbingSigns,row.exposedFood,row.entranceDefense,row.colonyVulnerability].some(unknown))return toast('Assess robbing signs, exposed food, entrance defense, and colony vulnerability before saving');
    row.verificationResult=resultOf(row);s.logs=s.logs||{};s.logs.robbingEvaluations=Array.isArray(s.logs.robbingEvaluations)?s.logs.robbingEvaluations:[];s.logs.robbingEvaluations.push(row);if(typeof save==='function'&&save(s)===false)return toast('Robbing check could not be saved');clearDraft(hid,episode,stage);toast('Robbing check saved');go('actions');
  };

  function renderReview(hid,episode){
    const s=S(),h=hiveBy(s,hid),a=findTaskFor(hid,episode,'management-review');if(!h||!a)return `<div class="vs"><section class="vc"><div class="vhead"><b>Robbing prevention review no longer required</b></div><p>New evidence or a recorded prevention step has replaced this review.</p><button class="primary" onclick="go('actions')">Back to Actions</button></section></div>`;
    const e=a.evidenceChain||{};
    return `<div class="vs v2p2e5r12-page"><section class="vc"><div class="vhead"><b>Review robbing prevention</b><span class="v2p2e5r12-pill">R12 · S24</span></div><p>Targeted evidence shows robbing vulnerability or signs. Choose only the measures you actually use.</p></section><section class="vc"><div class="vhead"><b>Evidence chain</b></div><div class="v2p2e5r12-grid"><span>Hive<b>${esc(h.name||hid)}</b></span><span>Check date<b>${esc(e.evaluationDate||'Not recorded')}</b></span><span>Robbing signs<b>${esc(e.robbingSigns||'Not assessed')}</b></span><span>Exposed food<b>${esc(e.exposedFood||'Not assessed')}</b></span><span>Entrance defense<b>${esc(e.entranceDefense||'Not assessed')}</b></span><span>Colony vulnerability<b>${esc(e.colonyVulnerability||'Not assessed')}</b></span></div></section>
      <section class="vc"><div class="vhead"><b>Record prevention measures</b></div><div class="v2p2e5r12-measures"><label><input type="checkbox" value="Reduce entrance / use robbing screen"> Reduce entrance / use robbing screen</label><label><input type="checkbox" value="Remove or clean exposed honey / syrup"> Remove or clean exposed honey / syrup</label><label><input type="checkbox" value="Minimize hive opening during dearth"> Minimize hive opening during dearth</label><label><input type="checkbox" value="Move feeding inside hive / avoid entrance feeder"> Move feeding inside hive / avoid entrance feeder</label><label><input type="checkbox" value="Other beekeeper-confirmed measure"> Other beekeeper-confirmed measure</label></div><label class="v2p2e5r12-note"><span>Notes</span><textarea id="r12-prevention-notes" placeholder="Optional prevention notes"></textarea></label></section>
      <section class="vc"><div class="vhead"><b>Why these options</b></div><p>Penn State and Mississippi State Extension describe dearth-related robbing risk, especially around weaker colonies, exposed honey/syrup, entrance access, and prolonged hive opening. HiveDash does not choose a measure automatically.</p></section><div class="v2p2e5r12-actions"><button class="secondary" onclick="go('actions')">Back</button><button class="primary" onclick="v2p2e5r12SavePrevention('${js(hid)}','${js(episode)}')">Record Prevention</button></div></div>`;
  }

  window.v2p2e5r12SavePrevention=function(hid,episode){
    const s=S(),h=hiveBy(s,hid),a=findTaskFor(hid,episode,'management-review');if(!h||!a)return toast('This robbing-prevention review is no longer active');
    const measures=[...document.querySelectorAll('.v2p2e5r12-measures input[type="checkbox"]:checked')].map(x=>txt(x.value)).filter(Boolean);if(!measures.length)return toast('Confirm at least one prevention measure before saving');
    const row={id:'robbing-prevention-'+Date.now(),hiveId:txt(hid),date:todayFor(s,h),episodeId:txt(episode),sourceTaskId:txt(a.id),measures,notes:txt(document.getElementById('r12-prevention-notes')?.value),recordedAt:new Date().toISOString(),coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    s.logs=s.logs||{};s.logs.robbingPreventions=Array.isArray(s.logs.robbingPreventions)?s.logs.robbingPreventions:[];s.logs.robbingPreventions.push(row);if(typeof save==='function'&&save(s)===false)return toast('Robbing prevention could not be saved');toast('Robbing prevention recorded');go('actions');
  };

  function detailHTML(a){
    const s=S(),h=hiveBy(s,a.hiveId),stage=low(a.workflowStage),stageLabel=stage==='evidence'?'Gather evidence':stage==='follow-up'?'Verify result':'Review management',why=txt(a.systemWhy||'Current robbing-risk evidence requires review.'),due=txt(a.dueDate||a.due||'Needs confirmation'),next=stage==='management-review'?'Review the evidence and record only the prevention measures you actually use. HiveDash will not choose or mark a prevention step complete for you.':stage==='follow-up'?'Record new targeted robbing evidence. A prevention record is not treated as success until current conditions support it.':'Record a targeted robbing-risk check. Regional dearth context is not treated as proof of robbing.';
    const cta=stage==='management-review'?'Review Robbing Prevention':stage==='follow-up'?'Verify Robbing Risk':'Start Robbing Risk Check';
    return `<div class="vs v2p2e5ab-detail v2p2e5r12-detail"><section class="vc"><div class="vhead"><b>${esc(a.title||'R12 robbing task')}</b><span class="v2p2e5ab-source-pill">System</span><span class="v2p2e5r12-pill">R12 · S24</span></div><div class="v2p2e5ab-detail-grid"><span>Hive<b>${esc(h?.name||'Unavailable')}</b></span><span>Stage<b>${esc(stageLabel)}</b></span><span>Priority<b>${esc(a.priority||'Medium')}</b></span><span>Due<b>${esc(due)}</b></span></div></section><section class="vc"><div class="vhead"><b>Why this task exists</b></div><p>${esc(why)}</p></section><section class="vc"><div class="vhead"><b>What happens next</b></div><p>${esc(next)}</p></section><div class="v2p2e5ab-detail-actions"><button class="secondary" onclick="go('actions')">Back</button><button class="primary" onclick="v2p2e5r12OpenExactTask('${js(a.id)}')">${esc(cta)}</button></div></div>`;
  }
  window.v2p2e5r12OpenExactTask=function(id){const a=findTask(id);if(!a)return toast('This R12 robbing task is no longer active');const route=txt(a.executionRoute);if(!route)return toast('This R12 robbing task has no active next step');go(route)};

  if(!window.__HIVEDASH_V2P2E5R12A_CARD_ROUTE_BOUND__){window.__HIVEDASH_V2P2E5R12A_CARD_ROUTE_BOUND__=true;document.addEventListener('click',function(ev){const el=ev.target instanceof Element?ev.target:null,btn=el?.closest?.('#alist > button');if(!btn)return;let id=txt(btn.dataset?.actionId);if(!id){const raw=txt(btn.getAttribute('onclick')),m=raw.match(/(?:v2p2e5amOpenTask|v2p2e5abOpenUnifiedAction)\('([^']+)'\)/);if(m)id=txt(m[1])}if(!isR12TaskId(id))return;ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation?.();go(`scientific-action/${encodeURIComponent(id)}`)},true)}

  const prevRender=window.render||render;
  window.render=function(){
    const p=txt(location.hash||'#home').replace(/^#/,'').split('/');
    if(p[0]==='scientific-action'&&isR12TaskId(decodeURIComponent(txt(p[1])))){
      const id=decodeURIComponent(txt(p[1])),a=findTask(id),r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=a?detailHTML(a):`<div class="vs"><section class="vc"><div class="vhead"><b>R12 task no longer required</b></div><p>New evidence or a changed workflow state has resolved or replaced this robbing-risk task.</p><button class="primary" onclick="go('actions')">Back to Actions</button></section></div>`;const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML=`<button class="iconbtn" onclick="go('actions')" aria-label="Back">‹</button><div class="pagebar-title">Task Detail</div><span></span>`}document.getElementById('bottomnav')?.classList.add('hidden');return;
    }
    if(p[0]==='robbing-evaluation'){
      const r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=renderEvaluation(decodeURIComponent(txt(p[1])),decodeURIComponent(txt(p[2])),txt(p[3]));const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML=`<button class="iconbtn" onclick="go('actions')" aria-label="Back">‹</button><div class="pagebar-title">Robbing Risk Check</div><span></span>`}document.getElementById('bottomnav')?.classList.add('hidden');return;
    }
    if(p[0]==='r12-robbing-review'){
      const r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=renderReview(decodeURIComponent(txt(p[1])),decodeURIComponent(txt(p[2])));const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML=`<button class="iconbtn" onclick="go('actions')" aria-label="Back">‹</button><div class="pagebar-title">Robbing Prevention</div><span></span>`}document.getElementById('bottomnav')?.classList.add('hidden');return;
    }
    return prevRender.apply(this,arguments);
  };try{render=window.render}catch(_){ }

  const style=document.createElement('style');style.id='v2p2e5r12a-style';style.textContent=`.v2p2e5r12-pill{font-size:10px;padding:4px 7px;border-radius:999px;background:#F1F3E9;color:#60734F;margin-left:auto}.v2p2e5r12-page{padding-bottom:24px}.v2p2e5r12-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v2p2e5r12-grid span{display:grid;gap:3px;font-size:10px;color:#7A817B}.v2p2e5r12-grid b{font-size:12px;color:#334C38}.v2p2e5r12-check label{display:flex;flex-direction:column;gap:6px;padding:10px 0;border-bottom:1px solid #ece8dd}.v2p2e5r12-check label:last-child{border-bottom:0}.v2p2e5r12-check select{width:100%;min-height:44px;border:1px solid #ddd7c8;border-radius:10px;background:#fff;padding:0 10px}.v2p2e5r12-check small{color:#9a7820;font-size:10px}.v2p2e5r12-note{display:flex;flex-direction:column;gap:8px;margin-top:10px}.v2p2e5r12-note textarea{min-height:88px;border:1px solid #ddd7c8;border-radius:10px;padding:10px}.v2p2e5r12-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:10px}.v2p2e5r12-actions button{margin:0!important}.v2p2e5r12-measures{display:grid;gap:10px}.v2p2e5r12-measures label{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#334C38}`;document.head.appendChild(style);

  window.V2P2E5R12A_CATALOG=Object.freeze({version:VERSION,migrationVersion:MIGRATION_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,coreRuleId:CORE_RULE_ID,scientificRuleChanged:'new-r12-s24-rule-no-frozen-rule-rewritten',automaticExecution:false,regionalProfiles:['Northeast','Mississippi','California']});
  window.__HIVEDASH_V2P2E5R12A_VERSION__=VERSION;
  console.log('V2P2E5R12A LOADED | R12/S24 robbing-prevention core');
})();
