/* HiveDash V2P2E5PERF1 — per-call-stack state read cache.
   Performance-only. No scientific-rule, routing, workflow, persistence,
   or business-decision changes.

   Problem measured in browser on the R11A8 baseline:
   - one UI render triggered ~50 calls to state()/v45s()/generateActions()
   - generateActions() is the full wrapped scientific-rule chain
   - the same unchanged local state was therefore reparsed/reprojected dozens
     of times inside one synchronous render.

   Contract:
   - state() still returns an independent plain-data object to each caller.
   - only the expensive source read/normalization/action projection is reused
     within ONE synchronous JavaScript call stack.
   - cache is cleared before/after state-mutating persistence entry points.
   - cache is cleared before later microtasks/events, so no cross-event state
     staleness is introduced.
*/
(function(){
  'use strict';

  const VERSION='v2p2e5perf1-call-stack-state-read-cache';
  window.__HIVEDASH_V2P2E5PERF1_VERSION__=VERSION;

  const originalState=(typeof window.state==='function')?window.state:null;
  if(!originalState){
    console.warn('V2P2E5PERF1 not installed: state() unavailable');
    return;
  }

  const fastClone=(value)=>{
    if(typeof structuredClone==='function'){
      try{return structuredClone(value)}catch(_){ }
    }
    return JSON.parse(JSON.stringify(value));
  };

  let canonical=null;
  let clearQueued=false;
  let hits=0;
  let misses=0;

  const clear=()=>{
    canonical=null;
  };

  const queueClear=()=>{
    if(clearQueued)return;
    clearQueued=true;
    const done=()=>{
      canonical=null;
      clearQueued=false;
    };
    if(typeof queueMicrotask==='function')queueMicrotask(done);
    else Promise.resolve().then(done);
  };

  function cachedState(){
    if(canonical===null){
      misses++;
      // Keep a private canonical snapshot so callers retain the old state()
      // isolation semantics: caller mutations cannot poison the cache.
      canonical=fastClone(originalState.apply(this,arguments));
      queueClear();
    }else{
      hits++;
    }
    return fastClone(canonical);
  }

  try{window.state=cachedState}catch(_){ }
  try{state=cachedState}catch(_){ }

  const wrapMutator=(name)=>{
    const fn=window[name];
    if(typeof fn!=='function')return;
    window[name]=function(){
      clear();
      try{return fn.apply(this,arguments)}
      finally{clear()}
    };
    try{
      // Keep classic-script global identifier in sync when writable.
      if(name==='save')save=window[name];
      else if(name==='resetState')resetState=window[name];
      else if(name==='writeLocalV50')writeLocalV50=window[name];
    }catch(_){ }
  };

  wrapMutator('save');
  wrapMutator('resetState');
  wrapMutator('writeLocalV50');

  // External-tab/cloud state changes must never reuse an in-flight snapshot.
  window.addEventListener('storage',clear,true);
  window.addEventListener('hashchange',clear,true);

  window.__HIVEDASH_PERF1_STATE_CACHE__={
    version:VERSION,
    stats:()=>({hits,misses,hasCanonical:canonical!==null}),
    clear
  };

  console.log('V2P2E5PERF1 LOADED | call-stack state read cache active');
})();
