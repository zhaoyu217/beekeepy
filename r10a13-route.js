/* ==============================================================
   HiveDash V2P2E5R10A13 — R10 visible-Hive authoritative route guard

   Scope ONLY:
   - Do not change R10/S21 scientific timing/evidence/path-confirmation logic.
   - Do not change frozen B39/B38/B41 or unrelated Action routing.
   - Fix R10 cards with duplicate visible titles (e.g. several
     "Confirm split queen path" cards) being opened as the wrong Hive because
     legacy Actions decorators rewrite onclick/actionId by positional rows.
   - The VISIBLE Hive label on the card is authoritative for routing.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R10A13_ROUTE__) return;
  window.__HIVEDASH_V2P2E5R10A13_ROUTE__=true;
  window.__HIVEDASH_V2P2E5R10A13_VERSION__='v2p2e5r10a13-visible-hive-authoritative-route';
  window.__HIVEDASH_V2P2E5R10A13_ROUTE_VERSION__='v2p2e5r10a13-visible-hive-authoritative-route';

  const RULE='HD-R10S-SPLIT-VERIFICATION';
  const txt=v=>String(v??'').trim();
  const norm=v=>txt(v).replace(/\s+/g,' ').toLowerCase();
  const S=()=>{try{return typeof v45s==='function'?v45s():(typeof state==='function'?state():null)}catch(_){return null}};
  const core=()=>window.HiveDashTaskEngineCoreV1;
  const isR10=a=>!!a&&txt(a.coreRuleId)===RULE;

  function visibleHive(btn){
    if(!btn)return '';
    return txt(btn.querySelector('.v2p2e5ab-task-top b')?.textContent || btn.querySelector(':scope > span')?.textContent || '');
  }
  function visibleTitle(btn){
    if(!btn)return '';
    return txt(btn.querySelector(':scope > strong')?.textContent || btn.querySelector(':scope > b')?.textContent || '');
  }
  function hiveByVisibleName(s,name){
    const n=norm(name);if(!s||!n)return null;
    const matches=(s.hives||[]).filter(h=>h&&norm(h.name)===n);
    return matches.length===1?matches[0]:null;
  }
  function currentR10ForHive(s,hive){
    if(!s||!hive)return null;
    try{
      const ev=core()?.evaluateSplitVerification?.(s,hive.id);
      const t=ev?.task;
      if(t&&isR10(t)&&txt(t.hiveId)===txt(hive.id))return t;
    }catch(err){console.error('R10A13 evaluator route lookup failed',err)}
    try{
      const rows=(window.v53ActionRows?.('Pending')||[]).filter(a=>isR10(a)&&txt(a.hiveId)===txt(hive.id));
      return rows.length===1?rows[0]:null;
    }catch(_){return null}
  }
  function resolveVisibleCard(btn){
    const s=S(),hName=visibleHive(btn),title=visibleTitle(btn),hive=hiveByVisibleName(s,hName);
    if(!hive)return null;
    const task=currentR10ForHive(s,hive);if(!task)return null;
    // Guard against capturing unrelated manual/system cards for the same Hive.
    // The projected task title must match exactly what the user can see.
    if(norm(task.title)!==norm(title))return null;
    return task;
  }
  function routeTask(a){
    if(!a)return false;
    try{window.v2p2e5lRememberActionFocus?.(txt(a.id))}catch(_){ }
    if(typeof go==='function')go(`scientific-action/${encodeURIComponent(txt(a.id))}`);
    return true;
  }
  function decorate(){
    try{
      const box=document.getElementById('alist');if(!box)return;
      [...box.querySelectorAll(':scope > button')].forEach(btn=>{
        const a=resolveVisibleCard(btn);if(!a){delete btn.dataset.r10a13ActionId;return}
        btn.dataset.r10a13ActionId=txt(a.id);
        btn.dataset.r10a13HiveId=txt(a.hiveId);
        btn.dataset.r10RouteGuard='a13';
      });
    }catch(err){console.error('R10A13 route decoration failed',err)}
  }

  // Capture phase: this executes before any stale inline onclick or legacy
  // bubbling handler can route the card by the wrong positional actionId.
  document.addEventListener('click',ev=>{
    const el=ev.target instanceof Element?ev.target:null;
    const btn=el?.closest?.('#alist > button');if(!btn)return;
    const a=resolveVisibleCard(btn);if(!a)return;
    ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation?.();
    routeTask(a);
  },true);

  const prevDraw=window.v53DrawActions||((typeof v53DrawActions==='function')?v53DrawActions:null);
  if(typeof prevDraw==='function'){
    const wrapped=function(){const ret=prevDraw.apply(this,arguments);decorate();queueMicrotask(decorate);return ret};
    try{window.v53DrawActions=wrapped}catch(_){ }
    try{v53DrawActions=wrapped}catch(_){ }
  }

  window.v2p2e5r10a13RouteAudit=function(){
    const box=document.getElementById('alist');
    return [...(box?.querySelectorAll(':scope > button')||[])].map(btn=>{
      const a=resolveVisibleCard(btn);
      return {visibleHive:visibleHive(btn),visibleTitle:visibleTitle(btn),resolvedR10Id:txt(a?.id),resolvedHiveId:txt(a?.hiveId)};
    }).filter(x=>x.resolvedR10Id);
  };

  queueMicrotask(decorate);
  console.log('V2P2E5R10A13 ROUTE LOADED | visible Hive is authoritative for duplicate-title R10 cards');
})();
