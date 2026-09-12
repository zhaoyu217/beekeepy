/* ==============================================================
   HiveDash V2P2E5R08A — R08 / S18 SWARM RISK CHECK
   Catalog rule: R08
   Catalog task: S18
   Core rule: HD-R08S-SWARM-RISK-CHECK

   Scientific/product contract:
   - R08 is a targeted evidence-acquisition rule, not Swarm Control.
   - It activates only when swarm-season context is supported AND current
     colony evidence supports an expanding/strong or space-pressure state.
   - Month alone never creates the biological assessment. Resolved Core
     seasonalPhase, explicit beekeeper seasonal mode, or validated regional
     timing is combined with current colony phase/evidence.
   - Weak/dormant/uncertain colonies are not forced into a swarm check solely
     from the calendar. Unknown weather remains a scheduling limitation.
   - The targeted check records queen-cell state, congestion, brood-nest space,
     super space, and swarm signs. It does not count as a Full Inspection.
   - PASS / FAIL / INCONCLUSIVE are explicit. FAIL hands off to S19/R09; this
     R08 module does not execute B41 or choose a swarm-control method.
   - Existing R01-R07, R03 Feeding, Inspection persistence, B41 and other
     frozen workflows are not rewritten.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R08A__) return;
  window.__HIVEDASH_V2P2E5R08A__=true;
  window.__HIVEDASH_V2P2E5R08A_VERSION__='v2p2e5r08a-targeted-swarm-risk-check';

  const CORE_RULE_ID='HD-R08S-SWARM-RISK-CHECK';
  const RULE_VERSION='HD-R08S-v1.0-2026-09-12';
  const MIGRATION_VERSION='V2P2E5R08A';
  const CATALOG_RULE_ID='R08';
  const CATALOG_TASK_ID='S18';
  const NEXT_CATALOG_RULE_ID='R09';
  const NEXT_CATALOG_TASK_ID='S19';
  const base=window.HiveDashTaskEngineCoreV1;
  if(!base||typeof base.normalizeTaskProjection!=='function'||typeof base.buildContextSnapshot!=='function'){
    console.error('V2P2E5R08A requires HiveDashTaskEngineCoreV1');return;
  }

  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const iso=v=>/^\d{4}-\d{2}-\d{2}$/.test(txt(v).slice(0,10))?txt(v).slice(0,10):'';
  const escS=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S=()=>{try{return typeof v45s==='function'?v45s():state()}catch(_){return null}};
  const active=s=>{try{return typeof v224ActiveTrackedHives==='function'?v224ActiveTrackedHives(s):(s?.hives||[]).filter(h=>h&&!h.archived&&!['combined','archived'].includes(low(h.lifecycleStatus||h.status)))}catch(_){return (s?.hives||[]).filter(Boolean)}};
  const hiveBy=(s,id)=>active(s).find(h=>txt(h.id)===txt(id))||null;
  const todayFor=(s,h)=>{try{return typeof v2p2e5Today==='function'?txt(v2p2e5Today(s,h?.id||'')):typeof v2p1bDateInHiveTimezone==='function'?txt(v2p1bDateInHiveTimezone(s,h)):new Date().toISOString().slice(0,10)}catch(_){return new Date().toISOString().slice(0,10)}};
  const addDays=(d,n)=>{const x=iso(d);if(!x)return'';const dt=new Date(x+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+Number(n||0));return dt.toISOString().slice(0,10)};
  const month=d=>Number(iso(d).slice(5,7)||0);
  const inspections=(s,hid)=>(Array.isArray(s?.logs?.inspections)?s.logs.inspections:[]).map((r,index)=>({r,index})).filter(x=>x.r&&txt(x.r.hiveId)===txt(hid)&&x.r.legacySnapshot!==true).sort((a,b)=>iso(b.r.date).localeCompare(iso(a.r.date))||b.index-a.index);
  const latestInspection=(s,hid)=>inspections(s,hid)[0]||null;
  const checks=(s,hid)=>(Array.isArray(s?.logs?.swarmRiskChecks)?s.logs.swarmRiskChecks:[]).filter(x=>x&&txt(x.hiveId)===txt(hid)&&txt(x.coreRuleId)===CORE_RULE_ID).slice().sort((a,b)=>txt(b.recordedAt||b.id).localeCompare(txt(a.recordedAt||a.id)));

  const NORTHEAST=new Set(['CT','ME','MA','NH','RI','VT','NJ','NY','PA']);
  const SOURCES=Object.freeze({
    PSU:Object.freeze({id:'PSU-SWARM-14',authority:'Penn State Extension',summary:'During northeastern swarm-prevention buildup, colonies are typically checked at least every two weeks.'}),
    MSU:Object.freeze({id:'MS-SWARM-WEEKLY',authority:'Mississippi State University Extension',summary:'Mississippi colonies should be checked weekly during the April-May swarm season.'}),
    UCANR:Object.freeze({id:'CA-BUILDUP-10',authority:'University of California ANR',summary:'During rapid spring population buildup, colonies are examined about every 10 days until honey flow begins.'}),
    CONTRACT:Object.freeze({id:'R08-SOURCE-CONTRACT',authority:'HiveDash Scientific Task Engine v1.0',summary:'R08 targets Queen Cells, congestion, brood/super space, queen status and colony strength; low risk resolves, high risk hands off to R09.'})
  });

  function currentContext(s,h){
    let c={};try{c=base.buildContextSnapshot(s,h.id)||{}}catch(_){c={}}
    const ins=latestInspection(s,h.id)?.r||null;
    const loc=c?.location||{};
    return {
      localDate:todayFor(s,h),stateCode:txt(loc.stateCode).toUpperCase(),city:txt(loc.city),timezone:txt(loc.timezone),
      coreSeasonalPhase:txt(c?.seasonalPhase)||'UNRESOLVED',colonyPhase:txt(c?.colonyPhase)||'Uncertain',risk:txt(c?.risk)||'Unassessed',confidence:txt(c?.confidence)||'LOW',
      manualSeasonMode:txt(s?.settings?.seasonal?.mode||'Auto'),weatherWindow:'UNKNOWN',
      broodStrength:ins?.broodStrength??'',colonySize:ins?.colonySize??'',populationFrames:ins?.populationFrames??'',
      queenStatus:txt(ins?.queenStatus)||'Not assessed',queenCells:txt(ins?.queenCells)||'Not assessed',swarming:txt(ins?.swarming)||'Not assessed',superStatus:txt(ins?.superStatus||ins?.super)||'Not assessed'
    };
  }

  function resolvedSeason(ctx){
    const core=txt(ctx.coreSeasonalPhase).toUpperCase();
    if(['SPRING_BUILDUP','SWARM_PERIOD'].includes(core))return {phase:core,source:'core-seasonal-phase',authority:SOURCES.CONTRACT,intervalDays:null};
    const phase=txt(ctx.colonyPhase),manual=low(ctx.manualSeasonMode),m=month(ctx.localDate),st=ctx.stateCode;
    if(manual==='spring')return {phase:phase==='Peak Population'?'SWARM_PERIOD':'SPRING_BUILDUP',source:'beekeeper-season-setting',authority:SOURCES.CONTRACT,intervalDays:NORTHEAST.has(st)?14:st==='MS'?7:st==='CA'?10:null};
    if(st==='MS'&&[4,5].includes(m))return {phase:'SWARM_PERIOD',source:'regional-calendar+colony-context',authority:SOURCES.MSU,intervalDays:7};
    if(NORTHEAST.has(st)&&[4,5,6].includes(m)&&['Population Increase','Peak Population'].includes(phase))return {phase:phase==='Peak Population'?'SWARM_PERIOD':'SPRING_BUILDUP',source:'regional-calendar+colony-context',authority:SOURCES.PSU,intervalDays:14};
    if(st==='CA'&&[3,4,5,6].includes(m)&&['Population Increase','Peak Population'].includes(phase))return {phase:phase==='Peak Population'?'SWARM_PERIOD':'SPRING_BUILDUP',source:'regional-calendar+colony-context',authority:SOURCES.UCANR,intervalDays:10};
    return {phase:'UNRESOLVED',source:'insufficient-season-context',authority:null,intervalDays:null};
  }

  const present=v=>['present','signs','yes','true'].includes(low(v));
  const queenCellsPresent=v=>['present','charged cells','capped swarm cells'].includes(low(v));
  const spacePressure=v=>['needed','limited','none','high','severe'].includes(low(v));
  function triggerEvidence(ctx){
    const expanding=['Population Increase','Peak Population'].includes(ctx.colonyPhase);
    const priorRisk=present(ctx.swarming)||queenCellsPresent(ctx.queenCells)||low(ctx.superStatus)==='needed';
    return {expanding,priorRisk,qualifies:expanding||priorRisk};
  }

  function episodeId(hid,baselineId,season){return `r08-swarm-${txt(hid)}-${txt(baselineId)}-${txt(season).toLowerCase()}`}
  function resultForCheck(v){
    if(!v)return 'NONE';
    const qc=low(v.queenCellStatus),cong=low(v.colonyCongestion),brood=low(v.broodNestSpace),sup=low(v.superSpace),signs=low(v.swarmSigns);
    const required=[qc,cong,brood,sup,signs];
    if(required.some(x=>['','not assessed','not checked','unknown'].includes(x)))return 'INCONCLUSIVE';
    const activeCells=['charged cells','capped swarm cells'].includes(qc);
    const pressure=['high','severe'].includes(cong)||['limited','none'].includes(brood)||['limited','none'].includes(sup);
    if(activeCells&&pressure)return 'FAIL';
    const cellsClear=qc==='none seen';
    const congestionOkay=['low','moderate'].includes(cong);
    const broodOkay=brood==='adequate';
    const superOkay=['adequate','no super installed'].includes(sup);
    const signsClear=signs==='none';
    if(cellsClear&&congestionOkay&&broodOkay&&superOkay&&signsClear)return 'PASS';
    return 'INCONCLUSIVE';
  }

  function evidencePayload(s,h,baseline,season,episode,extra={}){
    const ctx=currentContext(s,h),trig=triggerEvidence(ctx);
    return {
      episodeId:episode,baselineInspectionId:txt(baseline?.r?.id),baselineInspectionDate:iso(baseline?.r?.date),seasonalPhase:season.phase,seasonSource:season.source,
      authorityId:season.authority?.id||'',authority:season.authority?.authority||'Not resolved',authoritySummary:season.authority?.summary||'No validated swarm-season timing rule is active.',
      region:[ctx.city,ctx.stateCode].filter(Boolean).join(', ')||'Not recorded',stateCode:ctx.stateCode||'',timezone:ctx.timezone||'Not recorded',weatherWindow:ctx.weatherWindow,
      colonyPhase:ctx.colonyPhase,broodStrength:ctx.broodStrength===''?'Not recorded':ctx.broodStrength,colonySize:ctx.colonySize===''?'Not recorded':ctx.colonySize,populationFrames:ctx.populationFrames===''?'Not recorded':ctx.populationFrames,
      queenStatus:ctx.queenStatus,queenCells:ctx.queenCells,swarming:ctx.swarming,superStatus:ctx.superStatus,expandingColony:trig.expanding,priorSwarmRiskEvidence:trig.priorRisk,
      ...extra
    };
  }

  function baseTask(s,h,baseline,season,title,stage,episode,catalogTask=CATALOG_TASK_ID){
    const today=todayFor(s,h),days=season.intervalDays,due=days?`Within ${days} days`:'As soon as suitable conditions permit';
    return {
      id:`scientific-swarm-${stage}-${h.id}-${txt(baseline?.r?.id)}-${txt(season.phase)}`,hiveId:h.id,type:'Inspection',title,status:'Pending',priority:'Medium',
      due,dueEarliest:today,dueLatest:days?addDays(today,days):'',dueDate:days?addDays(today,days):'',date:'',source:'scientific-engine',systemGenerated:true,
      reasonCode:'swarm',intentKey:stage==='management-review'?'swarm-control-review':'swarm-risk-check',workflowStage:stage,executionRoute:'',
      coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,ruleEngineOwner:'HiveDashTaskEngineCoreV1',ruleMigrationVersion:MIGRATION_VERSION,catalogRuleId:stage==='management-review'?NEXT_CATALOG_RULE_ID:CATALOG_RULE_ID,catalogTaskId:catalogTask,
      assessmentType:stage==='management-review'?'SWARM_RISK_HIGH':'SWARM_CHECK_DUE',decisionType:stage==='management-review'?'RECOMMEND_CONFIRM':'AUTO_CREATE',automationLevel:stage==='management-review'?'B_RECOMMEND_CONFIRM':'A_AUTO_TASK',verificationStatus:stage==='management-review'?'FAIL':'PENDING',episodeId:episode
    };
  }

  function evaluateR08(s,h){
    const evaluation={ruleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,assessment:{status:'NO_SWARM_CHECK_DUE'},decision:{type:'NO_TASK',automationLevel:'NONE'},verification:{result:'NOT_REQUIRED'},outcome:{status:'NOT_OPEN'},task:null};
    const baseline=latestInspection(s,h.id);if(!baseline){evaluation.assessment={status:'NO_VALID_INSPECTION'};return evaluation}
    const ctx=currentContext(s,h),season=resolvedSeason(ctx),trigger=triggerEvidence(ctx);
    if(!['SPRING_BUILDUP','SWARM_PERIOD'].includes(season.phase)){evaluation.assessment={status:'OUTSIDE_SUPPORTED_SWARM_CONTEXT',seasonalPhase:season.phase,seasonSource:season.source,inspectionId:txt(baseline.r.id)};return evaluation}
    if(!trigger.qualifies){evaluation.assessment={status:'SWARM_CHECK_NOT_INDICATED',seasonalPhase:season.phase,colonyPhase:ctx.colonyPhase,inspectionId:txt(baseline.r.id)};return evaluation}

    const episode=episodeId(h.id,baseline.r.id,season.phase),latest=checks(s,h.id).find(v=>txt(v.episodeId)===episode)||null;
    if(latest){
      const result=resultForCheck(latest);
      if(result==='PASS'){
        evaluation.assessment={status:'SWARM_RISK_LOW',inspectionId:txt(baseline.r.id),checkId:txt(latest.id)};evaluation.verification={result:'PASS'};evaluation.outcome={status:'RESOLVED'};return evaluation;
      }
      if(result==='FAIL'){
        const a=baseTask(s,h,baseline,season,'Review swarm control','management-review',episode,NEXT_CATALOG_TASK_ID);a.priority='High';a.due='Review now';a.dueLatest='';a.dueDate='';
        a.systemWhy='Targeted Swarm Risk Inspection found active queen-cell evidence together with congestion or limited space. Review the high-risk evidence before choosing a Swarm Control action; R08 does not select a control method.';
        a.evidenceChain=evidencePayload(s,h,baseline,season,episode,{checkId:txt(latest.id),checkDate:iso(latest.date),verificationResult:'FAIL',queenCellStatus:txt(latest.queenCellStatus),colonyCongestion:txt(latest.colonyCongestion),broodNestSpace:txt(latest.broodNestSpace),superSpace:txt(latest.superSpace),swarmSigns:txt(latest.swarmSigns),targetRule:'R09',targetTask:'S19'});
        evaluation.assessment={status:'SWARM_RISK_HIGH',inspectionId:txt(baseline.r.id),checkId:txt(latest.id)};evaluation.decision={type:'RECOMMEND_CONFIRM',automationLevel:'B_RECOMMEND_CONFIRM'};evaluation.verification={result:'FAIL'};evaluation.outcome={status:'ESCALATE_TO_R09'};evaluation.task=a;return evaluation;
      }
      const a=baseTask(s,h,baseline,season,'Swarm risk inspection still needed','evidence',episode);a.systemWhy='The targeted Swarm Risk Inspection did not provide enough current evidence to classify risk. Missing or mixed observations are not treated as low risk.';
      a.evidenceChain=evidencePayload(s,h,baseline,season,episode,{checkId:txt(latest.id),checkDate:iso(latest.date),verificationResult:'INCONCLUSIVE'});
      evaluation.assessment={status:'SWARM_CHECK_INCONCLUSIVE',inspectionId:txt(baseline.r.id),checkId:txt(latest.id)};evaluation.decision={type:'AUTO_CREATE',automationLevel:'A_AUTO_TASK'};evaluation.verification={result:'INCONCLUSIVE'};evaluation.outcome={status:'OPEN'};evaluation.task=a;return evaluation;
    }

    const a=baseTask(s,h,baseline,season,'Check swarm risk','evidence',episode);a.systemWhy='Current season and colony-growth evidence support a targeted swarm-risk check before visible swarming occurs. Inspect queen cells, congestion and available space rather than repeating an unrelated full Inspection.';
    a.evidenceChain=evidencePayload(s,h,baseline,season,episode);
    evaluation.assessment={status:'SWARM_CHECK_DUE',inspectionId:txt(baseline.r.id),seasonalPhase:season.phase,colonyPhase:ctx.colonyPhase};evaluation.decision={type:'AUTO_CREATE',automationLevel:'A_AUTO_TASK'};evaluation.verification={result:'PENDING'};evaluation.outcome={status:'OPEN'};evaluation.task=a;return evaluation;
  }

  const ruleDefinition=Object.freeze({
    id:CORE_RULE_ID,version:RULE_VERSION,engineOwner:'HiveDashTaskEngineCoreV1',migrationVersion:MIGRATION_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,
    category:'SWARM_MANAGEMENT',assessmentType:'SWARM_CHECK_DUE',decisionClass:'A_AUTO_TASK',
    evidenceInputs:Object.freeze(['latest Inspection','colony phase','queen cells','swarming signs','super status','targeted Swarm Risk Inspection']),
    contextInputs:Object.freeze(['region','seasonalPhase','beekeeper seasonal mode','weather window']),authorityRules:SOURCES,
    policy:Object.freeze({monthAloneDoesNotTrigger:true,targetedInspection:true,weakOrDormantDoesNotAutoTrigger:true,weatherUnknownDoesNotInventSafeOpening:true,passFailInconclusive:true,highRiskHandsOffToR09:true,r08DoesNotExecuteB41:true}),
    evaluate:(s,h)=>evaluateR08(s,h)
  });
  try{if(typeof base.registerRule==='function')base.registerRule(ruleDefinition)}catch(err){console.error('V2P2E5R08A rule registration failed',err)}
  window.HiveDashTaskEngineCoreV1=Object.freeze({...base,swarmRiskCheckRule:ruleDefinition,evaluateSwarmRiskCheck:(s,hid)=>{const h=hiveBy(s,hid);return h?evaluateR08(s,h):null}});
  window.V2P2E5R08_SWARM_RISK_RULE=ruleDefinition;
  window.v2p2e5r08Evaluate=function(hiveId){const s=S(),h=hiveBy(s,hiveId);return h?evaluateR08(s,h):null};

  function isLegacySwarmTask(a){
    if(!a||txt(a.coreRuleId)===CORE_RULE_ID)return false;
    const id=low(a.id),intent=low(a.intentKey),src=low(a.source),title=low(a.title),reason=low(a.reasonCode);
    return (src==='scientific-engine'||id.startsWith('v224b-')||id.startsWith('scientific-swarm-'))&&(id.startsWith('v224b-swarm-')||intent==='swarm-review'||intent==='swarm-recheck'||(reason==='swarm'&&(title.includes('assess swarm risk')||title.includes('swarm risk inspection'))));
  }
  function projectTask(ev,s){
    if(!ev?.task)return null;let t;
    try{t=base.normalizeTaskProjection(ev.task,s,{evidence:new Map(),context:new Map()})}catch(_){t={...ev.task}}
    t.coreRuleId=CORE_RULE_ID;t.ruleVersion=RULE_VERSION;t.ruleEngineOwner='HiveDashTaskEngineCoreV1';t.ruleMigrationVersion=MIGRATION_VERSION;t.ruleEvaluation={assessment:ev.assessment,decision:ev.decision,verification:ev.verification,outcome:ev.outcome};t.outcomeSnapshot=ev.outcome;
    t.decisionType=ev.decision?.type||t.decisionType;t.automationLevel=ev.decision?.automationLevel||t.automationLevel;t.verificationStatus=ev.verification?.result||t.verificationStatus;
    return t;
  }

  const prevGenerate=window.generateActions||((typeof generateActions==='function')?generateActions:null);
  if(typeof prevGenerate==='function'){
    window.generateActions=function(s){
      let out=(prevGenerate(s)||[]).filter(a=>!isLegacySwarmTask(a));
      const seen=new Set(out.map(a=>txt(a.id)||`${txt(a.hiveId)}|${txt(a.intentKey)}|${txt(a.title)}`));
      for(const h of active(s)){
        const ev=evaluateR08(s,h),task=projectTask(ev,s);if(!task)continue;
        /* If a real B41 Swarm Control is already active, do not create a second
           R08/R09 management-review card. The existing management decision wins. */
        if(low(task.workflowStage)==='management-review'&&out.some(a=>a&&txt(a.hiveId)===txt(h.id)&&low(a.type)==='swarm-control'&&!['completed','done'].includes(low(a.status))&&low(a.priority)!=='done'))continue;
        const k=txt(task.id)||`${txt(task.hiveId)}|${txt(task.intentKey)}|${txt(task.title)}`;if(seen.has(k))continue;seen.add(k);out.push(task);
      }
      return out;
    };
    try{generateActions=window.generateActions}catch(_){ }
  }

  window.v2p2e5r08OpenCheck=function(actionId){
    const s=S();let a=null;try{a=(typeof generateActions==='function'?(generateActions(s)||[]):[]).find(x=>x&&txt(x.id)===txt(actionId)&&txt(x.coreRuleId)===CORE_RULE_ID&&txt(x.catalogTaskId)===CATALOG_TASK_ID)||null}catch(_){ }
    if(!a||low(a.workflowStage)!=='evidence')return toast('This Swarm Risk Inspection is no longer active');
    go(`swarm-risk-check/${a.hiveId}/${encodeURIComponent(txt(a.episodeId||a.evidenceChain?.episodeId))}`);
  };

  function detailHTML(a){
    const s=S(),h=hiveBy(s,a.hiveId),e=a.evidenceChain||{},handoff=txt(a.catalogTaskId)===NEXT_CATALOG_TASK_ID||low(a.workflowStage)==='management-review';
    return `<div class="vs v2p2e5r08-detail"><section class="vc"><div class="vhead"><b>${escS(a.title||'Swarm risk check')}</b><span class="v2p2e5r08-source">System</span></div><div class="v2p2e5r08-grid"><span>Hive<b>${escS(h?.name||'Unavailable')}</b></span><span>Stage<b>${handoff?'Review management':'Gather evidence'}</b></span><span>Priority<b>${escS(a.priority||'Medium')}</b></span><span>Due<b>${escS(a.due||'—')}</b></span></div></section>
      <section class="vc"><div class="vhead"><b>Why this task exists</b></div><p>${escS(a.systemWhy||'Current swarm-risk evidence needs review.')}</p></section>
      <section class="vc"><div class="vhead"><b>Swarm risk evidence</b><span class="v2p2e5r08-pill">${handoff?'R09 · S19':'R08 · S18'}</span></div><div class="v2p2e5r08-grid">
        <span>Latest Inspection<b>${escS(e.baselineInspectionDate||'Not recorded')}</b></span><span>Seasonal phase<b>${escS(e.seasonalPhase||'UNRESOLVED')}</b></span>
        <span>Season source<b>${escS(e.seasonSource||'Not resolved')}</b></span><span>Region<b>${escS(e.region||'Not recorded')}</b></span>
        <span>Colony phase<b>${escS(e.colonyPhase||'Uncertain')}</b></span><span>Weather window<b>${escS(e.weatherWindow||'UNKNOWN')}</b></span>
        <span>Queen status<b>${escS(e.queenStatus||'Not assessed')}</b></span><span>Queen cells<b>${escS(e.queenCells||'Not assessed')}</b></span>
        <span>Brood strength<b>${escS(e.broodStrength||'Not recorded')}</b></span><span>Colony size<b>${escS(e.colonySize||'Not recorded')}</b></span>
        <span>Population frames<b>${escS(e.populationFrames||'Not recorded')}</b></span><span>Super status<b>${escS(e.superStatus||'Not assessed')}</b></span>
        ${handoff?`<span>Targeted queen cells<b>${escS(e.queenCellStatus||'Not assessed')}</b></span><span>Congestion<b>${escS(e.colonyCongestion||'Not assessed')}</b></span><span>Brood-nest space<b>${escS(e.broodNestSpace||'Not assessed')}</b></span><span>Super space<b>${escS(e.superSpace||'Not assessed')}</b></span>`:''}
      </div><div class="v2p2e5r08-warning"><b>Context limit</b><br>Weather suitability is not currently measured here. HiveDash does not claim that opening the hive is safe simply because a swarm-season window is active.</div></section>
      <section class="vc"><div class="vhead"><b>What happens next</b></div><p>${handoff?'R08 has identified high swarm risk and handed the evidence to R09/S19. R08 itself does not select or execute a Swarm Control method.':'Record only the swarm-specific evidence requested. This targeted check does not replace a Full Inspection.'}</p></section>
      <div class="v2p2e5r08-actions"><button class="secondary" onclick="go('actions')">Back</button>${handoff?'':`<button class="primary" onclick="v2p2e5r08OpenCheck('${txt(a.id).replace(/'/g,"\\'")}')">Start Swarm Risk Inspection</button>`}</div></div>`;
  }

  function renderCheck(hid,episode){
    const s=S(),h=hiveBy(s,hid);if(!h)return `<div class="vs"><section class="vc"><b>Hive unavailable</b></section></div>`;
    const ev=evaluateR08(s,h),a=ev?.task,e=a?.evidenceChain||{};if(!a||txt(a.catalogTaskId)!==CATALOG_TASK_ID||low(a.workflowStage)!=='evidence'||txt(a.episodeId||e.episodeId)!==txt(episode))return `<div class="vs"><section class="vc"><div class="vhead"><b>Swarm Risk Inspection no longer required</b></div><p>New evidence or a changed seasonal state has resolved or replaced this check.</p><button class="primary" onclick="go('actions')">Back to Actions</button></section></div>`;
    return `<div class="vs v2p2e5r08-check"><section class="vc"><div class="vhead"><b>Swarm Risk Inspection · targeted evidence</b><span class="v2p2e5r08-pill">R08 · S18</span></div><p class="muted">Record only what you assess now. Previous Inspection values are reference only. This does not count as a Full Inspection.</p></section>
      <section class="vc v2p2e5r08-form">
        <label><span>Queen Cell Status</span><select id="r08-queen-cells"><option>Not assessed</option><option>None seen</option><option>Cups only</option><option>Charged cells</option><option>Capped swarm cells</option></select><small>Previous: ${escS(e.queenCells||'Not assessed')} · reference only</small></label>
        <label><span>Colony Congestion</span><select id="r08-congestion"><option>Not assessed</option><option>Low</option><option>Moderate</option><option>High</option><option>Severe</option></select></label>
        <label><span>Brood Nest Space</span><select id="r08-brood-space"><option>Not assessed</option><option>Adequate</option><option>Limited</option><option>None</option></select></label>
        <label><span>Super Space</span><select id="r08-super-space"><option>Not assessed</option><option>Adequate</option><option>Limited</option><option>None</option><option>No super installed</option></select><small>Previous super status: ${escS(e.superStatus||'Not assessed')} · reference only</small></label>
        <label><span>Swarm Signs</span><select id="r08-swarm-signs"><option>Not assessed</option><option>None</option><option>Present</option></select><small>Previous: ${escS(e.swarming||'Not assessed')} · reference only</small></label>
        <label><span>Queen Seen</span><select id="r08-queen-seen"><option>Not assessed</option><option>Seen</option><option>Not seen</option></select><small>Previous: ${escS(e.queenStatus||'Not assessed')} · reference only</small></label>
      </section>
      <section class="vc"><div class="vhead"><b>Colony strength context</b></div><div class="v2p2e5r08-grid"><span>Colony phase<b>${escS(e.colonyPhase||'Uncertain')}</b></span><span>Brood strength<b>${escS(e.broodStrength||'Not recorded')}</b></span><span>Colony size<b>${escS(e.colonySize||'Not recorded')}</b></span><span>Population frames<b>${escS(e.populationFrames||'Not recorded')}</b></span></div><p class="muted">These are prior Inspection references. Do not treat them as observations from this targeted check.</p></section>
      <section class="vc"><label class="v2p2e5r08-note"><span>Notes</span><textarea id="r08-notes" maxlength="500" placeholder="Optional current swarm-risk context"></textarea></label></section>
      <div class="v2p2e5r08-actions"><button class="secondary" onclick="go('actions')">Cancel</button><button class="primary" onclick="v2p2e5r08SaveCheck('${txt(h.id).replace(/'/g,"\\'")}','${txt(episode).replace(/'/g,"\\'")}')">Save Swarm Risk Inspection</button></div></div>`;
  }

  window.v2p2e5r08SaveCheck=function(hid,episode){
    const s=S(),h=hiveBy(s,hid);if(!h)return toast('Hive not found');const ev=evaluateR08(s,h),a=ev?.task,e=a?.evidenceChain||{};
    if(!a||txt(a.catalogTaskId)!==CATALOG_TASK_ID||low(a.workflowStage)!=='evidence'||txt(a.episodeId||e.episodeId)!==txt(episode))return toast('This Swarm Risk Inspection is no longer active');
    const row={id:'sr'+Date.now(),hiveId:txt(hid),date:todayFor(s,h),episodeId:txt(episode),sourceTaskId:txt(a.id),baselineInspectionId:txt(e.baselineInspectionId),queenCellStatus:txt(document.getElementById('r08-queen-cells')?.value)||'Not assessed',colonyCongestion:txt(document.getElementById('r08-congestion')?.value)||'Not assessed',broodNestSpace:txt(document.getElementById('r08-brood-space')?.value)||'Not assessed',superSpace:txt(document.getElementById('r08-super-space')?.value)||'Not assessed',swarmSigns:txt(document.getElementById('r08-swarm-signs')?.value)||'Not assessed',queenSeen:txt(document.getElementById('r08-queen-seen')?.value)||'Not assessed',notes:txt(document.getElementById('r08-notes')?.value),recordedAt:new Date().toISOString(),coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};
    row.verificationResult=resultForCheck(row);s.logs=s.logs||{};s.logs.swarmRiskChecks=Array.isArray(s.logs.swarmRiskChecks)?s.logs.swarmRiskChecks:[];s.logs.swarmRiskChecks.push(row);if(typeof save==='function'&&save(s)===false)return toast('Swarm Risk Inspection could not be saved');toast('Swarm Risk Inspection saved');go('actions');
  };

  /* Draft durability across unrelated global render() calls. Draft evidence is
     transient and is never persisted until Save Swarm Risk Inspection. */
  const DRAFT_IDS=['r08-queen-cells','r08-congestion','r08-brood-space','r08-super-space','r08-swarm-signs','r08-queen-seen','r08-notes'];
  const drafts=new Map();
  const routeKey=()=>{const r=txt(location.hash||'').replace(/^#/,'');return r.startsWith('swarm-risk-check/')?r:''};
  function snap(k){if(!k)return;const v={};let found=false;for(const id of DRAFT_IDS){const el=document.getElementById(id);if(el){v[id]=el.value;found=true}}if(found)drafts.set(k,v)}
  function restore(k){const v=drafts.get(k);if(!v)return;for(const id of DRAFT_IDS){const el=document.getElementById(id);if(el&&id in v)el.value=v[id]}}
  const remember=ev=>{if(DRAFT_IDS.includes(txt(ev?.target?.id))){const k=routeKey();if(k)snap(k)}};document.addEventListener('change',remember,true);document.addEventListener('input',remember,true);

  const prevRender=window.render||((typeof render==='function')?render:null);
  if(typeof prevRender==='function'){
    window.render=function(){
      const before=routeKey();if(before)snap(before);
      const p=txt(location.hash||'#home').replace(/^#/,'').split('/');
      if(p[0]==='swarm-risk-check'){
        const r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=renderCheck(txt(p[1]),decodeURIComponent(txt(p[2])));
        const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML='<button class="iconbtn" onclick="go(\'actions\')" aria-label="Back">‹</button><div class="pagebar-title">Swarm Risk Inspection</div><span></span>'}document.getElementById('bottomnav')?.classList.add('hidden');const k=routeKey();restore(k);queueMicrotask(()=>restore(k));setTimeout(()=>restore(k),0);return;
      }
      if(p[0]==='scientific-action'){
        let a=null;try{a=(typeof generateActions==='function'?(generateActions(S())||[]):[]).find(x=>x&&txt(x.id)===txt(p[1])&&txt(x.coreRuleId)===CORE_RULE_ID)||null}catch(_){ }
        if(a){const r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=detailHTML(a);const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML='<button class="iconbtn" onclick="go(\'actions\')" aria-label="Back">‹</button><div class="pagebar-title">Task Detail</div><span></span>'}document.getElementById('bottomnav')?.classList.add('hidden');return;}
      }
      const ret=prevRender.apply(this,arguments);return ret;
    };
    try{render=window.render}catch(_){ }
  }
  let lastKey=routeKey();window.addEventListener('hashchange',()=>{const next=routeKey();if(lastKey&&!next)drafts.delete(lastKey);lastKey=next});

  const style=document.createElement('style');style.id='v2p2e5r08a-style';style.textContent=`
    .v2p2e5r08-source,.v2p2e5r08-pill{display:inline-flex;padding:3px 7px;border-radius:999px;background:#f1f4eb;color:#58704d;font-size:10px;font-weight:700}
    .v2p2e5r08-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-top:8px}.v2p2e5r08-grid span{display:flex;flex-direction:column;font-size:11px;color:#667064}.v2p2e5r08-grid b{margin-top:2px;color:#263527;font-size:12px;overflow-wrap:anywhere}
    .v2p2e5r08-warning{margin-top:12px;padding:10px;border-radius:10px;background:#fff7dc;border:1px solid #eadca7;font-size:11px;line-height:1.45;color:#5b543b}
    .v2p2e5r08-form label{display:flex;flex-direction:column;gap:6px;padding:10px 0;border-bottom:1px solid #ece8dd}.v2p2e5r08-form label:last-child{border-bottom:0}.v2p2e5r08-form select{width:100%;min-height:44px;border:1px solid #ddd7c8;border-radius:10px;background:#fff;padding:0 10px}.v2p2e5r08-form small{color:#9a7820;font-size:10px}.v2p2e5r08-note{display:flex;flex-direction:column;gap:8px}.v2p2e5r08-note textarea{min-height:90px;border:1px solid #ddd7c8;border-radius:10px;padding:10px}.v2p2e5r08-actions{display:grid;grid-template-columns:1fr 1.45fr;gap:10px}.v2p2e5r08-check{padding-bottom:22px}
  `;document.head.appendChild(style);

  console.log('V2P2E5R08A LOADED | R08/S18 targeted swarm-risk check active');
})();
