(function fieldOps(){
  'use strict';

  const VERSION='five-gaps-v1';
  const QUICK_STORAGE='hivedash_quick_inspection';
  const ENV_CACHE='hivedash_environment_cache_v1';
  const GEOCODE_CACHE='hivedash_geocode_cache_v1';
  const ENH_ATTR='data-hd-five-gaps';

  function q(sel,root=document){return root.querySelector(sel)}
  function qa(sel,root=document){return Array.from(root.querySelectorAll(sel))}
  function norm(v){return String(v==null?'':v).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function safeState(){try{return typeof state==='function'?state():null}catch(_e){return null}}
  function fire(el,type){try{el.dispatchEvent(new Event(type,{bubbles:true}))}catch(_e){}}
  function setNativeValue(el,value){
    try{
      const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const d=Object.getOwnPropertyDescriptor(proto,'value');
      if(d&&d.set)d.set.call(el,value);else el.value=value;
    }catch(_e){el.value=value}
    fire(el,'input');fire(el,'change');
  }
  function routeName(){return String(location.hash||'#home').replace(/^#/,'').split('/')[0]}
  function toastSafe(msg){
    try{if(typeof toast==='function'){toast(msg);return}}catch(_e){}
    console.info('[HiveDash]',msg);
  }

  async function requestCloudFlush(){
    if(!navigator.onLine)return;
    try{
      if(typeof currentSession!=='undefined'&&currentSession?.user&&typeof cloudReady!=='undefined'&&!cloudReady&&typeof hydrateAuthenticatedApp==='function'){
        await hydrateAuthenticatedApp();
        return;
      }
      if(typeof scheduleCloudSave==='function'&&typeof state==='function')scheduleCloudSave(state());
    }catch(e){console.warn('HiveDash reconnect flush skipped',e)}
  }
  function refreshConnectivityUI(){
    qa('.hd-offline-indicator').forEach(el=>{
      const online=navigator.onLine!==false;
      el.textContent=online?'Online':'Offline · local save';
      el.classList.toggle('offline',!online);
    });
    qa('.hd-offline-banner').forEach(el=>{el.hidden=navigator.onLine!==false});
  }
  window.addEventListener('online',()=>{refreshConnectivityUI();requestCloudFlush()});
  window.addEventListener('offline',refreshConnectivityUI);

  const QUICK_PATTERNS=[
    /\bqueen\b/,/\beggs?\b/,/\blarvae?\b/,/queen cells?/,/colony strength/,
    /brood pattern/,/food stores?/,/\bpests?\b/,/\bnotes?\b/
  ];
  function cardHeading(card){
    const h=q('.v211-card-head,.vhead,h1,h2,h3,b,strong',card);
    return norm(h?h.textContent:(card.textContent||'').slice(0,180));
  }
  function classifyInspectionCards(root){
    qa('.v211-grid .v211-card',root).forEach(card=>{
      if(card.matches('[data-formal-reference]')||q('[data-formal-reference]',card)){
        card.classList.remove('hd-quick-secondary');return;
      }
      const text=cardHeading(card);
      const core=QUICK_PATTERNS.some(rx=>rx.test(text));
      card.classList.toggle('hd-quick-secondary',!core);
    });
  }
  function setQuickMode(root,on){
    root.classList.toggle('hd-quick-mode',!!on);
    try{localStorage.setItem(QUICK_STORAGE,on?'1':'0')}catch(_e){}
    const btn=q('[data-hd-quick]',root);
    if(btn){
      btn.classList.toggle('primary',!!on);
      btn.textContent=on?'Quick mode: On':'Quick mode: Off';
      btn.setAttribute('aria-pressed',on?'true':'false');
    }
  }

  const FIELD_DEFS={
    queenSeen:{label:'Queen',keywords:['queen'],aliases:{'seen':['seen','yes','present','found'],'not seen':['not seen','no','absent']}},
    eggs:{label:'Eggs',keywords:['eggs'],aliases:{'present':['present','seen','yes'],'none':['none','no','absent'],'not seen':['not seen']}},
    larvae:{label:'Larvae',keywords:['larvae','larva'],aliases:{'present':['present','seen','yes'],'none':['none','no','absent'],'not seen':['not seen']}},
    queenCells:{label:'Queen Cells',keywords:['queen cells','queen cell'],aliases:{'present':['present','seen','yes'],'none':['none','no','absent']}},
    colonyStrength:{label:'Colony Strength',keywords:['colony strength'],numeric:true},
    broodPattern:{label:'Brood Pattern',keywords:['brood pattern'],aliases:{'excellent':['excellent'],'good':['good'],'fair':['fair'],'poor':['poor'],'spotty brood':['spotty brood','spotty']}},
    foodStores:{label:'Food Stores',keywords:['food stores','food store'],aliases:{'high':['high'],'medium':['medium','moderate'],'low':['low'],'adequate':['adequate','enough']}},
    temperament:{label:'Temperament',keywords:['temperament'],aliases:{'calm':['calm'],'normal':['normal'],'defensive':['defensive'],'aggressive':['aggressive']}},
    notes:{label:'Notes',keywords:['notes','note'],text:true}
  };

  function parseInspectionTranscript(raw){
    const text=String(raw||'').trim();
    const low=text.toLowerCase();
    const found=[];
    function add(key,value){
      if(!value||found.some(x=>x.key===key))return;
      found.push({key,label:FIELD_DEFS[key].label,value});
    }
    if(/\bqueen\b.{0,24}\b(not seen|absent)\b/.test(low)||/\bno queen\b/.test(low))add('queenSeen','Not Seen');
    else if(/\bqueen\b.{0,24}\b(seen|present|found)\b/.test(low))add('queenSeen','Seen');

    if(/\b(no|none)\s+eggs?\b/.test(low)||/\beggs?\b.{0,16}\b(absent|not seen)\b/.test(low))add('eggs',low.includes('not seen')?'Not Seen':'None');
    else if(/\beggs?\b.{0,16}\b(present|seen|yes)\b/.test(low))add('eggs','Present');

    if(/\b(no|none)\s+larvae?\b/.test(low)||/\blarvae?\b.{0,16}\b(absent|not seen)\b/.test(low))add('larvae',low.includes('not seen')?'Not Seen':'None');
    else if(/\blarvae?\b.{0,16}\b(present|seen|yes)\b/.test(low))add('larvae','Present');

    if(/\b(no|none)\s+queen cells?\b/.test(low)||/\bqueen cells?\b.{0,18}\b(absent|none)\b/.test(low))add('queenCells','None');
    else if(/\bqueen cells?\b.{0,18}\b(present|seen|yes)\b/.test(low))add('queenCells','Present');

    const strength=low.match(/\bcolony strength(?:\s+is|\s+of|\s*:)?\s*(10|[1-9])\b/);
    if(strength)add('colonyStrength',strength[1]);

    const brood=low.match(/\bbrood pattern(?:\s+is|\s*:)?\s*(excellent|good|fair|poor|spotty(?: brood)?)\b/);
    if(brood)add('broodPattern',brood[1].startsWith('spotty')?'Spotty brood':brood[1][0].toUpperCase()+brood[1].slice(1));

    const food=low.match(/\bfood stores?(?:\s+are|\s+is|\s*:)?\s*(high|medium|moderate|low|adequate|enough)\b/);
    if(food){
      const v={moderate:'Medium',enough:'Adequate'}[food[1]]||food[1][0].toUpperCase()+food[1].slice(1);
      add('foodStores',v);
    }

    const temp=low.match(/\btemperament(?:\s+is|\s*:)?\s*(calm|normal|defensive|aggressive)\b/);
    if(temp)add('temperament',temp[1][0].toUpperCase()+temp[1].slice(1));

    const notes=text.match(/\bnotes?\s*[:\-]\s*(.+)$/i);
    if(notes&&notes[1].trim())add('notes',notes[1].trim());
    return found;
  }

  function smallestMatchingContainer(root,keywords){
    const candidates=qa('.v211-card,.v211-edit-row,.formgroup,.setting',root)
      .filter(el=>!el.matches('[data-formal-reference]')&&!q('[data-formal-reference]',el))
      .filter(el=>{
        const heading=q('.v211-card-head,.vhead,label,h1,h2,h3,b,strong',el);
        const t=norm(heading?heading.textContent:(el.textContent||'').slice(0,160));
        return keywords.some(k=>t.includes(norm(k)));
      });
    return candidates.sort((a,b)=>a.textContent.length-b.textContent.length)[0]||null;
  }
  function targetAliases(def,value){
    const n=norm(value);
    let arr=[n];
    Object.entries(def.aliases||{}).forEach(([canonical,aliases])=>{
      if(n===norm(canonical)||aliases.some(x=>n===norm(x)))arr=[canonical].concat(aliases);
    });
    return arr.map(norm);
  }
  function applyOneDetected(root,item){
    const def=FIELD_DEFS[item.key];if(!def)return false;
    const box=smallestMatchingContainer(root,def.keywords);
    if(!box)return false;
    if(def.text){
      const ta=q('textarea',box)||q('input[type="text"]',box);
      if(!ta)return false;
      setNativeValue(ta,item.value);return true;
    }
    if(def.numeric){
      const input=q('input[type="number"],input[type="range"],input:not([type])',box);
      if(input){setNativeValue(input,item.value);return true}
      const exact=qa('button',box).find(b=>norm(b.textContent)===norm(item.value));
      if(exact){exact.click();return true}
      return false;
    }
    const aliases=targetAliases(def,item.value);
    const sel=q('select',box);
    if(sel){
      const opt=Array.from(sel.options).find(o=>{
        const t=norm(o.textContent),v=norm(o.value);
        return aliases.some(a=>t===a||v===a||t.includes(a));
      });
      if(opt){sel.value=opt.value;fire(sel,'input');fire(sel,'change');return true}
    }
    const btn=qa('button',box).find(b=>{
      const t=norm(b.textContent);
      return aliases.some(a=>t===a);
    });
    if(btn){btn.click();return true}
    for(const lab of qa('label',box)){
      const t=norm(lab.textContent);
      if(aliases.some(a=>t===a||t.endsWith(' '+a))){
        const ctl=q('input[type="radio"],input[type="checkbox"]',lab);
        if(ctl&&!ctl.checked){ctl.click();return true}
      }
    }
    return false;
  }

  function openVoiceModal(root){
    q('.hd-modal')?.remove();
    const overlay=document.createElement('div');
    overlay.className='hd-modal';
    overlay.innerHTML=`
      <div class="hd-modal-panel" role="dialog" aria-modal="true" aria-label="Voice inspection">
        <div class="hd-modal-head">
          <div><h2>Voice inspection</h2><div class="hd-env-meta">Speak or paste notes. HiveDash detects fields, then you review before anything is applied.</div></div>
          <button type="button" class="hd-modal-close" aria-label="Close">×</button>
        </div>
        <textarea class="hd-voice-text" placeholder="Example: Queen seen. Eggs present. Brood pattern good. Food stores medium. Colony strength 7. No queen cells."></textarea>
        <div class="hd-modal-actions">
          <button type="button" data-hd-listen>Start listening</button>
          <button type="button" data-hd-detect>Detect fields</button>
        </div>
        <div class="hd-detected" hidden></div>
        <div class="hd-modal-actions">
          <button type="button" class="primary" data-hd-apply disabled>Review & Apply</button>
          <button type="button" data-hd-cancel>Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const textarea=q('.hd-voice-text',overlay);
    const detectedBox=q('.hd-detected',overlay);
    const applyBtn=q('[data-hd-apply]',overlay);
    let detected=[],recognition=null,listening=false;

    function close(){try{recognition?.stop()}catch(_e){} overlay.remove()}
    q('.hd-modal-close',overlay).onclick=close;
    q('[data-hd-cancel]',overlay).onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});

    function detect(){
      detected=parseInspectionTranscript(textarea.value);
      detectedBox.hidden=false;
      detectedBox.innerHTML=detected.length
        ? `<b>Detected fields</b><ul>${detected.map(x=>`<li>${esc(x.label)} → <b>${esc(x.value)}</b></li>`).join('')}</ul><div class="hd-env-meta">Nothing is saved yet. Apply fills the existing inspection controls for your final review.</div>`
        : `<b>No structured fields detected.</b><div class="hd-env-meta">Try phrases such as “Queen seen”, “Eggs present”, “Brood pattern good”, “Food stores medium”, or “Colony strength 7”.</div>`;
      applyBtn.disabled=!detected.length;
    }
    q('[data-hd-detect]',overlay).onclick=detect;

    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const listenBtn=q('[data-hd-listen]',overlay);
    if(!SR){
      listenBtn.disabled=true;listenBtn.textContent='Speech not supported';
    }else{
      listenBtn.onclick=()=>{
        if(listening){try{recognition.stop()}catch(_e){}return}
        recognition=new SR();
        recognition.lang='en-US';recognition.continuous=true;recognition.interimResults=true;
        let finalText=textarea.value.trim();
        recognition.onstart=()=>{listening=true;listenBtn.textContent='Stop listening'};
        recognition.onend=()=>{listening=false;listenBtn.textContent='Start listening';detect()};
        recognition.onerror=()=>{listening=false;listenBtn.textContent='Start listening'};
        recognition.onresult=e=>{
          let interim='',added='';
          for(let i=e.resultIndex;i<e.results.length;i++){
            const t=e.results[i][0]?.transcript||'';
            if(e.results[i].isFinal)added+=t+' ';else interim+=t;
          }
          if(added)finalText=(finalText+' '+added).trim();
          textarea.value=(finalText+(interim?' '+interim:'')).trim();
        };
        recognition.start();
      };
    }
    applyBtn.onclick=()=>{
      let ok=0;const missed=[];
      detected.forEach(item=>{if(applyOneDetected(root,item))ok++;else missed.push(item.label)});
      close();
      if(ok)toastSafe(`${ok} inspection field${ok===1?'':'s'} filled. Review them before saving.`);
      if(missed.length)toastSafe(`Review manually: ${missed.join(', ')}.`);
    };
  }

  function downloadText(name,text,type){
    const blob=new Blob([text],{type:type||'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function dateStamp(){return new Date().toISOString().slice(0,10)}
  function flatten(obj,prefix='',out={}){
    if(obj==null){out[prefix||'value']='';return out}
    if(Array.isArray(obj)){out[prefix||'value']=JSON.stringify(obj);return out}
    if(typeof obj!=='object'){out[prefix||'value']=obj;return out}
    Object.entries(obj).forEach(([k,v])=>{
      const key=prefix?`${prefix}.${k}`:k;
      if(v&&typeof v==='object'&&!Array.isArray(v))flatten(v,key,out);
      else out[key]=Array.isArray(v)?JSON.stringify(v):v;
    });
    return out;
  }
  function csvCell(v){
    let s=String(v==null?'':v);
    if(/^[=+\-@]/.test(s))s="'"+s;
    return `"${s.replace(/"/g,'""')}"`;
  }
  function rowsToCSV(rows){
    const flat=rows.map(r=>flatten(r));
    const cols=Array.from(new Set(flat.flatMap(r=>Object.keys(r))));
    if(!cols.length)return '\uFEFF';
    return '\uFEFF'+[cols.map(csvCell).join(','),...flat.map(r=>cols.map(c=>csvCell(r[c])).join(','))].join('\r\n');
  }
  function allRecordRows(s){
    const rows=[],logs=s?.logs||{};
    ['inspections','feedings','treatments','harvests','varroaTests','splitVerifications'].forEach(type=>{
      (Array.isArray(logs[type])?logs[type]:[]).forEach(x=>rows.push({record_type:type,...x}));
    });
    return rows;
  }
  function printableReport(s){
    const hives=Array.isArray(s?.hives)?s.hives:[],logs=s?.logs||{};
    const counts={Inspections:(logs.inspections||[]).length,Feedings:(logs.feedings||[]).length,Treatments:(logs.treatments||[]).length,'Varroa tests':(logs.varroaTests||[]).length,Harvests:(logs.harvests||[]).length};
    const win=window.open('','_blank','noopener,noreferrer');
    if(!win){toastSafe('Allow pop-ups to open the printable report.');return}
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>HiveDash Report</title>
    <style>body{font:14px/1.5 Arial,sans-serif;color:#22352a;margin:32px}h1{margin:0 0 6px}h2{margin-top:26px}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #d8ded7;padding:8px;text-align:left}th{background:#f2f5f0}.meta{color:#657068}.counts{display:flex;gap:12px;flex-wrap:wrap}.count{border:1px solid #d8ded7;padding:10px 12px;border-radius:8px}</style>
    </head><body><h1>HiveDash Apiary Report</h1><div class="meta">Generated ${esc(new Date().toLocaleString())}</div>
    <h2>Record summary</h2><div class="counts">${Object.entries(counts).map(([k,v])=>`<div class="count"><b>${esc(v)}</b><br>${esc(k)}</div>`).join('')}</div>
    <h2>Hives</h2><table><thead><tr><th>Name</th><th>Status</th><th>Last inspection</th></tr></thead><tbody>
    ${hives.map(h=>`<tr><td>${esc(h.name||h.id||'')}</td><td>${esc(h.status||h.hiveStatus||'')}</td><td>${esc(h.lastInspection||'')}</td></tr>`).join('')}
    </tbody></table><p class="meta">Use your browser Print command and choose “Save as PDF”.</p></body></html>`;
    win.document.write(html);win.document.close();win.focus();setTimeout(()=>win.print(),300);
  }
  function enhanceDataBackup(view){
    if(routeName()!=='data-backup'||q('.hd-export-card',view))return;
    const card=document.createElement('section');
    card.className='hd-export-card';
    card.innerHTML=`<h3>Export your HiveDash data</h3>
      <div class="hd-env-meta">Exports are generated in your browser. Existing HiveDash data is not changed.</div>
      <div class="hd-export-actions">
        <button type="button" data-hd-json>Full backup (JSON)</button>
        <button type="button" data-hd-inspections>Inspections CSV</button>
        <button type="button" data-hd-records>All records CSV</button>
        <button type="button" data-hd-pdf>Printable PDF report</button>
      </div>`;
    view.appendChild(card);
    q('[data-hd-json]',card).onclick=()=>downloadText(`hivedash-backup-${dateStamp()}.json`,JSON.stringify(safeState(),null,2),'application/json;charset=utf-8');
    q('[data-hd-inspections]',card).onclick=()=>downloadText(`hivedash-inspections-${dateStamp()}.csv`,rowsToCSV(safeState()?.logs?.inspections||[]),'text/csv;charset=utf-8');
    q('[data-hd-records]',card).onclick=()=>downloadText(`hivedash-records-${dateStamp()}.csv`,rowsToCSV(allRecordRows(safeState())),'text/csv;charset=utf-8');
    q('[data-hd-pdf]',card).onclick=()=>printableReport(safeState());
  }

  function locationText(){
    const s=safeState(),x=s?.settings||{};
    return [x.city,x.state,x.zip].filter(Boolean).join(', ')||x.location||x.apiaryLocation||'';
  }
  function cacheRead(key,maxAgeMs){
    try{const v=JSON.parse(localStorage.getItem(key)||'null');if(v&&Date.now()-v.at<maxAgeMs)return v.value}catch(_e){}
    return null;
  }
  function cacheWrite(key,value){try{localStorage.setItem(key,JSON.stringify({at:Date.now(),value}))}catch(_e){}}
  async function geocode(place){
    const cacheKey=GEOCODE_CACHE+':'+norm(place);
    const cached=cacheRead(cacheKey,30*24*60*60*1000);if(cached)return cached;
    const endpoint=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`;
    const res=await fetch(endpoint);if(!res.ok)throw new Error('Location lookup failed');
    const data=await res.json(),hit=data?.results?.[0];if(!hit)throw new Error('Location not found');
    const out={latitude:hit.latitude,longitude:hit.longitude,name:[hit.name,hit.admin1,hit.country].filter(Boolean).join(', '),timezone:hit.timezone};
    cacheWrite(cacheKey,out);return out;
  }
  function usesMetric(){
    const x=safeState()?.settings||{},v=norm(x.measurement||x.measure||x.units||'');
    return v.includes('metric');
  }
  async function weatherAt(coords){
    const metric=usesMetric();
    const key=ENV_CACHE+':weather:'+coords.latitude+','+coords.longitude+':'+(metric?'m':'u');
    const cached=cacheRead(key,30*60*1000);if(cached)return cached;
    const p=new URLSearchParams({latitude:String(coords.latitude),longitude:String(coords.longitude),current:'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',forecast_days:'3',timezone:'auto'});
    if(!metric){p.set('temperature_unit','fahrenheit');p.set('wind_speed_unit','mph');p.set('precipitation_unit','inch')}
    const res=await fetch('https://api.open-meteo.com/v1/forecast?'+p.toString());if(!res.ok)throw new Error('Weather lookup failed');
    const data=await res.json();
    const out={temperature:data.current?.temperature_2m,temperatureUnit:data.current_units?.temperature_2m||'',humidity:data.current?.relative_humidity_2m,wind:data.current?.wind_speed_10m,windUnit:data.current_units?.wind_speed_10m||'',precipitation:data.current?.precipitation,precipitationUnit:data.current_units?.precipitation||'',precipChance:data.daily?.precipitation_probability_max?.[0],high:data.daily?.temperature_2m_max?.[0],low:data.daily?.temperature_2m_min?.[0]};
    cacheWrite(key,out);return out;
  }
  async function pollenAt(coords){
    const key=ENV_CACHE+':pollen:'+coords.latitude+','+coords.longitude;
    const cached=cacheRead(key,60*60*1000);if(cached)return cached;
    try{
      const p=new URLSearchParams({
        latitude:String(coords.latitude),
        longitude:String(coords.longitude),
        current:'alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen',
        timezone:'auto'
      });
      const res=await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?'+p.toString());
      if(!res.ok)return null;
      const data=await res.json();
      const current=data?.current||{};
      const labels={
        alder_pollen:'Alder',
        birch_pollen:'Birch',
        grass_pollen:'Grass',
        mugwort_pollen:'Mugwort',
        olive_pollen:'Olive',
        ragweed_pollen:'Ragweed'
      };
      const types=Object.entries(labels)
        .map(([code,displayName])=>({code,displayName,value:current[code]}))
        .filter(x=>Number.isFinite(Number(x.value)))
        .map(x=>({...x,value:Number(x.value)}));
      const out=types.length?{available:true,types}:{available:false,reason:'not_available_for_region'};
      cacheWrite(key,out);return out;
    }catch(_e){return null}
  }

  function weatherSummary(weather){
    if(!weather)return '';
    return `${weather.temperature}${weather.temperatureUnit}, humidity ${weather.humidity}%, wind ${weather.wind} ${weather.windUnit}, precipitation ${weather.precipitation} ${weather.precipitationUnit}`;
  }
  async function loadEnvironment(card,force){
    const place=locationText(),content=q('[data-hd-env-content]',card);
    if(!place){content.innerHTML='<div class="hd-env-meta">Set your apiary location in Settings to load weather context.</div>';return}
    content.innerHTML='<div class="hd-env-meta">Loading environmental context…</div>';
    try{
      if(force){Object.keys(localStorage).filter(k=>k.startsWith(ENV_CACHE)).forEach(k=>localStorage.removeItem(k))}
      const coords=await geocode(place);
      const [weather,pollen]=await Promise.all([weatherAt(coords),pollenAt(coords)]);
      const items=[
        `<div class="hd-env-item"><b>${esc(weather.temperature)}${esc(weather.temperatureUnit)}</b><span>Current temperature</span></div>`,
        `<div class="hd-env-item"><b>${esc(weather.humidity)}%</b><span>Relative humidity</span></div>`,
        `<div class="hd-env-item"><b>${esc(weather.wind)} ${esc(weather.windUnit)}</b><span>Wind</span></div>`,
        `<div class="hd-env-item"><b>${weather.precipChance==null?'—':esc(weather.precipChance)+'%'}</b><span>Max precipitation chance today</span></div>`
      ];
      let pollenHtml='<div class="hd-env-meta" style="margin-top:8px">Airborne pollen: not configured. Informational only and not used in health/risk scoring.</div>';
      if(pollen&&pollen.available){
        const top=Array.isArray(pollen.types)?pollen.types.filter(x=>x&&x.value!=null).sort((a,b)=>Number(b.value)-Number(a.value))[0]:null;
        pollenHtml=top?`<div class="hd-env-meta" style="margin-top:8px">Airborne pollen: ${esc(top.displayName||top.code)} ${esc(top.category||top.value)}. Informational only; not a nectar-flow measurement and not used in scoring.</div>`:'<div class="hd-env-meta" style="margin-top:8px">Airborne pollen data returned no active index. Informational only.</div>';
      }
      content.innerHTML=`<div class="hd-env-meta">${esc(coords.name)}</div><div class="hd-env-grid">${items.join('')}</div>${pollenHtml}`;
      card.dataset.weatherSummary=weatherSummary(weather);
      const fill=q('[data-hd-fill-weather]',card);if(fill)fill.disabled=!card.dataset.weatherSummary;
    }catch(_e){
      content.innerHTML=`<div class="hd-env-meta">Environmental context unavailable${navigator.onLine===false?' while offline':''}. Existing inspection fields remain usable.</div>`;
    }
  }
  function findWeatherField(root){
    return qa('.v211-card,.v211-edit-row,.formgroup',root).find(x=>/\bweather\b/i.test(q('.v211-card-head,.vhead,label,h1,h2,h3,b,strong',x)?.textContent||''))||null;
  }
  function fillWeatherField(root,summary){
    const box=findWeatherField(root);if(!box||!summary)return false;
    const el=q('textarea,input[type="text"]',box);if(!el)return false;
    if(String(el.value||'').trim()&&!confirm('Replace the existing Weather field with current context?'))return false;
    setNativeValue(el,summary);return true;
  }
  function makeEnvironmentCard(root,inspection){
    if(q('.hd-env-card',root))return;
    const card=document.createElement('section');
    card.className='hd-env-card';
    card.innerHTML=`<h3>Environmental context</h3>
      <div data-hd-env-content><div class="hd-env-meta">Weather context has not loaded yet.</div></div>
      <div class="hd-env-actions">
        <button type="button" data-hd-refresh-env>Refresh weather</button>
        ${inspection?'<button type="button" data-hd-fill-weather disabled>Fill existing Weather field</button>':''}
      </div>`;
    const anchor=inspection?q('.hd-field-tools',root):null;
    if(anchor)anchor.insertAdjacentElement('afterend',card);else root.prepend(card);
    q('[data-hd-refresh-env]',card).onclick=()=>loadEnvironment(card,true);
    const fill=q('[data-hd-fill-weather]',card);
    if(fill)fill.onclick=()=>{if(fillWeatherField(root,card.dataset.weatherSummary))toastSafe('Weather field filled. Review before saving.');else toastSafe('No editable Weather text field was found.')};
    loadEnvironment(card,false);
  }

  function enhanceInspection(root){
    if(!root||root.getAttribute(ENH_ATTR)===VERSION)return;
    root.setAttribute(ENH_ATTR,VERSION);
    const isV211=root.classList.contains('v211-inspection');
    if(isV211)classifyInspectionCards(root);
    const bar=document.createElement('div');
    bar.className='hd-field-tools';
    bar.innerHTML=`<button type="button" data-hd-quick aria-pressed="false">Quick mode: Off</button><button type="button" data-hd-voice>Voice fill</button><span class="hd-offline-indicator"></span>`;
    const anchor=q('.switchh',root);if(anchor)anchor.insertAdjacentElement('afterend',bar);else root.prepend(bar);
    const quickBtn=q('[data-hd-quick]',bar);
    const voiceBtn=q('[data-hd-voice]',bar);
    if(isV211){
      quickBtn.onclick=()=>setQuickMode(root,!root.classList.contains('hd-quick-mode'));
      voiceBtn.onclick=()=>openVoiceModal(root);
      let saved=false;try{saved=localStorage.getItem(QUICK_STORAGE)==='1'}catch(_e){}
      setQuickMode(root,saved);
    }else{
      quickBtn.disabled=true;
      quickBtn.textContent='Quick mode: full form required';
      voiceBtn.onclick=()=>{
        try{
          if(typeof actionForm==='function'){
            const hiveId=(typeof activeInspectionHiveId!=='undefined'&&activeInspectionHiveId)||safeState()?.hives?.[0]?.id;
            actionForm('inspection',hiveId);
            setTimeout(()=>{
              const modal=q('.modal');
              if(modal)openVoiceModal(modal);
            },80);
            return;
          }
        }catch(_e){}
        toastSafe('Open the full Inspection form to use structured voice fill.');
      };
    }
    makeEnvironmentCard(root,true);
    const offline=document.createElement('div');offline.className='hd-offline-banner';offline.textContent='Offline mode: inspection edits remain local on this device and will be queued for cloud sync when connectivity returns.';offline.hidden=navigator.onLine!==false;bar.insertAdjacentElement('afterend',offline);
    refreshConnectivityUI();
  }
  function enhanceSeason(view){
    const root=q('.v124-season-page',view);if(root&&!q('.hd-env-card',root))makeEnvironmentCard(root,false);
  }
  function enhance(){
    const view=q('#view');if(!view)return;
    const inspection=q('.v211-inspection,.inspection-screen',view);if(inspection)enhanceInspection(inspection);
    enhanceDataBackup(view);enhanceSeason(view);refreshConnectivityUI();
  }
  let timer=0;
  function scheduleEnhance(){clearTimeout(timer);timer=setTimeout(enhance,30)}
  document.addEventListener('DOMContentLoaded',scheduleEnhance);
  window.addEventListener('hashchange',scheduleEnhance);
  const view=q('#view');if(view)new MutationObserver(scheduleEnhance).observe(view,{childList:true,subtree:true});
  scheduleEnhance();

  window.HiveDashFieldOps={version:VERSION,parseInspectionTranscript,rowsToCSV,requestCloudFlush};
})();
