/* ==============================================================
   V2P2E5R05A — R05 / S12 CATALOG MIGRATION + FINAL CLOSURE

   Scope ONLY:
   - Preserve the frozen HD-R03 Varroa-management science and legacy Core rule id.
   - Add launch-catalog identity R05 / S12 to the existing rule/evaluation/projected tasks.
   - Keep HD-R03-VARROA-MANAGEMENT-DECISION as the internal compatibility id so
     historical rows, R04 monitoring handoff, S13/S14 treatment lifecycle, routes,
     evidence chains and duplicate suppression continue to resolve exactly as before.
   - No threshold, authority, evidence-quality rule, treatment lifecycle, route,
     priority, automation level or Treatment persistence is changed here.
   ============================================================== */
(function v2p2e5r05aCatalogMigration(){
  if(window.__HIVEDASH_V2P2E5R05A__)return;
  window.__HIVEDASH_V2P2E5R05A__=true;

  const LEGACY_CORE_RULE_ID='HD-R03-VARROA-MANAGEMENT-DECISION';
  const CATALOG_RULE_ID='R05';
  const CATALOG_TASK_ID='S12';
  const MIGRATION_VERSION='V2P2E5R05A';
  const VERSION='v2p2e5r05a-r05-s12-catalog-migration-final-closure';
  const txt=v=>String(v??'').trim();

  function isR05Task(a){
    if(!a||typeof a!=='object')return false;
    return txt(a.coreRuleId)===LEGACY_CORE_RULE_ID||
      txt(a.ruleRef?.ruleId)===LEGACY_CORE_RULE_ID||
      txt(a.legacyCoreRuleId)===LEGACY_CORE_RULE_ID;
  }

  function tagTask(a){
    if(!isR05Task(a))return a;
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
  const legacyRule=window.V2P2E5AX_VARROA_MANAGEMENT_RULE||
    (core&&typeof core.getRegisteredRule==='function'?core.getRegisteredRule(LEGACY_CORE_RULE_ID):null);

  if(legacyRule&&typeof legacyRule==='object'){
    const catalogRule=Object.freeze({
      ...legacyRule,
      catalogRuleId:CATALOG_RULE_ID,
      catalogTaskId:CATALOG_TASK_ID,
      legacyCoreRuleId:LEGACY_CORE_RULE_ID,
      catalogMigrationVersion:MIGRATION_VERSION
    });

    try{if(core&&typeof core.registerRule==='function')core.registerRule(catalogRule)}catch(err){console.error('V2P2E5R05A rule catalog registration failed',err)}

    if(core&&typeof core==='object'){
      try{
        window.HiveDashTaskEngineCoreV1=Object.freeze({
          ...core,
          varroaManagementRule:catalogRule,
          r05VarroaManagementRule:catalogRule
        });
      }catch(_){ }
    }

    window.V2P2E5AX_VARROA_MANAGEMENT_RULE=catalogRule;
    window.V2P2E5R05A_VARROA_MANAGEMENT_RULE=catalogRule;
  }

  const prevEval=window.v2p2e5axEvaluateVarroaManagement;
  if(typeof prevEval==='function'){
    window.v2p2e5axEvaluateVarroaManagement=function(hiveId){return tagEvaluation(prevEval(hiveId))};
    window.v2p2e5r05EvaluateVarroaManagement=function(hiveId){return tagEvaluation(prevEval(hiveId))};
  }

  const prevGenerate=window.generateActions||(typeof generateActions==='function'?generateActions:null);
  if(typeof prevGenerate==='function'){
    window.generateActions=function(s){return (prevGenerate(s)||[]).map(tagTask)};
    try{generateActions=window.generateActions}catch(_){ }
  }

  const prevRows=window.v53ActionRows||(typeof v53ActionRows==='function'?v53ActionRows:null);
  if(typeof prevRows==='function'){
    window.v53ActionRows=function(mode='Pending'){return (prevRows(mode)||[]).map(tagTask)};
    try{v53ActionRows=window.v53ActionRows}catch(_){ }
  }

  window.V2P2E5R05A_CATALOG=Object.freeze({
    version:VERSION,
    migrationVersion:MIGRATION_VERSION,
    catalogRuleId:CATALOG_RULE_ID,
    catalogTaskId:CATALOG_TASK_ID,
    legacyCoreRuleId:LEGACY_CORE_RULE_ID,
    scientificRuleChanged:false
  });
  window.__HIVEDASH_V2P2E5R05A_VERSION__=VERSION;
})();
