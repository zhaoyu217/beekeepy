/* Beekeepy isolated commercial QA UI. Never reads/writes hive data. */
(function(){
 'use strict';
 const app=document.getElementById('app');
 const admin=location.pathname.startsWith('/admin');
 const E=(name,value)=>{const x=document.createElement(name);if(value!=null)x.textContent=String(value);return x;};
 const section=(title)=>{const wrap=E('section');wrap.append(E('h2',title));app.append(wrap);return wrap;};
 const show=(msg)=>{const p=document.getElementById('message');p.textContent=msg;};
 async function api(path,{method='GET',body=null,token='',csrf=''}={}){
  const res=await fetch(path,{method,credentials:'same-origin',headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{}),...(csrf?{'x-csrf-token':csrf}:{})},body:body?JSON.stringify(body):undefined});
  const x=await res.json();if(!res.ok)throw Error(x.error||'HTTP '+res.status);return x;
 }
 function table(rows,fields){const t=E('table');const tr=E('tr');for(const [key,label] of fields)tr.append(E('th',label));t.append(tr);for(const row of rows){const x=E('tr');for(const [key] of fields)x.append(E('td',row[key]??'—'));t.append(x);}return t;}
 const csrfKey='beekeepy_qa_csrf';
 const csrf=()=>sessionStorage.getItem(csrfKey)||'';
 const adminRequest=(path,method='GET',body=null)=>api('/api/admin/'+path,{method,body,csrf:csrf()});
 function renderAdmin(){
   app.replaceChildren();
   const login=section('管理员登录 · QA 环境');
   const f=E('form');
   const password=E('input');password.type='password';password.required=true;password.autocomplete='current-password';password.placeholder='管理员密码';password.setAttribute('aria-label','管理员密码');
   const otp=E('input');otp.type='text';otp.inputMode='numeric';otp.pattern='[0-9]{6}';otp.required=true;otp.maxLength=6;otp.placeholder='TOTP 六位验证码';otp.setAttribute('aria-label','TOTP 验证码');
   const submit=E('button','登录');submit.type='submit';f.append(password,otp,submit);login.append(f);
   f.addEventListener('submit',async evt=>{evt.preventDefault();submit.disabled=true;try{const r=await api('/api/admin/login',{method:'POST',body:{password:password.value,totp:otp.value}});sessionStorage.setItem(csrfKey,r.csrf);password.value='';otp.value='';await showAdminDashboard();}catch(e){show('登录失败：'+e.message);}finally{submit.disabled=false;}});
   if(csrf())showAdminDashboard().catch(()=>{sessionStorage.removeItem(csrfKey);});
 }
 async function showAdminDashboard(){
   const summary=await adminRequest('summary');app.replaceChildren();const s=section('商业系统概览（仅隔离 QA 数据）');
   s.append(E('p',`用户 ${summary.users} · Pro 状态记录 ${summary.pro} · 订单 ${summary.orders} · 待处理工单 ${summary.open_tickets}`));
   const grid=[['users','用户',[['user_id','用户 ID'],['email','邮箱'],['status','订阅状态'],['period_end','到期时间戳']]],['orders','订单',[['order_id','订单号'],['user_id','用户 ID'],['amount','金额（最小货币单位）'],['currency','币种'],['status','状态']]],['tickets','客服工单',[['ticket_id','工单 ID'],['user_id','用户 ID'],['subject','主题'],['status','状态']]],['audit','安全审计',[['action','操作'],['actor','操作者'],['created_at','时间']]]];
   for(const [route,label,columns] of grid){const v=await adminRequest(route);const rows=v[route==='audit'?'events':route];const area=section(label);area.append(table(rows,columns));}
   const statusArea=section('工单处理（需管理员权限）');
   const ticketForm=E('form');const ticketId=E('input');ticketId.placeholder='工单 ID';ticketId.required=true;
   const ticketStatus=E('select');for(const value of ['open','closed']){const op=E('option',value==='open'?'待处理':'已关闭');op.value=value;ticketStatus.append(op);}
   const saveTicket=E('button','修改状态');saveTicket.type='submit';ticketForm.append(ticketId,ticketStatus,saveTicket);statusArea.append(ticketForm);
   ticketForm.onsubmit=async e=>{e.preventDefault();saveTicket.disabled=true;try{await adminRequest('tickets/status','POST',{ticket_id:ticketId.value,status:ticketStatus.value});show('工单状态已更新');await showAdminDashboard();}catch(err){show('操作失败：'+err.message);}finally{saveTicket.disabled=false;}};
   const refunds=section('订单退款（真实支付账户未配置时不可操作）');
   const refundForm=E('form');const orderId=E('input');orderId.required=true;orderId.placeholder='订单号';
   const amount=E('input');amount.type='number';amount.step='1';amount.min='1';amount.required=true;amount.placeholder='退款金额（最小货币单位）';
   const issueRefund=E('button','请求退款');issueRefund.type='submit';refundForm.append(orderId,amount,issueRefund);refunds.append(refundForm);
   refundForm.onsubmit=async e=>{e.preventDefault();if(!confirm('确认向支付平台发起真实退款？本操作不会删除用户养蜂数据。'))return;issueRefund.disabled=true;try{
     const id='refund_'+crypto.randomUUID();const response=await adminRequest('refunds','POST',{order_id:orderId.value,amount:Number(amount.value),request_id:id,confirm:'CONFIRM_REFUND'});
     show('支付平台已确认退款请求：'+response.refund_id);
   }catch(err){show('退款未完成：'+err.message);}finally{issueRefund.disabled=false;}};
 }
 function renderAccount(){
   app.replaceChildren();const c=section('我的订阅');c.append(E('p','需要由已登录的 Beekeepy App 注入经过 Supabase 验证的访问令牌。未登录或没有后端配置时不会显示虚构的会员状态。'));
   const auth=window.BeeCommercialAuth;
   if(!auth||typeof auth.getToken!=='function')return;
   (async()=>{const token=await auth.getToken();const r=await api('/api/account/profile',{token});c.append(E('p',`账户：${r.email}，会员：${r.entitlement.plan}，状态：${r.entitlement.status}`));
     const plans=await api('/api/account/plans',{token});
     for(const plan of plans.plans){const upgrade=E('button','开通 '+plan.label);upgrade.onclick=async()=>{try{const o=await api('/api/account/checkout',{method:'POST',token,body:{price_id:plan.price_id}});location.assign(o.checkout_url);}catch(err){show('尚未发起付款：'+err.message);}};c.append(upgrade);}
     const portal=E('button','管理订阅');portal.onclick=async()=>{try{const x=await api('/api/account/portal',{method:'POST',token});location.assign(x.portal_url);}catch(e){show(e.message);}};c.append(portal);
     const cancel=E('button','到期取消续费');cancel.onclick=async()=>{if(!confirm('确认向支付平台申请到期取消续费？不会删除任何养蜂记录。'))return;try{const x=await api('/api/account/cancel',{method:'POST',token});show('已提交取消请求，等待支付平台回调确认。');}catch(e){show(e.message);}};c.append(cancel);
     const order=await api('/api/account/orders',{token});const area=section('我的订单');area.append(table(order.orders,[['order_id','订单号'],['amount','金额'],['currency','币种'],['status','状态']]));
     const f=E('form');const subject=E('input');subject.required=true;subject.placeholder='客服主题';const msg=E('textarea');msg.required=true;msg.placeholder='描述你的问题';const send=E('button','提交工单');send.type='submit';f.append(subject,msg,send);section('联系客服').append(f);
     f.onsubmit=async e=>{e.preventDefault();try{await api('/api/account/tickets',{method:'POST',token,body:{subject:subject.value,message:msg.value}});show('工单已提交');f.reset();}catch(err){show(err.message);}};
   })().catch(e=>show('无法验证登录会话：'+e.message));
 }
 admin?renderAdmin():renderAccount();
})();
