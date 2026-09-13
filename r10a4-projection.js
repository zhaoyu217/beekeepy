/* ==============================================================
   HiveDash V2P2E5R10A4 — R10/S21 lazy Actions projection

   Safety boundary:
   - Never patches generateActions(), state(), save(), or frozen B39/B41.
   - R10 is evaluated only when the Actions UI requests v53ActionRows().
   - Uses the already-loaded state object for evaluation; no evaluator calls
     back into state(), so unrelated pages cannot be trapped in recursion.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R10A4_PROJECTION__) return;
  window.__HIVEDASH_V2P2E5R10A4_PROJECTION__=true;
  window.__HIVEDASH_V2P2E5R10A4_PROJECTION_VERSION__='v2p2e5r10a4-lazy-actions-only-projection';

  const R10='HD-R10S-SPLIT-VERIFICATION';
  const R01='HD-R01-PERIODIC-INSPECTION';
  const LEGACY='split-hive-follow-up';
  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();

  function getState(){
    try{return typeof v45s==='function'?v45s():(typeof state==='function'?state():null)}catch(err){console.error('R10A4 state read failed',err);return null}
  }

  function r10Tasks(s){
    const out=[],seen=new Set(),hs=Array.isArray(s?.hives)?s.hives:[];
    const core=window.HiveDashTaskEngineCoreV1;
    if(typeof core?.evaluateSplitVerification!=='function')return out;
    for(const h of hs){
      if(!h||h.archived||['archived','combined'].includes(low(h.lifecycleStatus||h.status)))continue;
      let ev=null;
      try{ev=core.evaluateSplitVerification(s,h.id)}catch(err){console.error('R10A4 evaluator failed for hive',h?.id,err);continue}
      const t=ev?.task;
      if(!t||txt(t.coreRuleId)!==R10)continue;
      const id=txt(t.id);if(!id||seen.has(id))continue;
      seen.add(id);out.push(t);
    }
    return out;
  }

  function merge(rows,s,mode='Pending'){
    const base=Array.isArray(rows)?rows:[];
    if(low(mode)==='completed'||!s)return base;
    const tasks=r10Tasks(s),byHive=new Map(tasks.map(t=>[txt(t.hiveId),t]));
    const out=base.filter(a=>{
      if(!a)return false;
      const r10=byHive.get(txt(a.hiveId));
      if(!r10)return true;
      if(txt(a.source)===LEGACY)return false;
      if(txt(a.coreRuleId)===R01&&low(a.title)==='initial inspection needed')return false;
      return txt(a.coreRuleId)!==R10;
    });
    const ids=new Set(out.map(a=>txt(a.id)));
    for(const t of tasks)if(!ids.has(txt(t.id))){ids.add(txt(t.id));out.push(t)}
    return out;
  }

  const prevRows=window.v53ActionRows||((typeof v53ActionRows==='function')?v53ActionRows:null);
  if(typeof prevRows==='function'){
    const wrappedRows=function(mode='Pending'){
      const rows=prevRows.apply(this,arguments)||[];
      if(low(mode)==='completed')return rows;
      return merge(rows,getState(),mode);
    };
    try{window.v53ActionRows=wrappedRows}catch(_){ }
    try{v53ActionRows=wrappedRows}catch(_){ }
  }

  window.v2p2e5r10a4ProjectionAudit=function(hiveId){
    const s=getState(),hid=txt(hiveId),core=window.HiveDashTaskEngineCoreV1;
    let ev=null;try{ev=core?.evaluateSplitVerification?.(s,hid)||null}catch(_){ }
    let rows=[];try{rows=(window.v53ActionRows?.('Pending')||[]).filter(a=>txt(a?.hiveId)===hid)}catch(_){ }
    return {version:window.__HIVEDASH_V2P2E5R10A4_PROJECTION_VERSION__,evaluatorTask:ev?.task?.title||null,evaluatorRule:ev?.task?.coreRuleId||null,rows:rows.map(a=>({id:a?.id,title:a?.title,rule:a?.coreRuleId||a?.ruleId||'',source:a?.source||'',due:a?.due||a?.dueDate||''}))};
  };

  console.log('V2P2E5R10A4 PROJECTION LOADED | Actions-only lazy projection active');
})();
