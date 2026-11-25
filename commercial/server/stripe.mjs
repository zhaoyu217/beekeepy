/** Verified Stripe events are the ONLY code path granting Pro entitlements.
 *  Payment, billing and refund API calls are disabled without secrets/config.
 */
import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';

export function verifyStripeEvent(raw, header, secret, time=Math.floor(Date.now()/1000)) {
  if (!secret || typeof header!=='string' || !Buffer.isBuffer(raw) || raw.length>1024*1024) throw Error('Stripe verification prerequisites missing');
  const parts=header.split(',').map(x=>x.trim().split('='));
  const t=parts.find(x=>x[0]==='t')?.[1];
  const signatures=parts.filter(x=>x[0]==='v1' && /^[0-9a-f]{64}$/.test(x[1]||'')).map(x=>Buffer.from(x[1],'hex'));
  if (!/^\d{10}$/.test(t||'') || Math.abs(time-Number(t))>300 || !signatures.length) throw Error('Invalid/expired webhook signature');
  const expected=createHmac('sha256',secret).update(`${t}.`).update(raw).digest();
  if(!signatures.some(x=>timingSafeEqual(x,expected))) throw Error('Invalid webhook signature');
  const parsed=JSON.parse(raw.toString('utf8'));
  if(!/^evt_[A-Za-z0-9]+$/.test(parsed?.id||'')||!Number.isInteger(parsed?.created)||!parsed?.data?.object) throw Error('Invalid Stripe event payload');
  return parsed;
}
const subscriptionId = value => /^sub_[A-Za-z0-9]+$/.test(value||'');
const customerId = value => /^cus_[A-Za-z0-9]+$/.test(value||'');
const money = value => Number.isSafeInteger(value) && value>=0 && value<=100000000;

function findUser(store,sub) {
  const embedded=sub?.metadata?.beekeepy_user_id;
  if(embedded && /^[\w-]{5,128}$/.test(embedded)) return embedded;
  const id=sub?.id;
  const customer=sub?.customer;
  // No cross-account transfer if customer is not yet unambiguously linked.
  if(subscriptionId(id)) {
    const match=store.get('SELECT user_id FROM subscription WHERE stripe_subscription_id=?',id);
    if(match) return match.user_id;
  }
  if(customerId(customer)) {
    const users=store.all('SELECT DISTINCT user_id FROM subscription WHERE stripe_customer_id=?',customer);
    if(users.length===1) return users[0].user_id;
  }
  return null;
}

export function applyVerifiedStripeEvent(store,event,{allowedPriceIds=[]}={}) {
  // A verified Stripe subscription does not imply this is a Beekeepy Pro product.
  const approved=new Set(allowedPriceIds.filter(x=>/^price_[A-Za-z0-9]+$/.test(x)));
  const supported=new Set(['checkout.session.completed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.payment_failed','charge.refunded']);
  if(!supported.has(event.type)) return {processed:false,reason:'unsupported'};
  return store.transaction(()=>{
    if(store.get('SELECT event_id FROM commerce_event WHERE event_id=?',event.id)) return {processed:false,reason:'duplicate'};
    const obj=event.data.object;
    const time=Number(event.created)||0;
    let result={processed:true,event_type:event.type};
    if(event.type==='checkout.session.completed') {
      const uid=obj.client_reference_id||obj.metadata?.beekeepy_user_id;
      if(!/^[\w-]{5,128}$/.test(uid||'')||!/^cs_[A-Za-z0-9_]+$/.test(obj.id||'')) throw Error('Verified checkout lacks valid account/session linkage');
      const total=obj.amount_total;
      if(!money(total))throw Error('Invalid checkout total');
      store.ensureAccount(uid);
      const oid='order_'+obj.id;
      store.sql('INSERT OR IGNORE INTO commerce_order VALUES (?,?,?,?,?,?,?,?)',oid,uid,obj.id,obj.payment_intent||null,total,String(obj.currency||'usd').toLowerCase().slice(0,8),obj.payment_status||'unpaid',store.now());
      // Checkout completion alone never grants Pro; wait for verified subscription event.
      result.order_id=oid;
    } else if(event.type.startsWith('customer.subscription.')) {
      if(!subscriptionId(obj.id)||!customerId(obj.customer)) throw Error('Verified subscription lacks valid IDs');
      const uid=findUser(store,obj);
      if(!uid)throw Error('Unlinked subscription; no entitlement change');
      const ownership=store.get('SELECT user_id FROM subscription WHERE stripe_subscription_id=?',obj.id);
      if(ownership && ownership.user_id!==uid) throw Error('Subscription ownership conflict');
      const existing=store.get('SELECT * FROM subscription WHERE user_id=?',uid);
      if(existing?.stripe_subscription_id && existing.stripe_subscription_id!==obj.id && existing.status!=='canceled') throw Error('Existing subscription requires explicit reconciliation');
      const incomingStatus=event.type.endsWith('.deleted')?'canceled':String(obj.status||'none').slice(0,30);
      const isGrant=['active','trialing'].includes(incomingStatus);
      const oldGrant=existing && ['active','trialing'].includes(existing.status) && existing.approved_price===1;
      // Stripe created timestamps have only second precision. Never let an
      // equal-time privilege grant overrule an already recorded downgrade.
      const stale=existing && (existing.stripe_event_time>time ||
        (existing.stripe_event_time===time && isGrant && !oldGrant));
      if(stale){result={processed:false,reason:'out_of_order_or_ambiguous'};}
      else {
        store.ensureAccount(uid);
        const status=incomingStatus;
        const recognized=['active','trialing','past_due','unpaid','canceled','incomplete','incomplete_expired','paused','none'];
        if(!recognized.includes(status))throw Error('Unknown subscription status');
        const item=obj.items?.data?.[0];
        const period=Number(obj.current_period_end || item?.current_period_end || 0);
        if(!Number.isSafeInteger(period)||period<0)throw Error('Invalid period');
        const priceId=item?.price?.id||null;
        const approvedPrice=approved.has(priceId)?1:0;
        store.sql(`INSERT INTO subscription(user_id,stripe_subscription_id,stripe_customer_id,status,price_id,approved_price,period_end,cancel_at_period_end,stripe_event_time,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
          stripe_subscription_id=excluded.stripe_subscription_id,stripe_customer_id=excluded.stripe_customer_id,status=excluded.status,
          price_id=excluded.price_id,approved_price=excluded.approved_price,period_end=excluded.period_end,cancel_at_period_end=excluded.cancel_at_period_end,
          stripe_event_time=excluded.stripe_event_time,updated_at=excluded.updated_at`,
          uid,obj.id,obj.customer,status,priceId,approvedPrice,period||null,obj.cancel_at_period_end?1:0,time,store.now());
        // Durable outbox: app_metadata sync must happen explicitly and be retried
        // until Supabase confirms; it must never silently change user hive data.
        const e=store.entitlement(uid, time);
        store.sql(`INSERT INTO entitlement_outbox(user_id,stripe_event_id,required_plan,synced_at,last_error,updated_at)
          VALUES(?,?,?,NULL,NULL,?) ON CONFLICT(user_id) DO UPDATE SET
          stripe_event_id=excluded.stripe_event_id,required_plan=excluded.required_plan,
          synced_at=NULL,last_error=NULL,updated_at=excluded.updated_at`,uid,event.id,e.plan,store.now());
        result.user_id=uid;
      }
    } else if(event.type==='invoice.payment_failed') {
      // Do not arbitrarily downgrade from an invoice event; Stripe subscription.updated is authoritative.
      result={processed:true,reason:'subscription_update_required'};
    } else if(event.type==='charge.refunded') {
      // Do not erase app records or modify subscription from a refund event.
      result={processed:true,reason:'record_only'};
    }
    store.sql('INSERT INTO commerce_event VALUES(?,?,?,?)',event.id,event.type,time,store.now());
    store.audit('stripe',`stripe:${event.type}`,event.id);
    return result;
  });
}

export async function stripePost(path, params, {secret, fetcher=fetch, idempotencyKey=randomUUID()}={}) {
  if(!/^sk_(test|live)_/.test(secret||''))throw Error('Stripe API not configured');
  const resp=await fetcher('https://api.stripe.com/v1/'+path,{
    method:'POST',headers:{authorization:`Bearer ${secret}`,'content-type':'application/x-www-form-urlencoded','idempotency-key':idempotencyKey},
    body:new URLSearchParams(params).toString(),signal:AbortSignal.timeout(12000)
  });
  const data=await resp.json();
  if(!resp.ok)throw Error('Stripe API request failed'); // Never leak provider secrets or PII.
  return data;
}
