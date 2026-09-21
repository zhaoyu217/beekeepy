/* ==============================================================
   HiveDash V2P2E5X2A — R10/R02 queen-episode handoff ownership

   Scope: cross-rule projection only. Frozen R02, R10, B38 and Inspection
   business logic/persistence are not modified.

   Proven defect:
   - R10/S21 Split Verification FAIL owns the split-specific queen episode and
     projects "Split queen-right still uncertain" (management-review).
   - The same child hive can independently satisfy generic R02/S05 Queen
     uncertainty and project "Recheck queen status" at the same time.
   - Two tasks then ask the beekeeper to act on the same queen-right problem.

   Ownership contract:
   1) R10 FAIL management-review owns the episode until the beekeeper accepts
      the handoff into Queen Management. Generic R02/S05 tasks are suppressed.
   2) Once the R10 handoff has created an active B38 Queen Management action,
      B38 owns the episode: the R10 handoff card is suppressed as well.
   3) Completing a BIOLOGICAL R10-handoff B38 action (Requeen / Introduce Queen)
      releases ownership to R02. R10 stays suppressed and R02 may create its
      frozen post-management biological verification / downstream review.
   4) Completing a non-biological B38 action does NOT close the R10 episode;
      R10 may reappear and generic R02 remains suppressed.
   5) No records are deleted or rewritten. This is runtime projection only.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5X2A__) return;
  window.__HIVEDASH_V2P2E5X2A__=true;

  const VERSION='v2p2e5x2a-r10-r02-queen-handoff-ownership';
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
    return !!a&&(txt(a.coreRuleId)===R02_CORE || (txt(a.catalogRuleId)===R02_RULE&&txt(a.catalogTaskId)===R02_TASK));
  }

  function allQueenActions(s){
    return [
      ...(Array.isArray(s?.actions)?s.actions:[]),
      ...(Array.isArray(s?.meta?.completedActions)?s.meta.completedActions:[])
    ].filter(a=>a&&low(a.type)===B38_TYPE);
  }

  // R10 opens B38 with b38OpenQueenAction(hiveId,'scientific-engine','queen').
  // Restrict ownership transfer to that exact bridge so unrelated manual or
  // R02-origin Queen Management never closes the R10 split episode by accident.
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
    for(const a of rows||[]){
      if(isR10Owner(a))map.set(txt(a.hiveId),a);
    }
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

      // A completed biological handoff releases onward queen biology to R02.
      // R10's old FAIL review must not remain as a competing entry point.
      if(completedHandoff){
        if(isR10Owner(a))return false;
        return true;
      }

      // While a direct R10 -> B38 handoff is active, B38 is the one owner.
      if(activeHandoff){
        if(isR10Owner(a)||isR02(a))return false;
        return true;
      }

      // Before B38 is created, R10 FAIL owns the split-specific episode.
      // Suppress every R02/S05 projection for this hive, including a legacy
      // persisted generic Recheck task already created before X2A loaded.
      if(isR02(a))return false;
      return true;
    });
  }

  const prevGenerate=window.generateActions||((typeof generateActions==='function')?generateActions:null);
  if(typeof prevGenerate==='function'){
    window.generateActions=function(s){
      const out=prevGenerate(s)||[];
      return project(s,out);
    };
    try{generateActions=window.generateActions}catch(_){ }
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
  console.log('V2P2E5X2A LOADED | R10/R02 queen handoff ownership active');
})();
