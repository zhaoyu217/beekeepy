/* HiveDash Inspection Voice Entry V312
   UI-only bootstrap. No scientific fields, scoring, routes, or save logic changed. */
(function(){
  if(window.__HD_VOICE_ENTRY_V312__)return;
  window.__HD_VOICE_ENTRY_V312__=true;

  function onInspection(){return /^#inspection(?:\/|$)/i.test(String(location.hash||''));}

  function loadAndOpen(){
    if(typeof window.openStructuredVoiceInspection==='function'){
      window.openStructuredVoiceInspection();
      return;
    }
    var old=document.querySelector('script[data-hd-voice-v312-loader]');
    if(old)return;
    try{window.__HD_STRUCTURED_VOICE_V1__=false;}catch(_){}
    var s=document.createElement('script');
    s.src='inspection-voice.js?v=voice-inspection-v312-cacheproof';
    s.dataset.hdVoiceV312Loader='1';
    s.onload=function(){
      if(typeof window.openStructuredVoiceInspection==='function')window.openStructuredVoiceInspection();
      else if(typeof window.toast==='function')window.toast('Voice module did not initialize');
    };
    s.onerror=function(){if(typeof window.toast==='function')window.toast('Voice module could not be loaded');};
    document.head.appendChild(s);
  }

  function ensureStyle(){
    if(document.getElementById('hd-voice-entry-v312-style'))return;
    var st=document.createElement('style');
    st.id='hd-voice-entry-v312-style';
    st.textContent=
      '.v211-inspection .voice-row{display:none!important}'+
      '.v211-notes.hd-v312-host{position:relative!important;padding-top:14px!important}'+
      '.hd-v312-speak{position:absolute!important;top:8px!important;right:10px!important;z-index:999!important;display:inline-flex!important;visibility:visible!important;opacity:1!important;align-items:center!important;justify-content:center!important;min-width:78px!important;min-height:34px!important;padding:0 11px!important;border:1px solid #D9D4C9!important;border-radius:999px!important;background:#FFFEFB!important;color:#49643F!important;font:inherit!important;font-size:11px!important;font-weight:800!important;line-height:1!important;white-space:nowrap!important;cursor:pointer!important}'+
      '.v211-notes.hd-v312-host>span:first-child{padding-right:92px!important;min-height:34px!important;display:flex!important;align-items:center!important}';
    document.head.appendChild(st);
  }

  function mount(){
    if(!onInspection())return;
    ensureStyle();
    var root=document.getElementById('view')||document;
    root.querySelectorAll('.voice-row').forEach(function(row){
      row.hidden=true;
      row.setAttribute('aria-hidden','true');
      row.style.setProperty('display','none','important');
    });

    var notes=root.querySelector('.v211-notes')||
              root.querySelector('label.notes:has(#inotes)')||
              (document.getElementById('inotes')&&document.getElementById('inotes').closest('label,.notes'));
    if(!notes)return;
    notes.classList.add('hd-v312-host');

    var btn=notes.querySelector('.hd-v312-speak');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className='hd-v312-speak';
      btn.setAttribute('aria-label','Speak inspection');
      btn.textContent='🎙 Speak';
      btn.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        loadAndOpen();
      });
      notes.appendChild(btn);
    }
    btn.style.setProperty('display','inline-flex','important');
    btn.style.setProperty('visibility','visible','important');
    btn.style.setProperty('opacity','1','important');
  }

  function schedule(){
    mount();
    setTimeout(mount,0);
    setTimeout(mount,100);
    setTimeout(mount,400);
    setTimeout(mount,1000);
  }

  schedule();
  window.addEventListener('hashchange',schedule);
  var view=document.getElementById('view');
  if(view&&typeof MutationObserver==='function'){
    new MutationObserver(function(){mount();}).observe(view,{childList:true,subtree:true});
  }
  setInterval(mount,1000);
})();
