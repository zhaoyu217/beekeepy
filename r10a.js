/* ==============================================================
   HiveDash V2P2E5R10A — R10 / S21 SPLIT ESTABLISHMENT VERIFICATION

   Scope:
   - Add the scientific R10/S21 layer ABOVE frozen B39 Split Hive.
   - Replace the legacy Pending "Split follow-up" UI projection with one
     System Split Verification task; preserve the original B39 Action/history.
   - Respect the actual queen path. A Queen-cell split is NOT failed merely
     because eggs are absent at the old 7-day B39 follow-up.
   - For Queen-cell paths, start queen-right verification around day 21 and
     keep an explicit grace window through day 28. Before day 28, absence of
     eggs/young brood is INCONCLUSIVE / VERIFY_LATER, never automatic FAIL.
   - Collect targeted current evidence; do not force a Full Inspection.

   Evidence / safety boundaries:
   - Frozen B39 workflow, result schema and child-Hive creation are untouched.
   - The legacy B39 follow-up remains persisted as history/lineage; R10 only
     replaces its Active UI projection and may close it only after R10 PASS.
   - Previous Split plan/result values are reference only, never current
     biological evidence.
   - Queen seen alone is not queen-right proof; eggs/young brood outrank it.
   - Unknown / missing values never become PASS or FAIL by default.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R10A__) return;
  window.__HIVEDASH_V2P2E5R10A__=true;
  window.__HIVEDASH_V2P2E5R10A_VERSION__='v2p2e5r10a-s21-path-aware-split-verification';

  const CORE_RULE_ID='HD-R10S-SPLIT-VERIFICATION';
  const RULE_VERSION='HD-R10S-v1.0-2026-09-13';
  const MIGRATION_VERSION='V2P2E5R10A';
  const CATALOG_RULE_ID='R10';
  const CATALOG_TASK_ID='S21';
  const LEGACY_SOURCE='split-hive-follow-up';
  const base=window.HiveDashTaskEngineCoreV1||{};

  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const iso=v=>/^\d{4}-\d{2}-\d{2}$/.test(txt(v).slice(0,10))?txt(v).slice(0,10):'';
  const esc=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S=()=>{try{return typeof v45s==='function'?v45s():state()}catch(_){return null}};
  const active=s=>{try{return typeof v224ActiveTrackedHives==='function'?v224ActiveTrackedHives(s):(s?.hives||[]).filter(h=>h&&!h.archived&&!['combined','archived'].includes(low(h.lifecycleStatus||h.status)))}catch(_){return (s?.hives||[]).filter(Boolean)}};
  const hiveBy=(s,id)=>(s?.hives||[]).find(h=>h&&txt(h.id)===txt(id))||null;
  const todayFor=(s,h)=>{try{return typeof v2p2e5Today==='function'?txt(v2p2e5Today(s,h?.id||'')):typeof v2p1bDateInHiveTimezone==='function'?txt(v2p1bDateInHiveTimezone(s,h)):new Date().toISOString().slice(0,10)}catch(_){return new Date().toISOString().slice(0,10)}};
  const dayNo=v=>{const d=iso(v);return d?Math.floor(Date.parse(d+'T00:00:00Z')/86400000):null};
  const addDays=(v,n)=>{const d=dayNo(v);return d===null?'':new Date((d+Number(n||0))*86400000).toISOString().slice(0,10)};
  const daysBetween=(a,b)=>{const A=dayNo(a),B=dayNo(b);return A===null||B===null?null:B-A};
  const isCompleted=a=>!!a&&(['completed','done'].includes(low(a.status))||low(a.priority)==='done'||!!a.resultAppliedAt||a.resultData?.splitCompleted===true);

  const SOURCES=Object.freeze({
    PSU:Object.freeze({id:'PSU-SPLIT-3-WEEK',authority:'Penn State Extension',summary:'After a colony is left to rear a queen, avoid disturbance for roughly two to three weeks; after about three weeks check for eggs.'}),
    USU:Object.freeze({id:'USU-SPLIT-24-28',authority:'Utah State University Extension',summary:'A colony-reared queen commonly reaches orientation/mating around days 19–21 and first eggs around days 24–28 after the split.'}),
    CONTRACT:Object.freeze({id:'R10-S21-CONTRACT',authority:'HiveDash Scientific Task Engine v1.0',summary:'R10 verifies split establishment using queen evidence, eggs/young brood, colony strength, food and queen-cell context; timing depends on the queen path.'})
  });

  function allSplitActions(s){
    const rows=[...(Array.isArray(s?.actions)?s.actions:[]),...(Array.isArray(s?.meta?.completedActions)?s.meta.completedActions:[])],seen=new Set();
    return rows.filter(a=>a&&low(a.type)==='split-hive'&&!seen.has(txt(a.id))&&seen.add(txt(a.id)));
  }
  function splitById(s,id){return allSplitActions(s).find(a=>txt(a.id)===txt(id))||null}
  function legacyFollowups(s){return (Array.isArray(s?.actions)?s.actions:[]).filter(a=>a&&txt(a.source)===LEGACY_SOURCE&&!isCompleted(a))}
  function splitForFollow(s,f){
    const pid=txt(f?.parentActionId||f?.linkedActionId||f?.createdFromSplitActionId);
    if(pid){const a=splitById(s,pid);if(a)return a}
    return allSplitActions(s).find(a=>isCompleted(a)&&txt(a.resultData?.newHiveId)===txt(f?.hiveId))||null;
  }
  function childForSplit(s,a){
    const rd=a?.resultData||{};
    return hiveBy(s,rd.newHiveId)||(s?.hives||[]).find(h=>txt(h?.createdFromSplitActionId)===txt(a?.id))||null;
  }
  function sourceForSplit(s,a){return hiveBy(s,a?.hiveId)}
  function legacyForSplit(s,a){return legacyFollowups(s).find(f=>txt(f.parentActionId||f.linkedActionId||f.createdFromSplitActionId)===txt(a.id)||txt(f.hiveId)===txt(a.resultData?.newHiveId))||null}
  function verifications(s,splitId){return (Array.isArray(s?.logs?.splitVerifications)?s.logs.splitVerifications:[]).filter(v=>v&&txt(v.splitActionId)===txt(splitId)&&txt(v.coreRuleId)===CORE_RULE_ID).slice().sort((a,b)=>txt(b.recordedAt||b.id).localeCompare(txt(a.recordedAt||a.id)))}

  function queenPath(a){
    const p=txt(a?.workflowData?.queenPlan||'Not decided');
    if(low(p)==='queen cell')return {code:'QUEEN_CELL',label:'Queen cell',startDays:21,finalDays:28,source:SOURCES.PSU,secondSource:SOURCES.USU};
    if(low(p)==='new hive gets queen')return {code:'LAYING_QUEEN_TRANSFER',label:'New hive gets queen',startDays:7,finalDays:14,source:SOURCES.CONTRACT,secondSource:null};
    if(low(p)==='introduce queen later')return {code:'INTRODUCE_LATER',label:'Introduce queen later',startDays:null,finalDays:null,source:SOURCES.CONTRACT,secondSource:null};
    if(low(p)==='parent keeps queen')return {code:'CHILD_PATH_UNRESOLVED',label:'Parent keeps queen / child queen path unresolved',startDays:null,finalDays:null,source:SOURCES.CONTRACT,secondSource:null};
    return {code:'UNRESOLVED',label:p||'Not decided',startDays:null,finalDays:null,source:SOURCES.CONTRACT,secondSource:null};
  }
  function timingFor(s,a,child){
    const rd=a?.resultData||{},completed=iso(rd.completedDate||a?.completedAt),p=queenPath(a),legacy=legacyForSplit(s,a),oldDue=iso(legacy?.dueDate||legacy?.due||rd.followUpDate||a?.followUpDate);
    const start=p.startDays!==null&&completed?addDays(completed,p.startDays):oldDue;
    const final=p.finalDays!==null&&completed?addDays(completed,p.finalDays):'';
    const today=todayFor(s,child),age=completed?daysBetween(completed,today):null;
    let phase='PATH_CONFIRMATION_REQUIRED';
    if(p.code==='QUEEN_CELL') phase=age===null?'UNKNOWN':age<p.startDays?'EARLY_ESTABLISHMENT':age<p.finalDays?'QUEEN_RIGHT_WINDOW':'FINAL_QUEEN_RIGHT_WINDOW';
    else if(p.code==='LAYING_QUEEN_TRANSFER') phase=age===null?'UNKNOWN':age<p.startDays?'EARLY_ESTABLISHMENT':'QUEEN_RIGHT_WINDOW';
    return {path:p,completed,legacyDue:oldDue,verificationStart:start,finalQueenRightDate:final,today,daysSinceSplit:age,phase};
  }

  function resultForVerification(v,t){
    if(!v)return 'NONE';
    const eggs=low(v.eggs),young=low(v.youngBrood),strength=low(v.colonyStrength),food=low(v.foodStores),cells=low(v.queenCells),source=low(v.sourceHiveStatus);
    const required=[eggs,young,strength,food,cells,source];
    if(required.some(x=>['','not assessed','not checked','unknown'].includes(x)))return 'INCONCLUSIVE';
    const queenRight=eggs==='seen'||young==='seen';
    if(queenRight && !['weak','failing'].includes(strength) && food!=='low')return 'PASS';
    if(t?.path?.code==='QUEEN_CELL' && Number(t.daysSinceSplit)<Number(t.path.finalDays))return 'INCONCLUSIVE';
    if(t?.path?.code==='QUEEN_CELL' && Number(t.daysSinceSplit)>=Number(t.path.finalDays) && eggs==='not seen' && young==='not seen')return 'FAIL';
    if(t?.path?.code==='LAYING_QUEEN_TRANSFER' && Number(t.daysSinceSplit)>=Number(t.path.finalDays) && eggs==='not seen' && young==='not seen')return 'FAIL';
    return 'INCONCLUSIVE';
  }

  function evidenceChain(s,a,child,source,t,v=null){
    const w=a?.workflowData||{},rd=a?.resultData||{};
    return {
      splitActionId:txt(a?.id),sourceHiveId:txt(source?.id||a?.hiveId),sourceHiveName:txt(source?.name)||'Not recorded',childHiveId:txt(child?.id||rd.newHiveId),childHiveName:txt(child?.name||rd.actualNewHiveName||w.plannedNewHiveName)||'Not recorded',
      splitCompletedDate:t.completed||'Not recorded',queenPlan:t.path.label,queenPathCode:t.path.code,queenOutcome:txt(rd.queenOutcome)||'Not recorded',plannedBroodFrames:w.plannedBroodFrames??'Not recorded',plannedFoodFrames:w.plannedFoodFrames??'Not recorded',actualBroodFrames:rd.actualBroodFrames??'Not recorded',actualFoodFrames:rd.actualFoodFrames??'Not recorded',
      legacyFollowUpDate:t.legacyDue||'Not recorded',verificationStart:t.verificationStart||'Needs queen-path confirmation',finalQueenRightDate:t.finalQueenRightDate||'Needs queen-path confirmation',daysSinceSplit:t.daysSinceSplit??'Not recorded',timingPhase:t.phase,
      childLastInspection:txt(child?.lastInspection)||'Not recorded',authorityPrimary:t.path.source?.authority||SOURCES.CONTRACT.authority,authorityPrimaryId:t.path.source?.id||SOURCES.CONTRACT.id,authoritySecondary:t.path.secondSource?.authority||'',authoritySecondaryId:t.path.secondSource?.id||'',
      latestVerificationId:txt(v?.id),latestVerificationDate:txt(v?.date),latestVerificationResult:txt(v?.verificationResult),verifiedEggs:txt(v?.eggs),verifiedYoungBrood:txt(v?.youngBrood),verifiedStrength:txt(v?.colonyStrength),verifiedFood:txt(v?.foodStores),verifiedQueenCells:txt(v?.queenCells),verifiedSourceStatus:txt(v?.sourceHiveStatus)
    };
  }

  function taskFor(s,a,child,source,t,latest){
    const latestResult=txt(latest?.verificationResult).toUpperCase();
    if(latestResult==='PASS')return null;
    const id=`scientific-r10-s21-${txt(a.id)}`;
    const due=t.verificationStart||t.legacyDue||'Needs confirmation';
    let title='Verify split establishment',why=`Split ${t.completed||'completion'} created ${child?.name||'the child hive'}. Verify establishment and queen-right evidence using the actual queen path rather than assuming the split succeeded.`;
    let stage='follow-up',assessment='SPLIT_VERIFICATION_REQUIRED',decision='AUTO_CREATE',verification='PENDING',outcome='OPEN';
    if(latestResult==='INCONCLUSIVE'){
      title=t.path.code==='QUEEN_CELL'&&Number(t.daysSinceSplit)<Number(t.path.finalDays)?'Split verification still developing':'Split verification still needed';
      why=t.path.code==='QUEEN_CELL'&&Number(t.daysSinceSplit)<Number(t.path.finalDays)?`The latest Split Verification did not yet prove queen-right status, but this Queen-cell split is still inside its normal development window. Missing eggs before the end of that window is not treated as failure.`:'The latest Split Verification did not provide enough current evidence to close the split-establishment episode.';
      verification='INCONCLUSIVE';outcome='OPEN';
    }else if(latestResult==='FAIL'){
      title='Split queen-right still uncertain';why='The post-split verification reached the path-specific final window without queen-right evidence. Review Queen Management / R02 rather than assuming the child hive established successfully.';stage='management-review';assessment='SPLIT_ESTABLISHMENT_FAILED';decision='RECOMMEND_CONFIRM';verification='FAIL';outcome='ESCALATE_TO_R02';
    }else if(t.path.code==='QUEEN_CELL'){
      why=`This is a Queen-cell split. The old B39 follow-up date (${t.legacyDue||'not recorded'}) is historical planning context, not a final queen-right deadline. Target queen-right verification begins around day 21; absence of eggs before day 28 is not automatic failure.`;
    }else if(['INTRODUCE_LATER','CHILD_PATH_UNRESOLVED','UNRESOLVED'].includes(t.path.code)){
      title='Confirm split queen path';why='The completed Split does not contain enough timing evidence to calculate a scientifically defensible queen-right deadline. Confirm the child hive queen path before judging establishment.';stage='confirmation';assessment='SPLIT_PATH_UNRESOLVED';decision='RECOMMEND_CONFIRM';verification='NOT_REQUIRED';outcome='OPEN';
    }
    return {
      id,hiveId:child?.id||a?.resultData?.newHiveId,type:'Inspection',title,status:'Pending',priority:latestResult==='FAIL'?'High':'Medium',due,dueDate:iso(due),date:iso(due),source:'scientific-engine',systemGenerated:true,reasonCode:'split',intentKey:'split-verification',workflowStage:stage,executionRoute:stage==='management-review'?'':`split-verification/${encodeURIComponent(txt(child?.id||a?.resultData?.newHiveId))}/${encodeURIComponent(txt(a.id))}`,
      systemWhy:why,coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,ruleEngineOwner:'HiveDashTaskEngineCoreV1',ruleMigrationVersion:MIGRATION_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,assessmentType:assessment,decisionType:decision,automationLevel:decision==='AUTO_CREATE'?'A_AUTO_TASK':'B_RECOMMEND_CONFIRM',verificationStatus:verification,outcomeSnapshot:{status:outcome},sourceActionId:txt(a.id),legacyFollowUpId:txt(legacyForSplit(s,a)?.id),
      evidenceChain:evidenceChain(s,a,child,source,t,latest)
    };
  }

  function evaluationForSplit(s,a){
    if(!a||!isCompleted(a))return {assessment:{status:'NO_COMPLETED_SPLIT'},decision:{type:'NO_TASK'},verification:{result:'NOT_REQUIRED'},outcome:{status:'NOT_OPEN'},task:null};
    const child=childForSplit(s,a),source=sourceForSplit(s,a);if(!child)return {assessment:{status:'CHILD_HIVE_NOT_FOUND'},decision:{type:'NO_TASK'},verification:{result:'NOT_REQUIRED'},outcome:{status:'NOT_OPEN'},task:null};
    const t=timingFor(s,a,child),latest=verifications(s,a.id)[0]||null,lr=txt(latest?.verificationResult).toUpperCase(),task=taskFor(s,a,child,source,t,latest);
    const status=lr==='PASS'?'SPLIT_ESTABLISHED':lr==='FAIL'?'SPLIT_ESTABLISHMENT_FAILED':lr==='INCONCLUSIVE'?'SPLIT_VERIFICATION_INCONCLUSIVE':t.path.code==='QUEEN_CELL'?'SPLIT_VERIFICATION_REQUIRED':'SPLIT_PATH_UNRESOLVED';
    return {assessment:{status,splitActionId:txt(a.id),childHiveId:txt(child.id),queenPath:t.path.code,daysSinceSplit:t.daysSinceSplit},decision:{type:task?.decisionType||'NO_TASK',automationLevel:task?.automationLevel||'NONE'},verification:{result:lr||'PENDING'},outcome:{status:lr==='PASS'?'RESOLVED':lr==='FAIL'?'ESCALATE_TO_R02':'OPEN'},task,timing:t};
  }
  function evaluationForChild(s,hid){
    const follow=legacyFollowups(s).find(f=>txt(f.hiveId)===txt(hid));
    const a=follow?splitForFollow(s,follow):allSplitActions(s).find(x=>isCompleted(x)&&txt(x.resultData?.newHiveId)===txt(hid));
    return a?evaluationForSplit(s,a):{assessment:{status:'NO_LINKED_SPLIT'},decision:{type:'NO_TASK'},verification:{result:'NOT_REQUIRED'},outcome:{status:'NOT_OPEN'},task:null};
  }

  const ruleDefinition=Object.freeze({id:CORE_RULE_ID,version:RULE_VERSION,engineOwner:'HiveDashTaskEngineCoreV1',migrationVersion:MIGRATION_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,category:'SPLIT_VERIFICATION',assessmentType:'SPLIT_VERIFICATION_REQUIRED',decisionClass:'A_AUTO_TASK',evidenceInputs:Object.freeze(['B39 Split Completed','child Hive lineage','targeted Split Verification']),contextInputs:Object.freeze(['queen path','days since Split','legacy follow-up date']),authorityRules:SOURCES,policy:Object.freeze({splitCompletedDoesNotEqualEstablished:true,queenPathControlsTiming:true,queenCellNoEggsBeforeDay28DoesNotFail:true,queenSeenAloneDoesNotProveQueenRight:true,targetedVerification:true,passFailInconclusive:true}),evaluate:(s,h)=>evaluationForChild(s,h.id)});
  try{if(typeof base.registerRule==='function')base.registerRule(ruleDefinition)}catch(err){console.error('V2P2E5R10A rule registration failed',err)}
  window.HiveDashTaskEngineCoreV1=Object.freeze({...base,splitVerificationRule:ruleDefinition,evaluateSplitVerification:(s,hid)=>evaluationForChild(s,hid)});
  window.V2P2E5R10_SPLIT_VERIFICATION_RULE=ruleDefinition;
  window.v2p2e5r10Evaluate=function(hiveId){return evaluationForChild(S(),hiveId)};

  function eligibleLegacy(a,s){return !!a&&txt(a.source)===LEGACY_SOURCE&&!isCompleted(a)&&!!splitForFollow(s,a)}
  function projectedTasks(s){
    const out=[];
    for(const f of legacyFollowups(s)){
      const a=splitForFollow(s,f);if(!a)continue;
      const ev=evaluationForSplit(s,a);if(ev.task)out.push(ev.task);
    }
    return out;
  }
  function mergeProjection(rows,s,mode='Pending'){
    const normalized=low(mode||'Pending');if(normalized==='completed')return rows;
    const baseRows=(rows||[]).filter(a=>!eligibleLegacy(a,s));
    const seen=new Set(baseRows.map(a=>txt(a.id)));
    for(const t of projectedTasks(s)){if(!seen.has(txt(t.id))){seen.add(txt(t.id));baseRows.push(t)}}
    return baseRows;
  }

  const prevGenerate=window.generateActions||((typeof generateActions==='function')?generateActions:null);
  if(typeof prevGenerate==='function'){
    window.generateActions=function(s){return mergeProjection(prevGenerate(s)||[],s,'Pending')};
    try{generateActions=window.generateActions}catch(_){ }
  }
  const prevRows=window.v53ActionRows||((typeof v53ActionRows==='function')?v53ActionRows:null);
  if(typeof prevRows==='function'){
    window.v53ActionRows=function(mode='Pending'){const s=S();return mergeProjection(prevRows.apply(this,arguments)||[],s,mode)};
    try{v53ActionRows=window.v53ActionRows}catch(_){ }
  }

  function projectedById(id){try{return (window.v53ActionRows?.('Pending')||[]).find(a=>a&&txt(a.id)===txt(id)&&txt(a.coreRuleId)===CORE_RULE_ID)||null}catch(_){return null}}
  const prevAMOpen=window.v2p2e5amOpenTask;
  if(typeof prevAMOpen==='function')window.v2p2e5amOpenTask=function(actionId){const a=projectedById(actionId);if(a)return go(`scientific-action/${encodeURIComponent(txt(a.id))}`);return prevAMOpen.apply(this,arguments)};
  const prevABOpen=window.v2p2e5abOpenUnifiedAction;
  if(typeof prevABOpen==='function')window.v2p2e5abOpenUnifiedAction=function(actionId){const a=projectedById(actionId);if(a)return go(`scientific-action/${encodeURIComponent(txt(a.id))}`);return prevABOpen.apply(this,arguments)};

  window.v2p2e5r10OpenVerification=function(actionId){
    const a=projectedById(actionId);if(!a)return toast('This Split Verification is no longer active');
    if(low(a.workflowStage)==='management-review')return toast('This split needs Queen Management review, not another automatic verification');
    go(`split-verification/${encodeURIComponent(txt(a.hiveId))}/${encodeURIComponent(txt(a.sourceActionId))}`);
  };

  function detailHTML(a){
    const s=S(),h=hiveBy(s,a.hiveId),e=a.evidenceChain||{},stage=low(a.workflowStage),stageLabel=stage==='management-review'?'Review management':stage==='confirmation'?'Confirm pathway':'Verify result';
    const beforeStart=e.timingPhase==='EARLY_ESTABLISHMENT';
    return `<div class="vs v2p2e5r10-detail">
      <section class="vc"><div class="vhead"><b>${esc(a.title||'Verify split establishment')}</b><span class="v2p2e5r10-pill">System</span></div><div class="v2p2e5r10-grid"><span>Hive<b>${esc(h?.name||'Unavailable')}</b></span><span>Stage<b>${esc(stageLabel)}</b></span><span>Priority<b>${esc(a.priority||'Medium')}</b></span><span>Due<b>${esc(a.due||'Needs confirmation')}</b></span></div></section>
      <section class="vc"><div class="vhead"><b>Why this task exists</b></div><p>${esc(a.systemWhy||'A completed Split needs establishment verification.')}</p></section>
      <section class="vc"><div class="vhead"><b>Split establishment evidence</b><span class="v2p2e5r10-pill">R10 · S21</span></div><div class="v2p2e5r10-grid">
        <span>Source hive<b>${esc(e.sourceHiveName||'Not recorded')}</b></span><span>Child hive<b>${esc(e.childHiveName||'Not recorded')}</b></span>
        <span>Split completed<b>${esc(e.splitCompletedDate||'Not recorded')}</b></span><span>Queen path<b>${esc(e.queenPlan||'Not decided')}</b></span>
        <span>Planned brood transfer<b>${esc(e.plannedBroodFrames)}</b></span><span>Planned food transfer<b>${esc(e.plannedFoodFrames)}</b></span>
        <span>Old B39 follow-up<b>${esc(e.legacyFollowUpDate||'Not recorded')}</b></span><span>Days since split<b>${esc(e.daysSinceSplit)}</b></span>
        <span>Queen-right verification start<b>${esc(e.verificationStart||'Needs confirmation')}</b></span><span>Final queen-right window<b>${esc(e.finalQueenRightDate||'Needs confirmation')}</b></span>
        <span>Child last Full Inspection<b>${esc(e.childLastInspection||'Not recorded')}</b></span><span>Timing phase<b>${esc(e.timingPhase||'Unknown')}</b></span>
      </div>${e.queenPathCode==='QUEEN_CELL'?`<div class="v2p2e5r10-warning"><b>Queen-cell timing boundary</b><br>The old 7-day B39 follow-up is not a final queen-right deadline. Around day 21, begin checking for queen-right evidence. Until the end of the day-28 window, missing eggs / young brood remains unresolved rather than automatic failure.</div>`:`<div class="v2p2e5r10-warning"><b>Path boundary</b><br>HiveDash will not invent a queen-right deadline when the child-hive queen path is not recorded precisely enough.</div>`}</section>
      <section class="vc"><div class="vhead"><b>What happens next</b></div><p>${stage==='management-review'?'Review the failed establishment verification and choose Queen Management / R02 only if appropriate.':beforeStart?'You may record an early establishment check, but absence of eggs or young brood cannot fail this Queen-cell split yet.':'Record targeted split-establishment evidence. This does not count as a Full Inspection.'}</p></section>
      <div class="v2p2e5r10-actions"><button class="secondary" onclick="go('actions')">Back</button>${stage==='management-review'?`<button class="primary" onclick="v2p2e5r10ReviewQueen('${esc(a.id)}')">Review Queen Management</button>`:`<button class="primary" onclick="v2p2e5r10OpenVerification('${esc(a.id)}')">${beforeStart?'Start Establishment Check':'Start Split Verification'}</button>`}</div>
    </div>`;
  }

  window.v2p2e5r10ReviewQueen=function(actionId){
    const a=projectedById(actionId);if(!a)return toast('This Split review is no longer active');
    if(typeof b38OpenQueenAction==='function')return b38OpenQueenAction(txt(a.hiveId),'scientific-engine','queen');
    return go('actions');
  };

  function formHTML(hid,splitId){
    const s=S(),a=splitById(s,splitId),child=hiveBy(s,hid),source=sourceForSplit(s,a);if(!a||!child)return `<div class="vs"><section class="vc"><b>Split Verification unavailable</b><p>The linked Split or child Hive could not be found.</p><button class="primary" onclick="go('actions')">Back to Actions</button></section></div>`;
    const ev=evaluationForSplit(s,a),t=ev.timing,e=ev.task?.evidenceChain||evidenceChain(s,a,child,source,t,null),early=t.path.code==='QUEEN_CELL'&&Number(t.daysSinceSplit)<Number(t.path.startDays),preFinal=t.path.code==='QUEEN_CELL'&&Number(t.daysSinceSplit)<Number(t.path.finalDays);
    return `<div class="vs v2p2e5r10-form-page"><section class="vc"><div class="vhead"><b>Split Verification · targeted evidence</b><span class="v2p2e5r10-pill">R10 · S21</span></div><p class="muted">Record only what you assess now. Split plan values and earlier hive records are reference only. This does not count as a Full Inspection.</p>${early?`<div class="v2p2e5r10-warning"><b>Early establishment check</b><br>This Queen-cell split is only ${esc(t.daysSinceSplit)} days old. Missing eggs / young brood cannot be treated as failure. Final queen-right failure is blocked until the day-28 window.</div>`:preFinal?`<div class="v2p2e5r10-warning"><b>Queen-right verification window</b><br>Current evidence may prove establishment early, but missing eggs / young brood remains unresolved until the final path-specific window.</div>`:''}</section>
      <section class="vc v2p2e5r10-form">
        <label><span>Queen Seen</span><select id="r10-queen-seen"><option>Not assessed</option><option>Seen</option><option>Not seen</option></select><small>Queen seen alone does not prove queen-right status.</small></label>
        <label><span>Eggs</span><select id="r10-eggs"><option>Not assessed</option><option>Seen</option><option>Not seen</option></select></label>
        <label><span>Young Brood</span><select id="r10-young-brood"><option>Not assessed</option><option>Seen</option><option>Not seen</option></select></label>
        <label><span>Colony Strength</span><select id="r10-strength"><option>Not assessed</option><option>Weak</option><option>Moderate</option><option>Strong</option></select></label>
        <label><span>Food Stores</span><select id="r10-food"><option>Not assessed</option><option>Low</option><option>Adequate</option><option>High</option></select><small>Split plan food: ${esc(e.plannedFoodFrames)} frame(s) · reference only</small></label>
        <label><span>Queen Cells</span><select id="r10-queen-cells"><option>Not assessed</option><option>None seen</option><option>Cups only</option><option>Charged cells</option><option>Capped queen cells</option></select><small>Queen path: ${esc(e.queenPlan)} · reference only</small></label>
        <label><span>Source Hive Status</span><select id="r10-source-status"><option>Not assessed</option><option>Stable</option><option>Needs attention</option></select><small>${esc(e.sourceHiveName)} · key-state check only</small></label>
      </section>
      <section class="vc"><div class="vhead"><b>Linked Split</b></div><div class="v2p2e5r10-grid"><span>Split action<b>${esc(splitId)}</b></span><span>Completed<b>${esc(t.completed||'Not recorded')}</b></span><span>Child hive<b>${esc(child.name||hid)}</b></span><span>Queen path<b>${esc(t.path.label)}</b></span><span>Verification start<b>${esc(t.verificationStart||'Needs confirmation')}</b></span><span>Final queen-right window<b>${esc(t.finalQueenRightDate||'Needs confirmation')}</b></span></div></section>
      <section class="vc"><label class="v2p2e5r10-note"><span>Notes</span><textarea id="r10-notes" maxlength="500" placeholder="Optional current split-establishment context"></textarea></label></section>
      <div class="v2p2e5r10-actions"><button class="secondary" onclick="go('actions')">Cancel</button><button class="primary" onclick="v2p2e5r10SaveVerification('${esc(hid)}','${esc(splitId)}')">Save Split Verification</button></div></div>`;
  }

  function closeLegacyFollowupOnPass(s,a,verification){
    const f=legacyForSplit(s,a);if(!f)return;
    const idx=(s.actions||[]).findIndex(x=>x&&txt(x.id)===txt(f.id));if(idx<0)return;
    const row=s.actions[idx],now=new Date().toISOString();row.status='Completed';row.priority='Done';row.completedAt=now;row.linkedRecordId=txt(verification.id);row.completionSource='r10-s21-split-verification-pass';
    s.meta=s.meta||{};s.meta.completedActions=Array.isArray(s.meta.completedActions)?s.meta.completedActions:[];const cp=JSON.parse(JSON.stringify(row)),mi=s.meta.completedActions.findIndex(x=>x&&txt(x.id)===txt(row.id));if(mi>=0)s.meta.completedActions[mi]=cp;else s.meta.completedActions.push(cp);s.actions.splice(idx,1);
  }

  window.v2p2e5r10SaveVerification=function(hid,splitId){
    const s=S(),a=splitById(s,splitId),child=hiveBy(s,hid);if(!a||!child)return toast('Linked Split is no longer available');
    const t=timingFor(s,a,child);
    const row={id:'split-verification-'+Date.now(),hiveId:txt(hid),splitActionId:txt(splitId),sourceHiveId:txt(a.hiveId),date:todayFor(s,child),queenSeen:txt(document.getElementById('r10-queen-seen')?.value)||'Not assessed',eggs:txt(document.getElementById('r10-eggs')?.value)||'Not assessed',youngBrood:txt(document.getElementById('r10-young-brood')?.value)||'Not assessed',colonyStrength:txt(document.getElementById('r10-strength')?.value)||'Not assessed',foodStores:txt(document.getElementById('r10-food')?.value)||'Not assessed',queenCells:txt(document.getElementById('r10-queen-cells')?.value)||'Not assessed',sourceHiveStatus:txt(document.getElementById('r10-source-status')?.value)||'Not assessed',notes:txt(document.getElementById('r10-notes')?.value),daysSinceSplit:t.daysSinceSplit,queenPathCode:t.path.code,verificationStart:t.verificationStart,finalQueenRightDate:t.finalQueenRightDate,recordedAt:new Date().toISOString(),coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    row.verificationResult=resultForVerification(row,t);s.logs=s.logs||{};s.logs.splitVerifications=Array.isArray(s.logs.splitVerifications)?s.logs.splitVerifications:[];s.logs.splitVerifications.push(row);
    if(row.verificationResult==='PASS')closeLegacyFollowupOnPass(s,a,row);
    if(typeof save==='function'&&save(s)===false)return toast('Split Verification could not be saved');toast('Split Verification saved');go('actions');
  };

  const DRAFT_IDS=['r10-queen-seen','r10-eggs','r10-young-brood','r10-strength','r10-food','r10-queen-cells','r10-source-status','r10-notes'];
  const drafts=new Map();const routeKey=()=>{const r=txt(location.hash||'').replace(/^#/,'');return r.startsWith('split-verification/')?r:''};
  function snap(k){if(!k)return;const v={};let found=false;for(const id of DRAFT_IDS){const el=document.getElementById(id);if(el){v[id]=el.value;found=true}}if(found)drafts.set(k,v)}
  function restore(k){const v=drafts.get(k);if(!v)return;for(const id of DRAFT_IDS){const el=document.getElementById(id);if(el&&id in v)el.value=v[id]}}
  const remember=ev=>{if(DRAFT_IDS.includes(txt(ev?.target?.id))){const k=routeKey();if(k)snap(k)}};document.addEventListener('change',remember,true);document.addEventListener('input',remember,true);

  const prevRender=window.render||((typeof render==='function')?render:null);
  if(typeof prevRender==='function'){
    window.render=function(){
      const before=routeKey();if(before)snap(before);
      const p=txt(location.hash||'#home').replace(/^#/,'').split('/');
      if(p[0]==='scientific-action'){
        let a=null;try{a=(window.v53ActionRows?.('Pending')||[]).find(x=>x&&txt(x.id)===decodeURIComponent(txt(p[1]))&&txt(x.coreRuleId)===CORE_RULE_ID)||null}catch(_){ }
        if(a){const r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=detailHTML(a);const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML='<button class="iconbtn" onclick="go(\'actions\')" aria-label="Back">‹</button><div class="pagebar-title">Task Detail</div><span></span>'}document.getElementById('bottomnav')?.classList.add('hidden');return;}
      }
      if(p[0]==='split-verification'){
        const hid=decodeURIComponent(txt(p[1])),splitId=decodeURIComponent(txt(p[2])),r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=formHTML(hid,splitId);const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML='<button class="iconbtn" onclick="go(\'actions\')" aria-label="Back">‹</button><div class="pagebar-title">Split Verification</div><span></span>'}document.getElementById('bottomnav')?.classList.add('hidden');const k=routeKey();restore(k);queueMicrotask(()=>restore(k));setTimeout(()=>restore(k),0);return;
      }
      return prevRender.apply(this,arguments);
    };
    try{render=window.render}catch(_){ }
  }
  let lastKey=routeKey();window.addEventListener('hashchange',()=>{const next=routeKey();if(lastKey&&!next)drafts.delete(lastKey);lastKey=next});

  const style=document.createElement('style');style.id='v2p2e5r10a-style';style.textContent=`
    .v2p2e5r10-pill{display:inline-flex;padding:3px 7px;border-radius:999px;background:#f1f4eb;color:#58704d;font-size:10px;font-weight:700}.v2p2e5r10-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-top:8px}.v2p2e5r10-grid span{display:flex;flex-direction:column;font-size:11px;color:#667064}.v2p2e5r10-grid b{margin-top:2px;color:#263527;font-size:12px;overflow-wrap:anywhere}.v2p2e5r10-warning{margin-top:12px;padding:10px;border-radius:10px;background:#fff7dc;border:1px solid #eadca7;font-size:11px;line-height:1.45;color:#5b543b}.v2p2e5r10-form label{display:flex;flex-direction:column;gap:6px;padding:10px 0;border-bottom:1px solid #ece8dd}.v2p2e5r10-form label:last-child{border-bottom:0}.v2p2e5r10-form select{width:100%;min-height:44px;border:1px solid #ddd7c8;border-radius:10px;background:#fff;padding:0 10px}.v2p2e5r10-form small{color:#8d7425;font-size:10px}.v2p2e5r10-note{display:flex;flex-direction:column;gap:8px}.v2p2e5r10-note textarea{min-height:90px;border:1px solid #ddd7c8;border-radius:10px;padding:10px}.v2p2e5r10-actions{display:grid;grid-template-columns:1fr 1.45fr;gap:10px}.v2p2e5r10-form-page{padding-bottom:22px}
  `;document.head.appendChild(style);

  console.log('V2P2E5R10A LOADED | R10/S21 path-aware Split Verification active');
})();
