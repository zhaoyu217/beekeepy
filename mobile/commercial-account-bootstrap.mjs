/** Optional Android/browser billing bridge added ONLY to generated mobile bundle.
 * Does not edit frozen app.js or enable a payment path without verified QA config.
 */
import {createVerifiedAccountClient} from './mobile-commercial-verified-client.mjs';
const endpoint=window.HIVEDASH_CONFIG?.COMMERCIAL_URL;
if(endpoint){
  try{
    // Classic app.js declares supabaseClient in the global lexical environment.
    const auth=typeof supabaseClient!=='undefined' ? supabaseClient?.auth : null;
    const api=createVerifiedAccountClient({auth,origin:endpoint,locationOrigin:location.origin});
    const status=()=>{if(typeof toast==='function')toast('订单尚未确认，请在支付平台核对，不会修改养蜂数据。')};
    window.startProCheckout=async()=>{
      try{
        const {plans}=await api.plans();
        if(!Array.isArray(plans)||plans.length!==1||!plans[0]?.price_id)throw Error('plan_selection_requires_review');
        const x=await api.checkout(plans[0].price_id);
        const url=new URL(x.checkout_url);
        if(url.protocol!=='https:'||!/(^|\.)stripe\.com$/.test(url.hostname))throw Error('untrusted_payment_destination');
        // User has already clicked the original subscription button.
        location.assign(url.href);
      }catch(err){console.warn('Commercial checkout was blocked:',err.message);status();}
    };
    window.manageSubscription=async()=>{
      try{
        const x=await api.portal();const url=new URL(x.portal_url);
        if(url.protocol!=='https:'||!/(^|\.)stripe\.com$/.test(url.hostname))throw Error('untrusted_billing_destination');
        location.assign(url.href);
      }catch(err){console.warn('Commercial portal was blocked:',err.message);status();}
    };
  }catch(err){console.warn('Commercial QA billing bridge is disabled:',err.message);}
}
