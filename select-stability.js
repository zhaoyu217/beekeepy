/* ==============================================================
   V2P2E5UI1A — NATIVE SELECT POPUP FOCUS STABILITY GUARD

   UI-only scope:
   - Preserve a native <select> while its browser popup is open/committing.
   - Fix UI1's over-eager focusout release: some desktop browsers can move
     focus while the native popup is active, allowing a same-route repaint to
     replace the control before the first option click commits.
   - Same-route renders are deferred, never discarded; route changes always win.
   - No Action, rule, workflow, persistence, data model, or scientific logic.

   UI1A lifecycle:
   - begin on pointer/mouse/focus into a page-level select;
   - DO NOT end merely because focusout fires;
   - end after change (next task, after inline onchange has persisted draft),
     Escape, focus moving to another real control, or pointerdown elsewhere;
   - route changes clear ownership immediately and render normally.
   ============================================================== */
(function v2p2e5ui1aNativeSelectPopupFocusGuard(){
  'use strict';
  if(window.__HIVEDASH_V2P2E5UI1A__)return;
  window.__HIVEDASH_V2P2E5UI1A__=true;

  const VERSION='v2p2e5ui1a-native-select-popup-focus-stability';
  const routeNow=()=>String(location.hash||'#home').replace(/^#/,'');
  const baseRender=(typeof window.render==='function')?window.render:null;
  if(!baseRender){
    console.warn('V2P2E5UI1A not installed: render() unavailable');
    return;
  }

  let activeSelect=null;
  let activeRoute='';
  let pendingCall=null;
  let replayTimer=0;
  let blockedRenders=0;
  let replayedRenders=0;
  let focusoutIgnored=0;

  function pageSelect(el){
    if(!el||!el.matches?.('select')||el.disabled)return null;
    return el.closest?.('#view')?el:null;
  }
  function pageControl(el){
    if(!el||!el.matches?.('input,select,textarea,button,a,[tabindex]'))return null;
    return el.closest?.('#view')?el:null;
  }

  function cancelReplay(){
    if(replayTimer){clearTimeout(replayTimer);replayTimer=0;}
  }

  function begin(el){
    el=pageSelect(el);
    if(!el)return;
    const route=routeNow();
    cancelReplay();
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
    replayTimer=0;
    if(!pendingCall||routeNow()!==route)return;
    const call=pendingCall;
    pendingCall=null;
    replayedRenders++;
    try{window.render.apply(call.thisArg,call.args)}catch(err){
      console.error('V2P2E5UI1A deferred render replay failed',err);
    }
  }

  function finish(el){
    if(el&&activeSelect&&el!==activeSelect)return;
    if(!activeSelect)return;
    const route=activeRoute;
    clearInteraction();
    cancelReplay();
    /* Use a task boundary, not a microtask. This guarantees the native select's
       target/inline onchange and any bubbling draft handlers finish before a
       deferred repaint is allowed to reconstruct the page. */
    if(pendingCall&&routeNow()===route){
      replayTimer=setTimeout(()=>replay(route),0);
    }
  }

  document.addEventListener('pointerdown',e=>{
    const sel=pageSelect(e.target?.closest?.('select'));
    if(sel){begin(sel);return;}
    /* Clicking another real page control means the native popup interaction is
       over. Defer the replay so the new control's click is not destroyed. */
    if(activeSelect&&pageControl(e.target?.closest?.('input,select,textarea,button,a,[tabindex]')))finish(activeSelect);
  },true);

  document.addEventListener('mousedown',e=>{
    const sel=pageSelect(e.target?.closest?.('select'));
    if(sel)begin(sel);
  },true);

  document.addEventListener('focusin',e=>{
    const sel=pageSelect(e.target);
    if(sel){
      if(activeSelect&&activeSelect!==sel)finish(activeSelect);
      begin(sel);
      return;
    }
    if(activeSelect&&pageControl(e.target))finish(activeSelect);
  },true);

  /* Critical UI1A change: focusout alone is NOT proof that the native popup is
     finished. Chrome/Edge/OS-native select UI may temporarily move focus while
     the option list is active. Replaying here can invalidate the first click. */
  document.addEventListener('focusout',e=>{
    if(pageSelect(e.target)&&activeSelect===e.target)focusoutIgnored++;
  },true);

  document.addEventListener('change',e=>{
    const el=pageSelect(e.target);
    if(!el)return;
    /* schedule finish; target inline onchange persists the selected value first */
    setTimeout(()=>finish(el),0);
  },true);

  document.addEventListener('keydown',e=>{
    if(!activeSelect)return;
    if(String(e.key||'')==='Escape')setTimeout(()=>finish(activeSelect),0);
  },true);

  window.render=function(){
    const route=routeNow();

    /* Navigation must always win. Never hold a render across route ownership. */
    if(activeSelect&&activeRoute&&route!==activeRoute){
      clearInteraction();
      pendingCall=null;
      cancelReplay();
      return baseRender.apply(this,arguments);
    }

    /* Same-route background repaint while the native option UI is active. */
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
      cancelReplay();
    }
  },true);

  window.__HIVEDASH_SELECT_STABILITY__={
    version:VERSION,
    status:()=>({
      active:!!activeSelect,
      route:activeRoute,
      pending:!!pendingCall,
      blockedRenders,
      replayedRenders,
      focusoutIgnored
    })
  };
  window.__HIVEDASH_V2P2E5UI1A_VERSION__=VERSION;
  console.log('V2P2E5UI1A LOADED | native select popup focus stability guard active');
})();
