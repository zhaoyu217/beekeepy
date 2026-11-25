import {test} from 'node:test';
import assert from 'node:assert/strict';
let round=0;
const load=async()=>import('../../mobile/dist/mobile-commercial-account-bootstrap.mjs?case='+(++round));
function setup({origin='https://commercial.example',price='price_ABC',checkout='https://checkout.stripe.com/c/test'}={}){
  const requests=[],assigned=[],messages=[];
  globalThis.window={HIVEDASH_CONFIG:origin?{COMMERCIAL_URL:origin}:{}};
  globalThis.location={origin:'https://app.example',assign:u=>assigned.push(u)};
  globalThis.supabaseClient={auth:{getUser:async()=>({data:{user:{id:'u1'}}}),getSession:async()=>({data:{session:{user:{id:'u1'},access_token:'jwt'}}})}};
  globalThis.toast=v=>messages.push(v);
  globalThis.fetch=async(url,options)=>{
    requests.push({url,options});
    const data=url.endsWith('/plans')?{plans:[{price_id:price}]}:url.endsWith('/checkout')?{checkout_url:checkout}:{portal_url:'https://billing.stripe.com/p/session'};
    return{ok:true,json:async()=>data};
  };
  return{requests,assigned,messages};
}
test('unconfigured QA gateway does not create billing commands',async()=>{setup({origin:''});await load();assert.equal(window.startProCheckout,undefined);assert.equal(window.manageSubscription,undefined)});
test('configured gateway needs verified JWT and exact remote plan price',async()=>{const x=setup();await load();await window.startProCheckout();assert.equal(x.assigned.length,1);assert.match(x.assigned[0],/^https:\/\/checkout\.stripe\.com/);assert.equal(x.requests[1].options.headers.Authorization,'Bearer jwt');assert.equal(JSON.parse(x.requests[1].options.body).price_id,'price_ABC')});
test('third-party payment redirect cannot be opened',async()=>{const x=setup({checkout:'https://evil.example/payment'});await load();await window.startProCheckout();assert.equal(x.assigned.length,0);assert.equal(x.messages.length,1)});
test('missing Supabase session never starts checkout',async()=>{const x=setup();supabaseClient.auth.getUser=async()=>({data:{user:null}});await load();await window.startProCheckout();assert.equal(x.requests.length,0);assert.equal(x.assigned.length,0)});
test('manage subscription navigates only to Stripe billing portal',async()=>{const x=setup();await load();await window.manageSubscription();assert.equal(x.assigned[0],'https://billing.stripe.com/p/session')});
