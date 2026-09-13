/* ==============================================================
   HiveDash V2P2E5R10A4 — R10/S21 isolated open-route closure

   Scope ONLY:
   - No change to frozen B39 Split workflow/data/history.
   - No change to R10/S21 scientific timing, evidence or result rules.
   - Resolve R10 projected tasks directly from the final Actions projection
     (with evaluator fallback) before legacy persisted-action lookup.
   - Bind R10 cards directly to the R10 scientific detail route.
   - Bind the R10 detail CTA directly to its targeted Split Verification route.
   - Loaded through new physical filenames to defeat stale CDN/browser cache.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R10A4_ROUTE__) return;
  window.__HIVEDASH_V2P2E5R10A4_ROUTE__=true;
  window.__HIVEDASH_V2P2E5R10A4_ROUTE_VERSION__='v2p2e5r10a4-isolated-open-route-closure';

  const RULE='HD-R10S-SPLIT-VERIFICATION';
  const txt=v=>String(v??'').trim();
  const S=()=>{try{return typeof v45s==='function'?v45s():state()}catch(_){return null}};
  const isR10=a=>!!a&&txt(a.coreRuleId)===RULE;
  const js=v=>txt(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ');

  function projectedRows(){
    try{
      const fn=window.v53ActionRows||((typeof v53ActionRows==='function')?v53ActionRows:null);
      return typeof fn==='function'?(fn('Pending')||[]):[];
    }catch(_){return []}
  }

  function evaluatorFallback(id){
    const s=S(),hs=Array.isArray(s?.hives)?s.hives:[];
    for(const h of hs){
      try{
        const core=window.HiveDashTaskEngineCoreV1;
        const t=core?.evaluateSplitVerification?.(s,h?.id)?.task||null;
        if(t&&isR10(t)&&txt(t.id)===txt(id))return t;
      }catch(_){ }
    }
    return null;
  }

  function taskById(id){
    const key=txt(id);
    if(!key)return null;
    return projectedRows().find(a=>isR10(a)&&txt(a.id)===key)||evaluatorFallback(key);
  }

  window.v2p2e5r10a4OpenTask=function(actionId){
    const a=taskById(actionId);
    if(!a)return typeof toast==='function'?toast('This Split Verification is no longer active'):null;
    return typeof go==='function'?go(`scientific-action/${encodeURIComponent(txt(a.id))}`):null;
  };

  window.v2p2e5r10a4OpenVerification=function(actionId){
    const a=taskById(actionId);
    if(!a)return typeof toast==='function'?toast('This Split Verification is no longer active'):null;
    const route=txt(a.executionRoute);
    if(route&&typeof go==='function')return go(route);
    return typeof toast==='function'?toast('Split Verification route is unavailable'):null;
  };

  // Intercept both current Actions openers before they fall back to the
  // persisted state.actions lookup. R10 is intentionally a projected task.
  const prevAM=window.v2p2e5amOpenTask;
  if(typeof prevAM==='function'){
    window.v2p2e5amOpenTask=function(actionId){
      if(taskById(actionId))return window.v2p2e5r10a4OpenTask(actionId);
      return prevAM.apply(this,arguments);
    };
  }

  const prevAB=window.v2p2e5abOpenUnifiedAction;
  if(typeof prevAB==='function'){
    window.v2p2e5abOpenUnifiedAction=function(actionId){
      if(taskById(actionId))return window.v2p2e5r10a4OpenTask(actionId);
      return prevAB.apply(this,arguments);
    };
  }

  // R10A already owns the scientific detail renderer. This closure makes its
  // CTA route deterministic even if an older open-handler wrapper exists.
  const prevVerify=window.v2p2e5r10OpenVerification;
  window.v2p2e5r10OpenVerification=function(actionId){
    if(taskById(actionId))return window.v2p2e5r10a4OpenVerification(actionId);
    return typeof prevVerify==='function'?prevVerify.apply(this,arguments):null;
  };

  // Final draw-time hardening: rewrite only R10 card clicks after all legacy
  // Actions decorators have run. No other task/card routing is changed.
  const prevDraw=window.v53DrawActions||((typeof v53DrawActions==='function')?v53DrawActions:null);
  if(typeof prevDraw==='function'){
    const wrappedDraw=function(mode='Pending'){
      const ret=prevDraw.apply(this,arguments);
      try{
        if(txt(mode).toLowerCase()==='completed')return ret;
        const box=document.getElementById('alist');
        if(!box)return ret;
        const rows=projectedRows(),buttons=[...box.querySelectorAll(':scope > button')];
        buttons.forEach((btn,i)=>{
          const id=txt(btn?.dataset?.actionId)||txt(rows[i]?.id);
          const a=taskById(id);
          if(!a)return;
          btn.dataset.actionId=txt(a.id);
          btn.dataset.hiveId=txt(a.hiveId);
          btn.setAttribute('onclick',`v2p2e5r10a4OpenTask('${js(a.id)}')`);
        });
      }catch(err){console.error('V2P2E5R10A2 R10 card-route closure failed',err)}
      return ret;
    };
    try{window.v53DrawActions=wrappedDraw}catch(_){ }
    try{v53DrawActions=wrappedDraw}catch(_){ }
  }

  console.log('V2P2E5R10A4 ROUTE LOADED | isolated R10 open route active');
})();
