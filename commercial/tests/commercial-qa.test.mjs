import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {Readable,Writable} from 'node:stream';
import {openStore} from '../server/db.mjs';
import {verifyStripeEvent,applyVerifiedStripeEvent as applyStripeEvent,stripePost} from '../server/stripe.mjs';
import {encodeAdminPassword,checkAdminPassword,totpAt,verifyTotp,createSession,validateSession,verifySupabaseAccessToken} from '../server/auth.mjs';
import {synchronizeEntitlements} from '../server/entitlement-sync.mjs';
import {createCommercialApp} from '../server/app.mjs';
const applyVerifiedStripeEvent=(store,event)=>applyStripeEvent(store,event,{allowedPriceIds:['price_test123']});
const USER='11111111-2222-4333-8444-555555555555';
const OTHER='99999999-2222-4333-8444-555555555555';
const TIME=1795400000;
const date=()=>TIME*1000;
let nextId=0;
function event(type,object,created=TIME,id){return {id:id||'evt_test'+(++nextId),type,created,data:{object}};}
function sub(status='active',extras={}){return {id:'sub_test123',customer:'cus_test123',status,metadata:{beekeepy_user_id:USER},current_period_end:TIME+50000,items:{data:[{price:{id:'price_test123'}}]},...extras};}
function signed(evt,secret='whsec_test',t=TIME){const raw=Buffer.from(JSON.stringify(evt));const digest=createHmac('sha256',secret).update(`${t}.`).update(raw).digest('hex');return {raw,header:`t=${t},v1=${digest}`};}
const newStore=()=>openStore();
function withStore(fn){const s=newStore();try{return fn(s)}finally{s.close()}}
async function fakeRequest(handler,path,{method='GET',body,headers={},remoteAddress='127.0.0.1'}={}) {
 const req=Readable.from(body===undefined?[]:[typeof body==='string'?body:JSON.stringify(body)]);
 req.method=method;req.url=path;req.headers={host:'localhost:8443',origin:'https://localhost:8443',...headers};req.socket={remoteAddress};
 const parts=[];const res=new Writable({write(chunk,enc,cb){parts.push(Buffer.from(chunk));cb();}});res.writeHead=(status,h)=>{res.statusCode=status;res.headers={...res.headers,...h};return res;};
 res.setHeader=(k,v)=>{res.headers??={};res.headers[k]=v;};
 res.end=(data)=>{if(data)parts.push(Buffer.from(data));res._qaEnded=true;};
 await handler(req,res);const raw=Buffer.concat(parts).toString('utf8');return {status:res.statusCode||200,headers:res.headers,json:raw?JSON.parse(raw):null,raw};
}
test('free default, no subscription',()=>withStore(s=>{s.ensureAccount(USER);assert.equal(s.entitlement(USER).plan,'Free');}));
test('app state/user metadata cannot independently grant Pro',()=>withStore(s=>{s.ensureAccount(USER);s.sql('UPDATE account SET email=? WHERE user_id=?','Pro',USER);assert.equal(s.entitlement(USER).plan,'Free');}));
test('HMAC valid event signature verifies',()=>{const e=event('charge.refunded',{id:'ch_test'});const x=signed(e);assert.deepEqual(verifyStripeEvent(x.raw,x.header,'whsec_test',TIME),e);});
test('HMAC tampered body fails',()=>{const e=event('charge.refunded',{id:'ch_test'});const x=signed(e);assert.throws(()=>verifyStripeEvent(Buffer.from('{}'),x.header,'whsec_test',TIME));});
test('expired HMAC fails',()=>{const x=signed(event('charge.refunded',{id:'ch_test'}));assert.throws(()=>verifyStripeEvent(x.raw,x.header,'whsec_test',TIME+301));});
test('missing HMAC fails closed',()=>{assert.throws(()=>verifyStripeEvent(Buffer.from('{}'),'', '', TIME));});
test('malformed event cannot be parsed as valid payment',()=>{const x=signed({id:'oops',data:{}});assert.throws(()=>verifyStripeEvent(x.raw,x.header,'whsec_test',TIME));});
test('checkout completion creates order but DOES NOT grant Pro',()=>withStore(s=>{const e=event('checkout.session.completed',{id:'cs_test_a',client_reference_id:USER,amount_total:4200,currency:'usd',payment_status:'paid',payment_intent:'pi_test123'});const r=applyVerifiedStripeEvent(s,e);assert.equal(r.processed,true);assert.equal(s.all('SELECT * FROM commerce_order').length,1);assert.equal(s.entitlement(USER).plan,'Free');}));
test('verified subscription active grants Pro',()=>withStore(s=>{const r=applyVerifiedStripeEvent(s,event('customer.subscription.created',sub()));assert.equal(r.user_id,USER);assert.equal(s.entitlement(USER,TIME).plan,'Pro');}));
test('verified trialing grants Pro',()=>withStore(s=>{applyVerifiedStripeEvent(s,event('customer.subscription.created',sub('trialing')));assert.equal(s.entitlement(USER,TIME).plan,'Pro');}));
test('payment past_due revokes Pro without deletion',()=>withStore(s=>{applyVerifiedStripeEvent(s,event('customer.subscription.created',sub()));s.sql('INSERT INTO ticket VALUES (?,?,?,?,?,?)','ticket_1',USER,'A','B','open',s.now());applyVerifiedStripeEvent(s,event('customer.subscription.updated',sub('past_due'),TIME+2));assert.equal(s.entitlement(USER,TIME+3).plan,'Free');assert.equal(s.all('SELECT * FROM ticket').length,1);assert.equal(s.all('SELECT * FROM account').length,1);}));
test('cancel_at_period_end does not delete data or immediately downgrade',()=>withStore(s=>{applyVerifiedStripeEvent(s,event('customer.subscription.created',sub()));applyVerifiedStripeEvent(s,event('customer.subscription.updated',sub('active',{cancel_at_period_end:true}),TIME+4));assert.equal(s.entitlement(USER,TIME+5).plan,'Pro');assert.equal(s.entitlement(USER,TIME+60000).plan,'Free');}));
test('subscription.deleted revokes Pro; archived user remains',()=>withStore(s=>{applyVerifiedStripeEvent(s,event('customer.subscription.created',sub()));applyVerifiedStripeEvent(s,event('customer.subscription.deleted',sub('active'),TIME+10));assert.equal(s.entitlement(USER,TIME+11).plan,'Free');assert.equal(s.all('SELECT * FROM account').length,1);}));
test('webhook idempotency: same event cannot change state twice',()=>withStore(s=>{const e=event('customer.subscription.created',sub());assert.equal(applyVerifiedStripeEvent(s,e).processed,true);assert.equal(applyVerifiedStripeEvent(s,e).reason,'duplicate');assert.equal(s.all('SELECT * FROM commerce_event').length,1);}));
test('out-of-order event cannot downgrade newer entitlement',()=>withStore(s=>{applyVerifiedStripeEvent(s,event('customer.subscription.created',sub('active'),TIME+10));const r=applyVerifiedStripeEvent(s,event('customer.subscription.updated',sub('canceled'),TIME+2));assert.equal(r.reason,'out_of_order_or_ambiguous');assert.equal(s.entitlement(USER,TIME).plan,'Pro');}));
test('subscription customer cannot be silently transferred',()=>withStore(s=>{applyVerifiedStripeEvent(s,event('customer.subscription.created',sub()));assert.throws(()=>applyVerifiedStripeEvent(s,event('customer.subscription.updated',sub('active',{metadata:{beekeepy_user_id:OTHER}}),TIME+2)));assert.equal(s.entitlement(USER,TIME).plan,'Pro');assert.equal(s.all('SELECT * FROM account').length,1);}));
test('unknown subscription link blocked, not free-to-Pro',()=>withStore(s=>{assert.throws(()=>applyVerifiedStripeEvent(s,event('customer.subscription.created',sub('active',{metadata:{}}))));assert.equal(s.all('SELECT * FROM account').length,0);}));
test('refund event never deletes hive/customer records',()=>withStore(s=>{s.ensureAccount(USER);applyVerifiedStripeEvent(s,event('charge.refunded',{id:'ch_test',refunded:true}));assert.equal(s.all('SELECT * FROM account').length,1);assert.equal(s.entitlement(USER).plan,'Free');}));
test('invoice.payment_failed does not forge subscription status',()=>withStore(s=>{applyVerifiedStripeEvent(s,event('customer.subscription.created',sub()));applyVerifiedStripeEvent(s,event('invoice.payment_failed',{id:'in_test'},TIME+1));assert.equal(s.entitlement(USER,TIME+2).plan,'Pro');}));
test('outbox is created for verified subscription change',()=>withStore(s=>{applyVerifiedStripeEvent(s,event('customer.subscription.created',sub()));const o=s.get('SELECT * FROM entitlement_outbox WHERE user_id=?',USER);assert.equal(o.required_plan,'Pro');assert.equal(o.synced_at,null);}));
test('admin scrypt roundtrip and no default fallback',()=>{const hash=encodeAdminPassword('Strong!QA.password');assert(checkAdminPassword('Strong!QA.password',hash));assert(!checkAdminPassword('wrong',hash));assert(!checkAdminPassword('Strong!QA.password',''));});
test('TOTP RFC6238 6 digit vector',()=>{assert.equal(totpAt('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',Math.floor(59/30)), '287082');});
test('TOTP replay denied across attempts',()=>withStore(s=>{const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';const clock=TIME*1000;const t=Math.floor(clock/30000);const code=totpAt(secret,t);assert(verifyTotp(s,code,secret,clock));assert(!verifyTotp(s,code,secret,clock));}));
test('admin cookie session and anti-CSRF token',()=>withStore(s=>{const a=createSession(s,1000);assert(validateSession(s,a.token,a.csrf,1001));assert(!validateSession(s,a.token,'wrong',1001));assert(!validateSession(s,a.token,a.csrf,1000+4*3600000+1));}));
test('Supabase bearer fails closed without service configured',async()=>{assert.equal(await verifySupabaseAccessToken('user_generated_token'),null);});
test('Supabase rejects unverified token',async()=>{const u=await verifySupabaseAccessToken('fake',{url:'https://demo.supabase.co',key:'sb_publishable_test',fetcher:async()=>({ok:false})});assert.equal(u,null);});
test('Supabase accepts only remotely verified user subject',async()=>{const u=await verifySupabaseAccessToken('real',{url:'https://demo.supabase.co',key:'sb_publishable_test',fetcher:async()=>({ok:true,json:async()=>({id:USER,email:'qa@example.test'})})});assert.equal(u.id,USER);});
test('Stripe live API disabled without explicit secret',async()=>{await assert.rejects(stripePost('refunds',{payment_intent:'pi_test'}),/not configured/);});
test('Supabase entitlement sync never runs without explicit authorization',async()=>{const s=newStore();try{await assert.rejects(synchronizeEntitlements(s),/explicit authorization/);}finally{s.close();}});
test('Supabase entitlement sync merges old app_metadata keys',async()=>{const s=newStore();try{
  const e=event('customer.subscription.created',sub('active',{current_period_end:Math.floor(Date.now()/1000)+86400}));applyVerifiedStripeEvent(s,e);
  const calls=[];const fetcher=async(url,opt)=>{calls.push({url,opt});if(!opt.method)return {ok:true,json:async()=>({app_metadata:{other_role:'keep_me',hivedash_plan:'Free'}})};return {ok:true,json:async()=>({id:USER})};};
  const out=await synchronizeEntitlements(s,{url:'https://demo.supabase.co',key:'sb_secret_example',fetcher,explicitAuthorization:true});
  assert.equal(out[0].status,'synced');assert.equal(calls.length,2);
  const update=JSON.parse(calls[1].opt.body).app_metadata;
  assert.equal(update.other_role,'keep_me');assert.equal(update.hivedash_plan,'Pro');assert.equal(update.hivedash_entitlement_source,'stripe');
}finally{s.close();}});
test('QA API healthcheck discloses non-production',async()=>{const s=newStore();try{const a=createCommercialApp({store:s});const out=await fakeRequest(a.handler,'/healthz');assert.equal(out.status,200);assert.equal(out.json.production_ready,false);}finally{s.close();}});
test('QA admin API denied without TOTP session',async()=>{const s=newStore();try{const {handler}=createCommercialApp({store:s});const out=await fakeRequest(handler,'/api/admin/summary');assert.equal(out.status,401);}finally{s.close();}});
test('QA user API denied without remotely verified Supabase bearer',async()=>{const s=newStore();try{const {handler}=createCommercialApp({store:s});const out=await fakeRequest(handler,'/api/account/profile');assert.equal(out.status,401);}finally{s.close();}});
test('QA admin login requires password and TOTP, generates secure cookie',async()=>{const s=newStore();try{
 const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';const env={BEE_ADMIN_PASSWORD_SCRYPT:encodeAdminPassword('abc123Strong'),BEE_ADMIN_TOTP_SECRET:secret};
 const {handler}=createCommercialApp({store:s,env,clock:date});
 const no=await fakeRequest(handler,'/api/admin/login',{method:'POST',body:{password:'abc123Strong',totp:'000000'}});
 assert.equal(no.status,401);
 const yes=await fakeRequest(handler,'/api/admin/login',{method:'POST',body:{password:'abc123Strong',totp:totpAt(secret,Math.floor(TIME/30))}});
 assert.equal(yes.status,200);assert.match(yes.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
 const token=/beekeepy_qa_admin=([^;]+)/.exec(yes.headers['Set-Cookie'])[1];
 const ok=await fakeRequest(handler,'/api/admin/summary',{headers:{cookie:`beekeepy_qa_admin=${token}`}});
 assert.equal(ok.status,200);
 const bad=await fakeRequest(handler,'/api/admin/refunds',{method:'POST',body:{},headers:{cookie:`beekeepy_qa_admin=${token}`,'x-csrf-token':'invalid'}});
 assert.equal(bad.status,401);
}finally{s.close();}});
test('webhook signature required before changing any entitlements',async()=>{const s=newStore();try{const {handler}=createCommercialApp({store:s,env:{STRIPE_WEBHOOK_SECRET:'whsec_test',STRIPE_PRO_PRICE_IDS:'price_test123'},clock:date});const ev=event('customer.subscription.created',sub());const denied=await fakeRequest(handler,'/api/stripe/webhook',{method:'POST',body:ev});assert.equal(denied.status,400);assert.equal(s.all('SELECT * FROM subscription').length,0);const sig=signed(ev);const good=await fakeRequest(handler,'/api/stripe/webhook',{method:'POST',body:sig.raw.toString('utf8'),headers:{'stripe-signature':sig.header}});assert.equal(good.status,200);assert.equal(s.entitlement(USER,TIME).plan,'Pro');}finally{s.close();}});
test('user subscription events cannot directly mutate hive state',()=>withStore(s=>{const tables=s.all("SELECT name FROM sqlite_master WHERE type='table'").map(x=>x.name);for(const original of ['app_state','hivedash_v9','accounts','snapshots','outbox','conflicts'])assert(!tables.includes(original));}));
test('QA platform refuses cross-origin administrator login',async()=>{const s=newStore();try{const {handler}=createCommercialApp({store:s});const x=await fakeRequest(handler,'/api/admin/login',{method:'POST',body:{},headers:{origin:'https://evil.example'}});assert.equal(x.status,403);}finally{s.close();}});
test('QA default rejects checkout without user session and configured Stripe',async()=>{const s=newStore();try{const {handler}=createCommercialApp({store:s});const x=await fakeRequest(handler,'/api/account/checkout',{method:'POST',body:{price_id:'price_fake'}});assert.equal(x.status,401);}finally{s.close();}});

test('valid Stripe event for unrelated price cannot unlock Pro',()=>withStore(s=>{applyStripeEvent(s,event('customer.subscription.created',sub('active',{items:{data:[{price:{id:'price_unrelated'}}]}})),{allowedPriceIds:['price_test123']});assert.equal(s.entitlement(USER,TIME).plan,'Free');}));
test('missing approved price list never unlocks Pro',()=>withStore(s=>{applyStripeEvent(s,event('customer.subscription.created',sub()),{});assert.equal(s.entitlement(USER,TIME).plan,'Free');}));
test('same-timestamp stale active event cannot override cancellation',()=>withStore(s=>{applyVerifiedStripeEvent(s,event('customer.subscription.created',sub('active'),TIME));applyVerifiedStripeEvent(s,event('customer.subscription.deleted',sub('canceled'),TIME));assert.equal(s.entitlement(USER,TIME).plan,'Free');const result=applyVerifiedStripeEvent(s,event('customer.subscription.updated',sub('active'),TIME));assert.equal(result.reason,'out_of_order_or_ambiguous');assert.equal(s.entitlement(USER,TIME).plan,'Free');}));
test('live Stripe event blocked by QA endpoint even with valid signature',async()=>{const store=newStore();try{const {handler}=createCommercialApp({store,env:{STRIPE_WEBHOOK_SECRET:'whsec_test',STRIPE_PRO_PRICE_IDS:'price_test123'},clock:date});const sig=signed({...event('customer.subscription.created',sub()),livemode:true});const out=await fakeRequest(handler,'/api/stripe/webhook',{method:'POST',body:sig.raw.toString('utf8'),headers:{'stripe-signature':sig.header}});assert.equal(out.status,403);assert.equal(store.all('SELECT * FROM subscription').length,0);}finally{store.close();}});

test('account checkout requires verified Supabase identity and approved Stripe price',async()=>{
 const s=newStore(),called=[];
 try{
  const env={SUPABASE_URL:'https://demo.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',
    STRIPE_SECRET_KEY:'sk_test_mock',STRIPE_PRO_PRICE_IDS:'price_test123',BEE_PUBLIC_ORIGIN:'https://127.0.0.1:8443'};
  const fetcher=async(url,opts)=>{
    called.push({url,opts});
    if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id:USER,email:'u@example.test'})};
    if(url.endsWith('/checkout/sessions'))return {ok:true,json:async()=>({id:'cs_test_ABC',url:'https://checkout.stripe.com/c/pay/cs_test_ABC'})};
    throw Error('unexpected network request');
  };
  const {handler}=createCommercialApp({store:s,env,fetcher});
  const denied=await fakeRequest(handler,'/api/account/checkout',{method:'POST',headers:{authorization:'Bearer valid'},body:{price_id:'price_wrong'}});
  assert.equal(denied.status,400);assert.equal(called.filter(x=>x.url.endsWith('/checkout/sessions')).length,0);
  const allowed=await fakeRequest(handler,'/api/account/checkout',{method:'POST',headers:{authorization:'Bearer valid'},body:{price_id:'price_test123'}});
  assert.equal(allowed.status,200);assert.match(allowed.json.checkout_url,/stripe\.com/);
  const req=called.find(x=>x.url.endsWith('/checkout/sessions'));
  assert.equal(new URLSearchParams(req.opts.body).get('client_reference_id'),USER);
  assert.equal(s.entitlement(USER).plan,'Free');
 }finally{s.close();}
});

test('account cancel request waits for signed Stripe webhook before changing membership',async()=>{
 const s=newStore();try{
  applyVerifiedStripeEvent(s,event('customer.subscription.created',sub('active',{current_period_end:Math.floor(Date.now()/1000)+86400})));
  const fetcher=async(url,opts)=>{
    if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id:USER})};
    if(url.includes('/subscriptions/sub_test123'))return {ok:true,json:async()=>({id:'sub_test123',cancel_at_period_end:true})};
    throw Error('unexpected remote');
  };
  const env={SUPABASE_URL:'https://demo.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',STRIPE_SECRET_KEY:'sk_test_mock'};
  const {handler}=createCommercialApp({store:s,env,fetcher});
  const out=await fakeRequest(handler,'/api/account/cancel',{method:'POST',headers:{authorization:'Bearer valid'},body:{}});
  assert.equal(out.status,200);assert.equal(out.json.pending_webhook,true);
  assert.equal(s.entitlement(USER).plan,'Pro');
 }finally{s.close();}
});

test('account tickets are bound to remotely verified Supabase user ID',async()=>{
 const s=newStore();try{
  const {handler}=createCommercialApp({store:s,env:{SUPABASE_URL:'https://demo.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'},fetcher:async()=>({ok:true,json:async()=>({id:USER,email:'qa@example.test'})})});
  const x=await fakeRequest(handler,'/api/account/tickets',{method:'POST',headers:{authorization:'Bearer signed'},body:{subject:'Hive data report',message:'Please do not delete history'}});
  assert.equal(x.status,201);
  assert.equal(s.get('SELECT user_id FROM ticket WHERE ticket_id=?',x.json.ticket_id).user_id,USER);
 }finally{s.close();}
});

test('admin refund requires signed session, CSRF and explicit confirmation; data remains untouched',async()=>{
 const s=newStore();try{
  const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';const env={BEE_ADMIN_PASSWORD_SCRYPT:encodeAdminPassword('refund-QA-only'),BEE_ADMIN_TOTP_SECRET:secret,STRIPE_SECRET_KEY:'sk_test_mock'};
  let stripeCalls=0;
  const {handler}=createCommercialApp({store:s,env,clock:date,fetcher:async(url)=>{stripeCalls++;assert.match(url,/api\.stripe\.com\/v1\/refunds/);return {ok:true,json:async()=>({id:'re_test123',status:'pending'})};}});
  s.ensureAccount(USER);
  s.sql('INSERT INTO commerce_order VALUES(?,?,?,?,?,?,?,?)','order_cs_test_a',USER,'cs_test_a','pi_test123',4200,'usd','paid',s.now());
  const login=await fakeRequest(handler,'/api/admin/login',{method:'POST',body:{password:'refund-QA-only',totp:totpAt(secret,Math.floor(TIME/30))}});
  assert.equal(login.status,200);
  const token=/beekeepy_qa_admin=([^;]+)/.exec(login.headers['Set-Cookie'])[1];
  const headers={cookie:`beekeepy_qa_admin=${token}`,'x-csrf-token':login.json.csrf};
  const declined=await fakeRequest(handler,'/api/admin/refunds',{method:'POST',headers,body:{order_id:'order_cs_test_a',request_id:'refund_12345678',amount:2500}});
  assert.equal(declined.status,400);assert.equal(stripeCalls,0);
  const accepted=await fakeRequest(handler,'/api/admin/refunds',{method:'POST',headers,body:{order_id:'order_cs_test_a',request_id:'refund_12345678',amount:2500,confirm:'CONFIRM_REFUND'}});
  assert.equal(accepted.status,200);assert.equal(stripeCalls,1);
  const retried=await fakeRequest(handler,'/api/admin/refunds',{method:'POST',headers,body:{order_id:'order_cs_test_a',request_id:'refund_12345678',amount:2500,confirm:'CONFIRM_REFUND'}});
  assert.equal(retried.status,200);assert.equal(stripeCalls,1);
  assert.equal(s.all('SELECT * FROM account').length,1);
  assert.equal(s.all('SELECT * FROM commerce_order').length,1);
 }finally{s.close();}
});

test('five invalid administrator passwords cause rate limit',async()=>{
 const s=newStore();try{
  const {handler}=createCommercialApp({store:s,env:{BEE_ADMIN_PASSWORD_SCRYPT:encodeAdminPassword('real-password'),BEE_ADMIN_TOTP_SECRET:'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'},clock:date});
  for(let k=0;k<5;k++){const x=await fakeRequest(handler,'/api/admin/login',{method:'POST',body:{password:'wrong',totp:'123456'}});assert.equal(x.status,401);}
  const limited=await fakeRequest(handler,'/api/admin/login',{method:'POST',body:{password:'wrong',totp:'123456'}});
  assert.equal(limited.status,429);
 }finally{s.close();}
});
