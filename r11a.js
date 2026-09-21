/* ==============================================================
   V2P2E5R11A1 — R11 / S22 SPACE EVALUATION DRAFT-PERSISTENCE FIX

   CURRENT LAUNCH MAPPING (authoritative for this build):
   - Catalog rule R11 = Space insufficiency check
   - Catalog task S22 = Add Space Evaluation

   Safety / scope contract:
   - Do not invent a numeric nationwide space threshold.
   - Trigger only from explicit current space evidence already recorded by the
     beekeeper (Inspection Super Status = Needed) or newer targeted swarm-space
     evidence (Limited/None space or High/Severe congestion).
   - R11 automatically creates an evaluation / follow-up task, but it never
     creates or completes an Add Super action by itself.
   - If targeted evidence confirms insufficient space, R11 hands off to the
     frozen B37 Add / Remove Super workflow. The beekeeper still chooses and
     confirms the actual action and number of supers.
   - A completed R11-linked B37 Add Super plan creates a targeted space
     verification due about 7 days later. PASS requires new targeted evidence;
     completion of the physical action alone is not biological verification.
   - Existing B37 persistence, R08/R09 swarm logic, Inspection persistence,
     Timeline and every frozen rule/workflow are not rewritten.
   ============================================================== */
(function v2p2e5r11aSpaceEvaluation(){
  if(window.__HIVEDASH_V2P2E5R11A__)return;
  window.__HIVEDASH_V2P2E5R11A__=true;

  const CORE_RULE_ID='HD-R11-SPACE-EVALUATION';
  const RULE_VERSION='HD-R11-v1.0-2026-09-20';
  const MIGRATION_VERSION='V2P2E5R11A1';
  const CATALOG_RULE_ID='R11';
  const CATALOG_TASK_ID='S22';
  const CTX_KEY='hivedash:v2p2e5r11:b37-exec';
  const DRAFT_PREFIX='hivedash:v2p2e5r11:space-draft:';
  const VERSION='v2p2e5r11a1-r11-s22-space-evaluation-draft-persistence-fix';

  const base=window.HiveDashTaskEngineCoreV1;
  if(!base||typeof base.normalizeTaskProjection!=='function'||typeof base.buildContextSnapshot!=='function'){
    console.error('V2P2E5R11A requires HiveDashTaskEngineCoreV1');
    return;
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
  const orderMs=x=>stamp(x?.recordedAt)||stamp(x?.completedAt)||stamp(x?.updatedAt)||stamp(x?.createdAt)||stamp(iso(x?.resultData?.completedDate)?iso(x.resultData.completedDate)+'T12:00:00Z':'')||stamp(iso(x?.date)?iso(x.date)+'T12:00:00Z':'')||0;

  function inspections(s,hid){
    return (Array.isArray(s?.logs?.inspections)?s.logs.inspections:[])
      .map((r,index)=>({r,index}))
      .filter(x=>x.r&&txt(x.r.hiveId)===txt(hid)&&x.r.legacySnapshot!==true)
      .sort((a,b)=>orderMs(b.r)-orderMs(a.r)||b.index-a.index);
  }
  function latestInspection(s,hid){return inspections(s,hid)[0]||null}
  function r08Checks(s,hid){
    return (Array.isArray(s?.logs?.swarmRiskChecks)?s.logs.swarmRiskChecks:[])
      .filter(x=>x&&txt(x.hiveId)===txt(hid))
      .slice().sort((a,b)=>orderMs(b)-orderMs(a));
  }
  function spaceChecks(s,hid,episode=''){
    return (Array.isArray(s?.logs?.spaceEvaluations)?s.logs.spaceEvaluations:[])
      .filter(x=>x&&txt(x.hiveId)===txt(hid)&&txt(x.coreRuleId)===CORE_RULE_ID&&(!episode||txt(x.episodeId)===txt(episode)))
      .slice().sort((a,b)=>orderMs(b)-orderMs(a));
  }
  function pendingAddSpace(s,hid){
    return (s?.actions||[]).find(a=>a&&txt(a.hiveId)===txt(hid)&&low(a.type)==='super-management'&&!['completed','done','cancelled'].includes(low(a.status))&&low(a.priority)!=='done'&&low(a.workflowData?.operation)==='add')||null;
  }
  function completedLinkedSpace(s,hid,episode){
    return (s?.meta?.completedActions||[])
      .filter(a=>a&&txt(a.hiveId)===txt(hid)&&low(a.type)==='super-management'&&low(a.status)==='completed'&&low(a.workflowData?.operation)==='add'&&txt(a.r11EpisodeId)===txt(episode))
      .slice().sort((a,b)=>orderMs(b)-orderMs(a))[0]||null;
  }

  const unknown=v=>['','not assessed','not checked','not confirmed','unknown','not recorded','—','-','n/a'].includes(low(v));
  const draftKey=(hid,episode,stage)=>DRAFT_PREFIX+[txt(hid),txt(episode),low(stage)==='follow-up'?'follow-up':'initial'].map(encodeURIComponent).join('|');
  function readSpaceDraft(hid,episode,stage){
    try{return JSON.parse(sessionStorage.getItem(draftKey(hid,episode,stage))||'null')||{}}catch(_){return {}}
  }
  function writeSpaceDraft(hid,episode,stage,patch){
    try{
      const key=draftKey(hid,episode,stage),cur=readSpaceDraft(hid,episode,stage);
      sessionStorage.setItem(key,JSON.stringify({...cur,...(patch||{}),updatedAt:Date.now()}));
    }catch(_){ }
  }
  function clearSpaceDraft(hid,episode,stage){try{sessionStorage.removeItem(draftKey(hid,episode,stage))}catch(_){ }}
  const optionHtml=(items,current)=>items.map(v=>`<option${txt(v)===txt(current)?' selected':''}>${esc(v)}</option>`).join('');
  window.v2p2e5r11DraftSet=function(hid,episode,stage,field,value){writeSpaceDraft(hid,episode,stage,{[txt(field)]:txt(value)})};
  window.v2p2e5r11CancelSpaceEvaluation=function(hid,episode,stage){clearSpaceDraft(hid,episode,stage);go('actions')};
  const shortageSpace=v=>['limited','none'].includes(low(v));
  const adequateSpace=v=>low(v)==='adequate';
  const highCongestion=v=>['high','severe'].includes(low(v));
  const okayCongestion=v=>['low','moderate'].includes(low(v));

  function checkResult(row){
    if(!row)return 'NONE';
    const brood=txt(row.broodNestSpace),sup=txt(row.superSpace),cong=txt(row.colonyCongestion);
    if(shortageSpace(brood)||shortageSpace(sup)||highCongestion(cong))return 'FAIL';
    if(adequateSpace(brood)&&adequateSpace(sup)&&okayCongestion(cong))return 'PASS';
    return 'INCONCLUSIVE';
  }

  function contextFor(s,h){
    let c={};try{c=base.buildContextSnapshot(s,h.id)||{}}catch(_){c={}}
    return {
      stateCode:txt(c?.location?.stateCode),city:txt(c?.location?.city),timezone:txt(c?.location?.timezone),
      seasonalPhase:txt(c?.seasonalPhase)||'UNRESOLVED',colonyPhase:txt(c?.colonyPhase)||'Uncertain',
      nectarState:txt(c?.nectarState)||'UNKNOWN'
    };
  }

  function currentSignal(s,h){
    const inspWrap=latestInspection(s,h.id),insp=inspWrap?.r||null;
    const swarm=r08Checks(s,h.id)[0]||null;
    const inspMs=orderMs(insp),swarmMs=orderMs(swarm);

    // A newer targeted swarm-space observation can be reused as explicit current
    // space evidence. An older R08 observation never outranks a newer Inspection.
    if(swarm&&swarmMs>inspMs){
      const shortage=shortageSpace(swarm.broodNestSpace)||shortageSpace(swarm.superSpace)||highCongestion(swarm.colonyCongestion);
      if(shortage){
        return {
          sourceType:'targeted-swarm-space',sourceId:txt(swarm.id)||`r08-${iso(swarm.date)}`,
          sourceDate:iso(swarm.date),sourceRecordedAt:txt(swarm.recordedAt),
          superStatus:txt(insp?.superStatus||insp?.super)||'Not assessed',
          broodNestSpace:txt(swarm.broodNestSpace)||'Not assessed',superSpace:txt(swarm.superSpace)||'Not assessed',
          colonyCongestion:txt(swarm.colonyCongestion)||'Not assessed',severity:(low(swarm.colonyCongestion)==='severe'||low(swarm.broodNestSpace)==='none'||low(swarm.superSpace)==='none')?'High':'Medium'
        };
      }
    }
    if(insp&&low(insp.superStatus||insp.super)==='needed'){
      return {
        sourceType:'inspection-super-needed',sourceId:txt(insp.id)||`inspection-${inspWrap.index}-${iso(insp.date)}`,
        sourceDate:iso(insp.date),sourceRecordedAt:txt(insp.recordedAt),superStatus:'Needed',
        broodNestSpace:'Not assessed',superSpace:'Not assessed',colonyCongestion:'Not assessed',severity:'Medium'
      };
    }
    return null;
  }

  const episodeId=(h,signal)=>`r11-space-${txt(h.id)}-${txt(signal?.sourceId||signal?.sourceDate||'evidence')}`;

  function taskBase(s,h,signal,episode,title,stage,due,priority){
    const ctx=contextFor(s,h);
    return {
      id:`scientific-r11-${stage}-${txt(h.id)}-${txt(signal.sourceId)}`,
      hiveId:h.id,type:stage==='management-review'?'super-management':'Inspection',title,status:'Pending',
      priority:priority||signal.severity||'Medium',due:due||todayFor(s,h),dueDate:iso(due||todayFor(s,h)),date:iso(due||todayFor(s,h)),
      source:'scientific-engine',systemGenerated:true,reasonCode:'space',intentKey:stage==='evidence'?'space-evaluation':stage==='follow-up'?'space-verification':'space-management',
      workflowStage:stage,executionRoute:'',coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,ruleEngineOwner:'HiveDashTaskEngineCoreV1',ruleMigrationVersion:MIGRATION_VERSION,
      catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,episodeId:episode,
      evidenceChain:{
        episodeId:episode,sourceType:signal.sourceType,sourceId:signal.sourceId,sourceDate:signal.sourceDate||'Not recorded',
        superStatus:signal.superStatus||'Not assessed',triggerBroodNestSpace:signal.broodNestSpace||'Not assessed',triggerSuperSpace:signal.superSpace||'Not assessed',triggerCongestion:signal.colonyCongestion||'Not assessed',
        region:[ctx.city,ctx.stateCode].filter(Boolean).join(', ')||'Not recorded',timezone:ctx.timezone||'Not recorded',seasonalPhase:ctx.seasonalPhase,colonyPhase:ctx.colonyPhase,nectarState:ctx.nectarState,
        currentSuperCount:Number(h.superCount)||0
      }
    };
  }

  function evaluateR11(s,h){
    if(!s||!h)return {assessment:{status:'NO_HIVE'},decision:{type:'NO_TASK',reason:'hive-unavailable'},verification:{result:'NONE'},outcome:{status:'NO_TASK'},task:null,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    const signal=currentSignal(s,h);
    if(!signal)return {assessment:{status:'NO_CURRENT_SPACE_CONCERN'},decision:{type:'NO_TASK',reason:'no-explicit-current-space-shortage-evidence'},verification:{result:'NONE'},outcome:{status:'NO_TASK'},task:null,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    const episode=episodeId(h,signal),today=todayFor(s,h),checks=spaceChecks(s,h.id,episode),latest=checks[0]||null,result=checkResult(latest),pending=pendingAddSpace(s,h.id),completed=completedLinkedSpace(s,h.id,episode);
    const common={hiveId:h.id,episodeId:episode,trigger:signal,latestSpaceEvaluation:latest||null,spaceResult:result,pendingAddSpaceId:txt(pending?.id),completedAddSpaceId:txt(completed?.id),context:contextFor(s,h)};

    if(pending){
      return {assessment:{status:'SPACE_MANAGEMENT_PLANNED',...common},decision:{type:'NO_TASK',reason:'add-space-action-already-planned'},verification:{result:'PENDING_MANAGEMENT'},outcome:{status:'WAITING_FOR_ACTION'},task:null,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    }

    // A linked completed physical action must be verified by new targeted
    // evidence recorded after completion. The action itself never equals PASS.
    if(completed && (!latest || orderMs(latest)<=orderMs(completed))){
      const due=addDays(iso(completed.resultData?.completedDate||completed.completedAt||today)||today,7);
      const a=taskBase(s,h,signal,episode,'Verify hive space','follow-up',due,'Medium');
      a.id=`scientific-r11-followup-${h.id}-${txt(signal.sourceId)}`;
      a.executionRoute=`space-evaluation/${encodeURIComponent(h.id)}/${encodeURIComponent(episode)}/follow-up`;
      a.systemWhy='An Add Super action was completed for this space episode. Confirm current brood-nest space, honey/super space and congestion; completed work does not prove the space constraint is resolved.';
      a.evidenceChain={...a.evidenceChain,linkedAddSpaceActionId:txt(completed.id),linkedAddSpaceCompletedDate:iso(completed.resultData?.completedDate||completed.completedAt)||'Not recorded',verificationResult:'PENDING'};
      return {assessment:{status:'POST_ACTION_VERIFICATION_REQUIRED',...common},decision:{type:'AUTO_CREATE',reason:'linked-add-space-completed-needs-verification',automationLevel:'A_AUTO'},verification:{result:'PENDING'},outcome:{status:'FOLLOW_UP_REQUIRED'},task:a,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    }

    if(!latest){
      const a=taskBase(s,h,signal,episode,'Evaluate hive space','evidence',today,signal.severity);
      a.executionRoute=`space-evaluation/${encodeURIComponent(h.id)}/${encodeURIComponent(episode)}/initial`;
      a.systemWhy='Current hive evidence indicates that space may be constrained. Record a targeted space evaluation before deciding whether to add equipment; HiveDash will not add a super automatically.';
      return {assessment:{status:'SPACE_EVALUATION_REQUIRED',...common},decision:{type:'AUTO_CREATE',reason:'explicit-space-concern-needs-targeted-evaluation',automationLevel:'A_AUTO'},verification:{result:'PENDING'},outcome:{status:'EVIDENCE_REQUIRED'},task:a,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    }

    if(result==='PASS'){
      return {assessment:{status:'SPACE_SUFFICIENT',...common},decision:{type:'NO_TASK',reason:'targeted-space-evidence-sufficient'},verification:{result:'PASS'},outcome:{status:'RESOLVED'},task:null,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    }
    if(result==='FAIL'){
      const severe=low(latest.colonyCongestion)==='severe'||low(latest.broodNestSpace)==='none'||low(latest.superSpace)==='none';
      const a=taskBase(s,h,signal,episode,'Review add-space options','management-review',today,severe?'High':'Medium');
      a.executionRoute=`r11-space-review/${encodeURIComponent(h.id)}/${encodeURIComponent(episode)}`;
      a.systemWhy='Targeted evidence confirms limited brood/honey space or high congestion. Review an add-space plan; HiveDash does not choose the number of supers or execute the equipment change without beekeeper confirmation.';
      a.evidenceChain={...a.evidenceChain,spaceEvaluationId:txt(latest.id),spaceEvaluationDate:iso(latest.date),broodNestSpace:txt(latest.broodNestSpace),superSpace:txt(latest.superSpace),colonyCongestion:txt(latest.colonyCongestion),nectarFlow:txt(latest.nectarFlow),verificationResult:'FAIL'};
      return {assessment:{status:'SPACE_INSUFFICIENT',...common},decision:{type:'RECOMMEND_CONFIRM',reason:'targeted-space-evidence-confirms-insufficient-space',automationLevel:'B_RECOMMEND_CONFIRM'},verification:{result:'FAIL'},outcome:{status:'MANAGEMENT_REVIEW'},task:a,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    }

    const stage=low(latest.stage)==='follow-up'?'follow-up':'evidence';
    const a=taskBase(s,h,signal,episode,stage==='follow-up'?'Space verification still needed':'Space evaluation still needed',stage,today,'Medium');
    a.executionRoute=`space-evaluation/${encodeURIComponent(h.id)}/${encodeURIComponent(episode)}/${stage==='follow-up'?'follow-up':'initial'}`;
    a.systemWhy='The latest targeted space check is incomplete or inconclusive. Missing fields are not treated as adequate space; record current brood-nest space, honey/super space and congestion.';
    a.evidenceChain={...a.evidenceChain,spaceEvaluationId:txt(latest.id),spaceEvaluationDate:iso(latest.date),broodNestSpace:txt(latest.broodNestSpace),superSpace:txt(latest.superSpace),colonyCongestion:txt(latest.colonyCongestion),nectarFlow:txt(latest.nectarFlow),verificationResult:'INCONCLUSIVE'};
    return {assessment:{status:'SPACE_EVIDENCE_INCONCLUSIVE',...common},decision:{type:'AUTO_CREATE',reason:'targeted-space-evidence-incomplete',automationLevel:'A_AUTO'},verification:{result:'INCONCLUSIVE'},outcome:{status:'EVIDENCE_REQUIRED'},task:a,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
  }

  function projectTask(ev,s){
    if(!ev?.task)return null;
    let task;try{task=base.normalizeTaskProjection(ev.task,s,{evidence:new Map(),context:new Map()})}catch(_){task={...ev.task}}
    task={...task,coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,ruleEngineOwner:'HiveDashTaskEngineCoreV1',ruleMigrationVersion:MIGRATION_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,episodeId:ev.task.episodeId,evidenceChain:ev.task.evidenceChain,assessmentType:ev.assessment?.status||'',decisionType:ev.decision?.type||'',automationLevel:ev.decision?.automationLevel||'',verificationStatus:ev.verification?.result||'PENDING',ruleEvaluation:{assessment:ev.assessment,decision:ev.decision,verification:ev.verification,outcome:ev.outcome}};
    task.ruleRef={...(task.ruleRef||{}),ruleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,engineOwner:'HiveDashTaskEngineCoreV1',migrationVersion:MIGRATION_VERSION,authority:'HiveDash Scientific Task Engine — explicit current space evidence contract'};
    return task;
  }

  const ruleDefinition=Object.freeze({
    id:CORE_RULE_ID,version:RULE_VERSION,engineOwner:'HiveDashTaskEngineCoreV1',migrationVersion:MIGRATION_VERSION,
    catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,
    title:'Space insufficiency evaluation',
    evidenceInputs:Object.freeze(['latest Inspection super status','newer targeted swarm-space evidence','targeted Space Evaluation','linked B37 Add Super action']),
    automation:'A_AUTO_EVIDENCE_THEN_B_RECOMMEND_CONFIRM',
    evaluate:(s,hiveId)=>{const h=hiveBy(s,hiveId);return evaluateR11(s,h)}
  });
  try{if(typeof base.registerRule==='function')base.registerRule(ruleDefinition)}catch(err){console.error('V2P2E5R11A rule registration failed',err)}

  window.v2p2e5r11EvaluateSpace=function(hiveId){const s=S(),h=hiveBy(s,hiveId);return evaluateR11(s,h)};
  window.V2P2E5R11A_SPACE_RULE=ruleDefinition;

  const prevGenerate=window.generateActions||(typeof generateActions==='function'?generateActions:null);
  if(typeof prevGenerate==='function'){
    window.generateActions=function(s){
      let out=(prevGenerate(s)||[]).filter(a=>txt(a?.coreRuleId)!==CORE_RULE_ID);
      const seen=new Set(out.map(a=>txt(a.id)||`${txt(a.hiveId)}|${txt(a.intentKey)}|${txt(a.title)}`));
      for(const h of active(s)){
        const ev=evaluateR11(s,h),task=projectTask(ev,s);if(!task)continue;
        const k=txt(task.id)||`${txt(task.hiveId)}|${txt(task.intentKey)}|${txt(task.title)}`;if(seen.has(k))continue;seen.add(k);out.push(task);
      }
      return out;
    };
    try{generateActions=window.generateActions}catch(_){ }
  }

  function findTask(id){
    const s=S();
    try{return (typeof generateActions==='function'?(generateActions(s)||[]):[]).find(a=>a&&txt(a.id)===txt(id)&&txt(a.coreRuleId)===CORE_RULE_ID)||null}catch(_){return null}
  }
  function findTaskFor(hid,episode,stage=''){
    const s=S();try{return (typeof generateActions==='function'?(generateActions(s)||[]):[]).find(a=>a&&txt(a.hiveId)===txt(hid)&&txt(a.coreRuleId)===CORE_RULE_ID&&txt(a.episodeId)===txt(episode)&&(!stage||low(a.workflowStage)===low(stage)))||null}catch(_){return null}
  }

  function renderEvaluation(hid,episode,stage){
    const normalizedStage=stage==='follow-up'?'follow-up':'initial';
    const s=S(),h=hiveBy(s,hid),a=findTaskFor(hid,episode,normalizedStage==='follow-up'?'follow-up':'evidence');
    if(!h||!a)return `<div class="vs"><section class="vc"><div class="vhead"><b>Space evaluation no longer required</b></div><p>New evidence or a changed workflow state has resolved or replaced this task.</p><button class="primary" onclick="go('actions')">Back to Actions</button></section></div>`;
    const e=a.evidenceChain||{},ctx=contextFor(s,h),draft=readSpaceDraft(hid,episode,normalizedStage);
    const broodDraft=txt(draft.broodNestSpace)||'Not assessed',superDraft=txt(draft.superSpace)||'Not assessed',congestionDraft=txt(draft.colonyCongestion)||'Not assessed',nectarDraft=txt(draft.nectarFlow)||'Not assessed',notesDraft=txt(draft.notes);
    return `<div class="vs v2p2e5r11-space-page">
      <section class="vc"><div class="vhead"><b>${stage==='follow-up'?'Space Verification':'Space Evaluation'} · targeted evidence</b><span class="v2p2e5r11-pill">R11 · S22</span></div><p class="muted">Record only what you assess now. Previous Inspection or swarm-space values are reference only. This does not count as a Full Inspection.</p></section>
      <section class="vc"><div class="vhead"><b>Current context</b></div><div class="v2p2e5r11-grid">
        <span>Hive<b>${esc(h.name||hid)}</b></span><span>Trigger<b>${esc(e.sourceType||'Space concern')}</b></span>
        <span>Inspection super status<b>${esc(e.superStatus||'Not assessed')}</b></span><span>Current supers<b>${esc(e.currentSuperCount??0)}</b></span>
        <span>Colony phase<b>${esc(ctx.colonyPhase)}</b></span><span>Nectar state<b>${esc(ctx.nectarState)}</b></span>
      </div></section>
      <section class="vc v2p2e5r11-check-card">
        <label><span>Brood Nest Space</span><select id="r11-brood-space" onchange="v2p2e5r11DraftSet('${js(hid)}','${js(episode)}','${normalizedStage}','broodNestSpace',this.value)">${optionHtml(['Not assessed','Adequate','Limited','None'],broodDraft)}</select></label>
        <label><span>Honey / Super Space</span><select id="r11-super-space" onchange="v2p2e5r11DraftSet('${js(hid)}','${js(episode)}','${normalizedStage}','superSpace',this.value)">${optionHtml(['Not assessed','Adequate','Limited','None','No super installed'],superDraft)}</select></label>
        <label><span>Colony Congestion</span><select id="r11-congestion" onchange="v2p2e5r11DraftSet('${js(hid)}','${js(episode)}','${normalizedStage}','colonyCongestion',this.value)">${optionHtml(['Not assessed','Low','Moderate','High','Severe'],congestionDraft)}</select></label>
        <label><span>Nectar Flow Context</span><select id="r11-nectar" onchange="v2p2e5r11DraftSet('${js(hid)}','${js(episode)}','${normalizedStage}','nectarFlow',this.value)">${optionHtml(['Not assessed','Active','Not active','Unknown'],nectarDraft)}</select><small>Context only. HiveDash does not invent a local nectar-flow state.</small></label>
      </section>
      <section class="vc"><label class="v2p2e5r11-note"><span>Notes</span><textarea id="r11-notes" placeholder="Optional current space context" oninput="v2p2e5r11DraftSet('${js(hid)}','${js(episode)}','${normalizedStage}','notes',this.value)">${esc(notesDraft)}</textarea></label></section>
      <div class="v2p2e5r11-actions"><button class="secondary" onclick="v2p2e5r11CancelSpaceEvaluation('${js(hid)}','${js(episode)}','${normalizedStage}')">Cancel</button><button class="primary" onclick="v2p2e5r11SaveSpaceEvaluation('${js(hid)}','${js(episode)}','${normalizedStage}')">Save Space Evaluation</button></div>
    </div>`;
  }

  window.v2p2e5r11SaveSpaceEvaluation=function(hid,episode,stage){
    const s=S(),h=hiveBy(s,hid),a=findTaskFor(hid,episode,low(stage)==='follow-up'?'follow-up':'evidence');if(!h||!a)return toast('This R11 space task is no longer active');
    const brood=txt(document.getElementById('r11-brood-space')?.value),sup=txt(document.getElementById('r11-super-space')?.value),cong=txt(document.getElementById('r11-congestion')?.value),nectar=txt(document.getElementById('r11-nectar')?.value),notes=txt(document.getElementById('r11-notes')?.value);
    if(unknown(brood)||unknown(sup)||unknown(cong))return toast('Assess brood space, honey/super space, and congestion before saving');
    const row={id:'space-eval-'+Date.now(),hiveId:txt(hid),date:todayFor(s,h),episodeId:txt(episode),sourceTaskId:txt(a.id),stage:low(stage)==='follow-up'?'follow-up':'initial',broodNestSpace:brood,superSpace:sup,colonyCongestion:cong,nectarFlow:nectar||'Not assessed',notes,recordedAt:new Date().toISOString(),coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    row.verificationResult=checkResult(row);s.logs=s.logs||{};s.logs.spaceEvaluations=Array.isArray(s.logs.spaceEvaluations)?s.logs.spaceEvaluations:[];s.logs.spaceEvaluations.push(row);
    if(typeof save==='function'&&save(s)===false)return toast('Space Evaluation could not be saved');
    clearSpaceDraft(hid,episode,stage);
    toast('Space Evaluation saved');go('actions');
  };

  function renderReview(hid,episode){
    const s=S(),h=hiveBy(s,hid),a=findTaskFor(hid,episode,'management-review');
    if(!h||!a)return `<div class="vs"><section class="vc"><div class="vhead"><b>Space management review no longer required</b></div><p>New evidence or a planned action has replaced this review.</p><button class="primary" onclick="go('actions')">Back to Actions</button></section></div>`;
    const e=a.evidenceChain||{};
    return `<div class="vs v2p2e5r11-space-page"><section class="vc"><div class="vhead"><b>Review add-space options</b><span class="v2p2e5r11-pill">R11 · S22</span></div><p>Targeted evidence indicates a space constraint. Review the evidence before planning equipment work.</p></section>
      <section class="vc"><div class="vhead"><b>Evidence chain</b></div><div class="v2p2e5r11-grid">
        <span>Hive<b>${esc(h.name||hid)}</b></span><span>Evaluation date<b>${esc(e.spaceEvaluationDate||'Not recorded')}</b></span>
        <span>Brood-nest space<b>${esc(e.broodNestSpace||'Not assessed')}</b></span><span>Honey / super space<b>${esc(e.superSpace||'Not assessed')}</b></span>
        <span>Congestion<b>${esc(e.colonyCongestion||'Not assessed')}</b></span><span>Nectar context<b>${esc(e.nectarFlow||'Not assessed')}</b></span>
      </div></section>
      <section class="vc"><div class="vhead"><b>What happens next</b></div><p>Open the existing Add / Remove Super workflow and decide whether to add space. HiveDash will not create an Add Super action or choose the number of supers until you confirm the plan.</p></section>
      <div class="v2p2e5r11-actions"><button class="secondary" onclick="go('actions')">Back</button><button class="primary" onclick="v2p2e5r11PlanSpaceAction('${js(a.id)}')">Plan Add / Remove Super</button></div></div>`;
  }

  function writeCtx(a){try{sessionStorage.setItem(CTX_KEY,JSON.stringify({taskId:txt(a.id),hiveId:txt(a.hiveId),episodeId:txt(a.episodeId),startedAt:Date.now()}))}catch(_){ }}
  function readCtx(){try{const x=JSON.parse(sessionStorage.getItem(CTX_KEY)||'null');if(!x||Date.now()-Number(x.startedAt||0)>3600000){sessionStorage.removeItem(CTX_KEY);return null}return x}catch(_){return null}}
  function clearCtx(){try{sessionStorage.removeItem(CTX_KEY)}catch(_){ }}

  window.v2p2e5r11PlanSpaceAction=function(taskId){
    const a=findTask(taskId);if(!a||low(a.workflowStage)!=='management-review')return toast('This space management review is no longer active');
    writeCtx(a);
    if(typeof window.b37OpenSuperAction!=='function')return toast('Add / Remove Super workflow is unavailable');
    window.b37OpenSuperAction(a.hiveId,'manual','space-needed');
    queueMicrotask(()=>{
      try{
        window.__b37CreateDraft={...(window.__b37CreateDraft||{}),hiveId:txt(a.hiveId),operation:'add',count:1,reason:'space-needed',reasonDetails:'',priority:txt(a.priority||'Medium')};
        if(typeof render==='function')render();
      }catch(_){ }
    });
  };

  const prevB37Create=window.b37CreateAction;
  if(typeof prevB37Create==='function'){
    window.b37CreateAction=function(){
      const ctx=readCtx(),before=S(),beforeIds=new Set((before?.actions||[]).map(a=>txt(a.id))),ret=prevB37Create.apply(this,arguments);
      if(!ctx)return ret;
      try{
        const s=S(),created=(s?.actions||[]).filter(a=>a&&low(a.type)==='super-management'&&txt(a.hiveId)===txt(ctx.hiveId)&&!beforeIds.has(txt(a.id)));
        const row=created[created.length-1];
        if(row){row.r11EpisodeId=txt(ctx.episodeId);row.r11SourceTaskId=txt(ctx.taskId);row.r11LinkedAt=new Date().toISOString();row.r11CatalogRuleId=CATALOG_RULE_ID;row.r11CatalogTaskId=CATALOG_TASK_ID;if(typeof save==='function')save(s);clearCtx();}
      }catch(err){console.error('V2P2E5R11A B37 linkage failed',err)}
      return ret;
    };
  }

  function decorateR11Task(){
    const p=txt(location.hash||'#home').replace(/^#/,'').split('/');if(p[0]!=='scientific-action')return;
    const a=findTask(p[1]);if(!a)return;
    const head=document.querySelector('.v2p2e5ab-detail .vhead');if(head&&!head.querySelector('.v2p2e5r11-pill'))head.insertAdjacentHTML('beforeend','<span class="v2p2e5r11-pill">R11 · S22</span>');
    const btn=document.querySelector('.v2p2e5ab-detail-actions .primary');if(btn){btn.textContent=low(a.workflowStage)==='management-review'?'Review Add-space Options':low(a.workflowStage)==='follow-up'?'Verify Space':'Start Space Evaluation';}
  }

  const prevRender=window.render||render;
  window.render=function(){
    const p=txt(location.hash||'#home').replace(/^#/,'').split('/');
    if(p[0]==='space-evaluation'){
      const r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=renderEvaluation(decodeURIComponent(txt(p[1])),decodeURIComponent(txt(p[2])),txt(p[3]));
      const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML=`<button class="iconbtn" onclick="go('actions')" aria-label="Back">‹</button><div class="pagebar-title">Space Evaluation</div><span></span>`}document.getElementById('bottomnav')?.classList.add('hidden');return;
    }
    if(p[0]==='r11-space-review'){
      const r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=renderReview(decodeURIComponent(txt(p[1])),decodeURIComponent(txt(p[2])));
      const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML=`<button class="iconbtn" onclick="go('actions')" aria-label="Back">‹</button><div class="pagebar-title">Space Management</div><span></span>`}document.getElementById('bottomnav')?.classList.add('hidden');return;
    }
    const ret=prevRender.apply(this,arguments);try{decorateR11Task()}catch(err){console.error('V2P2E5R11A task decoration failed',err)}return ret;
  };
  try{render=window.render}catch(_){ }

  const style=document.createElement('style');style.id='v2p2e5r11a-style';style.textContent=`
    .v2p2e5r11-pill{font-size:10px;padding:4px 7px;border-radius:999px;background:#F1F3E9;color:#60734F;margin-left:auto}.v2p2e5r11-space-page{padding-bottom:24px}.v2p2e5r11-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v2p2e5r11-grid span{display:grid;gap:3px;font-size:10px;color:#7A817B}.v2p2e5r11-grid b{font-size:12px;color:#334C38}.v2p2e5r11-check-card label{display:flex;flex-direction:column;gap:6px;padding:10px 0;border-bottom:1px solid #ece8dd}.v2p2e5r11-check-card label:last-child{border-bottom:0}.v2p2e5r11-check-card select{width:100%;min-height:44px;border:1px solid #ddd7c8;border-radius:10px;background:#fff;padding:0 10px}.v2p2e5r11-check-card small{color:#9a7820;font-size:10px}.v2p2e5r11-note{display:flex;flex-direction:column;gap:8px}.v2p2e5r11-note textarea{min-height:88px;border:1px solid #ddd7c8;border-radius:10px;padding:10px}.v2p2e5r11-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:10px}.v2p2e5r11-actions button{margin:0!important}
  `;document.head.appendChild(style);

  window.V2P2E5R11A_CATALOG=Object.freeze({version:VERSION,migrationVersion:MIGRATION_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,coreRuleId:CORE_RULE_ID,scientificRuleChanged:'new-rule-no-existing-r11-core-rewritten',automaticExecution:false,linkedWorkflow:'B37 Add / Remove Super'});
  window.__HIVEDASH_V2P2E5R11A_VERSION__=VERSION;
})();
