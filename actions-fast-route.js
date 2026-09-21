/* ==============================================================
   HiveDash V2P2E5AFR1 — Actions System Task Fast Route

   Scope ONLY:
   - Speed up clicks on already-rendered System cards in Actions.
   - Route the exact rendered task id directly to scientific-action/<id>.
   - Do NOT re-run task projection, state parsing, or any scientific evaluator
     on the click path.
   - R10/S21 and R11/S22 keep their specialized frozen route guards.
   - Manual Actions keep their existing workflow-specific routing.
   - Task Detail remains the validity gate: stale/replaced tasks are handled
     after navigation by the existing detail renderer.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5AFR1__)return;
  window.__HIVEDASH_V2P2E5AFR1__=true;
  window.__HIVEDASH_V2P2E5AFR1_VERSION__='v2p2e5afr1-actions-system-task-fast-route';

  const txt=v=>String(v??'').trim();
  const specialized=id=>/^scientific-r10(?:-|$)/i.test(id)||/^scientific-r11(?:-|$)/i.test(id);

  function taskIdFromButton(btn){
    if(!btn)return '';
    const explicit=txt(btn.dataset?.actionId||btn.dataset?.v2p2e5sActionId||btn.dataset?.taskId);
    if(explicit)return explicit;
    const raw=txt(btn.getAttribute('onclick'));
    const m=raw.match(/(?:v2p2e5abOpenUnifiedAction|v2p2e5amOpenTask)\('([^']+)'\)/);
    return m?txt(m[1]):'';
  }

  function isSystemCard(btn){
    if(!btn)return false;
    if(btn.classList.contains('system'))return true;
    const badge=btn.querySelector('.v2p2e5ab-task-top i.system');
    return !!badge;
  }

  document.addEventListener('click',ev=>{
    const el=ev.target instanceof Element?ev.target:null;
    const btn=el?.closest?.('#alist > button');
    if(!btn||!isSystemCard(btn))return;

    const id=taskIdFromButton(btn);
    if(!id||specialized(id))return; // frozen R10/R11 own their exact routes

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();

    window.__HIVEDASH_ACTIONS_FAST_ROUTE_LAST__={
      actionId:id,
      clickedAt:(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now(),
      fromHash:String(location.hash||''),
      route:`scientific-action/${encodeURIComponent(id)}`
    };

    if(typeof go==='function')return go(`scientific-action/${encodeURIComponent(id)}`);
    location.hash=`#scientific-action/${encodeURIComponent(id)}`;
  },true);

  window.v2p2e5afr1Audit=function(){
    const buttons=[...(document.querySelectorAll?.('#alist > button')||[])];
    return buttons.map(btn=>({
      title:txt(btn.querySelector(':scope > strong')?.textContent||btn.querySelector(':scope > b')?.textContent),
      system:isSystemCard(btn),
      actionId:taskIdFromButton(btn),
      specialized:specialized(taskIdFromButton(btn))
    })).filter(x=>x.system);
  };

  console.log('V2P2E5AFR1 LOADED | rendered System cards route directly; no task-engine recompute on click');
})();
