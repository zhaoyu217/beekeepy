/* HiveDash V2P2E5R03A5
   Food Verification draft durability.
   Preserve targeted Food Verification form values across unrelated global render()
   calls while the user remains on the same verification route. Leaving the route
   or saving discards the transient draft. This does not persist evidence until Save.
*/
(()=>{
  'use strict';
  if(window.__HIVEDASH_V2P2E5R03A5__) return;
  window.__HIVEDASH_V2P2E5R03A5__=true;
  window.__HIVEDASH_V2P2E5R03A5_VERSION__='v2p2e5r03a5-food-verification-draft-durability';

  const drafts=new Map();
  const IDS=['r03fv-honey','r03fv-pollen','r03fv-need','r03fv-notes'];

  function routeKey(){
    const raw=String(location.hash||'').replace(/^#/,'');
    return raw.startsWith('food-verification/') ? raw : '';
  }

  function snapshot(key){
    if(!key) return;
    const values={};
    let found=false;
    for(const id of IDS){
      const el=document.getElementById(id);
      if(!el) continue;
      values[id]=el.value;
      found=true;
    }
    if(found) drafts.set(key,values);
  }

  function restore(key){
    if(!key) return;
    const values=drafts.get(key);
    if(!values) return;
    for(const id of IDS){
      const el=document.getElementById(id);
      if(!el || !(id in values)) continue;
      el.value=values[id];
    }
  }

  function rememberFromEvent(ev){
    const id=String(ev?.target?.id||'');
    if(!IDS.includes(id)) return;
    const key=routeKey();
    if(key) snapshot(key);
  }
  document.addEventListener('change',rememberFromEvent,true);
  document.addEventListener('input',rememberFromEvent,true);

  const prevRender=window.render||((typeof render==='function')?render:null);
  if(typeof prevRender==='function'){
    window.render=function(){
      const before=routeKey();
      if(before) snapshot(before);
      const ret=prevRender.apply(this,arguments);
      const after=routeKey();
      if(after){
        try{restore(after)}catch(_){ }
        queueMicrotask(()=>{try{restore(after)}catch(_){ }});
        setTimeout(()=>{try{restore(after)}catch(_){ }},0);
      }
      return ret;
    };
    try{render=window.render}catch(_){ }
  }

  const prevSave=window.v2p2e5r03SaveFoodVerification;
  if(typeof prevSave==='function'){
    window.v2p2e5r03SaveFoodVerification=function(){
      const key=routeKey();
      if(key) snapshot(key);
      const ret=prevSave.apply(this,arguments);
      if(key) drafts.delete(key);
      return ret;
    };
  }

  let lastKey=routeKey();
  window.addEventListener('hashchange',()=>{
    const next=routeKey();
    if(lastKey && !next) drafts.delete(lastKey);
    lastKey=next;
  });

  console.log('V2P2E5R03A5 LOADED | Food Verification draft durability active');
})();
