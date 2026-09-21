/* ==============================================================
   HiveDash V2P2E5R09A5 — R09 post-B41 verification due fallback

   Proven regression fixed:
   - Frozen B41 intentionally stores NO followUpDate when the beekeeper sets
     Follow-up Required = No.
   - Frozen R09A3 then fell back to todayFor(...), which made the System
     "Recheck swarm risk" due on the same day as Swarm Control completion.
   - R09/S19 contract requires a post-control reassessment window; management
     completion is not biological resolution.

   Scope / frozen boundaries:
   - Projection-only timing correction for the INITIAL R09 follow-up task.
   - Does NOT modify B41 persistence, R08/R09 science, PASS/FAIL criteria,
     R11 ownership, routes, UI, or completed history.
   - Does NOT fabricate a B41 manual follow-up date. Evidence continues to
     display Follow-up date = Not recorded when the beekeeper selected No.
   - If B41 has an explicit follow-up date, that date remains authoritative.
   ============================================================== */
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R09A5__) return;
  window.__HIVEDASH_V2P2E5R09A5__=true;

  const VERSION='v2p2e5r09a5-post-b41-verification-due-fallback';
  const CORE='HD-R09S-SWARM-CONTROL-VERIFICATION';
  const TYPE='swarm-control';

  const txt=v=>String(v??'').trim();
  const low=v=>txt(v).toLowerCase();
  const dateOnly=v=>{
    const s=txt(v);
    const m=s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m?m[1]:'';
  };
  const addDays=(iso,n)=>{
    const m=txt(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return '';
    const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+Number(n||0)));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  };

  function sourceAction(s,id){
    const pools=[Array.isArray(s?.actions)?s.actions:[],Array.isArray(s?.meta?.completedActions)?s.meta.completedActions:[]];
    for(const p of pools){
      const a=p.find(x=>x&&txt(x.id)===txt(id));
      if(a)return a;
    }
    return null;
  }

  function completedDate(a){
    return dateOnly(a?.resultData?.completedDate)||dateOnly(a?.completedDate)||dateOnly(a?.completedAt);
  }

  function explicitFollowUp(a){
    return dateOnly(a?.resultData?.followUpDate)||dateOnly(a?.followUpDate);
  }

  function correctionFor(s,t){
    if(!t||txt(t.coreRuleId)!==CORE)return null;
    if(low(t.workflowStage)!=='follow-up'||low(t.intentKey)!=='swarm-verification')return null;
    // Only the initial post-B41 verification task. INCONCLUSIVE follow-up is a
    // different state and must not be silently retimed by this compatibility fix.
    if(low(t.title)!=='recheck swarm risk')return null;
    const a=sourceAction(s,t.sourceActionId);
    if(!a||low(a.type)!==TYPE)return null;
    if(!(low(a.status)==='completed'||low(a.priority)==='done'||a.resultData?.controlCompleted===true))return null;
    const explicit=explicitFollowUp(a);
    if(explicit)return null;
    const done=completedDate(a);
    if(!done)return null;
    const due=addDays(done,7);
    if(!due)return null;
    return {due,sourceAction:a,completedDate:done};
  }

  function correctTask(s,t){
    const c=correctionFor(s,t);
    if(!c)return t;
    // Keep evidenceChain.followUpDate untouched. It truthfully records that
    // B41 had no user-confirmed manual follow-up date.
    if(txt(t.due)===c.due&&txt(t.dueDate)===c.due)return t;
    return {...t,due:c.due,dueDate:c.due};
  }

  const prevGenerate=window.generateActions||((typeof generateActions==='function')?generateActions:null);
  if(typeof prevGenerate==='function'){
    window.generateActions=function(s){
      const out=prevGenerate(s)||[];
      if(!Array.isArray(out)||!out.length)return out;
      let changed=false;
      const next=out.map(t=>{
        const c=correctTask(s,t);
        if(c!==t)changed=true;
        return c;
      });
      return changed?next:out;
    };
    try{generateActions=window.generateActions}catch(_){ }
  }

  window.HiveDashR09A5=Object.freeze({version:VERSION,correctionFor,correctTask,addDays});
  window.__HIVEDASH_V2P2E5R09A5_VERSION__=VERSION;
  console.log('V2P2E5R09A5 LOADED | R09 initial post-B41 verification due fallback active');
})();
