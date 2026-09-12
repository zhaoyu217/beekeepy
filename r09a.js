/* ==============================================================
   HiveDash V2P2E5R09A — R09/S19 Swarm Control review bridge

   Scope: ONLY add the missing user-confirmed execution entry from the
   R09/S19 "Review swarm control" scientific task into the already-frozen
   B41 Swarm Control workflow.

   Safety invariants:
   - R08/R09 never auto-create a B41 action.
   - The user must press "Review Swarm Control" explicitly.
   - B41 opens for the source hive, but its control method remains blank.
   - No swarm-control method, result, follow-up or biological outcome is
     preselected or persisted by this bridge.
   - Frozen B41 implementation is not modified.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R09A__) return;
  window.__HIVEDASH_V2P2E5R09A__=true;
  window.__HIVEDASH_V2P2E5R09A_VERSION__='v2p2e5r09a-r09-s19-b41-review-bridge';

  const CORE_RULE_ID='HD-R08S-SWARM-RISK-CHECK';
  const CATALOG_TASK_ID='S19';
  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const S=()=>typeof v45s==='function'?v45s():(typeof state==='function'?state():{});

  function activeTask(taskId=''){
    try{
      const s=S();
      const tasks=typeof generateActions==='function'?(generateActions(s)||[]):[];
      return tasks.find(a=>a &&
        txt(a.id)===txt(taskId) &&
        txt(a.catalogTaskId)===CATALOG_TASK_ID &&
        txt(a.coreRuleId)===CORE_RULE_ID &&
        low(a.workflowStage)==='management-review' &&
        low(a.title)==='review swarm control') || null;
    }catch(_){ return null; }
  }

  window.v2p2e5r09OpenSwarmControl=function(taskId){
    const a=activeTask(taskId);
    if(!a) return typeof toast==='function'?toast('This Swarm Control review is no longer active'):undefined;
    if(typeof window.b41OpenSwarmAction!=='function') return typeof toast==='function'?toast('Swarm Control workflow is unavailable'):undefined;
    // B41's own fresh-entry function clears stale draft state and leaves
    // plannedMethod blank. Only the originating hive is supplied.
    return window.b41OpenSwarmAction(a.hiveId);
  };

  function inject(){
    const raw=txt(location.hash||'').replace(/^#/,'');
    const p=raw.split('/');
    if(p[0]!=='scientific-action' || !p[1]) return;
    const a=activeTask(p[1]);
    if(!a) return;
    const box=document.querySelector('.v2p2e5r08-detail .v2p2e5r08-actions');
    if(!box || box.querySelector('[data-r09-b41-review="1"]')) return;
    const btn=document.createElement('button');
    btn.className='primary';
    btn.type='button';
    btn.dataset.r09B41Review='1';
    btn.textContent='Review Swarm Control';
    btn.addEventListener('click',()=>window.v2p2e5r09OpenSwarmControl(a.id));
    box.appendChild(btn);
  }

  const prevRender=window.render||((typeof render==='function')?render:null);
  if(typeof prevRender==='function'){
    window.render=function(){
      const ret=prevRender.apply(this,arguments);
      inject();
      queueMicrotask(inject);
      return ret;
    };
    try{render=window.render}catch(_){ }
  }
  window.addEventListener('hashchange',()=>queueMicrotask(inject));

  // Handles any unrelated/global DOM refresh that redraws the Task Detail
  // without passing through the outer render wrapper.
  try{
    const mo=new MutationObserver(()=>queueMicrotask(inject));
    const start=()=>{const root=document.getElementById('view');if(root)mo.observe(root,{childList:true,subtree:true})};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }catch(_){ }

  console.log('V2P2E5R09A LOADED | R09/S19 explicit B41 review bridge active');
})();
