/* ==============================================================
   HiveDash V2P2E5R09A2 — R09/S19 -> frozen B41 bridge stabilization

   Replaces R09A1 at load time. Scope ONLY:
   1) Preserve the already-working R09 explicit Review Swarm Control entry.
   2) Lock B41 to the originating R09 Hive without interfering with navigation.
   3) Seed B41 priority from the R09 task once (High in the current rule).

   Safety invariants:
   - Frozen B41 workflow/business logic is not edited.
   - Manual B41 entry remains unchanged.
   - No swarm-control method, observation, result or follow-up is preselected.
   - No MutationObserver feedback loop and no pre-hash render/draft mutation.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R09A2__) return;
  window.__HIVEDASH_V2P2E5R09A2__=true;
  window.__HIVEDASH_V2P2E5R09A2_VERSION__='v2p2e5r09a2-r09-b41-navigation-safe-lock-priority';

  const CORE_RULE_ID='HD-R08S-SWARM-RISK-CHECK';
  const R09='R09', S19='S19';
  const CTX_KEY='hivedash_r09_b41_bridge_context_v2';
  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const S=()=>typeof v45s==='function'?v45s():(typeof state==='function'?state():{});

  // Capture the frozen B41 functions before wrapping anything.
  const baseOpen=window.b41OpenSwarmAction;
  const baseSet=window.b41SetDraft;
  const baseCreate=window.b41CreateAction;

  function route(){return txt(location.hash||'').replace(/^#/,'').split('?')[0]}
  function isB41New(){return route()==='swarm-action/new'}
  function readCtx(){
    try{const x=JSON.parse(sessionStorage.getItem(CTX_KEY)||'null');return x&&typeof x==='object'?x:null}catch(_){return null}
  }
  function writeCtx(x){try{sessionStorage.setItem(CTX_KEY,JSON.stringify(x))}catch(_){ }return x}
  function clearCtx(){try{sessionStorage.removeItem(CTX_KEY)}catch(_){ }}
  function validHive(id){return !!(S().hives||[]).find(h=>h&&txt(h.id)===txt(id))}

  function activeR09Task(taskId=''){
    try{
      const tasks=typeof generateActions==='function'?(generateActions(S())||[]):[];
      return tasks.find(a=>a &&
        txt(a.id)===txt(taskId) &&
        txt(a.catalogRuleId)===R09 &&
        txt(a.catalogTaskId)===S19 &&
        txt(a.coreRuleId)===CORE_RULE_ID &&
        low(a.workflowStage)==='management-review' &&
        low(a.title)==='review swarm control') || null;
    }catch(_){return null}
  }

  function applyBridge(){
    const ctx=readCtx();
    if(!ctx || !isB41New() || !validHive(ctx.hiveId)) return;

    // UI lock only after B41 has actually rendered. The frozen opener already
    // seeds this Hive into B41's own fresh draft before navigation.
    const hiveSel=document.getElementById('b41-hive');
    if(hiveSel){
      if(txt(hiveSel.value)!==txt(ctx.hiveId)){
        hiveSel.value=ctx.hiveId;
        if(typeof baseSet==='function') baseSet.call(window,'hiveId',ctx.hiveId);
      }
      if(!hiveSel.disabled) hiveSel.disabled=true;
      hiveSel.setAttribute('aria-disabled','true');
      hiveSel.title='Locked to the hive from the R09 swarm-control review';
      const card=hiveSel.closest('.b39-card');
      const hint=card?.querySelector('.b37-hint');
      if(hint && hint.textContent!=='R09 source hive · locked') hint.textContent='R09 source hive · locked';
    }

    // Seed inherited priority ONCE. After that the user may still change the
    // priority deliberately; the bridge does not keep forcing it on redraws.
    const pr=document.getElementById('b41-priority');
    if(pr && !ctx.prioritySeeded){
      const seed=txt(ctx.priority)||'High';
      if(pr.value!==seed) pr.value=seed;
      if(typeof baseSet==='function') baseSet.call(window,'priority',seed);
      ctx.prioritySeeded=true;writeCtx(ctx);
    }
  }

  function scheduleApply(){
    setTimeout(applyBridge,0);
    if(typeof requestAnimationFrame==='function') requestAnimationFrame(()=>applyBridge());
    setTimeout(applyBridge,80);
  }

  // Navigation-safe opener: do not mutate B41 draft/DOM in a microtask before
  // the browser's hashchange render. Let frozen B41 navigate first, then apply.
  window.v2p2e5r09OpenSwarmControl=function(taskId){
    const a=activeR09Task(taskId);
    if(!a) return typeof toast==='function'?toast('This Swarm Control review is no longer active'):undefined;
    if(typeof baseOpen!=='function') return typeof toast==='function'?toast('Swarm Control workflow is unavailable'):undefined;

    writeCtx({
      taskId:txt(a.id),hiveId:txt(a.hiveId),priority:txt(a.priority)||'High',
      catalogRuleId:R09,catalogTaskId:S19,sourceCoreRuleId:txt(a.coreRuleId),
      episodeId:txt(a.episodeId||a.evidenceChain?.episodeId),prioritySeeded:false,
      openedAt:new Date().toISOString()
    });

    const ret=baseOpen.call(window,a.hiveId);
    scheduleApply();
    return ret;
  };

  // Create-time lock: even if DOM is changed through DevTools, restore the
  // source Hive immediately before frozen B41 performs its own validation/save.
  if(typeof baseCreate==='function'){
    window.b41CreateAction=function(){
      const ctx=readCtx();
      if(ctx && isB41New() && validHive(ctx.hiveId)){
        const hiveSel=document.getElementById('b41-hive');
        if(hiveSel) hiveSel.value=ctx.hiveId;
        if(typeof baseSet==='function') baseSet.call(window,'hiveId',ctx.hiveId);
      }
      const ret=baseCreate.apply(this,arguments);
      setTimeout(()=>{if(!isB41New()) clearCtx()},0);
      return ret;
    };
    try{b41CreateAction=window.b41CreateAction}catch(_){ }
  }

  window.addEventListener('hashchange',()=>{
    if(isB41New()) scheduleApply();
    else clearCtx();
  });

  // Handle legitimate redraws while staying on B41. This observer is
  // idempotent: it only changes the hint when different, avoiding A1's
  // childList feedback loop.
  try{
    const mo=new MutationObserver(()=>{if(isB41New()) scheduleApply()});
    const start=()=>{const root=document.getElementById('view');if(root)mo.observe(root,{childList:true,subtree:true})};
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  }catch(_){ }

  console.log('V2P2E5R09A2 LOADED | navigation-safe R09 -> B41 bridge active');
})();
