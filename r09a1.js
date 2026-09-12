/* ==============================================================
   HiveDash V2P2E5R09A1 — R09/S19 -> frozen B41 bridge hardening

   Scope ONLY:
   1) When B41 is opened from an R09/S19 "Review swarm control" task,
      lock the target Hive to the originating R09 Hive.
   2) Seed B41 Priority from the R09 task (High in the current rule)
      instead of silently falling back to B41's manual Medium default.

   Safety invariants:
   - Manual B41 entry is unchanged.
   - Frozen B41 business logic / methods / persistence schema are not edited.
   - No control method, swarm observation, result or follow-up is preselected.
   - The Hive lock is enforced again at Create Action time, not UI-only.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R09A1__) return;
  window.__HIVEDASH_V2P2E5R09A1__=true;
  window.__HIVEDASH_V2P2E5R09A1_VERSION__='v2p2e5r09a1-r09-b41-hive-lock-priority-inherit';

  const R08_CORE_RULE_ID='HD-R08S-SWARM-RISK-CHECK';
  const R09_CATALOG_RULE_ID='R09';
  const S19='S19';
  const CTX_KEY='hivedash_r09_b41_bridge_context_v1';
  const B41_DRAFT_KEY='hivedash_b41_swarm_create_draft';
  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const S=()=>typeof v45s==='function'?v45s():(typeof state==='function'?state():{});

  function isB41New(){
    return txt(location.hash||'').replace(/^#/,'').split('?')[0]==='swarm-action/new';
  }
  function readCtx(){
    try{const x=JSON.parse(sessionStorage.getItem(CTX_KEY)||'null');return x&&typeof x==='object'?x:null}catch(_){return null}
  }
  function writeCtx(x){
    try{sessionStorage.setItem(CTX_KEY,JSON.stringify(x))}catch(_){ }
    return x;
  }
  function clearCtx(){try{sessionStorage.removeItem(CTX_KEY)}catch(_){ }}
  function readB41Draft(){
    try{const x=JSON.parse(localStorage.getItem(B41_DRAFT_KEY)||'null');return x&&typeof x==='object'?x:{}}catch(_){return {}}
  }
  function writeB41Draft(d){
    try{localStorage.setItem(B41_DRAFT_KEY,JSON.stringify(d||{}))}catch(_){ }
    return d;
  }
  function activeR09Task(taskId=''){
    try{
      const s=S(),tasks=typeof generateActions==='function'?(generateActions(s)||[]):[];
      return tasks.find(a=>a &&
        txt(a.id)===txt(taskId) &&
        txt(a.catalogRuleId)===R09_CATALOG_RULE_ID &&
        txt(a.catalogTaskId)===S19 &&
        txt(a.coreRuleId)===R08_CORE_RULE_ID &&
        low(a.workflowStage)==='management-review' &&
        low(a.title)==='review swarm control') || null;
    }catch(_){return null}
  }
  function validCtx(ctx){
    if(!ctx||!txt(ctx.hiveId)) return false;
    const h=(S().hives||[]).find(x=>x&&txt(x.id)===txt(ctx.hiveId));
    return !!h;
  }

  function seedAndDecorate(){
    const ctx=readCtx();
    if(!ctx||!isB41New()||!validCtx(ctx)) return;

    // Persist the immutable source hive into B41's own draft. Priority is
    // seeded once from R09, but remains user-editable thereafter.
    const d=readB41Draft();
    let changed=false;
    if(txt(d.hiveId)!==txt(ctx.hiveId)){d.hiveId=ctx.hiveId;changed=true}
    if(!ctx.prioritySeeded){d.priority=txt(ctx.priority)||'High';ctx.prioritySeeded=true;writeCtx(ctx);changed=true}
    if(changed) writeB41Draft(d);

    const hiveSel=document.getElementById('b41-hive');
    if(hiveSel){
      if(txt(hiveSel.value)!==txt(ctx.hiveId)) hiveSel.value=ctx.hiveId;
      hiveSel.disabled=true;
      hiveSel.setAttribute('aria-disabled','true');
      hiveSel.title='Locked to the hive from the R09 swarm-control review';
      const card=hiveSel.closest('.b39-card');
      const hint=card?.querySelector('.b37-hint');
      if(hint) hint.textContent='R09 source hive · locked';
    }

    const pr=document.getElementById('b41-priority');
    if(pr && !pr.dataset.r09PrioritySeeded){
      const stored=txt(readB41Draft().priority)||txt(ctx.priority)||'High';
      pr.value=stored;
      pr.dataset.r09PrioritySeeded='1';
    }
  }

  // Replace the A bridge opener with a hardened R09-specific entry context.
  window.v2p2e5r09OpenSwarmControl=function(taskId){
    const a=activeR09Task(taskId);
    if(!a) return typeof toast==='function'?toast('This Swarm Control review is no longer active'):undefined;
    if(typeof window.b41OpenSwarmAction!=='function') return typeof toast==='function'?toast('Swarm Control workflow is unavailable'):undefined;

    writeCtx({
      taskId:txt(a.id),hiveId:txt(a.hiveId),priority:txt(a.priority)||'High',
      catalogRuleId:R09_CATALOG_RULE_ID,catalogTaskId:S19,
      sourceCoreRuleId:txt(a.coreRuleId),episodeId:txt(a.episodeId||a.evidenceChain?.episodeId),
      prioritySeeded:false,openedAt:new Date().toISOString()
    });

    const ret=window.b41OpenSwarmAction(a.hiveId);
    // b41OpenSwarmAction clears/rebuilds its draft and navigates immediately.
    // Decorate after that operation so the R09 priority can replace the manual
    // Medium default without changing the frozen manual B41 path.
    queueMicrotask(seedAndDecorate);
    setTimeout(seedAndDecorate,0);
    setTimeout(seedAndDecorate,80);
    return ret;
  };

  // Hard guard: even a scripted/select mutation cannot change the source Hive
  // while this specific R09 -> B41 bridge is active.
  const prevSet=window.b41SetDraft;
  if(typeof prevSet==='function'){
    window.b41SetDraft=function(key,val){
      const ctx=readCtx();
      if(ctx&&isB41New()&&validCtx(ctx)&&key==='hiveId'){
        if(txt(val)!==txt(ctx.hiveId)&&typeof toast==='function') toast('This R09 Swarm Control is locked to the original hive');
        return prevSet.call(this,key,ctx.hiveId);
      }
      return prevSet.apply(this,arguments);
    };
    try{b41SetDraft=window.b41SetDraft}catch(_){ }
  }

  // Create-time guard. B41 still performs all of its frozen validation and
  // persistence; this wrapper only restores the source Hive before that runs.
  const prevCreate=window.b41CreateAction;
  if(typeof prevCreate==='function'){
    window.b41CreateAction=function(){
      const ctx=readCtx();
      if(ctx&&isB41New()&&validCtx(ctx)){
        const hiveSel=document.getElementById('b41-hive');
        if(hiveSel) hiveSel.value=ctx.hiveId;
        const d=readB41Draft();d.hiveId=ctx.hiveId;writeB41Draft(d);
      }
      const ret=prevCreate.apply(this,arguments);
      // Keep context when B41 validation blocks creation; clear it only after
      // a successful navigation away from the new-action page.
      setTimeout(()=>{if(!isB41New())clearCtx()},0);
      return ret;
    };
    try{b41CreateAction=window.b41CreateAction}catch(_){ }
  }

  window.addEventListener('hashchange',()=>queueMicrotask(()=>{
    if(isB41New()) seedAndDecorate(); else clearCtx();
  }));

  try{
    const mo=new MutationObserver(()=>{if(isB41New())queueMicrotask(seedAndDecorate)});
    const start=()=>{const root=document.getElementById('view');if(root)mo.observe(root,{childList:true,subtree:true})};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }catch(_){ }

  queueMicrotask(seedAndDecorate);
  console.log('V2P2E5R09A1 LOADED | R09 -> B41 hive lock + priority inheritance active');
})();
