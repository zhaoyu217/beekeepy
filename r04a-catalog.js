/* ==============================================================
   V2P2E5R04A — R04 / S11 CATALOG MIGRATION + FINAL CLOSURE

   Scope ONLY:
   - Preserve the frozen AW2 Varroa-monitoring science and legacy Core rule id.
   - Add launch-catalog identity R04 / S11 to the existing rule and projected tasks.
   - Keep HD-R02-VARROA-MONITORING as the internal compatibility id so historical
     records, duplicate suppression, R05/S12 handoff, S13/S14, routes and timelines
     continue to resolve exactly as before.
   - No monitoring interval, sampling method, sample-size gate, seasonal policy,
     suppression rule, route, priority or Treatment decision is changed here.
   ============================================================== */
(function v2p2e5r04aCatalogMigration(){
  if(window.__HIVEDASH_V2P2E5R04A__)return;
  window.__HIVEDASH_V2P2E5R04A__=true;

  const LEGACY_CORE_RULE_ID='HD-R02-VARROA-MONITORING';
  const CATALOG_RULE_ID='R04';
  const CATALOG_TASK_ID='S11';
  const MIGRATION_VERSION='V2P2E5R04A';
  const VERSION='v2p2e5r04a-r04-s11-catalog-migration-final-closure';
  const txt=v=>String(v??'').trim();

  function isR04Task(a){
    if(!a||typeof a!=='object')return false;
    return txt(a.coreRuleId)===LEGACY_CORE_RULE_ID||
      txt(a.ruleRef?.ruleId)===LEGACY_CORE_RULE_ID||
      txt(a.legacyCoreRuleId)===LEGACY_CORE_RULE_ID;
  }

  function tagTask(a){
    if(!isR04Task(a))return a;
    return {
      ...a,
      catalogRuleId:CATALOG_RULE_ID,
      catalogTaskId:CATALOG_TASK_ID,
      legacyCoreRuleId:LEGACY_CORE_RULE_ID,
      catalogRef:{...(a.catalogRef||{}),ruleId:CATALOG_RULE_ID,taskId:CATALOG_TASK_ID,migrationVersion:MIGRATION_VERSION},
      ruleRef:{...(a.ruleRef||{}),catalogRuleId:CATALOG_RULE_ID,catalogTaskId:CATALOG_TASK_ID,legacyCoreRuleId:LEGACY_CORE_RULE_ID}
    };
  }

  function tagEvaluation(ev){
    if(!ev||typeof ev!=='object')return ev;
    return {
      ...ev,
      catalogRuleId:CATALOG_RULE_ID,
      catalogTaskId:CATALOG_TASK_ID,
      legacyCoreRuleId:LEGACY_CORE_RULE_ID,
      task:ev.task?tagTask(ev.task):ev.task
    };
  }

  const core=window.HiveDashTaskEngineCoreV1;
  const legacyRule=window.V2P2E5AW_VARROA_MONITORING_RULE||
    (core&&typeof core.getRegisteredRule==='function'?core.getRegisteredRule(LEGACY_CORE_RULE_ID):null);

  if(legacyRule&&typeof legacyRule==='object'){
    const catalogRule=Object.freeze({
      ...legacyRule,
      catalogRuleId:CATALOG_RULE_ID,
      catalogTaskId:CATALOG_TASK_ID,
      legacyCoreRuleId:LEGACY_CORE_RULE_ID,
      catalogMigrationVersion:MIGRATION_VERSION
    });

    try{if(core&&typeof core.registerRule==='function')core.registerRule(catalogRule)}catch(err){console.error('V2P2E5R04A rule catalog registration failed',err)}

    if(core&&typeof core==='object'){
      try{
        window.HiveDashTaskEngineCoreV1=Object.freeze({
          ...core,
          varroaMonitoringRule:catalogRule,
          r04VarroaMonitoringRule:catalogRule
        });
      }catch(_){ }
    }

    window.V2P2E5AW_VARROA_MONITORING_RULE=catalogRule;
    window.V2P2E5R04A_VARROA_MONITORING_RULE=catalogRule;
  }

  const prevEval=window.v2p2e5awEvaluateVarroaMonitoring;
  if(typeof prevEval==='function'){
    window.v2p2e5awEvaluateVarroaMonitoring=function(hiveId){return tagEvaluation(prevEval(hiveId))};
    window.v2p2e5r04EvaluateVarroaMonitoring=function(hiveId){return tagEvaluation(prevEval(hiveId))};
  }

  const prevGenerate=window.generateActions||(typeof generateActions==='function'?generateActions:null);
  if(typeof prevGenerate==='function'){
    window.generateActions=function(s){return (prevGenerate(s)||[]).map(tagTask)};
    try{generateActions=window.generateActions}catch(_){ }
  }

  window.V2P2E5R04A_CATALOG=Object.freeze({
    version:VERSION,
    migrationVersion:MIGRATION_VERSION,
    catalogRuleId:CATALOG_RULE_ID,
    catalogTaskId:CATALOG_TASK_ID,
    legacyCoreRuleId:LEGACY_CORE_RULE_ID,
    scientificRuleChanged:false
  });
  window.__HIVEDASH_V2P2E5R04A_VERSION__=VERSION;
})();
