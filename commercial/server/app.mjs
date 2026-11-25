/** HTTPS-only isolated Beekeepy commercial QA API.
 * No route can modify the beekeeping app_state/Phase1/IndexedDB data stores.
 * Never treat this reconstruction as a certified production deployment.
 */
import {createServer as createHttpsServer} from 'node:https';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openStore} from './db.mjs';
import {verifyStripeEvent,applyVerifiedStripeEvent,stripePost} from './stripe.mjs';
import {checkAdminPassword,verifyTotp,createSession,validateSession,verifySupabaseAccessToken} from './auth.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const root=join(here,'..','public');
const htmlFiles=new Map([['/admin/','admin/index.html'],['/account/','account/index.html']]);
const assets=new Map([['/commercial.js','commercial.js'],['/admin.css','admin.css'],['/account.css','account.css']]);
const nowSeconds=()=>Math.floor(Date.now()/1000);
const safeError=(status,code)=>Object.assign(new Error(code),{status,code});
const respond=(res,status,data,headers={})=>{const raw=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(raw);};
async function readBody(req,limit=1024*1024){let size=0;const chunks=[];for await(const part of req){const chunk=Buffer.isBuffer(part)?part:Buffer.from(part);size+=chunk.length;if(size>limit)throw safeError(413,'body_too_large');chunks.push(chunk);}return Buffer.concat(chunks);}
function json(raw){try{return JSON.parse(raw.toString('utf8'));}catch{throw safeError(400,'invalid_json');}}
const cookie=(req,name)=>String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';
const bearer=req=>/^Bearer (.+)$/.exec(String(req.headers.authorization||''))?.[1]||'';
const pathOf=req=>new URL(req.url,'https://localhost').pathname;
function checkOrigin(req,allowedAppOrigin=null){
  const origin=req.headers.origin;
  const host=req.headers.host;
  if(!origin||!host)throw safeError(403,'origin_required');
  let u;try{u=new URL(origin);}catch{throw safeError(403,'invalid_origin');}
  if(u.protocol!=='https:'||(u.host!==host&&u.origin!==allowedAppOrigin))throw safeError(403,'cross_origin_forbidden');
}
function inputString(v,max=200){return typeof v==='string' && v.trim().length>0 && v.length<=max;}
function strictText(v,max){if(!inputString(v,max))throw safeError(400,'invalid_input');return v.trim();}

export function createCommercialApp({store=openStore(),env=process.env,fetcher=fetch,clock=()=>Date.now()}={}) {
  const loginAttempts=new Map();
  const publicOrigin=env.BEE_PUBLIC_ORIGIN;
  const appOrigin=(()=>{try{const u=new URL(env.BEE_APP_ORIGIN);return u.protocol==='https:'&&u.pathname==='/'&&!u.search&&!u.hash?u.origin:null;}catch{return null;}})();
  const allowPrice=(env.STRIPE_PRO_PRICE_IDS||'').split(',').map(x=>x.trim()).filter(x=>/^price_[A-Za-z0-9]+$/.test(x));
  const stripeSecret=env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret=env.STRIPE_WEBHOOK_SECRET;
  const stripePostFn=(path,params,key)=>stripePost(path,params,{secret:stripeSecret,fetcher,idempotencyKey:key||randomUUID()});
  const requireAdmin=(req,write=false)=>{
    const token=cookie(req,'beekeepy_qa_admin');
    if(!validateSession(store,token,write?(req.headers['x-csrf-token']??''):null,clock()))throw safeError(401,'admin_auth_required');
    if(write)checkOrigin(req);
  };
  const requireUser=async req=>{
    const u=await verifySupabaseAccessToken(bearer(req),{url:env.SUPABASE_URL,key:env.SUPABASE_PUBLISHABLE_KEY,fetcher});
    if(!u)throw safeError(401,'verified_supabase_session_required');
    store.ensureAccount(u.id,u.email);
    return u;
  };
  const readAdmin=(req,res,path)=>{
    requireAdmin(req);
    if(path==='/api/admin/session')return respond(res,200,{authenticated:true});
    if(path==='/api/admin/summary'){
      const count=sql=>store.get(sql)?.n||0;
      return respond(res,200,{
        users:count('SELECT count(*) n FROM account'),
        pro:store.get("SELECT count(*) n FROM subscription WHERE status IN ('active','trialing') AND approved_price=1 AND (period_end IS NULL OR period_end > ?)",Math.floor(clock()/1000))?.n||0,
        orders:count('SELECT count(*) n FROM commerce_order'),
        open_tickets:count("SELECT count(*) n FROM ticket WHERE status='open'")
      });
    }
    if(path==='/api/admin/users'){
      const rows=store.all('SELECT a.user_id,a.email,a.created_at,s.status,s.period_end,s.cancel_at_period_end FROM account a LEFT JOIN subscription s USING(user_id) ORDER BY a.created_at DESC LIMIT 200');
      return respond(res,200,{users:rows});
    }
    if(path==='/api/admin/orders')return respond(res,200,{orders:store.all('SELECT order_id,user_id,amount,currency,status,created_at FROM commerce_order ORDER BY created_at DESC LIMIT 200')});
    if(path==='/api/admin/tickets')return respond(res,200,{tickets:store.all('SELECT * FROM ticket ORDER BY created_at DESC LIMIT 200')});
    if(path==='/api/admin/audit')return respond(res,200,{events:store.all('SELECT * FROM audit ORDER BY created_at DESC LIMIT 200')});
    throw safeError(404,'not_found');
  };
  async function handler(req,res){
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; form-action 'self'");
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Strict-Transport-Security','max-age=300');
    let p;
    try{
      p=pathOf(req);
      // Strict CORS: only the explicitly configured app origin gets bearer-only account API access.
      if(p.startsWith('/api/account/')&&appOrigin&&req.headers.origin===appOrigin){
        res.setHeader('Access-Control-Allow-Origin',appOrigin);
        res.setHeader('Vary','Origin');
        res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
      }
      if(req.method==='OPTIONS'&&p.startsWith('/api/account/')&&appOrigin&&req.headers.origin===appOrigin){res.writeHead(204,{'Cache-Control':'no-store'});res.end();return;}
      if(req.method==='OPTIONS'&&p.startsWith('/api/account/'))throw safeError(403,'app_origin_not_allowed');
      if(req.method==='GET' && p==='/healthz')return respond(res,200,{status:'ok',scope:'isolated_qa',production_ready:false});
      if(req.method==='GET' && (htmlFiles.has(p)||assets.has(p))) {
        const filename=join(root,assets.get(p)||htmlFiles.get(p));
        const body=readFileSync(filename);
        res.writeHead(200,{'Content-Type':p.endsWith('.js')?'application/javascript; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body);return;
      }
      if(req.method==='POST' && p==='/api/stripe/webhook'){
        const raw=await readBody(req);
        let event;
        try{event=verifyStripeEvent(raw,req.headers['stripe-signature'],stripeWebhookSecret,Math.floor(clock()/1000));}
        catch {throw safeError(400,'stripe_signature_invalid');}
        if(event.livemode===true)throw safeError(403,'live_payment_events_disabled_in_qa');
        try{return respond(res,200,applyVerifiedStripeEvent(store,event,{allowedPriceIds:allowPrice}));}
        catch(e){return respond(res,409,{error:'stripe_event_unprocessed',detail:'requires reconciliation'});}
      }
      if(req.method==='POST' && p==='/api/admin/login'){
        checkOrigin(req);
        const key=String(req.socket.remoteAddress||'local');
        const entry=loginAttempts.get(key)||{failures:0,until:0};
        if(entry.until>clock())throw safeError(429,'login_rate_limited');
        const body=json(await readBody(req,2048));
        const hasCredentials=!!env.BEE_ADMIN_PASSWORD_SCRYPT && !!env.BEE_ADMIN_TOTP_SECRET;
        const validPassword=checkAdminPassword(body.password,env.BEE_ADMIN_PASSWORD_SCRYPT);
        let validTotp=false;
        // Do not consume a one-time code when password verification failed.
        if(hasCredentials&&validPassword){try{validTotp=verifyTotp(store,body.totp,env.BEE_ADMIN_TOTP_SECRET,clock());}catch{validTotp=false;}}
        if(!hasCredentials||!validPassword||!validTotp){
          entry.failures++;if(entry.failures>=5)entry.until=clock()+15*60*1000;
          loginAttempts.set(key,entry);
          store.audit('anonymous','admin_login_denied');
          throw safeError(401,'invalid_admin_credentials');
        }
        loginAttempts.delete(key);
        const {token,csrf,expiresAt}=createSession(store,clock());
        store.audit('admin','admin_login');
        return respond(res,200,{authenticated:true,csrf,expiresAt},{'Set-Cookie':`beekeepy_qa_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=14400`});
      }
      if(p.startsWith('/api/admin/')){
        if(req.method==='GET')return readAdmin(req,res,p);
        requireAdmin(req,true);
        const body=json(await readBody(req,8192));
        if(req.method==='POST' && p==='/api/admin/refunds'){
          if(body.confirm!=='CONFIRM_REFUND')throw safeError(400,'explicit_refund_confirmation_required');
          const oid=strictText(body.order_id,128);
          const order=store.get('SELECT * FROM commerce_order WHERE order_id=?',oid);
          if(!order||order.status!=='paid'||!/^pi_[A-Za-z0-9]+$/.test(order.stripe_payment_intent_id||''))throw safeError(409,'verified_paid_payment_intent_required');
          if(!Number.isSafeInteger(body.amount)||body.amount<=0||body.amount>order.amount)throw safeError(400,'invalid_refund_amount');
          const key=body.request_id;
          if(!/^refund_[\w-]{8,100}$/.test(key||''))throw safeError(400,'invalid_idempotency_key');
          const existing=store.get('SELECT * FROM refund_request WHERE request_id=?',key);
          if(existing){
            if(existing.order_id!==oid||existing.amount!==body.amount)throw safeError(409,'refund_idempotency_conflict');
            return respond(res,200,{request_id:key,state:existing.state});
          }
          const already=store.get("SELECT COALESCE(SUM(amount),0) AS amount FROM refund_request WHERE order_id=? AND state NOT IN ('failed','canceled')",oid)?.amount||0;
          if(already+body.amount>order.amount)throw safeError(409,'refund_exceeds_verified_order_amount');
          // No optimistic local refund; Stripe must return a verified refund object first.
          const remote=await stripePostFn('refunds',{payment_intent:order.stripe_payment_intent_id,amount:String(body.amount),reason:'requested_by_customer'},key);
          if(!/^re_[A-Za-z0-9]+$/.test(remote.id||''))throw safeError(502,'stripe_refund_unverified');
          store.transaction(()=>{
            store.sql('INSERT INTO refund_request VALUES(?,?,?,?,?,?)',key,oid,remote.id,body.amount,remote.status||'pending',store.now());
            store.audit('admin','refund_created',key);
          });
          return respond(res,200,{request_id:key,refund_id:remote.id,status:remote.status||'pending'});
        }
        if(req.method==='POST' && p==='/api/admin/tickets/status'){
          const ticket=strictText(body.ticket_id,128);
          if(!['open','closed'].includes(body.status))throw safeError(400,'invalid_ticket_status');
          const x=store.sql('UPDATE ticket SET status=? WHERE ticket_id=?',body.status,ticket);
          if(x.changes===0)throw safeError(404,'ticket_not_found');
          store.audit('admin','ticket_status_changed',ticket);
          return respond(res,200,{updated:true});
        }
        throw safeError(404,'not_found');
      }
      if(p.startsWith('/api/account/')){
        if(req.method==='POST')checkOrigin(req,appOrigin);
        const user=await requireUser(req);
        if(req.method==='GET' && p==='/api/account/profile')return respond(res,200,{id:user.id,email:user.email,entitlement:store.entitlement(user.id)});
        if(req.method==='GET' && p==='/api/account/plans')return respond(res,200,{plans:allowPrice.map(id=>({price_id:id,label:'Beekeepy Pro（价格以 Stripe 结账页为准）'}))});
        if(req.method==='GET' && p==='/api/account/orders')return respond(res,200,{orders:store.all('SELECT order_id,amount,currency,status,created_at FROM commerce_order WHERE user_id=? ORDER BY created_at DESC LIMIT 100',user.id)});
        if(req.method==='POST' && p==='/api/account/checkout'){
          const body=json(await readBody(req,4096));
          const price=body.price_id;
          if(!allowPrice.includes(price))throw safeError(400,'unapproved_price_id');
          if(!/^https:\/\//.test(publicOrigin||''))throw safeError(503,'checkout_disabled_missing_origin');
          const sess=await stripePostFn('checkout/sessions',{
            mode:'subscription',client_reference_id:user.id,
            'metadata[beekeepy_user_id]':user.id,
            'subscription_data[metadata][beekeepy_user_id]':user.id,
            'line_items[0][price]':price,'line_items[0][quantity]':'1',
            success_url:publicOrigin+'/account/?checkout=success',
            cancel_url:publicOrigin+'/account/?checkout=cancelled'
          });
          if(!/^cs_[A-Za-z0-9_]+$/.test(sess.id||'')||!/^https:\/\//.test(sess.url||''))throw safeError(502,'stripe_checkout_unverified');
          store.audit(user.id,'checkout_started',sess.id);
          return respond(res,200,{checkout_url:sess.url});
        }
        if(req.method==='POST' && p==='/api/account/cancel'){
          const sub=store.get('SELECT * FROM subscription WHERE user_id=?',user.id);
          if(!/^sub_[A-Za-z0-9]+$/.test(sub?.stripe_subscription_id||''))throw safeError(409,'no_subscription_to_cancel');
          const remote=await stripePostFn('subscriptions/'+sub.stripe_subscription_id,{'cancel_at_period_end':'true'});
          if(remote.id!==sub.stripe_subscription_id)throw safeError(502,'stripe_cancel_unverified');
          store.audit(user.id,'cancel_requested',sub.stripe_subscription_id);
          return respond(res,200,{cancel_requested:true,pending_webhook:true});
        }
        if(req.method==='POST' && p==='/api/account/portal'){
          const sub=store.get('SELECT stripe_customer_id FROM subscription WHERE user_id=?',user.id);
          if(!/^cus_[A-Za-z0-9]+$/.test(sub?.stripe_customer_id||''))throw safeError(409,'billing_customer_not_found');
          if(!/^https:\/\//.test(publicOrigin||''))throw safeError(503,'portal_disabled_missing_origin');
          const remote=await stripePostFn('billing_portal/sessions',{customer:sub.stripe_customer_id,return_url:publicOrigin+'/account/'});
          if(!/^https:\/\//.test(remote.url||''))throw safeError(502,'stripe_portal_unverified');
          return respond(res,200,{portal_url:remote.url});
        }
        if(req.method==='POST' && p==='/api/account/tickets'){
          const body=json(await readBody(req,8192));
          const subject=strictText(body.subject,200),message=strictText(body.message,5000);
          const id='ticket_'+randomUUID();
          store.sql('INSERT INTO ticket VALUES(?,?,?,?,?,?)',id,user.id,subject,message,'open',store.now());
          store.audit(user.id,'ticket_created',id);
          return respond(res,201,{ticket_id:id,status:'open'});
        }
        throw safeError(404,'not_found');
      }
      throw safeError(404,'not_found');
    }catch(e){
      const status=e?.status||500;
      if(status>=500)console.error('QA server error:',e.message);
      return respond(res,status,{error:status>=500?'internal_error':e.code||'bad_request'});
    }
  }
  return {handler,store};
}

export function startCommercialServer({env=process.env}={}) {
  if(!env.BEE_HTTPS_PFX_FILE&&(!env.BEE_HTTPS_KEY_FILE||!env.BEE_HTTPS_CERT_FILE))throw Error('HTTPS PKCS#12 or PEM certificate files required');
  if(!env.BEE_ADMIN_PASSWORD_SCRYPT||!env.BEE_ADMIN_TOTP_SECRET)throw Error('Admin password and TOTP must be configured');
  const {handler,store}=createCommercialApp({store:openStore(env.BEE_DB_FILE||join(here,'..','qa-data','beekeepy-qa.sqlite')),env});
  const tls=env.BEE_HTTPS_PFX_FILE
    ? {pfx:readFileSync(env.BEE_HTTPS_PFX_FILE),passphrase:env.BEE_HTTPS_PFX_PASSWORD}
    : {key:readFileSync(env.BEE_HTTPS_KEY_FILE),cert:readFileSync(env.BEE_HTTPS_CERT_FILE)};
  const server=createHttpsServer(tls,handler);
  const host=env.BEE_BIND_HOST||'127.0.0.1';
  if(!['127.0.0.1','::1'].includes(host))throw Error('Only localhost binding is authorized for reconstructed QA deployment');
  const port=Number(env.BEE_PORT||8443);
  server.listen(port,host,()=>console.log(`Beekeepy isolated QA: https://${host}:${port}/admin/`));
  return {server,store};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])startCommercialServer();
