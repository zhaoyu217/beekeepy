/** Review-only isolated target planner: produces proposed evidence changes.
 * No direct write methods, no database connections, no Supabase credentials.
 */
export function planIsolatedReview(snapshot,{expectedOrigin,existingKeys=[]}={}){
  if(snapshot?.format!=='beekeepy-raw-preservation-candidate-v0'||!snapshot.coverage?.complete)return {blocked:true,reason:'invalid_or_incomplete_capture'};
  if(!expectedOrigin||snapshot.source.origin!==expectedOrigin)return {blocked:true,reason:'origin_mismatch'};
  const existing=new Set(existingKeys);
  const additions=[],conflicts=[];
  for(const e of snapshot.entries){
    const key=JSON.stringify([e.surface,e.location,e.key]);
    if(existing.has(key))conflicts.push(key);else additions.push(key);
  }
  return {blocked:conflicts.length>0,reason:conflicts.length?'manual_conflict_review_required':null,additions,conflicts,writeAuthorized:false,source:snapshot.source};
}
