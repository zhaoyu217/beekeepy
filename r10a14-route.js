/* ==============================================================
   HiveDash V2P2E5R10A14 — R10 fast visible-Hive route guard

   Scope ONLY:
   - Preserve A13 visible-Hive authoritative routing semantics.
   - Remove A13 performance regression caused by evaluating R10 separately
     for every visible Actions card (and doing it twice per draw).
   - Build one cached R10 route map per Actions redraw, then route clicks
     with O(1) lookup by visible Hive + visible title.
   - Do not change R10/S21 scientific logic, A12 path-confirmation gate,
     frozen B39/B38/B41, or unrelated Action routing.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R10A14_ROUTE__) return;
  window.__HIVEDASH_V2P2E5R10A14_ROUTE__=true;
  window.__HIVEDASH_V2P2E5R10A14_VERSION__='v2p2e5r10a14-fast-visible-hive-route-cache';
  window.__HIVEDASH_V2P2E5R10A14_ROUTE_VERSION__='v2p2e5r10a14-fast-visible-hive-route-cache';

  const RULE='HD-R10S-SPLIT-VERIFICATION';
  const txt=v=>String(v??'').trim();
  const norm=v=>txt(v).replace(/\s+/g,' ').toLowerCase();
  const key=(h,t)=>`${norm(h)}\u241f${norm(t)}`;
  const isR10=a=>!!a&&txt(a.coreRuleId)===RULE;
  const S=()=>{try{return typeof v45s==='function'?v45s():(typeof state==='function'?state():null)}catch(_){return null}};

  let routeMap=new Map();
  let rebuildQueued=false;

  function visibleHive(btn){
    if(!btn)return '';
    return txt(btn.querySelector('.v2p2e5ab-task-top b')?.textContent || btn.querySelector(':scope > span')?.textContent || '');
  }
  function visibleTitle(btn){
    if(!btn)return '';
    return txt(btn.querySelector(':scope > strong')?.textContent || btn.querySelector(':scope > b')?.textContent || '');
  }

  function buildRouteMap(){
    const s=S();
    if(!s){routeMap=new Map();return routeMap;}

    const hiveNames=new Map();
    for(const h of (s.hives||[])){
      if(h)hiveNames.set(txt(h.id),txt(h.name));
    }

    let rows=[];
    try{rows=window.v53ActionRows?.('Pending')||[]}catch(_){rows=[]}

    const next=new Map();
    for(const a of rows){
      if(!isR10(a))continue;
      const hName=hiveNames.get(txt(a.hiveId))||'';
      const title=txt(a.title);
      if(!hName||!title)continue;
      const k=key(hName,title);
      if(!next.has(k)) next.set(k,a);
      else next.set(k,null); // ambiguous: fail closed instead of misrouting
    }
    routeMap=next;
    return routeMap;
  }

  function scheduleRebuild(){
    if(rebuildQueued)return;
    rebuildQueued=true;
    queueMicrotask(()=>{
      rebuildQueued=false;
      try{buildRouteMap()}catch(err){console.error('R10A14 route cache rebuild failed',err)}
    });
  }

  function cachedTaskForButton(btn){
    const h=visibleHive(btn),t=visibleTitle(btn);
    if(!h||!t)return null;
    const k=key(h,t);
    let a=routeMap.get(k);
    if(a===undefined){
      buildRouteMap();
      a=routeMap.get(k);
    }
    return a||null;
  }

  function routeTask(a){
    if(!a)return false;
    try{window.v2p2e5lRememberActionFocus?.(txt(a.id))}catch(_){ }
    if(typeof go==='function')go(`scientific-action/${encodeURIComponent(txt(a.id))}`);
    return true;
  }

  // Capture phase still wins over stale legacy onclick handlers, but unlike
  // A13 the click path does not re-run the scientific evaluator.
  document.addEventListener('click',ev=>{
    const el=ev.target instanceof Element?ev.target:null;
    const btn=el?.closest?.('#alist > button');
    if(!btn)return;
    const a=cachedTaskForButton(btn);
    if(!a)return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();
    routeTask(a);
  },true);

  const prevDraw=window.v53DrawActions||((typeof v53DrawActions==='function')?v53DrawActions:null);
  if(typeof prevDraw==='function'){
    const wrapped=function(){
      const ret=prevDraw.apply(this,arguments);
      // One deferred map rebuild per draw. No per-card evaluator loop.
      scheduleRebuild();
      return ret;
    };
    try{window.v53DrawActions=wrapped}catch(_){ }
    try{v53DrawActions=wrapped}catch(_){ }
  }

  window.v2p2e5r10a14RouteAudit=function(){
    buildRouteMap();
    const box=document.getElementById('alist');
    return [...(box?.querySelectorAll(':scope > button')||[])].map(btn=>{
      const h=visibleHive(btn),t=visibleTitle(btn),a=routeMap.get(key(h,t));
      return {visibleHive:h,visibleTitle:t,resolvedR10Id:txt(a?.id),resolvedHiveId:txt(a?.hiveId)};
    }).filter(x=>x.resolvedR10Id);
  };

  scheduleRebuild();
  console.log('V2P2E5R10A14 ROUTE LOADED | cached visible-Hive routing; no per-card evaluator loop');
})();
