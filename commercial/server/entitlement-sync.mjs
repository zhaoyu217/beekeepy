/** Disabled by default. Explicitly applies verified Stripe-derived entitlement
 * to Supabase Auth app_metadata (the only authority read by existing app.js).
 * Never runs automatically during a QA reconstruction.
 */
export async function synchronizeEntitlements(store,{url,key,fetcher=fetch,explicitAuthorization=false}={}){
  if(!explicitAuthorization)throw Error('Supabase changes require explicit authorization');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url||'')||!/^eyJ|^sb_secret_/.test(key||''))
    throw Error('Service-role Supabase credentials required');
  const base=url.replace(/\/$/,'')+'/auth/v1/admin/users/';
  const rows=store.all('SELECT * FROM entitlement_outbox WHERE synced_at IS NULL ORDER BY updated_at LIMIT 100');
  const results=[];
  for(const row of rows){
    try {
      const sub=store.get('SELECT * FROM subscription WHERE user_id=?',row.user_id);
      const ent=store.entitlement(row.user_id);
      const headers={apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'};
      // Preserve unrelated app_metadata keys by reading current server record first.
      const existingResp=await fetcher(base+encodeURIComponent(row.user_id),{headers,signal:AbortSignal.timeout(8000)});
      if(!existingResp.ok)throw Error('Failed to read existing auth metadata');
      const user=await existingResp.json();
      const old=user.app_metadata||{};
      const next={...old,
        hivedash_plan:ent.plan,
        hivedash_subscription_status:ent.status,
        hivedash_entitlement_source:ent.plan==='Pro'?'stripe':'none',
        stripe_subscription_id:sub?.stripe_subscription_id||null
      };
      const updateResp=await fetcher(base+encodeURIComponent(row.user_id),{
        method:'PUT',headers,body:JSON.stringify({app_metadata:next}),signal:AbortSignal.timeout(8000)
      });
      if(!updateResp.ok)throw Error('Supabase entitlement update rejected');
      // No success marking if newer Stripe event arrived during await.
      store.sql('UPDATE entitlement_outbox SET synced_at=?,last_error=NULL WHERE user_id=? AND stripe_event_id=?',store.now(),row.user_id,row.stripe_event_id);
      results.push({user_id:row.user_id,status:'synced'});
    }catch(e){
      store.sql('UPDATE entitlement_outbox SET last_error=? WHERE user_id=? AND stripe_event_id=?','sync_failed',row.user_id,row.stripe_event_id);
      results.push({user_id:row.user_id,status:'blocked'});
    }
  }
  return results;
}
