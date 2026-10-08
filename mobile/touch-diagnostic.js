/* Android QA only: read-only touch, click, route and runtime activity display.
 * No API calls, no persistence, no changes to navigation or scientific logic.
 * Entire panel has pointer-events:none; cannot intercept user interactions. */
(() => {
  'use strict';
  if (window.__HIVE_ANDROID_TOUCH_QA__) return;
  const qa = {pointer:0,touch:0,click:0,heart:0,errors:0,last:'none',route:location.hash};
  window.__HIVE_ANDROID_TOUCH_QA__=qa;
  let panel=null;
  const fmt = el => {
    if (!(el instanceof Element)) return 'none';
    const btn=el.closest('button,[role="button"],a');
    const hit=btn||el;
    return (hit.tagName.toLowerCase()+'#'+(hit.id||'')+'.'+String(hit.className?.baseVal||hit.className||'').replace(/\s+/g,'.')).slice(0,58);
  };
  function observed(ev,kind) {
    qa[kind]++;
    const xy=ev.touches?.[0]||ev.changedTouches?.[0]||ev;
    let hit=ev.target;
    if(Number.isFinite(xy.clientX)&&Number.isFinite(xy.clientY))
      hit=document.elementFromPoint(xy.clientX,xy.clientY)||ev.target;
    qa.last=kind+':'+fmt(ev.target)+' hit='+fmt(hit);
    qa.route=location.hash||'#home';
    paint();
  }
  for(const type of ['pointerdown','touchstart','click']){
    const key=type==='pointerdown'?'pointer':type==='touchstart'?'touch':'click';
    window.addEventListener(type,e=>observed(e,key),{capture:true,passive:true});
  }
  window.addEventListener('error',()=>{qa.errors++;paint()});
  window.addEventListener('unhandledrejection',()=>{qa.errors++;paint()});
  window.addEventListener('hashchange',()=>{qa.route=location.hash;paint()});
  function paint(){
    if(!panel||!panel.isConnected)return;
    const nav=document.getElementById('bottomnav');
    const modalCount=document.querySelectorAll('#app > .modal,.hd-modal').length;
    const navPointer=nav?getComputedStyle(nav).pointerEvents:'missing';
    const authenticated=typeof isAuthenticated==='function' ? (isAuthenticated()?'yes':'no') : 'unknown';
    panel.textContent='TOUCH QA '+qa.heart+'s  P'+qa.pointer+' T'+qa.touch+' C'+qa.click+
      ' E'+qa.errors+' auth:'+authenticated+' '+qa.route+'\n'+qa.last+
      '\nmodal:'+modalCount+' nav:'+navPointer+' • no data sent';
  }
  function mount(){
    if(panel?.isConnected)return;
    panel=document.createElement('div');
    panel.id='hive-touch-qa-readonly';
    panel.setAttribute('aria-hidden','true');
    Object.assign(panel.style,{
      position:'fixed',top:'calc(env(safe-area-inset-top, 0px) + 82px)',
      left:'7px',right:'7px',boxSizing:'border-box',zIndex:'2147483647',
      pointerEvents:'none',userSelect:'none',whiteSpace:'pre-wrap',
      overflowWrap:'anywhere',font:'11px/1.35 monospace',
      background:'rgba(12,24,17,.91)',color:'#ffffff',
      padding:'5px 7px',borderRadius:'7px',maxHeight:'65px',
      overflow:'hidden',textAlign:'left'
    });
    document.body.appendChild(panel);
    paint();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
  setInterval(()=>{qa.heart++;qa.route=location.hash||'#home';paint()},1000);
})();