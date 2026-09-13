/* ==============================================================
   HiveDash V2P2E5R09A4 — R09 FAIL detail evidence-layer correction

   Scope ONLY:
   - Do not change R09/S19 decision logic or persistence.
   - On the post-control FAIL management-review Task Detail, show the
     CURRENT Swarm Verification evidence that caused FAIL.
   - Keep pre-control high-risk evidence clearly separated as historical
     reference, so the user can audit why the task is still open.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R09A4__) return;
  window.__HIVEDASH_V2P2E5R09A4__=true;
  window.__HIVEDASH_V2P2E5R09A4_VERSION__='v2p2e5r09a4-current-verification-evidence-detail';

  const CORE='HD-R09S-SWARM-CONTROL-VERIFICATION';
  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const esc=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S=()=>{try{return typeof v45s==='function'?v45s():state()}catch(_){return null}};
  const hiveBy=(s,id)=>(s?.hives||[]).find(h=>h&&txt(h.id)===txt(id))||null;
  const actionById=(s,id)=>{try{return (typeof generateActions==='function'?(generateActions(s)||[]):[]).find(a=>a&&txt(a.id)===txt(id))||null}catch(_){return null}};
  const verById=(s,id)=>((s?.logs?.swarmVerifications||[]).find(v=>v&&txt(v.id)===txt(id))||null);

  function failDetail(a){
    const s=S(), h=hiveBy(s,a.hiveId), e=a.evidenceChain||{}, v=verById(s,e.verificationId);
    const current={
      date: txt(v?.date||e.verificationDate)||'Not recorded',
      queenCellStatus: txt(v?.queenCellStatus||e.currentQueenCellStatus)||'Not assessed',
      congestion: txt(v?.colonyCongestion||e.currentCongestion)||'Not assessed',
      broodSpace: txt(v?.broodNestSpace||e.currentBroodNestSpace)||'Not assessed',
      superSpace: txt(v?.superSpace||e.currentSuperSpace)||'Not assessed',
      swarmSigns: txt(v?.swarmSigns||e.currentSwarmSigns)||'Not assessed',
      queenSeen: txt(v?.queenSeen)||'Not assessed',
      result: txt(v?.verificationResult||e.verificationResult)||'FAIL'
    };
    return `<div class="vs v2p2e5r09-detail v2p2e5r09a4-detail">
      <section class="vc"><div class="vhead"><b>${esc(a.title)}</b><span class="v2p2e5r09-source">System</span></div><div class="v2p2e5r09-grid">
        <span>Hive<b>${esc(h?.name||'Unavailable')}</b></span><span>Stage<b>Review management</b></span><span>Priority<b>${esc(a.priority||'High')}</b></span><span>Due<b>${esc(a.due||'Review now')}</b></span>
      </div></section>
      <section class="vc"><div class="vhead"><b>Why this task exists</b></div><p>${esc(a.systemWhy||'New post-control Swarm Verification still shows high swarm risk.')}</p></section>
      <section class="vc"><div class="vhead"><b>Current Swarm Verification</b><span class="v2p2e5r09-pill">R09 · S19</span></div><div class="v2p2e5r09-grid">
        <span>Verification date<b>${esc(current.date)}</b></span><span>Result<b>${esc(current.result)}</b></span>
        <span>Queen cells<b>${esc(current.queenCellStatus)}</b></span><span>Congestion<b>${esc(current.congestion)}</b></span>
        <span>Brood-nest space<b>${esc(current.broodSpace)}</b></span><span>Super space<b>${esc(current.superSpace)}</b></span>
        <span>Swarm signs<b>${esc(current.swarmSigns)}</b></span><span>Queen seen<b>${esc(current.queenSeen)}</b></span>
      </div></section>
      <section class="vc"><div class="vhead"><b>Linked management & prior evidence</b></div><div class="v2p2e5r09-grid">
        <span>Original high-risk check<b>${esc(e.sourceCheckDate||'Not recorded')}</b></span><span>Control completed<b>${esc(e.completedDate||'Not recorded')}</b></span>
        <span>Actual method<b>${esc(e.actualMethod||'Not recorded')}</b></span><span>Recorded outcome<b>${esc(e.swarmOutcome||'Not recorded')}</b></span>
        <span>Queen-cell outcome<b>${esc(e.queenCellOutcome||'Not recorded')}</b></span><span>Follow-up date<b>${esc(e.followUpDate||'Not recorded')}</b></span>
        <span>Pre-control queen cells<b>${esc(e.queenCellStatus||'Not assessed')}</b></span><span>Pre-control congestion<b>${esc(e.colonyCongestion||'Not assessed')}</b></span>
        <span>Pre-control brood space<b>${esc(e.broodNestSpace||'Not assessed')}</b></span><span>Pre-control super space<b>${esc(e.superSpace||'Not assessed')}</b></span>
      </div><div class="v2p2e5r09-warning"><b>Evidence boundary</b><br>The management action and pre-control evidence are historical context. The current FAIL decision above is based on the new post-control Swarm Verification.</div></section>
      <section class="vc"><div class="vhead"><b>What happens next</b></div><p>Review the failed verification and choose the next management step only if appropriate. HiveDash will not automatically repeat the previous method.</p></section>
      <div class="v2p2e5r09-actions"><button class="secondary" onclick="go('actions')">Back</button><button class="primary" onclick="v2p2e5r09RepeatControl('${txt(a.id).replace(/'/g,"\\'")}')">Review Swarm Control</button></div>
    </div>`;
  }

  const prevRender=window.render||((typeof render==='function')?render:null);
  if(typeof prevRender==='function'){
    window.render=function(){
      const p=txt(location.hash||'#home').replace(/^#/,'').split('/');
      if(p[0]==='scientific-action'){
        const s=S(), a=actionById(s,txt(p[1]));
        if(a && txt(a.coreRuleId)===CORE && low(a.workflowStage)==='management-review' && low(a.verificationStatus)==='fail' && txt(a.evidenceChain?.verificationId)){
          const r=document.getElementById('view'); if(!r) return;
          r.className='view secondary'; r.innerHTML=failDetail(a);
          const top=document.getElementById('topbar');
          if(top){top.className='topbar vtop';top.innerHTML='<button class="iconbtn" onclick="go(\'actions\')" aria-label="Back">‹</button><div class="pagebar-title">Task Detail</div><span></span>'}
          document.getElementById('bottomnav')?.classList.add('hidden');
          return;
        }
      }
      return prevRender.apply(this,arguments);
    };
    try{render=window.render}catch(_){ }
  }

  console.log('V2P2E5R09A4 LOADED | R09 FAIL detail now shows current verification evidence');
})();
