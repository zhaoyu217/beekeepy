/* ==============================================================
   HiveDash V2P2E5R10A9 — R10/S21 visible-card identity route guard

   Scope ONLY:
   - Do not change R10/S21 timing/evidence/result logic (A7 authoritative).
   - Do not change frozen B39/B41 or unrelated task routing.
   - Fix residual R10 Actions misrouting caused by legacy draw decorators that
     rewrite onclick by positional rows after Actions 2.0 sorts/filters cards.
   - In capture phase, identify an R10 card by the card's VISIBLE hive/title
     identity and route to that exact R10 projected task before any stale
     inline onclick can execute.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R10A9_ROUTE__) return;
  window.__HIVEDASH_V2P2E5R10A9_ROUTE__=true;
  window.__HIVEDASH_V2P2E5R10A9_VERSION__='v2p2e5r10a9-visible-card-identity-route';
  window.__HIVEDASH_V2P2E5R10A9_ROUTE_VERSION__='v2p2e5r10a9-visible-card-identity-route';

  const RULE='HD-R10S-SPLIT-VERIFICATION';
  const txt=v=>String(v??'').trim();
  const norm=v=>txt(v).replace(/\s+/g,' ').toLowerCase();
  const S=()=>{try{return typeof v45s==='function'?v45s():(typeof state==='function'?state():null)}catch(_){return null}};
  const isR10=a=>!!a&&txt(a.coreRuleId)===RULE;

  function projectedR10(){
    try{
      const fn=window.v53ActionRows||((typeof v53ActionRows==='function')?v53ActionRows:null);
      return typeof fn==='function'?(fn('Pending')||[]).filter(isR10):[];
    }catch(_){return []}
  }
  function hiveNameFor(a,s){
    const h=(s?.hives||[]).find(x=>x&&txt(x.id)===txt(a?.hiveId));
    return txt(h?.name||a?.hiveName||a?.hiveId);
  }
  function cardIdentity(btn){
    if(!btn)return {hive:'',title:'',due:''};
    const topHive=btn.querySelector('.v2p2e5ab-task-top b')?.textContent;
    const strong=btn.querySelector('strong')?.textContent;
    const time=btn.querySelector('.v2p2e5ab-task-foot time')?.textContent;
    // Fallbacks cover older Actions renderers without changing them.
    const spans=[...btn.querySelectorAll(':scope > span')];
    const directB=[...btn.querySelectorAll(':scope > b')];
    return {
      hive:norm(topHive||spans[0]?.textContent||''),
      title:norm(strong||directB[0]?.textContent||''),
      due:norm(time||btn.querySelector(':scope > small')?.textContent||'')
    };
  }
  function taskIdentity(a,s){
    return {
      hive:norm(hiveNameFor(a,s)),
      title:norm(a?.title||a?.type||''),
      due:norm(a?.dueDate||a?.due||a?.date||'')
    };
  }
  function currentId(btn){
    const d=txt(btn?.dataset?.actionId);
    if(d)return d;
    const raw=txt(btn?.getAttribute?.('onclick'));
    const m=raw.match(/(?:v2p2e5abOpenUnifiedAction|v2p2e5amOpenTask|v2p2e5r10\w*OpenTask)\('([^']+)'\)/);
    return m?txt(m[1]):'';
  }
  function exactTaskForCard(btn){
    const rows=projectedR10();
    if(!rows.length)return null;
    const s=S(),ci=cardIdentity(btn),id=currentId(btn);

    // Trust an embedded id only when its projected task also matches what the
    // user can actually see on the card. This rejects stale positional ids.
    if(id){
      const byId=rows.find(a=>txt(a.id)===id);
      if(byId){
        const ti=taskIdentity(byId,s);
        if(ci.hive===ti.hive&&ci.title===ti.title)return byId;
      }
    }

    let matches=rows.filter(a=>{
      const ti=taskIdentity(a,s);
      return ci.hive&&ci.title&&ci.hive===ti.hive&&ci.title===ti.title;
    });
    if(matches.length===1)return matches[0];
    if(matches.length>1&&ci.due){
      const dueMatches=matches.filter(a=>taskIdentity(a,s).due===ci.due);
      if(dueMatches.length===1)return dueMatches[0];
    }
    return null;
  }
  function routeExact(a){
    if(!a)return false;
    if(typeof window.v2p2e5lRememberActionFocus==='function'){
      try{window.v2p2e5lRememberActionFocus(txt(a.id))}catch(_){ }
    }
    if(typeof go==='function')go(`scientific-action/${encodeURIComponent(txt(a.id))}`);
    return true;
  }
  function decorate(){
    try{
      const box=document.getElementById('alist');if(!box)return;
      [...box.querySelectorAll(':scope > button')].forEach(btn=>{
        const a=exactTaskForCard(btn);if(!a)return;
        btn.dataset.r10ActionId=txt(a.id);
        btn.dataset.r10HiveId=txt(a.hiveId);
        btn.dataset.r10RouteGuard='a9';
      });
    }catch(err){console.error('R10A9 card identity decoration failed',err)}
  }

  // Capture-phase guard runs BEFORE inline onclick and all legacy bubbling
  // handlers. Only exact visible R10 cards are intercepted; every other task
  // continues through its frozen existing route.
  document.addEventListener('click',ev=>{
    const el=ev.target instanceof Element?ev.target:null;
    const btn=el?.closest?.('#alist > button');
    if(!btn)return;
    const a=exactTaskForCard(btn);
    if(!a)return;
    ev.preventDefault();
    ev.stopPropagation();
    if(typeof ev.stopImmediatePropagation==='function')ev.stopImmediatePropagation();
    routeExact(a);
  },true);

  const prevDraw=window.v53DrawActions||((typeof v53DrawActions==='function')?v53DrawActions:null);
  if(typeof prevDraw==='function'){
    const wrapped=function(){
      const ret=prevDraw.apply(this,arguments);
      decorate();
      queueMicrotask(decorate);
      return ret;
    };
    try{window.v53DrawActions=wrapped}catch(_){ }
    try{v53DrawActions=wrapped}catch(_){ }
  }

  window.v2p2e5r10a9RouteAudit=function(){
    const box=document.getElementById('alist');
    return [...(box?.querySelectorAll(':scope > button')||[])].map(btn=>{
      const ci=cardIdentity(btn),a=exactTaskForCard(btn);
      return {visibleHive:ci.hive,visibleTitle:ci.title,embeddedId:currentId(btn),resolvedR10Id:txt(a?.id),resolvedHiveId:txt(a?.hiveId)};
    }).filter(x=>x.resolvedR10Id);
  };

  queueMicrotask(decorate);
  console.log('V2P2E5R10A9 ROUTE LOADED | visible-card identity capture guard active');
})();
