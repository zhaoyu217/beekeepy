/** Commercial QA client for a trusted deployment of Beekeepy.
 * Never stores a JWT on disk, never interprets localStorage as Pro entitlement,
 * never mutates hive data. Network requests are disabled until configured.
 */
const assert=(cond,msg)=>{if(!cond)throw Error(msg)};
const loopback=/^(localhost|127\.0\.0\.1|\[::1\])$/i;
export function createVerifiedAccountClient({auth,origin,fetcher=globalThis.fetch,locationOrigin=globalThis.location?.origin}={}){
  assert(auth&&typeof auth.getUser==='function'&&typeof auth.getSession==='function','supabase_auth_required');
  let base;
  try{base=new URL(origin);}catch{throw Error('commercial_https_origin_required');}
  assert(base.protocol==='https:'&&base.pathname==='/'&&base.search===''&&base.hash==='','commercial_https_origin_required');
  // In an Android WebView, localhost refers to the phone, not the user's QA PC.
  assert(!(locationOrigin==='https://localhost'&&loopback.test(base.hostname)),'android_loopback_server_unreachable');
  assert(typeof fetcher==='function','fetch_required');
  async function identity(){
    const [u,s]=await Promise.all([auth.getUser(),auth.getSession()]);
    const id=u?.data?.user?.id;
    const session=s?.data?.session;
    assert(id&&session?.user?.id===id&&typeof session.access_token==='string'&&session.access_token,'authenticated_user_required');
    return {id,token:session.access_token};
  }
  async function request(path,{method='GET',body}={}){
    assert(['/profile','/plans','/orders','/checkout','/cancel','/portal','/tickets'].includes(path),'unapproved_commercial_route');
    assert(method==='GET'||method==='POST','unapproved_method');
    const initial=await identity();
    const url=new URL('/api/account'+path,base);
    const headers={'Authorization':`Bearer ${initial.token}`,...(body?{'Content-Type':'application/json'}:{})};
    // Account switch race: fetch and local identity must refer to the same account.
    const res=await fetcher(url.toString(),{method,headers,credentials:'omit',redirect:'error',cache:'no-store',body:body?JSON.stringify(body):undefined});
    const final=await identity();
    assert(final.id===initial.id&&final.token===initial.token,'account_changed_request_discarded');
    assert(res.ok,'commercial_server_rejected_'+res.status);
    return res.json();
  }
  return {profile:()=>request('/profile'),plans:()=>request('/plans'),orders:()=>request('/orders'),checkout:(price_id)=>request('/checkout',{method:'POST',body:{price_id}}),cancel:()=>request('/cancel',{method:'POST'}),portal:()=>request('/portal',{method:'POST'}),createTicket:(subject,message)=>request('/tickets',{method:'POST',body:{subject,message}})};
}
