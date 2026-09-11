/* V2P2E5R03A3 standalone loader: unique filename avoids stale v45.js deployment/cache ambiguity. */
(function(){
  const c=window.HiveDashTaskEngineCoreV1;
  if(c && typeof c.evaluateFoodShortage==='function' && c.foodShortageRule && typeof window.v2p2e5r03Evaluate==='function'){
    window.__HIVEDASH_V2P2E5R03A3__=true;
    window.__HIVEDASH_V2P2E5R03A4__=true;
  window.__HIVEDASH_V2P2E5R03A4_VERSION__='v2p2e5r03a4-r03-feeding-save-lock-fix';
    return;
  }
})();

/* ==============================================================
   V2P2E5R03A3 — R03 FEEDING HIVE LOCK
   Catalog rule: R03
   Catalog task: S07
   Core rule: HD-R03F-FOOD-SHORTAGE

   Source contract:
   - Direct current Food Stores evidence can identify FOOD_SHORTAGE.
   - Region / seasonal context changes management interpretation; when
     seasonalPhase or nectarState is unknown, HiveDash must not invent a
     universal recipe, ratio, amount, or claim that local forage is absent.
   - Initial management is B-level RECOMMEND_CONFIRM. Existing Feeding Record
     remains the execution workflow and keeps all AX15 validation.
   - A Feeding record proves management occurred, not biological resolution.
     Only a NEW targeted Food Verification (or newer full Inspection evidence)
     can verify the episode.
   - PASS / FAIL / INCONCLUSIVE are explicit. Missing fields never mean Low,
     adequate, or resolved.
   - Feeding must be explicitly linked to the R03 episode. An unrelated manual
     Feeding record never closes or advances this biological episode.
   - Existing Inspection / Feeding persistence, Timeline, R01/R02, S11-S14,
     AX17-AX19 and B37-B43 are not rewritten.
   ============================================================== */
(function v2p2e5r03a3FoodShortageCore(){
  if(window.__HIVEDASH_V2P2E5R03A3__)return;
  window.__HIVEDASH_V2P2E5R03A3__=true;

  const CORE_RULE_ID='HD-R03F-FOOD-SHORTAGE';
  const RULE_VERSION='HD-R03F-v1.1-2026-09-11';
  const MIGRATION_VERSION='V2P2E5R03A3';
  const CATALOG_RULE_ID='R03';
  const CATALOG_TASK_ID='S07';
  const CTX_KEY='hivedash:v2p2e5r03:feeding-exec';
  const base=window.HiveDashTaskEngineCoreV1;
  if(!base||typeof base.normalizeTaskProjection!=='function'||typeof base.buildContextSnapshot!=='function'){
    console.error('V2P2E5R03A1 requires HiveDashTaskEngineCoreV1');return;
  }

  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const iso=v=>/^\d{4}-\d{2}-\d{2}$/.test(txt(v).slice(0,10))?txt(v).slice(0,10):'';
  const escR=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S=()=>{try{return typeof v45s==='function'?v45s():state()}catch(_){return null}};
  const active=s=>{try{return typeof v224ActiveTrackedHives==='function'?v224ActiveTrackedHives(s):(s?.hives||[]).filter(h=>h&&!h.archived&&!['combined','archived'].includes(low(h.lifecycleStatus||h.status)))}catch(_){return (s?.hives||[]).filter(Boolean)}};
  const hiveBy=(s,id)=>active(s).find(h=>txt(h.id)===txt(id))||null;
  const todayFor=(s,h)=>{try{return typeof v2p2e5Today==='function'?txt(v2p2e5Today(s,h?.id||'')):typeof v2p1bDateInHiveTimezone==='function'?txt(v2p1bDateInHiveTimezone(s,h)):new Date().toISOString().slice(0,10)}catch(_){return new Date().toISOString().slice(0,10)}};
  const addDays=(d,n)=>{const x=iso(d);if(!x)return'';const dt=new Date(x+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+Number(n||0));return dt.toISOString().slice(0,10)};
  const parseMs=v=>{const n=Date.parse(txt(v));return Number.isFinite(n)?n:0};
  const idMs=v=>{const m=txt(v).match(/(\d{10,})/);return m?Number(m[1])||0:0};
  const orderMs=x=>parseMs(x?.r03LinkedAt)||parseMs(x?.recordedAt)||parseMs(x?.updatedAt)||parseMs(x?.createdAt)||parseMs(iso(x?.date)?iso(x.date)+'T12:00:00Z':'')||idMs(x?.id);

  function inspections(s,hid){return (Array.isArray(s?.logs?.inspections)?s.logs.inspections:[]).map((r,index)=>({r,index})).filter(x=>x.r&&txt(x.r.hiveId)===txt(hid)).sort((a,b)=>orderMs(b.r)-orderMs(a.r)||b.index-a.index)}
  function latestInspection(s,hid){return inspections(s,hid)[0]||null}
  function foodVerifications(s,hid){return (Array.isArray(s?.logs?.foodVerifications)?s.logs.foodVerifications:[]).filter(v=>v&&txt(v.hiveId)===txt(hid)&&txt(v.coreRuleId)===CORE_RULE_ID).slice().sort((a,b)=>orderMs(b)-orderMs(a))}
  function linkedFeedings(s,hid,episodeId){return (Array.isArray(s?.logs?.feedings)?s.logs.feedings:[]).filter(f=>f&&txt(f.hiveId)===txt(hid)&&txt(f.r03EpisodeId)===txt(episodeId)).slice().sort((a,b)=>orderMs(b)-orderMs(a))}

  const unknown=v=>['','not assessed','not confirmed','unknown','not recorded','—','-','n/a'].includes(low(v));
  const isLow=v=>low(v)==='low';
  const isAdequateStore=v=>['medium','high'].includes(low(v));
  // Legacy enum normalization: historical records may contain browser-translated values.
  // Normalize only at evaluation/display time; never rewrite the saved historical record.
  const yes=v=>['yes','true','needed','need feeding','是','需要','需喂食','需要喂食'].includes(low(v));
  const no=v=>['no','false','not needed','不','否','不需要','无需','无需喂食'].includes(low(v));

  function foodState(x){
    if(!x)return {status:'NO_EVIDENCE',honey:'',pollen:'',feedingNeed:''};
    const honey=txt(x.honey),pollen=txt(x.pollen),feedingNeed=txt(x.feedingNeed);
    if(isLow(honey)||isLow(pollen)||yes(feedingNeed))return {status:'SHORTAGE',honey,pollen,feedingNeed};
    if(isAdequateStore(honey)&&isAdequateStore(pollen)&&no(feedingNeed))return {status:'ADEQUATE',honey,pollen,feedingNeed};
    return {status:'INCONCLUSIVE',honey,pollen,feedingNeed};
  }
  function verificationResult(v){
    if(!v)return 'NONE';
    const fs=foodState(v);
    return fs.status==='SHORTAGE'?'FAIL':fs.status==='ADEQUATE'?'PASS':'INCONCLUSIVE';
  }
  function episodeId(hid,inspectionId){return `r03-food-${txt(hid)}-${txt(inspectionId)}`}
  function contextFor(s,h){
    let c={};try{c=base.buildContextSnapshot(s,h.id)||{}}catch(_){c={}}
    const insp=latestInspection(s,h.id)?.r||null;
    return {
      stateCode:txt(c?.location?.stateCode),city:txt(c?.location?.city),timezone:txt(c?.location?.timezone),
      seasonalPhase:txt(c?.seasonalPhase)||'UNRESOLVED',colonyPhase:txt(c?.colonyPhase)||'Uncertain',
      nectarState:txt(c?.nectarState)||'UNKNOWN',superStatus:txt(insp?.super||insp?.superStatus)||'Not assessed',
      hiveWeight:'Not recorded',contextGeneratedAt:txt(c?.contextGeneratedAt)||''
    };
  }
  function evidencePayload(s,h,baseline,episode,extra={}){
    const fs=foodState(baseline?.r),ctx=contextFor(s,h);
    return {
      episodeId:episode,baselineInspectionId:txt(baseline?.r?.id),baselineInspectionIndex:Number(baseline?.index??-1),baselineInspectionDate:iso(baseline?.r?.date),
      honey:fs.honey||'Not assessed',pollen:fs.pollen||'Not assessed',feedingNeed:fs.feedingNeed||'Not assessed',
      foodState:fs.status,region:[ctx.city,ctx.stateCode].filter(Boolean).join(', ')||'Not recorded',timezone:ctx.timezone||'Not recorded',
      seasonalPhase:ctx.seasonalPhase,nectarState:ctx.nectarState,colonyPhase:ctx.colonyPhase,superStatus:ctx.superStatus,hiveWeight:ctx.hiveWeight,
      contextLimitations:['seasonalPhase','nectarState','hiveWeight','harvestableHoneySuper'].filter(k=>k==='seasonalPhase'?ctx.seasonalPhase==='UNRESOLVED':k==='nectarState'?ctx.nectarState==='UNKNOWN':k==='hiveWeight'||k==='harvestableHoneySuper'),
      ...extra
    };
  }
  function taskBase(s,h,baseline,title,stage,episode){
    const today=todayFor(s,h),fs=foodState(baseline?.r),high=isLow(fs.honey)&&yes(fs.feedingNeed);
    return {
      id:`scientific-food-${stage}-${h.id}-${txt(baseline?.r?.id)}`,hiveId:h.id,type:stage==='follow-up'?'Inspection':'Feeding',title,status:'Pending',priority:high?'High':'Medium',
      due:high?'As soon as practical':'Within 7 days',dueEarliest:today,dueLatest:addDays(today,7),date:'',source:'scientific-engine',systemGenerated:true,
      reasonCode:'food',intentKey:stage==='follow-up'?'food-verification':'food-management',workflowStage:stage,executionRoute:'',
      coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,ruleEngineOwner:'HiveDashTaskEngineCoreV1',ruleMigrationVersion:MIGRATION_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,
      assessmentType:'FOOD_SHORTAGE',decisionType:'RECOMMEND_CONFIRM',automationLevel:'B_RECOMMEND_CONFIRM',verificationStatus:stage==='follow-up'?'PENDING':'NOT_REQUIRED',
      episodeId:episode
    };
  }

  function evaluateR03(s,h){
    const evaluation={ruleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,assessment:{status:'NO_FOOD_SHORTAGE_EVIDENCE'},decision:{type:'NO_TASK',automationLevel:'NONE'},verification:{result:'NOT_REQUIRED'},outcome:{status:'NOT_OPEN'},task:null};
    const baseline=latestInspection(s,h.id);if(!baseline)return evaluation;
    const fs=foodState(baseline.r);
    if(fs.status!=='SHORTAGE'){
      evaluation.assessment={status:fs.status==='ADEQUATE'?'FOOD_STORES_ADEQUATE':'FOOD_EVIDENCE_INSUFFICIENT',inspectionId:txt(baseline.r.id)};
      return evaluation;
    }
    const episode=episodeId(h.id,baseline.r.id),feeds=linkedFeedings(s,h.id,episode),feed=feeds[0]||null;
    const verifications=foodVerifications(s,h.id).filter(v=>txt(v.episodeId)===episode),verification=verifications[0]||null;
    const feedAfterVerification=feed&&(!verification||orderMs(feed)>orderMs(verification));

    if(feedAfterVerification){
      const a=taskBase(s,h,baseline,'Recheck food stores','follow-up',episode);
      a.id=`scientific-food-verification-${h.id}-${txt(baseline.r.id)}`;
      a.systemWhy='A Feeding record is linked to this food-shortage episode. Feeding proves management occurred, not that reserves recovered; record new Food Stores evidence.';
      a.evidenceChain=evidencePayload(s,h,baseline,episode,{linkedFeedingId:txt(feed.id),linkedFeedingDate:iso(feed.date),linkedFeedingType:txt(feed.type)||'Not recorded',linkedFeedingAmount:txt(feed.amount)||'Not recorded'});
      evaluation.assessment={status:'FOOD_VERIFICATION_REQUIRED',inspectionId:txt(baseline.r.id),linkedFeedingId:txt(feed.id)};evaluation.decision={type:'AUTO_CREATE',automationLevel:'A_AUTO_TASK'};evaluation.verification={result:'PENDING'};evaluation.outcome={status:'OPEN'};evaluation.task=a;return evaluation;
    }

    if(verification){
      const result=verificationResult(verification);
      if(result==='PASS'){
        evaluation.assessment={status:'FOOD_SHORTAGE_RESOLVED',inspectionId:txt(baseline.r.id),verificationId:txt(verification.id)};evaluation.verification={result:'PASS'};evaluation.outcome={status:'RESOLVED'};return evaluation;
      }
      if(result==='INCONCLUSIVE'){
        const a=taskBase(s,h,baseline,'Food verification still needed','follow-up',episode);
        a.id=`scientific-food-verification-${h.id}-${txt(baseline.r.id)}`;a.systemWhy='The targeted Food Verification did not provide enough current evidence to confirm recovery or ongoing shortage. Missing values are not treated as adequate stores.';
        a.evidenceChain=evidencePayload(s,h,baseline,episode,{verificationId:txt(verification.id),verificationResult:'INCONCLUSIVE',linkedFeedingId:txt(verification.linkedFeedingId)});
        evaluation.assessment={status:'FOOD_VERIFICATION_INCONCLUSIVE',inspectionId:txt(baseline.r.id),verificationId:txt(verification.id)};evaluation.decision={type:'AUTO_CREATE',automationLevel:'A_AUTO_TASK'};evaluation.verification={result:'INCONCLUSIVE'};evaluation.outcome={status:'OPEN'};evaluation.task=a;return evaluation;
      }
      const a=taskBase(s,h,baseline,'Food shortage persists','management-review',episode);
      a.id=`scientific-food-management-${h.id}-${txt(baseline.r.id)}`;a.systemWhy='New Food Verification still shows low stores or an explicit feeding need. Review the next legal and season-appropriate management step; HiveDash will not repeat a feed type, ratio, or amount automatically.';
      a.evidenceChain=evidencePayload(s,h,baseline,episode,{verificationId:txt(verification.id),verificationResult:'FAIL',verifiedHoney:txt(verification.honey)||'Not assessed',verifiedPollen:txt(verification.pollen)||'Not assessed',verifiedFeedingNeed:txt(verification.feedingNeed)||'Not assessed',linkedFeedingId:txt(verification.linkedFeedingId)});
      evaluation.assessment={status:'FOOD_SHORTAGE_PERSISTS',inspectionId:txt(baseline.r.id),verificationId:txt(verification.id)};evaluation.decision={type:'RECOMMEND_CONFIRM',automationLevel:'B_RECOMMEND_CONFIRM'};evaluation.verification={result:'FAIL'};evaluation.outcome={status:'CONTINUE'};evaluation.task=a;return evaluation;
    }

    const a=taskBase(s,h,baseline,'Review food shortage','management-review',episode);
    a.id=`scientific-food-shortage-${h.id}-${txt(baseline.r.id)}`;
    a.systemWhy='Current Inspection evidence shows low food stores or an explicit feeding need. Review local season, colony context, and hive configuration before choosing whether and how to feed.';
    a.evidenceChain=evidencePayload(s,h,baseline,episode);
    evaluation.assessment={status:'FOOD_SHORTAGE',inspectionId:txt(baseline.r.id),honey:fs.honey,pollen:fs.pollen,feedingNeed:fs.feedingNeed};evaluation.decision={type:'RECOMMEND_CONFIRM',automationLevel:'B_RECOMMEND_CONFIRM'};evaluation.verification={result:'NOT_REQUIRED'};evaluation.outcome={status:'OPEN'};evaluation.task=a;return evaluation;
  }

  const SOURCES=Object.freeze({CORE:Object.freeze({id:'R03-SOURCE-CONTRACT',authority:'HiveDash Scientific Task Engine v1.0',title:'R03 growing-season food shortage source contract'}),ARCH:Object.freeze({id:'TASK-ENGINE-CORE-V1',authority:'HiveDash Task Engine Core Architecture v1.0',title:'Food shortage evidence / Feeding / verification contract'})});
  const ruleDefinition=Object.freeze({
    id:CORE_RULE_ID,version:RULE_VERSION,engineOwner:'HiveDashTaskEngineCoreV1',migrationVersion:MIGRATION_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,
    category:'FOOD_MANAGEMENT',assessmentType:'FOOD_SHORTAGE',decisionClass:'B_RECOMMEND_CONFIRM',
    evidenceInputs:Object.freeze(['latest Inspection honey stores','latest Inspection pollen stores','latest Inspection feeding need','linked Feeding record','targeted Food Verification']),
    contextInputs:Object.freeze(['region','seasonalPhase','colonyPhase','nectarState','super status','hive weight']),authorityRules:SOURCES,
    policy:Object.freeze({foodLowCanTriggerReview:true,feedingDoesNotEqualResolution:true,unrelatedFeedingDoesNotSatisfyEpisode:true,noUniversalFeedRecipe:true,unknownSeasonRemainsUnknown:true,targetedVerification:true,passFailInconclusive:true}),
    evaluate:(s,h)=>evaluateR03(s,h)
  });
  try{if(typeof base.registerRule==='function')base.registerRule(ruleDefinition)}catch(err){console.error('V2P2E5R03A1 rule registration failed',err)}
  window.HiveDashTaskEngineCoreV1=Object.freeze({...base,foodShortageRule:ruleDefinition,evaluateFoodShortage:(s,hid)=>{const h=hiveBy(s,hid);return h?evaluateR03(s,h):null}});
  window.V2P2E5R03_FOOD_SHORTAGE_RULE=ruleDefinition;
  window.v2p2e5r03Evaluate=function(hiveId){const s=S(),h=hiveBy(s,hiveId);return h?evaluateR03(s,h):null};

  function isLegacyFoodTask(a){
    if(!a||txt(a.coreRuleId)===CORE_RULE_ID)return false;
    const id=low(a.id),intent=low(a.intentKey),src=low(a.source),title=low(a.title),reason=low(a.reasonCode);
    return (src==='scientific-engine'||id.startsWith('v224b-')||id.startsWith('scientific-food-'))&&(id.startsWith('v224b-food-')||id.startsWith('scientific-food-recheck-')||intent==='food-review'||intent==='food-recheck'||(reason==='food'&&(title.includes('food stores')||title.includes('food shortage'))));
  }
  function projectTask(evaluation,s){
    if(!evaluation?.task)return null;let task;
    try{task=base.normalizeTaskProjection(evaluation.task,s,{evidence:new Map(),context:new Map()})}catch(_){task={...evaluation.task}}
    task.coreRuleId=CORE_RULE_ID;task.ruleVersion=RULE_VERSION;task.ruleEngineOwner='HiveDashTaskEngineCoreV1';task.ruleMigrationVersion=MIGRATION_VERSION;task.catalogRuleId=CATALOG_RULE_ID;task.catalogTaskId=CATALOG_TASK_ID;task.assessmentType='FOOD_SHORTAGE';
    task.decisionType=evaluation.decision?.type||task.decisionType||'RECOMMEND_CONFIRM';task.automationLevel=evaluation.decision?.automationLevel||task.automationLevel||'B_RECOMMEND_CONFIRM';task.verificationStatus=evaluation.verification?.result||task.verificationStatus||'PENDING';task.ruleEvaluation={assessment:evaluation.assessment,decision:evaluation.decision,verification:evaluation.verification,outcome:evaluation.outcome};task.outcomeSnapshot=evaluation.outcome;
    return task;
  }

  const prevGenerate=window.generateActions||((typeof generateActions==='function')?generateActions:null);
  if(typeof prevGenerate==='function'){
    window.generateActions=function(s){
      let out=(prevGenerate(s)||[]).filter(a=>!isLegacyFoodTask(a));
      const seen=new Set(out.map(a=>txt(a.id)||`${txt(a.hiveId)}|${txt(a.intentKey)}|${txt(a.title)}`));
      for(const h of active(s)){
        const ev=evaluateR03(s,h),task=projectTask(ev,s);if(!task)continue;
        /* A user-created Feeding plan is the same broad intent. Do not create a
           duplicate system card; the biological episode remains evaluable. */
        const manualFeeding=out.some(a=>a&&txt(a.hiveId)===txt(h.id)&&low(a.type)==='feeding'&&low(a.source)!=='scientific-engine'&&!['completed','done'].includes(low(a.status))&&low(a.priority)!=='done');
        if(manualFeeding&&low(task.workflowStage)==='management-review')continue;
        const k=txt(task.id)||`${txt(task.hiveId)}|${txt(task.intentKey)}|${txt(task.title)}`;if(seen.has(k))continue;seen.add(k);out.push(task);
      }
      return out;
    };
    try{generateActions=window.generateActions}catch(_){ }
  }

  function currentGeneratedAction(){
    const p=txt(location.hash||'#home').replace(/^#/,'').split('/');if(p[0]!=='scientific-action'||!p[1])return null;
    const s=S();try{return (typeof generateActions==='function'?(generateActions(s)||[]):[]).find(a=>a&&txt(a.id)===txt(p[1])&&txt(a.coreRuleId)===CORE_RULE_ID)||null}catch(_){return null}
  }
  function writeFeedCtx(a){
    try{sessionStorage.setItem(CTX_KEY,JSON.stringify({hiveId:txt(a.hiveId),actionId:txt(a.id),episodeId:txt(a.episodeId||a.evidenceChain?.episodeId),baselineInspectionId:txt(a.evidenceChain?.baselineInspectionId),startedAt:Date.now()}))}catch(_){ }
  }
  function readFeedCtx(){try{const x=JSON.parse(sessionStorage.getItem(CTX_KEY)||'null');if(!x||Date.now()-Number(x.startedAt||0)>3600000){sessionStorage.removeItem(CTX_KEY);return null}return x}catch(_){return null}}
  function clearFeedCtx(){try{sessionStorage.removeItem(CTX_KEY)}catch(_){ }}
  if(!window.__HIVEDASH_R03_FEED_CTX_CLEANUP_BOUND__){
    window.__HIVEDASH_R03_FEED_CTX_CLEANUP_BOUND__=true;
    window.addEventListener('hashchange',()=>{
      const ctx=readFeedCtx();if(!ctx)return;
      const p=txt(location.hash||'#home').replace(/^#/,'').split('/');
      /* Keep context only while the scoped Feeding page is active. Leaving the
         workflow without saving must not contaminate a later manual Feeding. */
      if(p[0]!=='feeding-record')clearFeedCtx();
    });
  }

  window.v2p2e5r03StartFeeding=function(actionId){
    const s=S();let a=null;try{a=(typeof generateActions==='function'?(generateActions(s)||[]):[]).find(x=>x&&txt(x.id)===txt(actionId)&&txt(x.coreRuleId)===CORE_RULE_ID)||null}catch(_){ }
    if(!a||low(a.workflowStage)!=='management-review')return toast('This Food Management review is no longer active');
    writeFeedCtx(a);go('feeding-record/'+a.hiveId);
  };
  window.v2p2e5r03OpenFoodVerification=function(actionId){
    const s=S();let a=null;try{a=(typeof generateActions==='function'?(generateActions(s)||[]):[]).find(x=>x&&txt(x.id)===txt(actionId)&&txt(x.coreRuleId)===CORE_RULE_ID)||null}catch(_){ }
    if(!a||low(a.workflowStage)!=='follow-up')return toast('This Food Verification is no longer active');
    go(`food-verification/${a.hiveId}/${encodeURIComponent(txt(a.episodeId||a.evidenceChain?.episodeId))}`);
  };

  /* Exact Feeding linkage. Unrelated manual Feeding records are deliberately
     not accepted as execution evidence for an R03 episode. */
  const prevSaveRec=window.saveRec||((typeof saveRec==='function')?saveRec:null);
  if(typeof prevSaveRec==='function'){
    window.saveRec=function(type){
      if(low(type)!=='feeding')return prevSaveRec.apply(this,arguments);
      const form=document.getElementById('rform'),ctx=readFeedCtx(),hiddenHive=form?.querySelector('input[type="hidden"][name="hiveId"]'),routeHive=txt((location.hash||'#').replace(/^#/,'').split('/')[1]),hid=txt(hiddenHive?.value||routeHive),before=S(),beforeIds=new Set((before?.logs?.feedings||[]).map(x=>txt(x.id)));
      if(ctx && txt(ctx.hiveId)!==hid){
        toast('This R03 Feeding is locked to the original hive');
        try{go('feeding-record/'+ctx.hiveId)}catch(_){ }
        return false;
      }
      const ret=prevSaveRec.apply(this,arguments);
      if(!ctx)return ret;
      try{
        const s=S(),created=(s?.logs?.feedings||[]).filter(f=>f&&txt(f.hiveId)===hid&&!beforeIds.has(txt(f.id)));const row=created[created.length-1];
        if(row){row.r03EpisodeId=txt(ctx.episodeId);row.r03SourceTaskId=txt(ctx.actionId);row.r03BaselineInspectionId=txt(ctx.baselineInspectionId);row.r03LinkedAt=new Date().toISOString();row.coreRuleId=CORE_RULE_ID;row.catalogTaskId=CATALOG_TASK_ID;row.ruleVersion=RULE_VERSION;if(typeof save==='function')save(s);clearFeedCtx();try{if(low(location.hash).includes('actions')&&typeof render==='function')render()}catch(_){ }}
      }catch(err){console.error('V2P2E5R03A1 Feeding linkage failed',err)}
      return ret;
    };
    try{saveRec=window.saveRec}catch(_){ }
  }

  function detailHTML(a){
    const s=S(),h=hiveBy(s,a.hiveId),e=a.evidenceChain||{},stage=low(a.workflowStage),management=stage==='management-review';
    const contextWarnings=[];if(txt(e.seasonalPhase)==='UNRESOLVED')contextWarnings.push('Seasonal phase is unresolved');if(txt(e.nectarState)==='UNKNOWN')contextWarnings.push('Natural forage state is unknown');if(txt(e.hiveWeight)==='Not recorded')contextWarnings.push('Hive weight is not recorded');
    return `<div class="vs v2p2e5ab-detail v2p2e5r03-detail"><section class="vc"><div class="vhead"><b>${escR(a.title||'Food management')}</b><span class="v2p2e5ab-source-pill">System</span></div><div class="v2p2e5ab-detail-grid"><span>Hive<b>${escR(h?.name||'Unavailable')}</b></span><span>Stage<b>${management?'Review management':'Verify result'}</b></span><span>Priority<b>${escR(a.priority||'Medium')}</b></span><span>Due<b>${escR(a.due||'Within 7 days')}</b></span></div></section>
      <section class="vc"><div class="vhead"><b>Why this task exists</b></div><p>${escR(a.systemWhy||'Current Food Stores evidence needs review.')}</p></section>
      <section class="vc"><div class="vhead"><b>Food evidence</b><span class="v2p2e5r03-pill">R03 · S07</span></div><div class="v2p2e5r03-grid">
        <span>Latest Inspection<b>${escR(e.baselineInspectionDate||'Not recorded')}</b></span><span>Food state<b>${escR(e.foodState||'Unknown')}</b></span>
        <span>Honey Stores<b>${escR(e.honey||'Not assessed')}</b></span><span>Pollen Stores<b>${escR(e.pollen||'Not assessed')}</b></span>
        <span>Feeding Need<b>${escR(e.feedingNeed||'Not assessed')}</b></span><span>Colony phase<b>${escR(e.colonyPhase||'Uncertain')}</b></span>
        <span>Region<b>${escR(e.region||'Not recorded')}</b></span><span>Seasonal phase<b>${escR(e.seasonalPhase||'UNRESOLVED')}</b></span>
        <span>Nectar state<b>${escR(e.nectarState||'UNKNOWN')}</b></span><span>Super status<b>${escR(e.superStatus||'Not assessed')}</b></span>
        <span>Hive weight<b>${escR(e.hiveWeight||'Not recorded')}</b></span><span>Linked Feeding<b>${escR(e.linkedFeedingId||'Not recorded')}</b></span>
      </div>${contextWarnings.length?`<div class="v2p2e5r03-warning"><b>Context limits</b><br>${escR(contextWarnings.join(' · '))}. HiveDash will not invent a feed type, syrup ratio, quantity, or local forage condition.</div>`:''}</section>
      <section class="vc"><div class="vhead"><b>What happens next</b></div><p>${management?'Review the evidence and choose a Feeding action only if appropriate. The existing Feeding form starts blank; HiveDash does not preselect feed type, ratio, or amount.':'Record new Food Stores evidence. A Feeding record is management evidence, not proof that reserves recovered.'}</p></section>
      <div class="v2p2e5ab-detail-actions"><button class="secondary" onclick="go('actions')">Back</button><button class="primary" onclick="${management?`v2p2e5r03StartFeeding('${txt(a.id).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')`:`v2p2e5r03OpenFoodVerification('${txt(a.id).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')`}">${management?'Review Feeding Options':'Start Food Verification'}</button></div></div>`;
  }

  function renderFoodVerification(hid,episode){
    const s=S(),h=hiveBy(s,hid);if(!h)return `<div class="vs"><section class="vc"><b>Hive unavailable</b></section></div>`;
    const ev=evaluateR03(s,h),a=ev?.task,e=a?.evidenceChain||{};if(!a||low(a.workflowStage)!=='follow-up'||txt(a.episodeId||e.episodeId)!==txt(episode))return `<div class="vs"><section class="vc"><div class="vhead"><b>Food Verification no longer required</b></div><p>New evidence or a changed workflow state has resolved or replaced this follow-up.</p><button class="primary" onclick="go('actions')">Back to Actions</button></section></div>`;
    return `<div class="vs v2p2e5r03-food-verification"><section class="vc"><div class="vhead"><b>Food Verification · targeted evidence</b><span class="v2p2e5r03-pill">R03 · S07</span></div><p class="muted">Record only what you assess now. Previous values are reference only. This does not count as a full Inspection.</p></section>
      <section class="vc v2p2e5r03-verify-card"><label><span>Honey Stores</span><select id="r03fv-honey"><option>Not assessed</option><option>High</option><option>Medium</option><option>Low</option></select><small>Previous: ${escR(e.honey||'Not assessed')} · reference only</small></label><label><span>Pollen Stores</span><select id="r03fv-pollen"><option>Not assessed</option><option>High</option><option>Medium</option><option>Low</option></select><small>Previous: ${escR(e.pollen||'Not assessed')} · reference only</small></label><label><span>Feeding Need</span><select id="r03fv-need"><option>Not assessed</option><option>No</option><option>Yes</option></select><small>Previous: ${escR(e.feedingNeed||'Not assessed')} · reference only</small></label></section>
      <section class="vc"><div class="vhead"><b>Linked management</b></div><div class="v2p2e5r03-grid"><span>Feeding record<b>${escR(e.linkedFeedingId||'Not recorded')}</b></span><span>Feeding date<b>${escR(e.linkedFeedingDate||'Not recorded')}</b></span><span>Feed type<b>${escR(e.linkedFeedingType||'Not recorded')}</b></span><span>Amount<b>${escR(e.linkedFeedingAmount||'Not recorded')}</b></span></div></section>
      <section class="vc"><label class="v2p2e5r03-note"><span>Notes</span><textarea id="r03fv-notes" maxlength="500" placeholder="Optional current food-store context"></textarea></label></section>
      <div class="v2p2e5r03-verify-actions"><button class="secondary" onclick="go('actions')">Cancel</button><button class="primary" onclick="v2p2e5r03SaveFoodVerification('${txt(h.id).replace(/'/g,"\\'")}','${txt(episode).replace(/'/g,"\\'")}')">Save Food Verification</button></div></div>`;
  }

  window.v2p2e5r03SaveFoodVerification=function(hid,episode){
    const s=S(),h=hiveBy(s,hid);if(!h)return toast('Hive not found');const ev=evaluateR03(s,h),a=ev?.task,e=a?.evidenceChain||{};
    if(!a||low(a.workflowStage)!=='follow-up'||txt(a.episodeId||e.episodeId)!==txt(episode))return toast('This Food Verification is no longer active');
    const honey=txt(document.getElementById('r03fv-honey')?.value)||'Not assessed',pollen=txt(document.getElementById('r03fv-pollen')?.value)||'Not assessed',feedingNeed=txt(document.getElementById('r03fv-need')?.value)||'Not assessed',notes=txt(document.getElementById('r03fv-notes')?.value);
    const row={id:'fv'+Date.now(),hiveId:txt(hid),date:todayFor(s,h),episodeId:txt(episode),sourceTaskId:txt(a.id),baselineInspectionId:txt(e.baselineInspectionId),linkedFeedingId:txt(e.linkedFeedingId),honey,pollen,feedingNeed,notes,recordedAt:new Date().toISOString(),coreRuleId:CORE_RULE_ID,ruleVersion:RULE_VERSION,catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID};row.verificationResult=verificationResult(row);
    s.logs=s.logs||{};s.logs.foodVerifications=Array.isArray(s.logs.foodVerifications)?s.logs.foodVerifications:[];s.logs.foodVerifications.push(row);if(typeof save==='function'&&save(s)===false)return toast('Food Verification could not be saved');toast('Food Verification saved');go('actions');
  };

  function decorateFeedingForm(){
    const ctx=readFeedCtx();if(!ctx)return;
    const p=txt(location.hash||'#home').replace(/^#/,'').split('/');
    if(p[0]!=='feeding-record')return;
    /* An R03-linked Feeding is scoped to the hive that owns the biological
       episode. Do not allow the generic manual Feeding hive switcher to move
       the record to another hive. If a stale/mismatched route is reached,
       redirect back to the episode hive rather than silently unlinking it. */
    if(txt(p[1])!==txt(ctx.hiveId)){
      setTimeout(()=>{try{go('feeding-record/'+ctx.hiveId)}catch(_){ }},0);
      return;
    }
    const form=document.querySelector('.feeding-form-v98');if(!form)return;
    const hiveSelect=document.querySelector('.feeding-hive-card select[name="hiveId"]');
    if(hiveSelect){
      hiveSelect.value=txt(ctx.hiveId);
      hiveSelect.disabled=true;
      hiveSelect.setAttribute('aria-disabled','true');
      hiveSelect.setAttribute('title','Hive is locked to this R03 food-shortage episode');
      hiveSelect.classList.add('v2p2e5r03-hive-locked');
    }
    const hidden=form.querySelector('input[type="hidden"][name="hiveId"]');if(hidden)hidden.value=txt(ctx.hiveId);
    if(document.querySelector('.v2p2e5r03-feed-banner'))return;
    const box=document.createElement('section');box.className='vc v2p2e5r03-feed-banner';box.innerHTML='<div class="vhead"><b>R03 Food shortage review</b><span class="v2p2e5r03-pill">S07</span></div><p>Choose the feeding record that reflects your actual management decision. HiveDash has not selected a feed type, syrup ratio, or quantity. This Feeding is locked to the hive that owns the R03 episode. Saving this record will create a separate Food Verification follow-up; it will not mark the food risk resolved.</p>';
    form.parentElement?.insertBefore(box,form);
  }

  const prevRender=window.render||((typeof render==='function')?render:null);
  if(typeof prevRender==='function'){
    window.render=function(){
      const p=txt(location.hash||'#home').replace(/^#/,'').split('/');
      if(p[0]==='food-verification'){
        const r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=renderFoodVerification(txt(p[1]),decodeURIComponent(txt(p[2])));
        const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML='<button class="iconbtn" onclick="go(\'actions\')" aria-label="Back">‹</button><div class="pagebar-title">Food Verification</div><span></span>'}document.getElementById('bottomnav')?.classList.add('hidden');return;
      }
      if(p[0]==='scientific-action'){
        let a=null;try{a=(typeof generateActions==='function'?(generateActions(S())||[]):[]).find(x=>x&&txt(x.id)===txt(p[1])&&txt(x.coreRuleId)===CORE_RULE_ID)||null}catch(_){ }
        if(a){const r=document.getElementById('view');if(!r)return;r.className='view secondary';r.innerHTML=detailHTML(a);const top=document.getElementById('topbar');if(top){top.className='topbar vtop';top.innerHTML='<button class="iconbtn" onclick="go(\'actions\')" aria-label="Back">‹</button><div class="pagebar-title">Task Detail</div><span></span>'}document.getElementById('bottomnav')?.classList.add('hidden');return;}
      }
      const ret=prevRender.apply(this,arguments);try{decorateFeedingForm()}catch(_){ }queueMicrotask(()=>{try{decorateFeedingForm()}catch(_){ }});return ret;
    };
    try{render=window.render}catch(_){ }
  }

  const style=document.createElement('style');style.id='v2p2e5r03a-style';style.textContent=`
    .v2p2e5r03-pill{display:inline-flex;padding:3px 7px;border-radius:999px;background:#f1f4eb;color:#58704d;font-size:10px;font-weight:700}
    .v2p2e5r03-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-top:8px}.v2p2e5r03-grid span{display:flex;flex-direction:column;font-size:11px;color:#667064}.v2p2e5r03-grid b{margin-top:2px;color:#263527;font-size:12px;overflow-wrap:anywhere}
    .v2p2e5r03-warning{margin-top:12px;padding:10px;border-radius:10px;background:#fff7dc;border:1px solid #eadca7;font-size:11px;line-height:1.45;color:#5b543b}
    .v2p2e5r03-food-verification{padding-bottom:22px}.v2p2e5r03-verify-card label{display:flex;flex-direction:column;gap:6px;padding:10px 0;border-bottom:1px solid #ece8dd}.v2p2e5r03-verify-card label:last-child{border-bottom:0}.v2p2e5r03-verify-card select{width:100%;min-height:44px;border:1px solid #ddd7c8;border-radius:10px;background:#fff;padding:0 10px}.v2p2e5r03-verify-card small{color:#9a7820;font-size:10px}.v2p2e5r03-note{display:flex;flex-direction:column;gap:8px}.v2p2e5r03-note textarea{min-height:90px;border:1px solid #ddd7c8;border-radius:10px;padding:10px}.v2p2e5r03-verify-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:10px}.v2p2e5r03-feed-banner{margin-bottom:12px}.feeding-hive-card select.v2p2e5r03-hive-locked{opacity:.72;cursor:not-allowed;background:#f5f3ed}
  `;document.head.appendChild(style);

  window.__HIVEDASH_V2P2E5R03A4__=true;
  window.__HIVEDASH_V2P2E5R03A4_VERSION__='v2p2e5r03a4-r03-feeding-save-lock-fix';
})();
