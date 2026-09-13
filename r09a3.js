/* ==============================================================
   HiveDash V2P2E5R09A3 — R09/S19 post-B41 lifecycle closure

   Scope ONLY:
   1) Treat a user-confirmed B41 Swarm Control as management execution,
      NOT as biological resolution.
   2) After a linked B41 completes, suppress the stale R09 "Review swarm
      control" projection and the legacy/manual B41 follow-up projection.
   3) Create one System Swarm Verification task tied to the same R09
      episode and B41 action.
   4) Collect targeted current evidence and resolve explicitly as
      PASS / FAIL / INCONCLUSIVE.

   Safety invariants:
   - Frozen B41 implementation is not edited.
   - No B41 result is converted into biological evidence.
   - Verification fields start Not assessed; prior values are reference only.
   - PASS closes the R09 episode; FAIL recommends management review again;
     INCONCLUSIVE stays open.
   - Existing R08, R03 and other frozen workflows are not rewritten.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R09A3__) return;
  window.__HIVEDASH_V2P2E5R09A3__=true;
  window.__HIVEDASH_V2P2E5R09A3_VERSION__='v2p2e5r09a3-post-b41-swarm-verification-closure';

  const R08_CORE='HD-R08S-SWARM-RISK-CHECK';
  const CORE_RULE_ID='HD-R09S-SWARM-CONTROL-VERIFICATION';
  const RULE_VERSION='HD-R09S-v1.0-2026-09-13';
  const MIGRATION_VERSION='V2P2E5R09A3';
  const CATALOG_RULE_ID='R09';
  const CATALOG_TASK_ID='S19';
  const CTX_KEY='hivedash_r09_b41_bridge_context_v2';
  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const iso=v=>/^\d{4}-\d{2}-\d{2}$/.test(txt(v).slice(0,10))?txt(v).slice(0,10):'';
  const escS=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S=()=>{try{return typeof v45s==='function'?v45s():state()}catch(_){return null}};
  const active=s=>{try{return typeof v224ActiveTrackedHives==='function'?v224ActiveTrackedHives(s):(s?.hives||[]).filter(h=>h&&!h.archived&&!['combined','archived'].includes(low(h.lifecycleStatus||h.status)))}catch(_){return (s?.hives||[]).filter(Boolean)}};
  const hiveBy=(s,id)=>active(s).find(h=>txt(h.id)===txt(id))||null;
  const todayFor=(s,h)=>{try{return typeof v2p2e5Today==='function'?txt(v2p2e5Today(s,h?.id||'')):typeof v2p1bDateInHiveTimezone==='function'?txt(v2p1bDateInHiveTimezone(s,h)):new Date().toISOString().slice(0,10)}catch(_){return new Date().toISOString().slice(0,10)}};
  const base=window.HiveDashTaskEngineCoreV1||{};

  function allSwarmActions(s){
    const a=[...(Array.isArray(s?.actions)?s.actions:[]),...(Array.isArray(s?.meta?.completedActions)?s.meta.completedActions:[])];
    const seen=new Set();
    return a.filter(x=>x&&low(x.type)==='swarm-control'&&!seen.has(txt(x.id))&&seen.add(txt(x.id)));
  }
  function failChecks(s,hid){
    return (Array.isArray(s?.logs?.swarmRiskChecks)?s.logs.swarmRiskChecks:[])
      .filter(x=>x&&txt(x.hiveId)===txt(hid)&&txt(x.coreRuleId)===R08_CORE&&low(x.verificationResult)==='fail')
      .slice().sort((a,b)=>txt(b.recordedAt||b.id).localeCompare(txt(a.recordedAt||a.id)));
  }
  function verificationRows(s,hid){
    return (Array.isArray(s?.logs?.swarmVerifications)?s.logs.swarmVerifications:[])
      .filter(x=>x&&txt(x.hiveId)===txt(hid)&&txt(x.coreRuleId)===CORE_RULE_ID)
      .slice().sort((a,b)=>txt(b.recordedAt||b.id).localeCompare(txt(a.recordedAt||a.id)));
  }
  function actionAfterCheck(a,c){
    const ct=txt(c?.recordedAt),at=txt(a?.createdAt||a?.startedAt||a?.completedAt);
    return !ct||!at||at>=ct;
  }
  function linkedExecution(s,hid,check){
    if(!check)return null;
    const rows=allSwarmActions(s).filter(a=>txt(a.hiveId)===txt(hid));
    let hit=rows.find(a=>txt(a.workflowData?.r09SourceCheckId)===txt(check.id));
    if(hit)return hit;
    hit=rows.find(a=>txt(a.workflowData?.r09EpisodeId)===txt(check.episodeId)&&txt(check.episodeId));
    if(hit)return hit;
    const candidates=rows.filter(a=>actionAfterCheck(a,check)).sort((a,b)=>txt(a.createdAt||a.id).localeCompare(txt(b.createdAt||b.id)));
    return candidates.length===1?candidates[0]:null;
  }
  function completed(a){return !!a&&(['completed','done'].includes(low(a.status))||low(a.priority)==='done'||a.resultData?.controlCompleted===true||!!a.resultAppliedAt)};

  // Future-safe linking: when B41 is created from the R09 bridge, annotate only
  // metadata on the new action. No B41 business/result field is changed.
  const prevCreate=window.b41CreateAction;
  if(typeof prevCreate==='function'){
    window.b41CreateAction=function(){
      let ctx=null;try{ctx=JSON.parse(sessionStorage.getItem(CTX_KEY)||'null')}catch(_){ctx=null}
      const before=new Set(allSwarmActions(S()).map(a=>txt(a.id)));
      const ret=prevCreate.apply(this,arguments);
      try{
        if(ctx&&txt(ctx.catalogRuleId)==='R09'&&txt(ctx.catalogTaskId)==='S19'&&txt(ctx.hiveId)){
          const s=S(),created=allSwarmActions(s).filter(a=>!before.has(txt(a.id))&&txt(a.hiveId)===txt(ctx.hiveId));
          const a=created[created.length-1];
          if(a){
            const check=failChecks(s,a.hiveId).find(c=>!ctx.episodeId||txt(c.episodeId)===txt(ctx.episodeId))||failChecks(s,a.hiveId)[0];
            a.workflowData={...(a.workflowData||{}),r09SourceTaskId:txt(ctx.taskId),r09SourceCheckId:txt(check?.id),r09EpisodeId:txt(ctx.episodeId||check?.episodeId),r09CatalogRuleId:'R09',r09CatalogTaskId:'S19'};
            if(typeof save==='function')save(s);
          }
        }
      }catch(err){console.error('V2P2E5R09A3 B41 link annotation failed',err)}
      return ret;
    };
    try{b41CreateAction=window.b41CreateAction}catch(_){ }
  }

  function resultForVerification(v){
    if(!v)return 'NONE';
    const qc=low(v.queenCellStatus),cong=low(v.colonyCongestion),brood=low(v.broodNestSpace),sup=low(v.superSpace),signs=low(v.swarmSigns);
    if([qc,cong,brood,sup,signs].some(x=>['','not assessed','not checked','unknown'].includes(x)))return 'INCONCLUSIVE';
    const activeCells=['charged cells','capped swarm cells'].includes(qc);
    const pressure=['high','severe'].includes(cong)||['limited','none'].includes(brood)||['limited','none'].includes(sup);
    if(activeCells&&pressure)return 'FAIL';
    const pass=qc==='none seen'&&['low','moderate'].includes(cong)&&brood==='adequate'&&['adequate','no super installed'].includes(sup)&&signs==='none';
    return pass?'PASS':'INCONCLUSIVE';
  }
  function taskBase(s,h,check,a,title,stage){
    const rd=a?.resultData||{},due=txt(a?.followUpDate||rd.followUpDate)||todayFor(s,h);
    const episode=txt(check?.episodeId)||`r09-${h.id}-${txt(check?.id)}`;
    return {
      id:`scientific-r09-${stage}-${txt(a?.id)}-${txt(check?.id)}`,hiveId:h.id,type:'Inspection',title,status:'Pending',priority:stage==='management-review'?'High':'High',
      due:stage==='management-review'?'Review now':due,dueDate:stage==='management-review'?'':due,date:'',source:'scientific-engine',systemGenerated:true,
      reasonCode:'swarm',intentKey:stage==='management-review'?'swarm-control-review':'swarm-verification',workflowStage:stage,executionRoute:'',
      coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,ruleEngineOwner:'HiveDashTaskEngineCoreV1',ruleMigrationVersion:MIGRATION_VERSION,
      catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,assessmentType:stage==='management-review'?'SWARM_RISK_REMAINS_HIGH':'SWARM_VERIFICATION_REQUIRED',
      decisionType:stage==='management-review'?'RECOMMEND_CONFIRM':'AUTO_CREATE',automationLevel:stage==='management-review'?'B_RECOMMEND_CONFIRM':'A_AUTO_TASK',
      verificationStatus:stage==='management-review'?'FAIL':'PENDING',episodeId:episode,sourceActionId:txt(a?.id),sourceCheckId:txt(check?.id)
    };
  }
  function evidenceChain(s,h,check,a,extra={}){
    const rd=a?.resultData||{};
    return {
      episodeId:txt(check?.episodeId),sourceCheckId:txt(check?.id),sourceCheckDate:iso(check?.date),sourceActionId:txt(a?.id),
      completedDate:txt(rd.completedDate||a?.completedDate)||'Not recorded',actualMethod:txt(rd.actualMethod)||'Not recorded',swarmOutcome:txt(rd.swarmOutcome)||'Not recorded',queenCellOutcome:txt(rd.queenCellOutcome)||'Not recorded',
      followUpRequired:rd.followUpRequired===true,followUpDate:txt(rd.followUpDate||a?.followUpDate)||'Not recorded',
      queenCellStatus:txt(check?.queenCellStatus)||'Not assessed',colonyCongestion:txt(check?.colonyCongestion)||'Not assessed',broodNestSpace:txt(check?.broodNestSpace)||'Not assessed',superSpace:txt(check?.superSpace)||'Not assessed',swarmSigns:txt(check?.swarmSigns)||'Not assessed',queenSeen:txt(check?.queenSeen)||'Not assessed',
      ...extra
    };
  }
  function evaluateR09(s,h){
    const out={ruleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,assessment:{status:'NO_R09_EXECUTION'},decision:{type:'NO_TASK',automationLevel:'NONE'},verification:{result:'NOT_REQUIRED'},outcome:{status:'NOT_OPEN'},task:null};
    const check=failChecks(s,h.id)[0];if(!check)return out;
    const exec=linkedExecution(s,h.id,check);if(!exec){out.assessment={status:'R09_MANAGEMENT_REVIEW_REQUIRED',checkId:txt(check.id)};return out}
    if(!completed(exec)){out.assessment={status:'SWARM_CONTROL_PENDING',checkId:txt(check.id),actionId:txt(exec.id)};out.verification={result:'PENDING'};out.outcome={status:'MANAGEMENT_IN_PROGRESS'};return out}
    const rows=verificationRows(s,h.id).filter(v=>txt(v.sourceActionId)===txt(exec.id));
    const latest=rows[0]||null;
    if(!latest){
      const t=taskBase(s,h,check,exec,'Recheck swarm risk','follow-up');
      t.systemWhy='Swarm Control has been completed, but management completion does not prove the swarm risk is resolved. Record new targeted swarm evidence.';
      t.evidenceChain=evidenceChain(s,h,check,exec);
      out.assessment={status:'SWARM_VERIFICATION_REQUIRED',checkId:txt(check.id),actionId:txt(exec.id)};out.decision={type:'AUTO_CREATE',automationLevel:'A_AUTO_TASK'};out.verification={result:'PENDING'};out.outcome={status:'OPEN'};out.task=t;return out;
    }
    const vr=resultForVerification(latest);
    if(vr==='PASS'){
      out.assessment={status:'SWARM_RISK_RESOLVED',checkId:txt(check.id),actionId:txt(exec.id),verificationId:txt(latest.id)};out.decision={type:'NO_TASK',automationLevel:'NONE'};out.verification={result:'PASS'};out.outcome={status:'RESOLVED'};return out;
    }
    if(vr==='FAIL'){
      const t=taskBase(s,h,check,exec,'Swarm risk remains high','management-review');
      t.systemWhy='New Swarm Verification still shows active queen cells together with crowding or limited space. Review the evidence and choose the next management step; HiveDash will not repeat a control method automatically.';
      t.evidenceChain=evidenceChain(s,h,check,exec,{verificationId:txt(latest.id),verificationDate:iso(latest.date),verificationResult:'FAIL',currentQueenCellStatus:txt(latest.queenCellStatus),currentCongestion:txt(latest.colonyCongestion),currentBroodNestSpace:txt(latest.broodNestSpace),currentSuperSpace:txt(latest.superSpace),currentSwarmSigns:txt(latest.swarmSigns)});
      out.assessment={status:'SWARM_RISK_REMAINS_HIGH',checkId:txt(check.id),actionId:txt(exec.id),verificationId:txt(latest.id)};out.decision={type:'RECOMMEND_CONFIRM',automationLevel:'B_RECOMMEND_CONFIRM'};out.verification={result:'FAIL'};out.outcome={status:'CONTINUE'};out.task=t;return out;
    }
    const t=taskBase(s,h,check,exec,'Swarm verification still needed','follow-up');
    t.systemWhy='The post-control Swarm Verification does not yet provide enough current evidence to determine whether swarm risk has resolved. Missing or mixed observations remain inconclusive.';
    t.evidenceChain=evidenceChain(s,h,check,exec,{verificationId:txt(latest.id),verificationDate:iso(latest.date),verificationResult:'INCONCLUSIVE'});
    out.assessment={status:'SWARM_VERIFICATION_INCONCLUSIVE',checkId:txt(check.id),actionId:txt(exec.id),verificationId:txt(latest.id)};out.decision={type:'AUTO_CREATE',automationLevel:'A_AUTO_TASK'};out.verification={result:'INCONCLUSIVE'};out.outcome={status:'OPEN'};out.task=t;return out;
  }

  const ruleDefinition=Object.freeze({
    id:CORE_RULE_ID,version:RULE_VERSION,engineOwner:'HiveDashTaskEngineCoreV1',migrationVersion:MIGRATION_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,
    category:'SWARM_MANAGEMENT',assessmentType:'SWARM_VERIFICATION_REQUIRED',decisionClass:'A_AUTO_TASK / B_RECOMMEND_CONFIRM',
    evidenceInputs:Object.freeze(['R08 high-risk Swarm Risk Inspection','completed B41 Swarm Control','post-control targeted Swarm Verification']),
    policy:Object.freeze({managementCompletionIsNotBiologicalResolution:true,postControlVerificationRequired:true,passFailInconclusive:true,failDoesNotAutoRepeatControl:true})
  });
  try{if(typeof base.registerRule==='function')base.registerRule(ruleDefinition)}catch(_){ }
  try{window.HiveDashTaskEngineCoreV1=Object.freeze({...base,swarmControlVerificationRule:ruleDefinition,evaluateSwarmControlVerification:(s,hid)=>{const h=hiveBy(s,hid);return h?evaluateR09(s,h):null}})}catch(_){ }
  window.v2p2e5r09Evaluate=function(hiveId){const s=S(),h=hiveBy(s,hiveId);return h?evaluateR09(s,h):null};

  function linkedMap(s){
    const m=new Map();
    for(const h of active(s)){
      const c=failChecks(s,h.id)[0],a=linkedExecution(s,h.id,c);if(c&&a)m.set(txt(a.id),{h,check:c,action:a});
    }
    return m;
  }

  // Lifecycle projection: keep frozen B41 data, but replace its legacy/manual
  // follow-up UI projection with one System R09 verification task.
  const prevGenerate=window.generateActions||((typeof generateActions==='function')?generateActions:null);
  if(typeof prevGenerate==='function'){
    window.generateActions=function(s){
      let out=prevGenerate(s)||[];
      const links=linkedMap(s);
      if(links.size){
        out=out.filter(a=>{
          if(!a)return false;
          const parent=txt(a.parentActionId||a.linkedActionId);
          if(low(a.source)==='swarm-control-follow-up'&&links.has(parent))return false;
          if(txt(a.coreRuleId)===R08_CORE&&txt(a.catalogTaskId)==='S19'&&low(a.workflowStage)==='management-review'){
            const link=[...links.values()].find(x=>txt(x.h.id)===txt(a.hiveId)&&txt(x.check.episodeId)===txt(a.episodeId));
            if(link&&completed(link.action))return false;
          }
          return true;
        });
      }
      const seen=new Set(out.map(a=>txt(a.id)));
      for(const h of active(s)){
        const ev=evaluateR09(s,h),t=ev?.task;if(!t||seen.has(txt(t.id)))continue;seen.add(txt(t.id));out.push(t);
      }
      return out;
    };
    try{generateActions=window.generateActions}catch(_){ }
  }

  function currentTask(id){
    try{return (typeof generateActions==='function'?(generateActions(S())||[]):[]).find(a=>a&&txt(a.id)===txt(id)&&txt(a.coreRuleId)===CORE_RULE_ID)||null}catch(_){return null}
  }
  window.v2p2e5r09OpenVerification=function(taskId){
    const a=currentTask(taskId);if(!a||low(a.workflowStage)!=='follow-up')return toast('This Swarm Verification is no longer active');
    go(`swarm-verification/${a.hiveId}/${encodeURIComponent(txt(a.sourceActionId))}`);
  };
  window.v2p2e5r09RepeatControl=function(taskId){
    const a=currentTask(taskId);if(!a||low(a.workflowStage)!=='management-review')return toast('This swarm management review is no longer active');
    const ctx={taskId:txt(a.id),hiveId:txt(a.hiveId),priority:txt(a.priority)||'High',catalogRuleId:'R09',catalogTaskId:'S19',sourceCoreRuleId:CORE_RULE_ID,episodeId:txt(a.episodeId),prioritySeeded:false,openedAt:new Date().toISOString()};
    try{sessionStorage.setItem(CTX_KEY,JSON.stringify(ctx))}catch(_){ }
    return typeof window.b41OpenSwarmAction==='function'?window.b41OpenSwarmAction(a.hiveId):toast('Swarm Control workflow is unavailable');
  };

  function detailHTML(a){
    const s=S(),h=hiveBy(s,a.hiveId),e=a.evidenceChain||{},review=low(a.workflowStage)==='management-review';
    return `<div class="vs v2p2e5r09-detail"><section class="vc"><div class="vhead"><b>${escS(a.title)}</b><span class="v2p2e5r09-source">System</span></div><div class="v2p2e5r09-grid"><span>Hive<b>${escS(h?.name||'Unavailable')}</b></span><span>Stage<b>${review?'Review management':'Verify result'}</b></span><span>Priority<b>${escS(a.priority||'High')}</b></span><span>Due<b>${escS(a.due||'—')}</b></span></div></section>
      <section class="vc"><div class="vhead"><b>Why this task exists</b></div><p>${escS(a.systemWhy||'New post-control swarm evidence is required.')}</p></section>
      <section class="vc"><div class="vhead"><b>Swarm control evidence</b><span class="v2p2e5r09-pill">R09 · S19</span></div><div class="v2p2e5r09-grid">
        <span>Original high-risk check<b>${escS(e.sourceCheckDate||'Not recorded')}</b></span><span>Control completed<b>${escS(e.completedDate||'Not recorded')}</b></span>
        <span>Actual method<b>${escS(e.actualMethod||'Not recorded')}</b></span><span>Recorded outcome<b>${escS(e.swarmOutcome||'Not recorded')}</b></span>
        <span>Queen-cell outcome<b>${escS(e.queenCellOutcome||'Not recorded')}</b></span><span>Follow-up date<b>${escS(e.followUpDate||'Not recorded')}</b></span>
        <span>Prior targeted queen cells<b>${escS(e.queenCellStatus||'Not assessed')}</b></span><span>Prior congestion<b>${escS(e.colonyCongestion||'Not assessed')}</b></span>
        <span>Prior brood space<b>${escS(e.broodNestSpace||'Not assessed')}</b></span><span>Prior super space<b>${escS(e.superSpace||'Not assessed')}</b></span>
      </div><div class="v2p2e5r09-warning"><b>Evidence boundary</b><br>Completing Swarm Control records a management action. It does not prove biological swarm risk has resolved; only new current evidence can close this episode.</div></section>
      <section class="vc"><div class="vhead"><b>What happens next</b></div><p>${review?'Review the failed verification and choose the next management step only if appropriate. HiveDash will not automatically repeat the previous method.':'Record a targeted post-control Swarm Verification. Previous high-risk values are reference only.'}</p></section>
      <div class="v2p2e5r09-actions"><button class="secondary" onclick="go('actions')">Back</button><button class="primary" onclick="${review?`v2p2e5r09RepeatControl('${txt(a.id).replace(/'/g,"\\'")}')`:`v2p2e5r09OpenVerification('${txt(a.id).replace(/'/g,"\\'")}')`}">${review?'Review Swarm Control':'Start Swarm Verification'}</button></div></div>`;
  }
  function renderVerification(hid,actionId){
    const s=S(),h=hiveBy(s,hid);if(!h)return `<div class="vs"><section class="vc"><b>Hive unavailable</b></section></div>`;
    const ev=evaluateR09(s,h),a=ev?.task,e=a?.evidenceChain||{};
    if(!a||low(a.workflowStage)!=='follow-up'||txt(a.sourceActionId)!==txt(actionId))return `<div class="vs"><section class="vc"><div class="vhead"><b>Swarm Verification no longer required</b></div><p>New evidence has resolved or replaced this verification.</p><button class="primary" onclick="go('actions')">Back to Actions</button></section></div>`;
    return `<div class="vs v2p2e5r09-verification"><section class="vc"><div class="vhead"><b>Swarm Verification · targeted evidence</b><span class="v2p2e5r09-pill">R09 · S19</span></div><p class="muted">Record only what you assess now. Previous values are reference only. Completing Swarm Control does not prefill biological outcomes.</p></section>
      <section class="vc v2p2e5r09-form">
        <label><span>Queen Cell Status</span><select id="r09v-queen-cells"><option>Not assessed</option><option>None seen</option><option>Cups only</option><option>Charged cells</option><option>Capped swarm cells</option></select><small>Previous: ${escS(e.queenCellStatus||'Not assessed')} · reference only</small></label>
        <label><span>Colony Congestion</span><select id="r09v-congestion"><option>Not assessed</option><option>Low</option><option>Moderate</option><option>High</option><option>Severe</option></select><small>Previous: ${escS(e.colonyCongestion||'Not assessed')} · reference only</small></label>
        <label><span>Brood Nest Space</span><select id="r09v-brood-space"><option>Not assessed</option><option>Adequate</option><option>Limited</option><option>None</option></select><small>Previous: ${escS(e.broodNestSpace||'Not assessed')} · reference only</small></label>
        <label><span>Super Space</span><select id="r09v-super-space"><option>Not assessed</option><option>Adequate</option><option>Limited</option><option>None</option><option>No super installed</option></select><small>Previous: ${escS(e.superSpace||'Not assessed')} · reference only</small></label>
        <label><span>Swarm Signs</span><select id="r09v-swarm-signs"><option>Not assessed</option><option>None</option><option>Present</option></select><small>Previous: ${escS(e.swarmSigns||'Not assessed')} · reference only</small></label>
        <label><span>Queen Seen</span><select id="r09v-queen-seen"><option>Not assessed</option><option>Seen</option><option>Not seen</option></select></label>
      </section>
      <section class="vc"><div class="vhead"><b>Linked management</b></div><div class="v2p2e5r09-grid"><span>Swarm Control<b>${escS(e.sourceActionId||'Not recorded')}</b></span><span>Completed date<b>${escS(e.completedDate||'Not recorded')}</b></span><span>Actual method<b>${escS(e.actualMethod||'Not recorded')}</b></span><span>Recorded outcome<b>${escS(e.swarmOutcome||'Not recorded')}</b></span></div></section>
      <section class="vc"><label class="v2p2e5r09-note"><span>Notes</span><textarea id="r09v-notes" maxlength="500" placeholder="Optional current swarm-risk context"></textarea></label></section>
      <div class="v2p2e5r09-actions"><button class="secondary" onclick="go('actions')">Cancel</button><button class="primary" onclick="v2p2e5r09SaveVerification('${txt(h.id).replace(/'/g,"\\'")}','${txt(actionId).replace(/'/g,"\\'")}')">Save Swarm Verification</button></div></div>`;
  }

  window.v2p2e5r09SaveVerification=function(hid,actionId){
    const s=S(),h=hiveBy(s,hid);if(!h)return toast('Hive not found');const ev=evaluateR09(s,h),a=ev?.task;
    if(!a||low(a.workflowStage)!=='follow-up'||txt(a.sourceActionId)!==txt(actionId))return toast('This Swarm Verification is no longer active');
    const check=failChecks(s,h.id)[0];
    const row={id:'sv'+Date.now(),hiveId:txt(hid),date:todayFor(s,h),episodeId:txt(check?.episodeId),sourceActionId:txt(actionId),sourceCheckId:txt(check?.id),sourceTaskId:txt(a.id),queenCellStatus:txt(document.getElementById('r09v-queen-cells')?.value)||'Not assessed',colonyCongestion:txt(document.getElementById('r09v-congestion')?.value)||'Not assessed',broodNestSpace:txt(document.getElementById('r09v-brood-space')?.value)||'Not assessed',superSpace:txt(document.getElementById('r09v-super-space')?.value)||'Not assessed',swarmSigns:txt(document.getElementById('r09v-swarm-signs')?.value)||'Not assessed',queenSeen:txt(document.getElementById('r09v-queen-seen')?.value)||'Not assessed',notes:txt(document.getElementById('r09v-notes')?.value),recordedAt:new Date().toISOString(),coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    row.verificationResult=resultForVerification(row);s.logs=s.logs||{};s.logs.swarmVerifications=Array.isArray(s.logs.swarmVerifications)?s.logs.swarmVerifications:[];s.logs.swarmVerifications.push(row);
    if(typeof save==='function'&&save(s)===false)return toast('Swarm Verification could not be saved');clearDraft();toast('Swarm Verification saved');go('actions');
  };

  // Draft durability for the targeted verification page.
  const IDS=['r09v-queen-cells','r09v-congestion','r09v-brood-space','r09v-super-space','r09v-swarm-signs','r09v-queen-seen','r09v-notes'];
  const drafts=new Map();let restoring=false;
  const routeKey=()=>{const r=txt(location.hash||'').replace(/^#/,'');return r.startsWith('swarm-verification/')?r:''};
  function snapshot(k){if(!k||restoring)return;const o={};let found=false;for(const id of IDS){const el=document.getElementById(id);if(el){o[id]=String(el.value??'');found=true}}if(found)drafts.set(k,o)}
  function restore(k){const o=drafts.get(k);if(!k||!o)return;restoring=true;try{for(const id of IDS){const el=document.getElementById(id);if(el&&id in o&&String(el.value??'')!==o[id])el.value=o[id]}}finally{restoring=false}}
  function clearDraft(){const k=routeKey();if(k)drafts.delete(k)}
  document.addEventListener('change',ev=>{if(IDS.includes(txt(ev?.target?.id))){const k=routeKey();if(k)queueMicrotask(()=>snapshot(k))}},true);
  document.addEventListener('input',ev=>{if(IDS.includes(txt(ev?.target?.id))){const k=routeKey();if(k)queueMicrotask(()=>snapshot(k))}},true);
  try{const mo=new MutationObserver(()=>{const k=routeKey();if(k)queueMicrotask(()=>restore(k))});const start=()=>{const root=document.getElementById('view');if(root)mo.observe(root,{childList:true,subtree:true})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}catch(_){ }
  const guard=setInterval(()=>{const k=routeKey();if(k&&drafts.has(k))restore(k)},250);window.addEventListener('beforeunload',()=>clearInterval(guard),{once:true});
  let lastKey=routeKey();window.addEventListener('hashchange',()=>{const next=routeKey();if(lastKey&&!next)drafts.delete(lastKey);lastKey=next;if(next)queueMicrotask(()=>restore(next))});

  const prevRender=window.render||((typeof render==='function')?render:null);
  if(typeof prevRender==='function'){
    window.render=function(){
      const before=routeKey();if(before)snapshot(before);
      const p=txt(location.hash||'#home').replace(/^#/,'').split('/');
      if(p[0]==='swarm-verification'){
        const r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=renderVerification(txt(p[1]),decodeURIComponent(txt(p[2])));
        const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML='<button class="iconbtn" onclick="go(\'actions\')" aria-label="Back">‹</button><div class="pagebar-title">Swarm Verification</div><span></span>'}document.getElementById('bottomnav')?.classList.add('hidden');const k=routeKey();restore(k);queueMicrotask(()=>restore(k));setTimeout(()=>restore(k),0);return;
      }
      if(p[0]==='scientific-action'){
        const a=currentTask(txt(p[1]));
        if(a){const r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=detailHTML(a);const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML='<button class="iconbtn" onclick="go(\'actions\')" aria-label="Back">‹</button><div class="pagebar-title">Task Detail</div><span></span>'}document.getElementById('bottomnav')?.classList.add('hidden');return}
      }
      return prevRender.apply(this,arguments);
    };
    try{render=window.render}catch(_){ }
  }

  const style=document.createElement('style');style.id='v2p2e5r09a3-style';style.textContent=`
    .v2p2e5r09-source,.v2p2e5r09-pill{display:inline-flex;padding:3px 7px;border-radius:999px;background:#f1f4eb;color:#58704d;font-size:10px;font-weight:700}
    .v2p2e5r09-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-top:8px}.v2p2e5r09-grid span{display:flex;flex-direction:column;font-size:11px;color:#667064}.v2p2e5r09-grid b{margin-top:2px;color:#263527;font-size:12px;overflow-wrap:anywhere}
    .v2p2e5r09-warning{margin-top:12px;padding:10px;border-radius:10px;background:#fff7dc;border:1px solid #eadca7;font-size:11px;line-height:1.45;color:#5b543b}
    .v2p2e5r09-form label{display:flex;flex-direction:column;gap:6px;padding:10px 0;border-bottom:1px solid #ece8dd}.v2p2e5r09-form label:last-child{border-bottom:0}.v2p2e5r09-form select{width:100%;min-height:44px;border:1px solid #ddd7c8;border-radius:10px;background:#fff;padding:0 10px}.v2p2e5r09-form small{color:#9a7820;font-size:10px}.v2p2e5r09-note{display:flex;flex-direction:column;gap:8px}.v2p2e5r09-note textarea{min-height:90px;border:1px solid #ddd7c8;border-radius:10px;padding:10px}.v2p2e5r09-actions{display:grid;grid-template-columns:1fr 1.45fr;gap:10px}.v2p2e5r09-verification{padding-bottom:22px}
  `;document.head.appendChild(style);

  console.log('V2P2E5R09A3 LOADED | R09 post-B41 Swarm Verification lifecycle active');
})();
