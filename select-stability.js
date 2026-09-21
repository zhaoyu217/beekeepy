/* ==============================================================
   V2P2E5UI1 — NATIVE SELECT FIRST-OPEN STABILITY GUARD

   UI-only scope:
   - Prevent a same-route async/realtime render from replacing #view while
     the user is actively opening/choosing a native <select> option.
   - The render is deferred, not discarded, and is replayed after the select
     commits (change) or loses focus.
   - Route changes are never blocked.
   - No Action, rule, workflow, persistence, data model, or scientific logic
     is modified.

   Root interaction gap:
   - V224B14 protects dirty forms after input/change.
   - A native select can be destroyed by a background render after pointerdown
     but before its first change event, which collapses the first-open popup.
   - This guard closes only that pre-change interaction window globally for
     page-level selects inside #view.
   ============================================================== */
(function v2p2e5ui1NativeSelectFirstOpenGuard(){
  'use strict';
  if(window.__HIVEDASH_V2P2E5UI1__)return;
  window.__HIVEDASH_V2P2E5UI1__=true;

  const VERSION='v2p2e5ui1-native-select-first-open-stability';
  const routeNow=()=>String(location.hash||'#home').replace(/^#/,'');
  const baseRender=(typeof window.render==='function')?window.render:null;
  if(!baseRender){
    console.warn('V2P2E5UI1 not installed: render() unavailable');
    return;
  }

  let activeSelect=null;
  let activeRoute='';
  let pendingCall=null;
  let blockedRenders=0;
  let replayedRenders=0;

  function pageSelect(el){
    if(!el||!el.matches?.('select')||el.disabled)return null;
    return el.closest?.('#view')?el:null;
  }

  function begin(el){
    el=pageSelect(el);
    if(!el)return;
    const route=routeNow();
    if(activeSelect===el&&activeRoute===route)return;
    if(activeRoute&&activeRoute!==route)pendingCall=null;
    activeSelect=el;
    activeRoute=route;
  }

  function clearInteraction(){
    activeSelect=null;
    activeRoute='';
  }

  function replay(route){
    if(!pendingCall||routeNow()!==route)return;
    const call=pendingCall;
    pendingCall=null;
    replayedRenders++;
    try{window.render.apply(call.thisArg,call.args)}catch(err){
      console.error('V2P2E5UI1 deferred render replay failed',err);
    }
  }

  function finish(el){
    if(el&&activeSelect&&el!==activeSelect)return;
    if(!activeSelect)return;
    const route=activeRoute;
    clearInteraction();
    if(pendingCall&&routeNow()===route){
      if(typeof queueMicrotask==='function')queueMicrotask(()=>replay(route));
      else Promise.resolve().then(()=>replay(route));
    }
  }

  /* Begin before the browser opens the native option popup. Pointer events are
     primary; mousedown/focusin are harmless fallbacks and begin() is idempotent. */
  document.addEventListener('pointerdown',e=>begin(e.target?.closest?.('select')),true);
  document.addEventListener('mousedown',e=>begin(e.target?.closest?.('select')),true);
  document.addEventListener('focusin',e=>begin(pageSelect(e.target)),true);

  /* change is captured before inline onchange, so finish is deliberately queued:
     the target onchange handler gets the full event first and can persist its draft. */
  document.addEventListener('change',e=>{
    const el=pageSelect(e.target);
    if(!el)return;
    if(typeof queueMicrotask==='function')queueMicrotask(()=>finish(el));
    else Promise.resolve().then(()=>finish(el));
  },true);

  /* Covers Esc/cancel or clicking elsewhere without changing a value. Use a task
     boundary so any browser-delivered change event can complete first. */
  document.addEventListener('focusout',e=>{
    const el=pageSelect(e.target);
    if(!el)return;
    setTimeout(()=>finish(el),0);
  },true);

  window.render=function(){
    const route=routeNow();

    /* Navigation must always win. Never hold a render across route ownership. */
    if(activeSelect&&activeRoute&&route!==activeRoute){
      clearInteraction();
      pendingCall=null;
      return baseRender.apply(this,arguments);
    }

    /* Same-route background repaint during native select interaction: keep the
       live control mounted so the first-open popup stays open. Replay later. */
    if(activeSelect&&activeRoute===route){
      blockedRenders++;
      pendingCall={thisArg:this,args:Array.from(arguments)};
      return;
    }

    return baseRender.apply(this,arguments);
  };
  try{render=window.render}catch(_){ }

  window.addEventListener('hashchange',()=>{
    if(activeRoute&&routeNow()!==activeRoute){
      clearInteraction();
      pendingCall=null;
    }
  },true);

  window.__HIVEDASH_SELECT_STABILITY__={
    version:VERSION,
    status:()=>({
      active:!!activeSelect,
      route:activeRoute,
      pending:!!pendingCall,
      blockedRenders,
      replayedRenders
    })
  };
  window.__HIVEDASH_V2P2E5UI1_VERSION__=VERSION;
  console.log('V2P2E5UI1 LOADED | native select first-open stability guard active');
})();
