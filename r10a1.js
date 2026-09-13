/* ==============================================================
   HiveDash V2P2E5R10A1 — R10/S21 durable projection recovery

   Scope (minimal patch above V2P2E5R10A):
   - Do NOT modify frozen B39 Split workflow or R01.
   - Recover the scientific R10/S21 task from the completed Split lineage
     even when the legacy B39 "Split follow-up" action has already been
     consumed/removed by opening its old Inspection route.
   - Keep the generic R01 Initial Inspection task intact; R10 is a distinct
     targeted verification and may coexist with it.
   - Never create R10 for a Split whose persisted followUpRequired is false.
   - Preserve the legacy action/history; only suppress an active legacy
     split-hive-follow-up UI row when the R10 task replaces it.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R10A1__) return;
  window.__HIVEDASH_V2P2E5R10A1__=true;
  window.__HIVEDASH_V2P2E5R10A1_VERSION__='v2p2e5r10a1-durable-completed-split-projection';

  const CORE_RULE_ID='HD-R10S-SPLIT-VERIFICATION';
  const LEGACY_SOURCE='split-hive-follow-up';
  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const S=()=>{try{return typeof v45s==='function'?v45s():state()}catch(_){return null}};
  const isCompleted=a=>!!a&&(['completed','done'].includes(low(a.status))||low(a.priority)==='done'||!!a.resultAppliedAt||a.resultData?.splitCompleted===true);

  function allSplitActions(s){
    const src=[...(Array.isArray(s?.actions)?s.actions:[]),...(Array.isArray(s?.meta?.completedActions)?s.meta.completedActions:[])];
    const seen=new Set(),out=[];
    for(const a of src){
      if(!a||low(a.type)!=='split-hive') continue;
      const id=txt(a.id); if(!id||seen.has(id)) continue;
      seen.add(id); out.push(a);
    }
    return out;
  }
  function childForSplit(s,a){
    const rid=txt(a?.resultData?.newHiveId);
    return (s?.hives||[]).find(h=>h&&(txt(h.id)===rid||txt(h.createdFromSplitActionId)===txt(a?.id)))||null;
  }
  function legacyForSplit(s,a){
    return (s?.actions||[]).find(f=>f&&txt(f.source)===LEGACY_SOURCE&&!isCompleted(f)&&(
      txt(f.parentActionId||f.linkedActionId||f.createdFromSplitActionId)===txt(a?.id)||
      txt(f.hiveId)===txt(a?.resultData?.newHiveId)
    ))||null;
  }
  function qualifies(s,a){
    if(!a||!isCompleted(a)) return false;
    const child=childForSplit(s,a); if(!child) return false;
    const rd=a.resultData||{};
    // Respect an explicit user/B39 choice not to create a follow-up.
    if(rd.followUpRequired===false) return false;
    // Historical completed Split with an explicit follow-up, planned follow-up
    // date, or still-present legacy action is eligible for R10 recovery.
    return rd.followUpRequired===true || !!txt(rd.followUpDate||a.followUpDate) || !!legacyForSplit(s,a);
  }
  function r10Tasks(s){
    const out=[];
    if(typeof window.v2p2e5r10Evaluate!=='function') return out;
    for(const a of allSplitActions(s)){
      if(!qualifies(s,a)) continue;
      const child=childForSplit(s,a); if(!child) continue;
      let ev=null; try{ev=window.v2p2e5r10Evaluate(child.id)}catch(_){continue}
      const t=ev?.task;
      if(t&&txt(t.coreRuleId)===CORE_RULE_ID) out.push(t);
    }
    return out;
  }
  function eligibleLegacy(row,s){
    if(!row||txt(row.source)!==LEGACY_SOURCE||isCompleted(row)) return false;
    const a=allSplitActions(s).find(x=>txt(x.id)===txt(row.parentActionId||row.linkedActionId||row.createdFromSplitActionId)||txt(x.resultData?.newHiveId)===txt(row.hiveId));
    return !!a&&qualifies(s,a);
  }
  function project(rows,s,mode='Pending'){
    const m=low(mode||'Pending');
    if(m==='completed') return rows||[];
    const out=(rows||[]).filter(r=>!eligibleLegacy(r,s));
    const seen=new Set(out.map(r=>txt(r?.id)));
    for(const t of r10Tasks(s)){
      if(!seen.has(txt(t.id))){seen.add(txt(t.id));out.push(t)}
    }
    return out;
  }

  // Wrap the current post-R10A projections. R10A1 is loaded last so this layer
  // only recovers missing R10 tasks and does not disturb existing engines.
  const prevGenerate=window.generateActions||((typeof generateActions==='function')?generateActions:null);
  if(typeof prevGenerate==='function'){
    const wrapped=function(s){return project(prevGenerate(s)||[],s,'Pending')};
    window.generateActions=wrapped;
    try{generateActions=wrapped}catch(_){ }
  }
  const prevRows=window.v53ActionRows||((typeof v53ActionRows==='function')?v53ActionRows:null);
  if(typeof prevRows==='function'){
    const wrappedRows=function(mode='Pending'){
      const s=S();
      return project(prevRows.apply(this,arguments)||[],s,mode);
    };
    window.v53ActionRows=wrappedRows;
    try{v53ActionRows=wrappedRows}catch(_){ }
  }

  window.v2p2e5r10a1ProjectionAudit=function(hiveId){
    const s=S();
    const rows=(typeof window.v53ActionRows==='function'?window.v53ActionRows('Pending'):[]).filter(a=>txt(a?.hiveId)===txt(hiveId));
    return rows.map(a=>({id:a.id,title:a.title,rule:a.coreRuleId||a.ruleId||'',catalog:a.catalogTaskId||'',source:a.source||'',due:a.due||a.dueDate||''}));
  };

  console.log('V2P2E5R10A1 LOADED | recover R10/S21 projection from completed Split lineage');
})();
