/* ==============================================================
   HiveDash V2P2E5X2A1 — R10/R02 queen-episode handoff ownership

   Scope: cross-rule projection only. Frozen R02, R10, B38 and Inspection
   business logic/persistence are not modified.

   X2A runtime finding fixed here:
   - R10/S21 is intentionally NOT projected by generateActions().
   - Frozen R10A4 inserts the R10 task lazily in v53ActionRows().
   - X2A filtered generateActions(), so it ran BEFORE R10 existed in the row
     set and could not see the owner. The generic R02 task therefore survived.
   - X2A1 applies the same ownership contract at the final Actions-row layer,
     AFTER R10A4 has inserted its lazy R10 projection.

   Ownership contract:
   1) R10 FAIL management-review owns the split-specific queen episode until
      the beekeeper accepts the handoff into Queen Management. Generic R02/S05
      tasks are suppressed for that hive.
   2) Once the direct R10 -> B38 handoff is active, B38 owns the episode:
      suppress both the old R10 handoff card and generic R02 task.
   3) Completing a BIOLOGICAL R10-handoff B38 action (Requeen / Introduce Queen)
      releases ownership to R02. R10 remains hidden and R02 may project its
      frozen post-management biological verification.
   4) Completing a non-biological B38 action does NOT close the R10 episode.
   5) No records are deleted or rewritten. This is runtime projection only.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5X2A1__) return;
  window.__HIVEDASH_V2P2E5X2A1__=true;

  const VERSION='v2p2e5x2a1-r10-r02-final-row-ownership';
  const R10_CORE='HD-R10S-SPLIT-VERIFICATION';
  const R10_RULE='R10';
  const R10_TASK='S21';
  const R02_CORE='HD-R02Q-QUEEN-RIGHT-VERIFICATION';
  const R02_RULE='R02';
  const R02_TASK='S05';
  const B38_TYPE='queen-management';
  const BIOLOGICAL_B38=new Set(['requeen','introduce queen']);

  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const inactive=a=>{
    const status=low(a?.status),priority=low(a?.priority);
    return ['completed','cancelled','canceled','done'].includes(status)||priority==='done';
  };

  function isR10Owner(a){
    if(!a||txt(a.hiveId)==='')return false;
    const identity=txt(a.coreRuleId)===R10_CORE || (txt(a.catalogRuleId)===R10_RULE&&txt(a.catalogTaskId)===R10_TASK);
    if(!identity||inactive(a)||low(a.workflowStage)!=='management-review')return false;
    const verification=txt(a.verificationStatus||a?.ruleEvaluation?.verification?.result).toUpperCase();
    const outcome=txt(a?.outcomeSnapshot?.status||a?.ruleEvaluation?.outcome?.status).toUpperCase();
    return verification==='FAIL'||outcome==='ESCALATE_TO_R02'||low(a.title)==='split queen-right still uncertain';
  }

  function isR02(a){
    if(!a)return false;
    if(txt(a.coreRuleId)===R02_CORE)return true;
    if(txt(a.catalogRuleId)===R02_RULE&&txt(a.catalogTaskId)===R02_TASK)return true;
    // Migration-safe fallback for a persisted/core-normalized S05 row whose
    // catalogRuleId may be absent in older state, without catching B38.
    return txt(a.catalogTaskId)===R02_TASK&&low(a.type)!==B38_TYPE&&
      (low(a.reasonCode)==='queen'||low(a.title)==='recheck queen status'||low(a.title)==='verify queen status after management');
  }

  function allQueenActions(s){
    return [
      ...(Array.isArray(s?.actions)?s.actions:[]),
      ...(Array.isArray(s?.meta?.completedActions)?s.meta.completedActions:[])
    ].filter(a=>a&&low(a.type)===B38_TYPE);
  }

  // R10 opens B38 with b38OpenQueenAction(hiveId,'scientific-engine','queen').
  // Restrict transfer to that bridge so unrelated Queen Management does not
  // accidentally close or release the Split episode.
  function isR10HandoffB38(a,hiveId){
    return !!a&&txt(a.hiveId)===txt(hiveId)&&low(a.type)===B38_TYPE&&low(a.source)==='scientific-engine'&&low(a.reasonCode)==='queen';
  }

  function activeR10HandoffB38(s,hiveId){
    return allQueenActions(s).find(a=>isR10HandoffB38(a,hiveId)&&!inactive(a))||null;
  }

  function completedBiologicalR10HandoffB38(s,hiveId){
    const rows=allQueenActions(s).filter(a=>{
      if(!isR10HandoffB38(a,hiveId)||!inactive(a))return false;
      const task=low(a?.workflowData?.taskType||a?.title);
      return BIOLOGICAL_B38.has(task);
    });
    rows.sort((a,b)=>txt(b?.resultData?.completedDate||b?.completedAt||b?.id).localeCompare(txt(a?.resultData?.completedDate||a?.completedAt||a?.id)));
    return rows[0]||null;
  }

  function ownersFrom(rows){
    const map=new Map();
    for(const a of rows||[])if(isR10Owner(a))map.set(txt(a.hiveId),a);
    return map;
  }

  function project(s,rows){
    if(!Array.isArray(rows)||!rows.length)return rows;
    const owners=ownersFrom(rows);
    if(!owners.size)return rows;

    const activeHandoffs=new Map();
    const completedHandoffs=new Map();
    for(const hid of owners.keys()){
      const active=activeR10HandoffB38(s,hid);if(active)activeHandoffs.set(hid,active);
      const completed=completedBiologicalR10HandoffB38(s,hid);if(completed)completedHandoffs.set(hid,completed);
    }

    return rows.filter(a=>{
      const hid=txt(a?.hiveId),owner=owners.get(hid);
      if(!owner)return true;

      const activeHandoff=activeHandoffs.get(hid);
      const completedHandoff=completedHandoffs.get(hid);

      if(completedHandoff){
        if(isR10Owner(a))return false;
        return true;
      }

      if(activeHandoff){
        if(isR10Owner(a)||isR02(a))return false;
        return true;
      }

      if(isR02(a))return false;
      return true;
    });
  }

  function readState(){
    try{
      if(typeof v45s==='function')return v45s();
      if(typeof state==='function')return state();
    }catch(err){console.error('V2P2E5X2A1 state read failed',err)}
    return null;
  }

  // Keep generateActions guarded as a defense-in-depth boundary for any
  // non-Actions caller that happens to receive R10 and R02 in the same set.
  // The decisive fix is the v53ActionRows wrapper below, because R10A4 inserts
  // R10 lazily only at that layer.
  const prevGenerate=window.generateActions||((typeof generateActions==='function')?generateActions:null);
  if(typeof prevGenerate==='function'){
    const wrappedGenerate=function(s){return project(s,prevGenerate.apply(this,arguments)||[])};
    try{window.generateActions=wrappedGenerate}catch(_){ }
    try{generateActions=wrappedGenerate}catch(_){ }
  }

  // FINAL ACTIONS-ROW OWNERSHIP GATE — runs after frozen R10A4 lazy projection.
  const prevRows=window.v53ActionRows||((typeof v53ActionRows==='function')?v53ActionRows:null);
  if(typeof prevRows==='function'){
    const wrappedRows=function(mode='Pending'){
      const rows=prevRows.apply(this,arguments)||[];
      if(low(mode)==='completed')return rows;
      return project(readState(),rows);
    };
    try{window.v53ActionRows=wrappedRows}catch(_){ }
    try{v53ActionRows=wrappedRows}catch(_){ }
  }

  window.HiveDashCrossRuleOwnershipX2=Object.freeze({
    version:VERSION,
    isR10Owner,
    isR02,
    activeR10HandoffB38,
    completedBiologicalR10HandoffB38,
    project
  });
  window.__HIVEDASH_V2P2E5X2A_VERSION__=VERSION;
  window.__HIVEDASH_V2P2E5X2A1_VERSION__=VERSION;
  console.log('V2P2E5X2A1 LOADED | final Actions-row R10/R02 ownership active');
})();
