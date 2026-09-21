/* ==============================================================
   HiveDash V2P2E5AFR3 — Actions Fast Route Safety Guard

   Scope ONLY:
   - Keep AFR2 instant Back snapshot for read-only scientific Task Detail.
   - Keep direct fast routing only for task ids that are safe to open directly
     as durable scientific-action details.
   - DO NOT direct-route transient Varroa lifecycle projection rows. Those rows
     are not persisted in state.actions and must continue through the frozen
     AX5/AX6 opener so treatment/retest routes are resolved correctly.
   - R10/S21 and R11/S22 keep their specialized frozen forward routes.
   - Manual Actions keep their existing workflow-specific routing.
   - Scientific rules, task generation, evaluators, persistence, B37, app.js,
     v45.js and R11 are unchanged.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5AFR3__)return;
  window.__HIVEDASH_V2P2E5AFR3__=true;
  window.__HIVEDASH_V2P2E5AFR3_VERSION__='v2p2e5afr3-actions-fast-route-transient-guard';

  const txt=v=>String(v??'').trim();
  const specialized=id=>/^scientific-r10(?:-|$)/i.test(id)||/^scientific-r11(?:-|$)/i.test(id);
  const transientProjected=id=>/^v2p2c-stage-varroa-/i.test(txt(id));
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

    if(isScientificDetailBack(el)&&usableSnapshot()){
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
      restoreActionsSnapshot();
      return;
    }

    const btn=el?.closest?.('#alist > button');
    if(!btn||!isSystemCard(btn))return;

    const id=taskIdFromButton(btn);

    /* Capture specialized R10/R11 because their read-only Task Detail Back can
       still use AFR3's instant snapshot restore. */
    if(id&&specialized(id)){
      captureActionsSnapshot();
      return;
    }

    /* CRITICAL SAFETY GUARD:
       v2p2c-stage-varroa-* rows are transient projections. They intentionally
       do not exist in persisted state.actions. AX5/AX6 resolve them to the
       current Treatment/retest route. Never bypass that opener by sending the
       raw projection id to scientific-action/<id>. */
    if(!id||transientProjected(id)){
      window.__HIVEDASH_ACTIONS_FAST_ROUTE_LAST__={
        actionId:id,
        bypassed:true,
        reason:transientProjected(id)?'transient-varroa-projection':'missing-id',
        clickedAt:(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now(),
        fromHash:String(location.hash||'')
      };
      return;
    }

    captureActionsSnapshot();

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();

    window.__HIVEDASH_ACTIONS_FAST_ROUTE_LAST__={
      actionId:id,
      bypassed:false,
      clickedAt:(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now(),
      fromHash:String(location.hash||''),
      route:`scientific-action/${encodeURIComponent(id)}`
    };

    if(typeof go==='function')return go(`scientific-action/${encodeURIComponent(id)}`);
    location.hash=`#scientific-action/${encodeURIComponent(id)}`;
  },true);

  window.v2p2e5afr3BackToActions=restoreActionsSnapshot;
  window.v2p2e5afr3CaptureActionsSnapshot=captureActionsSnapshot;
  window.v2p2e5afr3Audit=function(){
    const buttons=[...(document.querySelectorAll?.('#alist > button')||[])];
    return {
      version:window.__HIVEDASH_V2P2E5AFR3_VERSION__,
      snapshot:usableSnapshot()?{
        ageMs:Date.now()-window.__HIVEDASH_ACTIONS_FAST_ROUTE_SNAPSHOT__.capturedAt,
        sourceHash:window.__HIVEDASH_ACTIONS_FAST_ROUTE_SNAPSHOT__.sourceHash,
        htmlLength:window.__HIVEDASH_ACTIONS_FAST_ROUTE_SNAPSHOT__.viewHTML.length
      }:null,
      systemCards:buttons.map(btn=>{
        const actionId=taskIdFromButton(btn);
        return {
          title:txt(btn.querySelector(':scope > strong')?.textContent||btn.querySelector(':scope > b')?.textContent),
          system:isSystemCard(btn),
          actionId,
          specialized:specialized(actionId),
          transientProjected:transientProjected(actionId),
          fastDirectSafe:!!actionId&&!specialized(actionId)&&!transientProjected(actionId)
        };
      }).filter(x=>x.system)
    };
  };

  console.log('V2P2E5AFR3 LOADED | direct durable System-task route + transient Varroa guard + instant scientific-detail Back');
})();
