/* ==============================================================
   HiveDash V2P2E5R10A1 — R10/S21 Actions projection closure

   Scope ONLY:
   - Do not change frozen B39 Split workflow or R10 scientific evaluator.
   - Project active R10/S21 tasks from COMPLETED Split lineage, not from the
     continued existence of the legacy B39 "Split follow-up" action.
   - While an R10 task is active for a child Hive, suppress only:
       1) its legacy split-hive-follow-up UI projection; and
       2) the generic R01 "Initial inspection needed" UI projection.
     This prevents a Queen-cell child from being told to open a full
     Inspection before its path-aware verification window.
   - Preserve underlying history/data. This is a UI/task projection layer.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R10A1__) return;
  window.__HIVEDASH_V2P2E5R10A1__=true;
  window.__HIVEDASH_V2P2E5R10A1_VERSION__='v2p2e5r10a1-completed-split-projection-closure';

  const R10='HD-R10S-SPLIT-VERIFICATION';
  const R01='HD-R01-PERIODIC-INSPECTION';
  const LEGACY='split-hive-follow-up';
  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const S=()=>{try{return typeof v45s==='function'?v45s():state()}catch(_){return null}};

  function r10Tasks(s){
    const out=[],seen=new Set();
    const hs=Array.isArray(s?.hives)?s.hives:[];
    for(const h of hs){
      if(!h||h.archived||['archived','combined'].includes(low(h.lifecycleStatus||h.status)))continue;
      let e=null;try{e=window.v2p2e5r10Evaluate?.(h.id)||null}catch(_){e=null}
      const t=e?.task;
      if(!t||txt(t.coreRuleId)!==R10)continue;
      const id=txt(t.id);if(!id||seen.has(id))continue;
      seen.add(id);out.push(t);
    }
    return out;
  }

  function merge(rows,s,mode='Pending'){
    const m=low(mode||'Pending');
    if(m==='completed')return Array.isArray(rows)?rows:[];
    const tasks=r10Tasks(s),byHive=new Map(tasks.map(t=>[txt(t.hiveId),t]));
    const base=(Array.isArray(rows)?rows:[]).filter(a=>{
      if(!a)return false;
      const hid=txt(a.hiveId),r10=byHive.get(hid);
      if(!r10)return true;
      if(txt(a.source)===LEGACY)return false;
      if(txt(a.coreRuleId)===R01 && low(a.title)==='initial inspection needed')return false;
      return txt(a.coreRuleId)!==R10; // replace stale/duplicate R10 projection with evaluator truth
    });
    const ids=new Set(base.map(a=>txt(a.id)));
    for(const t of tasks){if(!ids.has(txt(t.id))){ids.add(txt(t.id));base.push(t)}}
    return base;
  }

  // Patch the current global action generator if present. R10A1 does not
  // depend on this for correctness; v53ActionRows below is the UI authority.
  const prevGen=window.generateActions||((typeof generateActions==='function')?generateActions:null);
  if(typeof prevGen==='function'){
    const wrappedGen=function(s){return merge(prevGen.call(this,s)||[],s,'Pending')};
    try{window.generateActions=wrappedGen}catch(_){ }
    try{generateActions=wrappedGen}catch(_){ }
  }

  // Patch the final Actions row projection directly. This is intentionally
  // independent of whether an upstream generator persists/removes the old
  // B39 follow-up during reconciliation.
  const prevRows=window.v53ActionRows||((typeof v53ActionRows==='function')?v53ActionRows:null);
  if(typeof prevRows==='function'){
    const wrappedRows=function(mode='Pending'){
      const s=S();
      return merge(prevRows.apply(this,arguments)||[],s,mode);
    };
    try{window.v53ActionRows=wrappedRows}catch(_){ }
    try{v53ActionRows=wrappedRows}catch(_){ }
  }

  // Diagnostic API for QA without mutating state.
  window.v2p2e5r10a1ProjectionAudit=function(hiveId){
    const s=S(),hid=txt(hiveId),e=window.v2p2e5r10Evaluate?.(hid)||null;
    let rows=[];try{rows=(typeof v53ActionRows==='function'?v53ActionRows('Pending'):[]).filter(a=>txt(a?.hiveId)===hid)}catch(_){ }
    return {
      version:window.__HIVEDASH_V2P2E5R10A1_VERSION__,
      evaluatorTask:e?.task?.title||null,
      evaluatorRule:e?.task?.coreRuleId||null,
      rows:rows.map(a=>({title:a?.title,rule:a?.coreRuleId||a?.ruleId||'',catalog:a?.catalogTaskId||'',source:a?.source||'',due:a?.due||a?.dueDate||''}))
    };
  };

  console.log('V2P2E5R10A1 LOADED | R10 projection derives from completed Split lineage and supersedes generic initial inspection for the linked child Hive');
})();
