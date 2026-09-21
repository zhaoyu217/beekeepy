/* ==============================================================
   HiveDash V2P2E5X1A — R08/R09/R11 swarm-space evidence ownership

   Scope: cross-rule projection only. Frozen R08, R09, R11 and B41 business
   logic/persistence are not modified.

   Ownership contract:
   - An R08 targeted Swarm Risk Check that evaluates FAIL is owned by the
     R09/S19 swarm-management episode.
   - That exact failed R08 check must not simultaneously seed an R11/S22
     evidence or management-review task. This prevents duplicate collection
     of brood/super space + congestion and competing management entry points.
   - The old failed R08 evidence stays consumed even after R09 resolves. R11
     may re-enter only from NEW independent evidence (for example, a newer
     Inspection with Super Status = Needed, or another non-R09-owned signal).
   - Migration safety: if an R11-linked Add Super was already completed before
     this layer existed, keep its R11 follow-up verification. Never hide a
     verification for a real user-confirmed action that already occurred.
   - No tasks from other rules/hives are changed.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5X1A__) return;
  window.__HIVEDASH_V2P2E5X1A__=true;

  const VERSION='v2p2e5x1a-r08-r09-r11-space-evidence-ownership';
  const R08_CORE='HD-R08S-SWARM-RISK-CHECK';
  const R11_CORE='HD-R11-SPACE-EVALUATION';
  const R11_RULE='R11';
  const R11_TASK='S22';

  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();

  function r08Result(row){
    if(!row) return 'NONE';
    const stored=txt(row.verificationResult).toUpperCase();
    if(['PASS','FAIL','INCONCLUSIVE'].includes(stored)) return stored;
    // Legacy-safe fallback mirrors frozen R08 resultForCheck without calling it.
    const qc=low(row.queenCellStatus),cong=low(row.colonyCongestion),brood=low(row.broodNestSpace),sup=low(row.superSpace),signs=low(row.swarmSigns);
    const required=[qc,cong,brood,sup,signs];
    if(required.some(x=>['','not assessed','not checked','unknown'].includes(x))) return 'INCONCLUSIVE';
    const activeCells=['charged cells','capped swarm cells'].includes(qc);
    const pressure=['high','severe'].includes(cong)||['limited','none'].includes(brood)||['limited','none'].includes(sup);
    if(activeCells&&pressure) return 'FAIL';
    const pass=qc==='none seen'&&['low','moderate'].includes(cong)&&brood==='adequate'&&['adequate','no super installed'].includes(sup)&&signs==='none';
    return pass?'PASS':'INCONCLUSIVE';
  }

  function r08CheckById(s,hiveId,checkId){
    if(!checkId) return null;
    const rows=Array.isArray(s?.logs?.swarmRiskChecks)?s.logs.swarmRiskChecks:[];
    return rows.find(r=>r&&txt(r.hiveId)===txt(hiveId)&&txt(r.id)===txt(checkId)&&(!txt(r.coreRuleId)||txt(r.coreRuleId)===R08_CORE))||null;
  }

  function isR11Task(a){
    return !!a&&txt(a.coreRuleId)===R11_CORE&&txt(a.catalogRuleId)===R11_RULE&&txt(a.catalogTaskId)===R11_TASK;
  }

  function sourceR08CheckId(a){
    if(!isR11Task(a)) return '';
    const e=a.evidenceChain||{};
    if(low(e.sourceType)!=='targeted-swarm-space') return '';
    return txt(e.sourceId);
  }

  function hasCommittedR11Action(a){
    // Preserve only a post-action biological verification for a physical
    // action that was already completed before X1A. Planning/review tasks are
    // still suppressed because no irreversible management action occurred.
    if(low(a?.workflowStage)!=='follow-up') return false;
    return !!txt(a?.evidenceChain?.linkedAddSpaceActionId);
  }

  function ownershipDecision(s,a){
    if(!isR11Task(a)) return {suppress:false,reason:'not-r11'};
    const checkId=sourceR08CheckId(a);
    if(!checkId) return {suppress:false,reason:'independent-r11-evidence'};
    const check=r08CheckById(s,a.hiveId,checkId);
    if(!check) return {suppress:false,reason:'source-check-unavailable'};
    if(r08Result(check)!=='FAIL') return {suppress:false,reason:'r08-check-not-fail'};
    if(hasCommittedR11Action(a)) return {suppress:false,reason:'preserve-existing-r11-post-action-verification',checkId};
    return {suppress:true,reason:'r08-fail-owned-by-r09',checkId};
  }

  const prevGenerate=window.generateActions||((typeof generateActions==='function')?generateActions:null);
  if(typeof prevGenerate==='function'){
    window.generateActions=function(s){
      const out=prevGenerate(s)||[];
      if(!Array.isArray(out)||!out.length) return out;
      return out.filter(a=>!ownershipDecision(s,a).suppress);
    };
    try{generateActions=window.generateActions}catch(_){ }
  }

  window.HiveDashCrossRuleOwnershipX1=Object.freeze({
    version:VERSION,
    r08Result,
    ownershipDecision,
    shouldSuppressR11:(s,a)=>ownershipDecision(s,a).suppress
  });
  window.__HIVEDASH_V2P2E5X1A_VERSION__=VERSION;
  console.log('V2P2E5X1A LOADED | R08/R09/R11 swarm-space ownership active');
})();
