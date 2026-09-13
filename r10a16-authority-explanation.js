/* ================================================================
   HiveDash V2P2E5R10A16 — R10/S21 Authority Explanation Cleanup

   SCOPE ONLY:
   - Presentation/wording only on the R10 scientific-action detail page.
   - When Path source is "Child path confirmation":
       1) Replace stale "Plan / actual conflict" explanation with
          "Child-path confirmation controls".
       2) Replace stale unresolved "Path boundary" warning with an
          explanation that timing is based on the confirmed child path,
          and, for Introduced queen, the actual introduction-date-derived
          verification window.
   - Do NOT alter timing, evidence, persistence, routing, B39, B38,
     or any already-PASS R10 logic.
   ================================================================ */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R10A16_AUTHORITY_EXPLANATION__) return;
  window.__HIVEDASH_V2P2E5R10A16_AUTHORITY_EXPLANATION__=true;
  window.__HIVEDASH_V2P2E5R10A16_VERSION__='v2p2e5r10a16-authority-explanation-cleanup';

  const text=v=>String(v??'').trim();

  function gridValueByLabel(root,label){
    if(!root) return '';
    const spans=[...root.querySelectorAll('.v2p2e5r10-grid span')];
    const row=spans.find(s=>{
      const clone=s.cloneNode(true);
      clone.querySelectorAll('b').forEach(b=>b.remove());
      return text(clone.textContent)===label;
    });
    return text(row?.querySelector('b')?.textContent);
  }

  function setGridValueByLabel(root,label,value){
    if(!root) return false;
    const spans=[...root.querySelectorAll('.v2p2e5r10-grid span')];
    const row=spans.find(s=>{
      const clone=s.cloneNode(true);
      clone.querySelectorAll('b').forEach(b=>b.remove());
      return text(clone.textContent)===label;
    });
    const b=row?.querySelector('b');
    if(!b) return false;
    b.textContent=value;
    return true;
  }

  function patchAuthorityExplanation(){
    const route=text(location.hash).replace(/^#/,'').split('/')[0];
    if(route!=='scientific-action') return;
    const detail=document.querySelector('.v2p2e5r10-detail');
    if(!detail) return;

    const source=gridValueByLabel(detail,'Path source');
    if(source!=='Child path confirmation') return;

    // 1) Authority explanation: the later explicit child-path confirmation
    // is the active R10 authority. The completed Split result remains history.
    setGridValueByLabel(detail,'Plan / actual conflict','Child-path confirmation controls');

    // 2) Replace stale unresolved-path warning with confirmed-path timing text.
    const queenPath=gridValueByLabel(detail,'Queen path');
    const start=gridValueByLabel(detail,'Queen-right verification start');
    const finalDate=gridValueByLabel(detail,'Final queen-right window');
    const warnings=[...detail.querySelectorAll('.v2p2e5r10-warning')];
    const warning=warnings.find(w=>/Path boundary|child-hive queen path is not recorded precisely enough/i.test(text(w.textContent)));
    if(!warning) return;

    if(/introduced queen/i.test(queenPath)){
      warning.innerHTML='<b>Confirmed child-path timing</b><br>'+
        'Child-path confirmation is the active timing authority. Verification timing is based on the actual queen introduction date recorded for this child hive, not the Split date or old B39 follow-up.'+
        (start&&finalDate?` Current verification window: ${start} to ${finalDate}.`: '');
    }else{
      warning.innerHTML='<b>Confirmed child-path authority</b><br>'+
        'Child-path confirmation is the active R10 authority for this child hive. The completed Split result and earlier plan remain historical context and do not override the confirmed child path.';
    }
  }

  const prevRender=window.render||((typeof render==='function')?render:null);
  if(typeof prevRender==='function'){
    window.render=function(){
      const out=prevRender.apply(this,arguments);
      patchAuthorityExplanation();
      return out;
    };
    try{render=window.render}catch(_){ }
  }

  // Harmless catch-up for a page already rendered before this file executes.
  patchAuthorityExplanation();

  console.log('V2P2E5R10A16 LOADED | authority explanation cleanup only');
})();
