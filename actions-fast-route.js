/* ==============================================================
   HiveDash V2P2E5AFR2 — Actions Fast Route + Instant Detail Back

   Scope ONLY:
   - Keep AFR1's direct routing for already-rendered generic System cards.
   - Capture the already-rendered Actions DOM before opening a System task.
   - On Back from a read-only scientific Task Detail, restore that exact
     Actions snapshot immediately instead of synchronously regenerating the
     entire task queue before the user sees the Actions page.
   - R10/S21 and R11/S22 keep their specialized frozen forward routes.
   - Manual Actions keep their existing workflow-specific routing.
   - Scientific rules, task generation, evaluators, persistence and B37 are
     unchanged.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5AFR2__)return;
  window.__HIVEDASH_V2P2E5AFR2__=true;
  window.__HIVEDASH_V2P2E5AFR2_VERSION__='v2p2e5afr2-actions-fast-route-instant-detail-back';

  const txt=v=>String(v??'').trim();
  const specialized=id=>/^scientific-r10(?:-|$)/i.test(id)||/^scientific-r11(?:-|$)/i.test(id);
  const SNAP_TTL_MS=60000;

  function routeRoot(){
    return txt(location.hash||'#home').replace(/^#/,'').split('/')[0]||'home';
  }

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

  function captureActionsSnapshot(){
    if(routeRoot()!=='actions')return null;
    const view=document.getElementById('view');
    const top=document.getElementById('topbar');
    const bottom=document.getElementById('bottomnav');
    if(!view||!top||!bottom||!document.getElementById('alist'))return null;

    const snap={
      capturedAt:Date.now(),
      sourceHash:String(location.hash||'#actions'),
      viewHTML:view.innerHTML,
      viewClass:view.className,
      topHTML:top.innerHTML,
      topClass:top.className,
      bottomHTML:bottom.innerHTML,
      bottomClass:bottom.className,
      scrollX:Number(window.scrollX||0),
      scrollY:Number(window.scrollY||0)
    };
    window.__HIVEDASH_ACTIONS_FAST_ROUTE_SNAPSHOT__=snap;
    return snap;
  }

  function usableSnapshot(){
    const s=window.__HIVEDASH_ACTIONS_FAST_ROUTE_SNAPSHOT__;
    if(!s)return null;
    if(Date.now()-Number(s.capturedAt||0)>SNAP_TTL_MS)return null;
    if(!txt(s.viewHTML))return null;
    return s;
  }

  function restoreActionsSnapshot(){
    const snap=usableSnapshot();
    if(!snap){
      if(typeof go==='function')return go('actions');
      location.hash='#actions';
      return;
    }

    const view=document.getElementById('view');
    const top=document.getElementById('topbar');
    const bottom=document.getElementById('bottomnav');
    if(!view||!top||!bottom){
      if(typeof go==='function')return go('actions');
      location.hash='#actions';
      return;
    }

    /* replaceState changes the visible route without firing hashchange, so the
       expensive Actions regeneration cannot block the first paint. */
    try{
      const url=location.pathname+location.search+'#actions';
      history.replaceState(history.state,'',url);
    }catch(_){ }

    view.className=snap.viewClass;
    view.innerHTML=snap.viewHTML;
    top.className=snap.topClass;
    top.innerHTML=snap.topHTML;
    bottom.className=snap.bottomClass;
    bottom.innerHTML=snap.bottomHTML;

    window.__HIVEDASH_ACTIONS_FAST_BACK_LAST__={
      restoredAt:(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now(),
      snapshotAgeMs:Date.now()-Number(snap.capturedAt||0),
      from:'scientific-action',
      route:'#actions'
    };

    requestAnimationFrame(()=>{
      try{window.scrollTo(snap.scrollX||0,snap.scrollY||0)}catch(_){ }
    });
  }

  function isScientificDetailBack(el){
    if(routeRoot()!=='scientific-action')return false;
    const btn=el?.closest?.('button');
    if(!btn)return false;
    const onclick=txt(btn.getAttribute('onclick'));
    if(/go\(['"]actions['"]\)/.test(onclick))return true;
    const label=txt(btn.textContent).toLowerCase();
    return label==='back'||label==='back to actions';
  }

  document.addEventListener('click',ev=>{
    const el=ev.target instanceof Element?ev.target:null;

    /* Fast Back: intercept before the inline go('actions') can trigger the
       heavyweight hashchange Actions render. */
    if(isScientificDetailBack(el)&&usableSnapshot()){
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
      restoreActionsSnapshot();
      return;
    }

    const btn=el?.closest?.('#alist > button');
    if(!btn||!isSystemCard(btn))return;

    /* Capture even specialized R10/R11 cards. Their frozen forward handlers
       remain untouched; AFR2 only supplies the instant read-only Back path. */
    captureActionsSnapshot();

    const id=taskIdFromButton(btn);
    if(!id||specialized(id))return;

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

  window.v2p2e5afr2BackToActions=restoreActionsSnapshot;
  window.v2p2e5afr2CaptureActionsSnapshot=captureActionsSnapshot;
  window.v2p2e5afr2Audit=function(){
    const buttons=[...(document.querySelectorAll?.('#alist > button')||[])];
    return {
      version:window.__HIVEDASH_V2P2E5AFR2_VERSION__,
      snapshot:usableSnapshot()?{
        ageMs:Date.now()-window.__HIVEDASH_ACTIONS_FAST_ROUTE_SNAPSHOT__.capturedAt,
        sourceHash:window.__HIVEDASH_ACTIONS_FAST_ROUTE_SNAPSHOT__.sourceHash,
        htmlLength:window.__HIVEDASH_ACTIONS_FAST_ROUTE_SNAPSHOT__.viewHTML.length
      }:null,
      systemCards:buttons.map(btn=>({
        title:txt(btn.querySelector(':scope > strong')?.textContent||btn.querySelector(':scope > b')?.textContent),
        system:isSystemCard(btn),
        actionId:taskIdFromButton(btn),
        specialized:specialized(taskIdFromButton(btn))
      })).filter(x=>x.system)
    };
  };

  console.log('V2P2E5AFR2 LOADED | direct System-task forward route + instant scientific-detail Back snapshot restore');
})();
