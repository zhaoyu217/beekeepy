/* ==============================================================
   HiveDash V2P2E5R10A10 — R10/S21 final field-chain closure

   Scope ONLY (three verified gaps):
   1) POST-window FAIL escalation due date = the Split Verification date
      that created the escalation, not the old day-21 verification start.
   2) R10 management-review detail always exposes the latest targeted
      Split Verification evidence that caused the escalation.
   3) R10 High escalation -> Queen Management preserves hive, due date,
      and High priority while leaving Queen Action UNSELECTED.

   Explicit non-goals:
   - Do not change A7 timing/result rules (Day 12/21/28/29).
   - Do not change A9 visible-card routing.
   - Do not change frozen B38 Queen Management business logic.
   - Do not preselect Requeen or any irreversible queen action.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R10A10_CLOSURE__) return;
  window.__HIVEDASH_V2P2E5R10A10_CLOSURE__=true;
  window.__HIVEDASH_V2P2E5R10A10_VERSION__='v2p2e5r10a10-due-evidence-high-handoff';

  const RULE='HD-R10S-SPLIT-VERIFICATION';
  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const esc=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S=()=>{try{return typeof v45s==='function'?v45s():(typeof state==='function'?state():null)}catch(err){console.error('R10A10 state read failed',err);return null}};
  const isR10=a=>!!a&&txt(a.coreRuleId)===RULE;
  const isManagement=a=>isR10(a)&&low(a.workflowStage)==='management-review'&&txt(a.verificationStatus).toUpperCase()==='FAIL';

  function logs(s){return Array.isArray(s?.logs?.splitVerifications)?s.logs.splitVerifications:[]}
  function latestForSplit(s,splitId){
    return logs(s).filter(v=>v&&txt(v.coreRuleId)===RULE&&txt(v.splitActionId)===txt(splitId))
      .slice().sort((a,b)=>txt(b.recordedAt||b.id).localeCompare(txt(a.recordedAt||a.id)))[0]||null;
  }
  function latestForTask(s,a){
    return latestForSplit(s,a?.sourceActionId||a?.evidenceChain?.splitActionId);
  }
  function escalationDate(s,a){
    const v=latestForTask(s,a);
    return txt(v?.date)||txt(v?.recordedAt).slice(0,10)||txt(a?.dueDate||a?.due||a?.date);
  }
  function normalizeTask(a,s){
    if(!isManagement(a))return a;
    const d=escalationDate(s,a);
    if(d){a.due=d;a.dueDate=d;a.date=d;}
    a.priority='High';
    a.evidenceChain=a.evidenceChain||{};
    a.evidenceChain.escalationDate=d||a.evidenceChain.escalationDate||'';
    return a;
  }

  /* 1) Normalize the dynamically projected R10 task at the Actions row source.
        This feeds the Actions card, A9 identity guard, and A7 task detail. */
  const prevRows=window.v53ActionRows||((typeof v53ActionRows==='function')?v53ActionRows:null);
  if(typeof prevRows==='function'){
    const wrappedRows=function(){
      const rows=prevRows.apply(this,arguments)||[];
      const s=S();
      return rows.map(a=>normalizeTask(a,s));
    };
    try{window.v53ActionRows=wrappedRows}catch(_){ }
    try{v53ActionRows=wrappedRows}catch(_){ }
  }

  function taskById(id){
    const wanted=decodeURIComponent(txt(id));
    try{
      const fn=window.v53ActionRows||((typeof v53ActionRows==='function')?v53ActionRows:null);
      const hit=typeof fn==='function'?(fn('Pending')||[]).find(a=>a&&txt(a.id)===wanted&&isR10(a)):null;
      if(hit)return normalizeTask(hit,S());
    }catch(_){ }
    return null;
  }

  /* 2) Evidence visibility. A5 already attempts this for all R10 details;
        A10 guarantees it for management-review even if an older render wrapper
        failed to inject. No duplicate is added when A5 is already visible. */
  function evidenceSection(v){
    const result=txt(v?.verificationResult)||'FAIL';
    return `<section class="vc" data-r10a10-escalation-evidence="1">
      <div class="vhead"><b>Latest Split Verification · escalation evidence</b><span class="v2p2e5r10-pill">${esc(result)}</span></div>
      <div class="v2p2e5r10-grid">
        <span>Date<b>${esc(v?.date||txt(v?.recordedAt).slice(0,10)||'Not recorded')}</b></span>
        <span>Days since split<b>${esc(v?.daysSinceSplit??'Not recorded')}</b></span>
        <span>Queen seen<b>${esc(v?.queenSeen||'Not assessed')}</b></span>
        <span>Eggs<b>${esc(v?.eggs||'Not assessed')}</b></span>
        <span>Young brood<b>${esc(v?.youngBrood||'Not assessed')}</b></span>
        <span>Colony strength<b>${esc(v?.colonyStrength||'Not assessed')}</b></span>
        <span>Food stores<b>${esc(v?.foodStores||'Not assessed')}</b></span>
        <span>Queen cells<b>${esc(v?.queenCells||'Not assessed')}</b></span>
        <span>Source hive status<b>${esc(v?.sourceHiveStatus||'Not assessed')}</b></span>
        <span>Result<b>${esc(result)}</b></span>
      </div>
      ${txt(v?.notes)?`<div class="v2p2e5r10-warning"><b>Notes</b><br>${esc(v.notes)}</div>`:''}
    </section>`;
  }
  function ensureEvidence(){
    const route=txt(location.hash||'').replace(/^#/,'').split('/');
    if(route[0]!=='scientific-action')return;
    const root=document.querySelector('.v2p2e5r10-detail');
    if(!root)return;
    const task=taskById(route[1]);
    if(!isManagement(task))return;
    if(root.querySelector('[data-r10a5-latest-verification], [data-r10a10-escalation-evidence]'))return;
    const v=latestForTask(S(),task);if(!v)return;
    const holder=document.createElement('div');holder.innerHTML=evidenceSection(v);
    const section=holder.firstElementChild;if(!section)return;
    const next=[...root.querySelectorAll('section.vc')].find(el=>txt(el.querySelector('.vhead b')?.textContent)==='What happens next');
    if(next)root.insertBefore(section,next);else root.appendChild(section);
  }

  const prevRender=window.render||((typeof render==='function')?render:null);
  if(typeof prevRender==='function'){
    const wrappedRender=function(){
      const ret=prevRender.apply(this,arguments);
      try{ensureEvidence()}catch(err){console.error('R10A10 evidence injection failed',err)}
      queueMicrotask(()=>{try{ensureEvidence()}catch(_){ }});
      return ret;
    };
    try{window.render=wrappedRender}catch(_){ }
    try{render=wrappedRender}catch(_){ }
  }
  try{
    const view=document.getElementById('view');
    if(view&&typeof MutationObserver!=='undefined'){
      new MutationObserver(()=>queueMicrotask(()=>{try{ensureEvidence()}catch(_){ }})).observe(view,{childList:true,subtree:true});
    }
  }catch(_){ }
  window.addEventListener?.('hashchange',()=>setTimeout(()=>{try{ensureEvidence()}catch(_){ }},0));

  /* 3) Safe R10 -> frozen B38 handoff. We seed only B38's existing draft
        fields. taskType is intentionally omitted, so no action (including
        Requeen) can be preselected. */
  window.v2p2e5r10ReviewQueen=function(actionId){
    const a=taskById(actionId);
    if(!a||!isManagement(a))return typeof toast==='function'?toast('This Split review is no longer active'):undefined;
    const due=txt(a.dueDate||a.due||a.date)||escalationDate(S(),a);
    window.__b38Draft={
      hiveId:txt(a.hiveId),
      source:'scientific-engine',
      reasonCode:'queen',
      dueDate:due,
      priority:'High'
      // DO NOT set taskType, queenSource, or introductionMethod.
    };
    if(typeof go==='function')return go('queen-action/new');
  };

  window.v2p2e5r10a10Audit=function(taskId=''){
    const s=S(),a=taskId?taskById(taskId):null,v=a?latestForTask(s,a):null;
    return {
      version:window.__HIVEDASH_V2P2E5R10A10_VERSION__,
      task:a?{id:a.id,hiveId:a.hiveId,title:a.title,stage:a.workflowStage,priority:a.priority,due:a.due}:null,
      latestVerification:v?{date:v.date,result:v.verificationResult,queenSeen:v.queenSeen,eggs:v.eggs,youngBrood:v.youngBrood,colonyStrength:v.colonyStrength,foodStores:v.foodStores,queenCells:v.queenCells,sourceHiveStatus:v.sourceHiveStatus}:null,
      b38Draft:window.__b38Draft||null
    };
  };

  queueMicrotask(()=>{try{ensureEvidence()}catch(_){ }});
  console.log('V2P2E5R10A10 LOADED | due + evidence + High Queen Management handoff closure active');
})();
