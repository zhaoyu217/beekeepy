/* HiveDash V45 — LOCKED FEATURE + LOCKED VISUAL OVERLAY
   No feature architecture, entry-point, route, or bottom-navigation changes.
*/
const V45={
  home:'assets/home_apiary.jpg',hives:'assets/hives_apiary.jpg',hive:'assets/hive_detail.jpg',actions:'assets/actions_field.jpg',inspection:'assets/inspection_beekeeper.jpg',feeding:'assets/feeding_bucket.jpg',treatment:'assets/treatment_apiary.jpg',harvest:'assets/harvest_honey.jpg',flowers:'assets/flowers.jpg',honeycomb:'assets/honeycomb.jpg',settings:'assets/settings_apiary.jpg',season:'assets/season_apiary.jpg',map:'assets/map_bg.jpg',insights:'assets/insights_bee.jpg'
};

function v121CleanupDemoHives(s){
  if(!s || s.meta?.v121DemoHiveCleanup)return s;

  const demo={
    h4:'Willow Creek',
    h5:'South Field #2',
    h6:'East Field #1'
  };

  const removedIds=new Set(
    (s.hives||[])
      .filter(h=>demo[h.id]===h.name)
      .map(h=>h.id)
  );

  if(removedIds.size){
    s.hives=(s.hives||[]).filter(h=>!removedIds.has(h.id));

    if(s.logs){
      ['inspections','feedings','treatments','harvests'].forEach(k=>{
        if(Array.isArray(s.logs[k])){
          s.logs[k]=s.logs[k].filter(x=>!removedIds.has(x.hiveId));
        }
      });
    }

    if(Array.isArray(s.actions)){
      s.actions=s.actions.filter(x=>!removedIds.has(x.hiveId));
    }
  }

  s.meta=s.meta||{};
  s.meta.v121DemoHiveCleanup=true;
  save(s);
  return s;
}
function v45s(){const s=state();s.settings=s.settings||{};s.settings.notifications={inspection:true,varroa:true,treatment:true,feeding:true,weather:true,seasonal:true,push:true,...(s.settings.notifications||{})};s.settings.smart={voice:true,photo:true,varroaCount:true,aiHealth:true,recommendations:true,seasonWeather:true,qr:true,...(s.settings.smart||{})};s.settings.seasonal={mode:'Auto',nectar:true,swarm:'Apr – Jul',varroa:'Aug – Oct',feeding:'Aug – Oct',winter:'Oct – Feb',super:'Auto',focus:'Auto',...(s.settings.seasonal||{})};s.settings.region={measurement:s.settings.units==='metric'?'Metric':'Imperial (US)',temperature:s.settings.units==='metric'?'°C':'°F',weight:s.settings.units==='metric'?'kg':'lb',date:'MM/DD/YYYY',language:'English',timezone:s.settings.timezone||'America/Denver',...(s.settings.region||{})};s.settings.apiaryName=s.settings.apiaryName||'Oak Meadow Apiary';s.settings.location=s.settings.location||'Colorado, USA';s.hives=s.hives||[];v121CleanupDemoHives(s);return s}
function vh(id){const s=v45s();return hive(s,id)||s.hives[0]}
function vphoto(h,i=0){return v101HivePrimaryPhoto(h)}
function Vcard(title,body,action=''){return `<section class="vc"><div class="vhead"><b>${title}</b>${action}</div>${body}</section>`}
function Vhero(img,html,cls=''){return `<section class="vhero ${cls}" style="--hero:url('${img}')"><i></i>${html}</section>`}
function Vback(title,right=''){return `<button class="iconbtn" onclick="history.back()">‹</button><div class="pagebar-title">${title}</div>${right||'<span></span>'}`}
function Vstatus(h){return h.status==='Healthy'?'Good':h.status==='Attention'?'Needs Attention':'Critical'}
function Vclass(h){return h.status==='Healthy'?'good':h.status==='Attention'?'attention':'critical'}

function chrome(page){const s=v45s(),top=idq('topbar'),bottom=idq('bottomnav'),raw=(location.hash||'#home').slice(1).split('/'),id=raw[1]||s.hives[0]?.id||'h1';top.className='topbar vtop';if(page==='home')top.innerHTML=`<button class="iconbtn" onclick="go('settings')">${icon('settings')}</button><div class="brand"><img class="hd-header-logo" src="assets/hivedash-logo-header.png" alt="HiveDash"></div><button class="iconbtn" onclick="go('notifications')">${icon('bell')}${activeNotificationsV135(s).filter(n=>!n.read).length?`<span class="badge">${activeNotificationsV135(s).filter(n=>!n.read).length}</span>`:''}</button>`;else if(['hives','actions','insights'].includes(page))top.innerHTML=`<button class="iconbtn" onclick="go('settings')">${icon('settings')}</button><div class="pagebar-title">${page[0].toUpperCase()+page.slice(1)}</div><button class="iconbtn plusbtn" onclick="${page==='hives'?'addHive()':page==='actions'?`go('inspection/${id}')`:`go('analysis')`}">+</button>`;else{const t={'hive':'Hive Detail','inspection':'Inspection','timeline':'Timeline','honey':'Harvest','map':'Map','all-hives':'All Hives','all-actions':'All Actions','feeding-record':'Feeding Record','treatment-record':'Treatment Record','harvest-record':'Harvest Record','analysis':'AI Health Analysis','trend':'Health Trends','risk':'Risk Assessment','season':'Season Intelligence','honey-analytics':'Honey Analytics','recommendations':'Professional Recommendations','settings':'Settings','account':'Account','subscription':'HiveDash Pro','apiary':'Apiary & Hive','seasonal-settings':'Seasonal Settings','notification-preferences':'Notification Preferences','units-region':'Units & Region','smart-features':'Smart Features','data-backup':'Data & Backup','security':'Privacy & Security','store':'Store','notifications':'Notifications','help':'Help Center','faq':'FAQ / Report Problem','support':'Contact Support','about':'About HiveDash','version':'Version','privacy':'Privacy Policy','terms':'Terms of Service'}[page]||'HiveDash';let right='';if(page==='hive')right=`<button class="iconbtn" onclick="openHiveDetailMenu('${id}')">•••</button>`;if(page==='inspection')right=`<button class="csave" onclick="vSaveInspection('${id}')">Save</button>`;if(page==='honey')right=`<button class="iconbtn plusbtn" onclick="go('harvest-record/${id}')">+</button>`;top.innerHTML=Vback(t,right)}
const hide=['settings','account','subscription','apiary','seasonal-settings','notification-preferences','units-region','smart-features','data-backup','security','store','notifications','help','faq','support','about','version','privacy','terms','feeding-record','treatment-record','harvest-record'];bottom.classList.toggle('hidden',hide.includes(page));const active=page==='home'?'home':['hives','hive','map','all-hives'].includes(page)?'hives':['actions','inspection','all-actions','feeding-record','treatment-record','harvest-record','honey'].includes(page)?'actions':'insights';bottom.innerHTML=[['home','Home','navHome'],['hives','Hives','navHive'],['actions','Actions','navActions'],['insights','Insights','navInsights']].map(x=>`<button class="navitem ${active===x[0]?'active':''}" onclick="go('${x[0]}')">${icon(x[2])}<span>${x[1]}</span></button>`).join('')}


let V128_HONEY_RANGE='year';

function v128HoneyRangeLogs(logs,range,now=new Date()){
  const rows=(logs||[]).filter(x=>x && /^\d{4}-\d{2}-\d{2}/.test(String(x.date||'')));
  if(range==='all')return rows.slice();
  if(range==='12m'){
    const start=new Date(now);
    start.setFullYear(start.getFullYear()-1);
    start.setHours(0,0,0,0);
    return rows.filter(x=>{
      const d=new Date(String(x.date).slice(0,10)+'T12:00:00');
      return !Number.isNaN(d.getTime()) && d>=start && d<=now;
    });
  }
  const year=now.getFullYear();
  return rows.filter(x=>Number(String(x.date).slice(0,4))===year);
}

function v128HoneyUnit(s){
  const metric=s.settings?.units==='metric'||s.settings?.region?.measurement==='Metric';
  return {metric,unit:metric?'kg':'lb',factor:metric?1/2.20462:1};
}

function v128HoneyTrendPoints(logs){
  const byDate={};
  logs.forEach(x=>{
    const date=String(x.date||'').slice(0,10);
    const weight=Number(x.weightLb||0);
    if(!date || !Number.isFinite(weight))return;
    byDate[date]=(byDate[date]||0)+weight;
  });
  return Object.keys(byDate).sort().map(date=>({date,value:byDate[date]}));
}

function v128HoneyTrendSvg(points,unitInfo){
  if(points.length<2){
    return `<div class="v128-honey-empty-chart">
      <b>Not enough history</b>
      <span>At least two dated harvest records are required to show a production trend.</span>
    </div>`;
  }

  const w=320,h=128,pad=16;
  const vals=points.map(x=>x.value);
  let min=Math.min(...vals),max=Math.max(...vals);
  if(max===min){min=Math.max(0,min-1);max=max+1}
  const t0=new Date(points[0].date+'T12:00:00').getTime();
  const t1=new Date(points[points.length-1].date+'T12:00:00').getTime();
  const span=Math.max(1,t1-t0);
  const pts=points.map(x=>{
    const t=new Date(x.date+'T12:00:00').getTime();
    return {
      ...x,
      x:pad+((t-t0)/span)*(w-pad*2),
      y:h-pad-((x.value-min)/Math.max(1,max-min))*(h-pad*2)
    };
  });
  const line=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return `<div class="v128-honey-chart-wrap">
    <svg class="v128-honey-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Harvest production trend">
      <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" class="axis"/>
      <polyline points="${line}" class="trendline"/>
      ${pts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2"/>`).join('')}
    </svg>
    <div class="v128-honey-chart-labels">
      <span>${fmtDate(points[0].date)}</span>
      <span>${fmtDate(points[points.length-1].date)}</span>
    </div>
  </div>`;
}

function honeyAnalytics(r){
  const s=v45s();
  if(!isPro(s)){
    subscriptionModal('Honey Analytics');
    go('insights');
    return;
  }

  const all=(s.logs?.harvests||[]).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  const logs=v128HoneyRangeLogs(all,V128_HONEY_RANGE);
  const unitInfo=v128HoneyUnit(s);

  const totalLb=logs.reduce((n,x)=>n+(Number(x.weightLb)||0),0);
  const avgBatchLb=logs.length?totalLb/logs.length:0;
  const moistureRows=logs.filter(x=>Number.isFinite(Number(x.moisture)) && Number(x.moisture)>0);
  const avgMoisture=moistureRows.length
    ? moistureRows.reduce((n,x)=>n+Number(x.moisture),0)/moistureRows.length
    : null;

  const total=totalLb*unitInfo.factor;
  const avgBatch=avgBatchLb*unitInfo.factor;
  const points=v128HoneyTrendPoints(logs);

  const byHive={};
  logs.forEach(x=>{
    const w=Number(x.weightLb||0);
    if(!Number.isFinite(w))return;
    byHive[x.hiveId]=(byHive[x.hiveId]||0)+w;
  });
  const hiveRows=Object.entries(byHive)
    .map(([hiveId,weightLb])=>({hiveId,weightLb,h:hive(s,hiveId)}))
    .sort((a,b)=>b.weightLb-a.weightLb);

  const rangeLabel=V128_HONEY_RANGE==='year'?'This Year':V128_HONEY_RANGE==='12m'?'Last 12 Months':'All Time';

  r.innerHTML=`<div class="vs v128-honey-analytics">
    <section class="v128-honey-summary">
      <div>
        <small>HONEY ANALYTICS</small>
        <b>${logs.length} ${logs.length===1?'batch':'batches'}</b>
        <span>${esc(rangeLabel)} · real Harvest records only</span>
      </div>
      <strong>${total.toFixed(1)} <em>${unitInfo.unit}</em></strong>
    </section>

    <div class="v128-honey-ranges">
      ${[
        ['year','This Year'],
        ['12m','12 Months'],
        ['all','All Time']
      ].map(([key,label])=>`<button class="${V128_HONEY_RANGE===key?'active':''}" onclick="V128_HONEY_RANGE='${key}';honeyAnalytics(idq('view'))">${label}</button>`).join('')}
    </div>

    ${logs.length ? `
      <section class="v128-honey-stats">
        <div><small>Total Harvest</small><b>${total.toFixed(1)} ${unitInfo.unit}</b></div>
        <div><small>Avg / Batch</small><b>${avgBatch.toFixed(1)} ${unitInfo.unit}</b></div>
        <div><small>Avg Moisture</small><b>${avgMoisture===null?'—':avgMoisture.toFixed(1)+'%'}</b></div>
      </section>

      <section class="vc v128-honey-chart-card">
        <div class="vhead">
          <b>Production Trend</b>
          <span>${points.length<2?'Not enough history':`${points.length} dated points`}</span>
        </div>
        ${v128HoneyTrendSvg(points,unitInfo)}
      </section>

      <section class="vc v128-honey-hives">
        <div class="vhead"><b>Harvest by Hive</b><span>${hiveRows.length} ${hiveRows.length===1?'hive':'hives'}</span></div>
        <div class="v128-honey-hive-list">
          ${hiveRows.map((x,i)=>{
            const value=x.weightLb*unitInfo.factor;
            const pct=totalLb>0?(x.weightLb/totalLb*100):0;
            return `<button type="button" onclick="go('hive/${x.hiveId}')">
              <span class="rank">${i+1}</span>
              <span class="copy"><b>${esc(x.h?.name||'Hive')}</b><small>${pct.toFixed(0)}% of selected harvest</small></span>
              <span class="value">${value.toFixed(1)} ${unitInfo.unit}</span>
              <em>›</em>
            </button>`;
          }).join('')}
        </div>
      </section>

      <button class="v128-honey-open" type="button" onclick="go('honey')">View Harvest Records</button>
    ` : `
      <section class="v128-honey-empty">
        <b>No harvest data yet</b>
        <span>No real Harvest records exist in the selected range.</span>
        <button type="button" onclick="go('honey')">Open Harvest</button>
      </section>
    `}

    <section class="v128-honey-source">
      <b>Data source</b>
      <span>Uses saved Harvest records only. Missing moisture values are excluded from the moisture average.</span>
    </section>
  </div>`;
}


/* ==============================================================
   V135 — NOTIFICATIONS CURRENT-STATE SOURCE OF TRUTH
   Historical notifications contribute read state only.
   ============================================================== */
function notifications(r){
  const s=v45s(),rows=activeNotificationsV135(s);
  r.innerHTML=`<section><div class="h1">Notifications</div><div class="tiny muted">Alerts, reminders and seasonal updates</div></section>
    <section>${rows.length
      ? rows.map(n=>`<div class="setting card-button" style="opacity:${n.read?.65:1}" onclick="openNotification('${n.id}')"><div class="row"><div class="grow"><div class="h3">${esc(n.title)}</div><div class="small muted">${esc(n.body)}</div></div><span class="chev">›</span></div></div>`).join('')
      : '<div class="setting small muted">No active notifications.</div>'}
    </section>
    ${rows.length?'<button type="button" class="btn secondarybtn block" onclick="markAllRead()">Mark All Read</button>':''}`;
}

function openNotification(id){
  const s=v45s(),row=activeNotificationsV135(s).find(x=>x.id===id);
  if(!row)return;
  persistNotificationReadV135(s,row,true);
  save(s);
  go((row.target||'#notifications').replace(/^#/,''));
}

function markAllRead(){
  const s=v45s(),rows=activeNotificationsV135(s);
  rows.forEach(row=>persistNotificationReadV135(s,row,true));
  save(s);
  toast('All read');
  render();
}

function render(){const p=(location.hash||'#home').slice(1).split('/'),page=p[0]||'home',id=p[1],r=idq('view');r.className='view vview '+(['settings','account','subscription','apiary','seasonal-settings','notification-preferences','units-region','smart-features','data-backup','security','store','notifications','help','faq','support','about','version','privacy','terms','feeding-record','treatment-record','harvest-record'].includes(page)?'secondary':'main');const m={home:()=>home(r),hives:()=>hives(r),hive:()=>hiveDetail(r,id),inspection:()=>inspectionPage(r,id),timeline:()=>timelinePage(r),honey:()=>honeyPage(r),map:()=>mapPage(r),insights:()=>insights(r),actions:()=>actions(r),'all-hives':()=>allHives(r),'all-actions':()=>allActions(r,id),'feeding-record':()=>recordPage(r,'feeding',id),'treatment-record':()=>recordPage(r,'treatment',id),'harvest-record':()=>recordPage(r,'harvest',id),analysis:()=>healthAnalysis(r),trend:()=>trendPage(r),risk:()=>riskPage(r),season:()=>seasonPage(r),'honey-analytics':()=>honeyAnalytics(r),recommendations:()=>recommendations(r),settings:()=>settings(r),account:()=>accountPage(r),subscription:()=>subscriptionPage(r),apiary:()=>apiaryPage(r),'seasonal-settings':()=>seasonalSettings(r),'notification-preferences':()=>notificationPrefs(r),'units-region':()=>unitsRegion(r),'smart-features':()=>smartFeatures(r),'data-backup':()=>dataBackup(r),security:()=>securityPage(r),store:()=>storePage(r),notifications:()=>notifications(r),help:()=>helpPage(r),faq:()=>faqPage(r),support:()=>supportPage(r),about:()=>aboutPage(r),version:()=>versionPageV139(r),privacy:()=>infoPage(r,'Privacy Policy'),terms:()=>infoPage(r,'Terms of Service')};(m[page]||m.home)();chrome(page)}


function selectTab(btn){btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('active'));btn.classList.add('active')}
function filterHives(status,btn){selectTab(btn);const s=v45s(),rows=status==='All'?s.hives:s.hives.filter(h=>h.status===status);idq('hlist').innerHTML=rows.map(hcard).join('')}
function filterTimeline(type,btn){selectTab(btn);document.querySelectorAll('[data-timeline-type]').forEach(el=>el.style.display=(type==='All'||el.dataset.timelineType===type)?'grid':'none')}
/* V77 removed superseded filterActions */

/* V77 removed superseded home */
/* V77 removed superseded hives */
function hcard(h){return `<button class="hcard" onclick="go('hive/${h.id}')"><img src="${vphoto(h)}"><div><b>${esc(h.name)}</b><span>${h.score}% · Last ${fmtDate(h.lastInspection)}</span></div><em class="${Vclass(h)}">${Vstatus(h)}</em></button>`}function allHives(r){hives(r)}
/* V77 removed superseded hiveDetail */
function hg(t,rows){return `<section class="hg"><b>${t}</b>${rows.map(x=>`<div><span>${x[0]}</span><strong>${esc(x[1])}</strong></div>`).join('')}</section>`}
/* V77 removed superseded inspectionPage */
function ifield(a,b){return `<div class="irow"><span>${a}</span><b>${b}</b><em>›</em></div>`}function islider(a,n){return `<div class="irow slide"><span>${a}</span><i><u style="width:${n*10}%"></u></i><b>${n} / 10</b></div>`}function vSaveInspection(id){const s=v45s(),h=hive(s,id);h.lastInspection=new Date().toISOString().slice(0,10);h.notes=idq('inotes')?.value||h.notes;s.logs.inspections.push({id:'i'+Date.now(),hiveId:id,date:h.lastInspection,notes:h.notes});save(s);toast('Inspection saved');go('hive/'+id)}
/* V77 removed superseded timelinePage */
/* V77 removed superseded honeyPage */
function bars(){const v=[12,22,35,54,68,49,62,75,53,28,17,10];return `<section class="vc"><div class="vhead"><b>Monthly Harvest (lb)</b></div><div class="bars">${v.map((n,i)=>`<div><i style="height:${n}px"></i><span>${'JFMAMJJASOND'[i]}</span></div>`).join('')}</div></section>`}
/* V77 removed superseded mapPage */
/* V77 removed superseded insights */
/* V77 removed superseded actions */
/* V77 removed superseded allActions */
/* V77 removed superseded recordPage */
/* V77 removed superseded saveRec */
function healthAnalysis(r){
  const s=v45s();
  const h=s.hives[0]||{id:'h1',name:'Hive #1'};
  const photo='assets/ai_health_hero_clean.webp';

  r.innerHTML=`<div class="vs v112-ai-health">
    <section class="v112-ai-hero" style="--ai-photo:url('${photo}')">
      <div class="v112-ai-shade"></div>

      <div class="v112-ai-score" aria-label="Health score 82, Good">
        <strong>82</strong>
        <span>Good</span>
      </div>

      <div class="v112-ai-copy">
        <small>AI HEALTH ANALYSIS</small>
        <b>${esc(h.name||'Hive #1')}</b>
        <span>Current colony health assessment</span>
      </div>

      <div class="v112-ai-risk">
        <span>Risk Level</span>
        <strong>Low</strong>
      </div>
    </section>

    ${Vcard('Top Reasons',`
      <ul class="bullets v112-ai-reasons">
        <li>Strong colony population</li>
        <li>Good brood pattern</li>
        <li>Low varroa level</li>
      </ul>
    `)}

    ${Vcard('Recommended Action',`
      <div class="recol v112-ai-actions">
        <button onclick="go('inspection/${h.id}')">Continue regular inspection</button>
        <button onclick="go('risk')">Monitor for swarm signs</button>
      </div>
    `)}

    <button class="primary v112-ai-cta" onclick="go('recommendations')">View Recommendations</button>
  </div>`;
}
function drawV48Actions(mode='Pending'){
  const box=idq('alist'); if(!box)return;
  const s=v45s(),rows=v48ActionRows(mode);
  box.innerHTML=rows.length?rows.map(a=>{
    const h=hive(s,a.hiveId)||s.hives[0];
    const done=a.priority==='Done';
    return `<button onclick="${done?`go('hive/${h.id}')`:`openActionByType('${a.type}','${h.id}')`}"><span>${esc(h.name)}</span><b>${esc(a.title||a.type)}</b><em class="${done?'good':a.priority==='High'?'critical':a.priority==='Medium'?'attention':'good'}">${esc(a.priority||'Low')}</em><small>${esc(a.due||'')}</small></button>`
  }).join(''):'<div class="vc small muted">No matching actions.</div>';
}
function filterActions(mode,btn){selectTab(btn);drawV48Actions(mode)}
function openRecordPicker(){
  modal(`<div class="modalhead add-action-head">
    <b>Add Action / Record</b>
    <button class="iconbtn add-action-close" onclick="closeModal(this)" aria-label="Close">✕</button>
  </div>
  <div class="quick core-menu-actions add-action-grid">
    <button class="qbtn add-action-card" onclick="closeModal(this);go('inspection/${v45s().hives[0]?.id||''}')">
      <span class="add-action-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.2" y="4.8" width="13.6" height="16.2" rx="2.2"/><path d="M8.5 4.3h7M9.4 2.7h5.2c.5 0 .9.4.9.9v1.5H8.5V3.6c0-.5.4-.9.9-.9Z"/><path d="m8.2 10 1.5 1.5 2.4-2.7M13.8 10.3h2.3M8.2 15.2l1.5 1.5 2.4-2.7M13.8 15.5h2.3"/></svg>
      </span>
      <b>Inspection</b>
    </button>
    <button class="qbtn add-action-card" onclick="closeModal(this);go('feeding-record/${v45s().hives[0]?.id||''}')">
      <span class="add-action-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9h10l-1.1 10.2a1.5 1.5 0 0 1-1.5 1.3H9.6a1.5 1.5 0 0 1-1.5-1.3L7 9Z"/><path d="M8.5 9V6.8a3.5 3.5 0 0 1 7 0V9"/><path d="M9.5 13.2h5M10.2 16h3.6"/></svg>
      </span>
      <b>Feeding</b>
    </button>
    <button class="qbtn add-action-card" onclick="closeModal(this);go('treatment-record/${v45s().hives[0]?.id||''}')">
      <span class="add-action-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="12" height="14" rx="2"/><path d="M9 5V3h6v2"/><path d="M12 8v8M8 12h8"/></svg>
      </span>
      <b>Treatment</b>
    </button>
    <button class="qbtn add-action-card" onclick="closeModal(this);go('harvest-record/${v45s().hives[0]?.id||''}')">
      <span class="add-action-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h8l1 3H7l1-3Z"/><path d="M7 8h10v10.5A1.5 1.5 0 0 1 15.5 20h-7A1.5 1.5 0 0 1 7 18.5V8Z"/><path d="M9 12c1.6 1 4.4 1 6 0M10 15h4"/></svg>
      </span>
      <b>Harvest</b>
    </button>
  </div>`)
}
function allActions(r,mode){actions(r); if(mode){const want=String(mode).toLowerCase().startsWith('complete')?'Completed':String(mode).toLowerCase().startsWith('all')?'All':'Pending';const btn=[...document.querySelectorAll('.filters button')].find(b=>b.textContent.trim()===want);if(btn)filterActions(want,btn)}}

function recordPage(r,type,id){
  const s=v45s(),h=vh(id),cfg={feeding:['Feeding Record',V45.feeding],treatment:['Treatment Record',V45.treatment],harvest:['Harvest Record',V45.harvest]}[type];
  const today=new Date().toISOString().slice(0,10);

  if(type==='feeding'){
    const allowedHives=isPro(s)?s.hives:s.hives.slice(0,3);
    const active=allowedHives.find(x=>x.id===h.id)||allowedHives[0]||h;
    const metric=s.settings?.units==='metric'||s.settings?.region?.measurement==='Metric';
    const qtyUnit=metric?'L':'qt';
    const qtyValue=metric?'2.0':'2.1';
    const hivePhoto=v101HivePrimaryPhoto(active);

    r.innerHTML=`<div class="vs feeding-v98">
      <section class="feeding-hive-card">
        <img src="${hivePhoto}" alt="${esc(active.name)}">
        <div class="feeding-hive-copy">
          <b>${esc(active.name)}</b>
          <span>⌖ ${esc(s.settings.location||'Colorado, USA')}</span>
          <em>✓ Healthy</em>
        </div>
        <select name="hiveId" form="rform" aria-label="Change Hive" onchange="go('feeding-record/'+this.value)">
          ${allowedHives.map(x=>`<option value="${x.id}" ${x.id===active.id?'selected':''}>${esc(x.name)}</option>`).join('')}
        </select>
      </section>

      <form id="rform" class="feeding-form-v98">
        <input type="hidden" name="hiveId" value="${active.id}">

        <section class="feeding-section-v98">
          <h3><i>▣</i> FEEDING DETAILS</h3>
          <label><span>Feed Type</span><select name="Feed_Type"><option>Sugar Syrup</option><option>Pollen Patty</option><option>Dry Sugar</option></select></label>
          <label><span>Syrup Ratio</span><select name="Syrup_Ratio"><option>1:1</option><option selected>2:1</option><option>N/A</option></select></label>
          <label class="feeding-qty"><span>Quantity</span><div><input name="Quantity_Value" type="number" min="0" step=".1" value="${qtyValue}"><select name="Quantity_Unit"><option selected>${qtyUnit}</option>${metric?'<option>kg</option>':'<option>lb</option>'}</select></div></label>
        </section>

        <section class="feeding-section-v98">
          <h3><i>▦</i> SCHEDULE</h3>
          <label><span>Date</span><input name="Date" type="date" lang="en-US" value="${today}"></label>
          <label><span>Next Feeding</span><input name="Next_Feeding" type="date" lang="en-US"></label>
        </section>

        <section class="feeding-section-v98 feeding-notes-v98">
          <h3><i>✎</i> NOTES</h3>
          <label><span>Notes</span><div class="note-wrap-v98"><textarea name="Notes" maxlength="200" placeholder="Add any notes about this feeding..." oninput="this.nextElementSibling.textContent=this.value.length+' / 200'"></textarea><small>0 / 200</small></div></label>
        </section>
      </form>

      <div class="feeding-time-note">● <span>All times and dates are saved in your local time zone.</span></div>
      <button class="primary feeding-save-v98" onclick="saveRec('feeding')">▣&nbsp;&nbsp; Save Record</button>
    </div>`;
    return;
  }


  if(type==='treatment'){
    const allowedHives=isPro(s)?s.hives:s.hives.slice(0,3);
    const active=allowedHives.find(x=>x.id===h.id)||allowedHives[0]||h;
    const hivePhoto=v101HivePrimaryPhoto(active);

    r.innerHTML=`<div class="vs treatment-v102">
      <section class="treatment-hive-card">
        <img src="${hivePhoto}" alt="${esc(active.name)}">
        <div class="treatment-hive-copy">
          <b>${esc(active.name)}</b>
          <span>⌖ ${esc(s.settings.location||'Colorado, USA')}</span>
          <em>✓ ${esc(active.status||'Healthy')}</em>
        </div>
        <select aria-label="Change Hive" onchange="go('treatment-record/'+this.value)">
          ${allowedHives.map(x=>`<option value="${x.id}" ${x.id===active.id?'selected':''}>${esc(x.name)}</option>`).join('')}
        </select>
      </section>
      <form id="rform" class="treatment-form-v102">
        <input type="hidden" name="hiveId" value="${active.id}">
        <section class="treatment-section-v102">
          <h3><i>✚</i> TREATMENT DETAILS</h3>
          <label><span>Problem</span><select name="Problem">
            <option selected>Varroa Mites</option><option>Small Hive Beetle</option><option>Wax Moth</option><option>Disease</option><option>Other</option>
          </select></label>
          <label><span>Treatment</span><select name="Treatment">
            <option selected>Oxalic Acid (Dribble)</option><option>Oxalic Acid (Vapor)</option><option>Formic Acid</option><option>Thymol</option><option>Other</option>
          </select></label>
          <label><span>Product</span><input name="Product" value="Oxalic Acid Solution"></label>
          <label><span>Dose</span><input name="Dose" value="5 ml / seam"></label>
        </section>
        <section class="treatment-section-v102">
          <h3><i>▦</i> SCHEDULE</h3>
          <label><span>Start Date</span><input name="Start_Date" type="date" lang="en-US" value="${today}"></label>
          <label><span>End Date</span><input name="End_Date" type="date" lang="en-US"></label>
          <label><span>Follow-up</span><input name="Follow_up" type="date" lang="en-US"></label>
        </section>
        <section class="treatment-section-v102">
          <h3><i>!</i> SAFETY</h3>
          <label><span>Withdrawal</span><select name="Withdrawal">
            <option selected>None</option><option>1 day</option><option>3 days</option><option>7 days</option><option>14 days</option><option>Custom</option>
          </select></label>
          <div class="treatment-safety-note">Record the withdrawal period you intend to follow for the product and label you are using.</div>
        </section>
        <section class="treatment-section-v102 treatment-notes-v102">
          <h3><i>✎</i> NOTES</h3>
          <label><span>Notes</span><div class="treatment-note-wrap"><textarea name="Notes" maxlength="200" placeholder="Add notes about this treatment..." oninput="this.nextElementSibling.textContent=this.value.length+' / 200'"></textarea><small>0 / 200</small></div></label>
        </section>
      </form>
      <div class="treatment-time-note">● <span>All times and dates are saved in your local time zone.</span></div>
      <button class="primary treatment-save-v102" onclick="saveRec('treatment')">▣&nbsp;&nbsp; Save Record</button>
    </div>`;
    return;
  }


  if(type==='harvest'){
    const allowedHives=isPro(s)?s.hives:s.hives.slice(0,3);
    const active=allowedHives.find(x=>x.id===h.id)||allowedHives[0]||h;
    const hivePhoto=v101HivePrimaryPhoto(active);
    const metric=s.settings?.units==='metric'||s.settings?.region?.measurement==='Metric';
    const weightUnit=metric?'kg':'lb';
    const defaultWeight=metric?'12.7':'28';
    const nextBatch=nextHarvestBatchV107(today,s);

    r.innerHTML=`<div class="vs harvest-v103">
      <section class="harvest-hive-card">
        <img src="${hivePhoto}" alt="${esc(active.name)}">
        <div class="harvest-hive-copy">
          <b>${esc(active.name)}</b>
          <span>⌖ ${esc(s.settings.location||'Colorado, USA')}</span>
          <em>✓ ${esc(active.status||'Healthy')}</em>
        </div>
        <select aria-label="Change Hive" onchange="go('harvest-record/'+this.value)">
          ${allowedHives.map(x=>`<option value="${x.id}" ${x.id===active.id?'selected':''}>${esc(x.name)}</option>`).join('')}
        </select>
      </section>

      <form id="rform" class="harvest-form-v103">
        <input type="hidden" name="hiveId" value="${active.id}">

        <section class="harvest-section-v103">
          <h3><i>▣</i> HARVEST DETAILS</h3>
          <label><span>Date</span><input name="Date" type="date" lang="en-US" value="${today}" onchange="syncHarvestBatchV107(this)"></label>
          <label><span>Frames Harvested</span><input name="Frames_Harvested" type="number" min="0" step="1" value="8"></label>
          <label class="harvest-weight"><span>Honey Weight</span><div><input name="Honey_Weight" type="number" min="0" step=".1" value="${defaultWeight}"><select name="Honey_Weight_Unit"><option selected>${weightUnit}</option>${metric?'<option>lb</option>':'<option>kg</option>'}</select></div></label>
          <label class="harvest-moisture"><span>Moisture</span><div><input name="Moisture" type="number" min="0" max="100" step=".1" value="16.4"><b>%</b></div></label>
        </section>

        <section class="harvest-section-v103">
          <h3><i>#</i> BATCH</h3>
          <label><span>Batch Name</span><input name="Batch_Name" value="${nextBatch}" maxlength="60"></label>
        </section>

        <section class="harvest-section-v103 harvest-notes-v103">
          <h3><i>✎</i> NOTES</h3>
          <label><span>Notes</span><div class="harvest-note-wrap"><textarea name="Notes" maxlength="200" placeholder="Add notes about this harvest..." oninput="this.nextElementSibling.textContent=this.value.length+' / 200'"></textarea><small>0 / 200</small></div></label>
        </section>
      </form>

      <div class="harvest-time-note">● <span>All times and dates are saved in your local time zone.</span></div>
      <button class="primary harvest-save-v103" onclick="saveRec('harvest')">▣&nbsp;&nbsp; Save Record</button>
    </div>`;
    return;
  }

  const fields=type==='treatment'?`
    <label><span>Problem</span><input name="Problem" value="Varroa Mites"></label>
    <label><span>Treatment</span><input name="Treatment" value="Oxalic Acid (Dribble)"></label>
    <label><span>Product</span><input name="Product" value="Oxalic Acid Solution"></label>
    <label><span>Dose</span><input name="Dose" value="5 ml / seam"></label>
    <label><span>Start Date</span><input name="Start_Date" type="date" value="${today}"></label>
    <label><span>End Date</span><input name="End_Date" type="date"></label>
    <label><span>Follow-up</span><input name="Follow_up" type="date"></label>
    <label><span>Withdrawal</span><input name="Withdrawal" value="None"></label>`:`
    <label><span>Date</span><input name="Date" type="date" value="${today}"></label>
    <label><span>Frames Harvested</span><input name="Frames_Harvested" type="number" value="8"></label>
    <label><span>Honey Weight</span><input name="Honey_Weight" type="number" step=".1" value="28"></label>
    <label><span>Moisture</span><input name="Moisture" type="number" step=".1" value="16.4"></label>
    <label><span>Batch Name</span><input name="Batch_Name" value="${today}-01"></label>`;
  r.innerHTML=`<div class="vs"><div class="split rec"><img src="${cfg[1]}"><form id="rform"><label><span>Hive</span><select name="hiveId">${s.hives.map(x=>`<option value="${x.id}" ${x.id===h.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>${fields}<label><span>Notes</span><textarea name="Notes"></textarea></label></form></div><button class="primary" onclick="saveRec('${type}')">Save Record</button></div>`
}
function nextHarvestBatchV107(date,state){
  const d=String(date||new Date().toISOString().slice(0,10));
  const rx=new RegExp('^'+d+'-(\\d+)$');
  let max=0;
  ((state&&state.logs&&state.logs.harvests)||[]).forEach(x=>{
    const m=String(x.batch||'').match(rx);
    if(m) max=Math.max(max,Number(m[1])||0);
  });
  return d+'-'+String(max+1).padStart(2,'0');
}
function syncHarvestBatchV107(input){
  const form=input&&input.form;
  if(!form)return;
  const batch=form.elements['Batch_Name'];
  if(batch)batch.value=nextHarvestBatchV107(input.value,v45s());
}
function saveRec(type){
  const s=v45s(),fd=new FormData(idq('rform')),hiveId=fd.get('hiveId'),today=new Date().toISOString().slice(0,10),notes=fd.get('Notes')||'';
  if(type==='feeding'){
    s.logs.feedings.push({id:'f'+Date.now(),hiveId,date:fd.get('Date')||today,type:fd.get('Feed_Type'),ratio:fd.get('Syrup_Ratio'),amount:(fd.get('Quantity_Value')||'0')+' '+(fd.get('Quantity_Unit')||''),notes,nextFeeding:fd.get('Next_Feeding')||''});
  }else if(type==='treatment'){
    const treatmentId='t'+Date.now();
    const followUp=fd.get('Follow_up')||'';
    s.logs.treatments.push({id:treatmentId,hiveId,date:fd.get('Start_Date')||today,problem:fd.get('Problem'),type:fd.get('Treatment'),product:fd.get('Product'),dose:fd.get('Dose'),endDate:fd.get('End_Date')||'',followUp,withdrawal:fd.get('Withdrawal')||'',notes});
    if(followUp){
      s.actions=s.actions||[];
      if(!s.actions.some(a=>a.hiveId===hiveId&&a.type==='Treatment'&&a.sourceId===treatmentId)){
        s.actions.push({id:'a'+Date.now(),type:'Treatment',hiveId,title:'Treatment follow-up',priority:'Medium',due:followUp,status:'Pending',sourceId:treatmentId});
      }
    }
  }else{
    const weight=Number(fd.get('Honey_Weight')||0);
    const weightUnit=fd.get('Honey_Weight_Unit')||'lb';
    const harvestDate=fd.get('Date')||today;
    let harvestBatch=String(fd.get('Batch_Name')||'').trim();
    const autoBatchPattern=new RegExp('^'+harvestDate+'-\\d+$');
    if(!harvestBatch || (autoBatchPattern.test(harvestBatch) && s.logs.harvests.some(x=>String(x.batch||'')===harvestBatch))){
      harvestBatch=nextHarvestBatchV107(harvestDate,s);
    }
    s.logs.harvests.push({
      id:'hv'+Date.now(),
      hiveId,
      date:harvestDate,
      frames:Number(fd.get('Frames_Harvested')||0),
      weightLb:weightUnit==='kg'?Number((weight*2.20462).toFixed(2)):weight,
      weight,
      weightUnit,
      moisture:Number(fd.get('Moisture')||0),
      batch:harvestBatch,
      notes
    });
  }
  save(s);toast('Record saved');go(type==='harvest'?'honey':'actions');
}

function accountPage(r){
  const s=v45s(),provider=currentSession?.user?.app_metadata?.provider||'email';
  r.innerHTML=`<div class="vs"><section class="vc acct"><div class="avatar">${esc((s.user.name||'H')[0])}</div><b>${esc(s.user.name)}</b><span>${esc(s.user.email)}</span></section><section class="formlist"><label><span>Full Name</span><input id="aname" value="${esc(s.user.name)}"></label><label><span>Email</span><input id="aemail" value="${esc(s.user.email)}"></label><label><span>Google Account</span><input value="${provider==='google'?'Connected':'Not connected'}" readonly></label><label><span>Password</span><button type="button" onclick="sendReset()">Change Password</button></label></section><button class="primary" onclick="saveAcct()">Save</button><button class="secondary danger" onclick="requestAccountDeletion()">Delete Account</button></div>`
}
async function requestAccountDeletion(){
  if(!confirm('Delete this HiveDash account? This action requires server-side confirmation.'))return;
  localStorage.setItem('hivedash_delete_requested','1');
  toast('Deletion request recorded. Server-side account deletion must be completed by the production backend.');
}

function subscriptionPage(r){
  const s=v45s(),isPro=s.user.plan==='Pro';
  r.innerHTML=`<div class="vs"><section class="procard"><span>Current Plan</span><b>${s.user.plan} Plan</b><small>${isPro?'Pro features enabled':'Core hive management enabled'}</small><button onclick="${isPro?'manageSubscription()':"setPlan('Pro')"}">${isPro?'Manage Subscription':'Upgrade to Pro'}</button></section>${Vcard('Pro includes','<ul class="checks"><li>AI Health Analysis</li><li>Risk Prediction</li><li>Advanced Trends</li><li>Season Intelligence</li><li>Honey Analytics</li><li>Photo AI</li><li>Professional Recommendations</li><li>Reports & Export</li></ul>')}<button class="secondary" onclick="restorePurchase()">Restore Purchase</button></div>`
}
function manageSubscription(){modal(`<div class="modalhead"><b>Manage Subscription</b><button onclick="closeModal(this)">✕</button></div><div class="notice">Production billing portal connection is required here. Your current HiveDash UI route is correctly connected.</div><button class="secondary danger" onclick="closeModal(this);setPlan('Free')">Switch demo to Free</button>`)}
function restorePurchase(){const s=v45s();const saved=localStorage.getItem('hivedash_demo_entitlement');if(saved==='Pro'){s.user.plan='Pro';save(s);toast('Pro purchase restored');render()}else toast('No previous purchase found in this prototype')}
function setPlan(p){const s=v45s();s.user.plan=p;localStorage.setItem('hivedash_demo_entitlement',p);save(s);toast('Plan updated');render()}

function apiaryPage(r){
  const s=v45s(),x=s.settings;
  r.innerHTML=`<div class="vs">${Vcard('Apiaries & Hives','<div class="lines"><button onclick="go(&quot;all-hives&quot;)"><span>All Apiaries</span><b>'+s.hives.length+' hives</b><em>›</em></button></div>')}<section class="formlist"><label><span>Apiary Name</span><input id="v48apiary" value="${esc(x.apiaryName)}"></label><label><span>Location</span><input id="v48location" value="${esc(x.location)}"></label><label><span>Default Inspection Interval</span><select id="v48cycle"><option value="7" ${x.inspectionCycle==7?'selected':''}>7 days</option><option value="14" ${x.inspectionCycle==14?'selected':''}>14 days</option><option value="21" ${x.inspectionCycle==21?'selected':''}>21 days</option></select></label><label><span>Hive Type</span><select id="v48hivetype"><option ${x.hiveType==='Langstroth'?'selected':''}>Langstroth</option><option ${x.hiveType==='Flow Hive'?'selected':''}>Flow Hive</option><option ${x.hiveType==='Top Bar'?'selected':''}>Top Bar</option></select></label></section><button class="primary" onclick="saveApiaryV48()">Save Apiary Settings</button><button class="secondary" onclick="go('seasonal-settings')">Seasonal Settings</button></div>`
}
function saveApiaryV48(){const s=v45s();s.settings.apiaryName=idq('v48apiary').value.trim();s.settings.location=idq('v48location').value.trim();s.settings.inspectionCycle=Number(idq('v48cycle').value);s.settings.hiveType=idq('v48hivetype').value;save(s);toast('Apiary settings saved')}

function seasonalSettings(r){
  const s=v45s(),x=s.settings.seasonal;
  r.innerHTML=`<div class="vs"><section class="formlist"><label><span>Current Season</span><select id="smode">${['Auto','Spring','Summer','Fall','Winter'].map(v=>`<option ${x.mode===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="switchline"><span>Nectar Flow Tracking</span><input id="nectar" type="checkbox" ${x.nectar?'checked':''}></label><label><span>Swarm Season</span><input id="sswarm" value="${esc(x.swarm)}"></label><label><span>Varroa Season</span><input id="svarroa" value="${esc(x.varroa)}"></label><label><span>Feeding Season</span><input id="sfeeding" value="${esc(x.feeding)}"></label><label><span>Winter Preparation</span><input id="swinter" value="${esc(x.winter)}"></label><label><span>Super Management</span><select id="ssuper"><option ${x.super==='Auto'?'selected':''}>Auto</option><option ${x.super==='Manual'?'selected':''}>Manual</option></select></label><label><span>Seasonal Inspection Focus</span><select id="sfocus">${['Auto','Queen','Varroa'].map(v=>`<option ${x.focus===v?'selected':''}>${v}</option>`).join('')}</select></label></section><button class="primary" onclick="saveSeason()">Save Settings</button></div>`
}
function saveSeason(){const s=v45s(),x=s.settings.seasonal;x.mode=idq('smode').value;x.nectar=idq('nectar').checked;x.swarm=idq('sswarm').value;x.varroa=idq('svarroa').value;x.feeding=idq('sfeeding').value;x.winter=idq('swinter').value;x.super=idq('ssuper').value;x.focus=idq('sfocus').value;save(s);toast('Seasonal settings saved')}

function unitsRegion(r){
  const s=v45s(),x=s.settings.region;
  r.innerHTML=`<div class="vs"><section class="formlist"><label><span>Measurement System</span><select id="measure"><option ${x.measurement.startsWith('Imperial')?'selected':''}>Imperial (US)</option><option ${x.measurement==='Metric'?'selected':''}>Metric</option></select></label><label><span>Temperature</span><select id="v48temp"><option ${x.temperature==='°F'?'selected':''}>°F</option><option ${x.temperature==='°C'?'selected':''}>°C</option></select></label><label><span>Weight</span><select id="v48weight"><option ${x.weight==='lb'?'selected':''}>lb</option><option ${x.weight==='kg'?'selected':''}>kg</option></select></label><label><span>Date Format</span><select id="v48date"><option ${x.date==='MM/DD/YYYY'?'selected':''}>MM/DD/YYYY</option><option ${x.date==='DD/MM/YYYY'?'selected':''}>DD/MM/YYYY</option></select></label><label><span>Language</span><select id="v48lang"><option>English</option></select></label><label><span>Time Zone</span><input id="v48tz" value="${esc(x.timezone)}"></label></section><button class="primary" onclick="saveUnitsV48()">Save Settings</button></div>`
}
function saveUnitsV48(){const s=v45s(),x=s.settings.region;x.measurement=idq('measure').value;x.temperature=idq('v48temp').value;x.weight=idq('v48weight').value;x.date=idq('v48date').value;x.language=idq('v48lang').value;x.timezone=idq('v48tz').value;s.settings.units=x.measurement==='Metric'?'metric':'imperial';s.settings.timezone=x.timezone;save(s);toast('Units & region saved')}

function syncNowV48(){if(currentSession&&cloudReady){scheduleCloudSave(v45s());toast('Cloud sync queued')}else toast('Cloud sync requires a signed-in cloud session')}
function showSyncStatusV48(){modal(`<div class="modalhead"><b>Sync Status</b><button onclick="closeModal(this)">✕</button></div><div class="notice">${esc(cloudStatusText())}</div>`)}
function createBackupV48(){exportData();toast('Backup file created')}
function dataBackup(r){r.innerHTML=`<div class="vs"><section class="setmenu"><button onclick="syncNowV48()"><span>☁</span><b>Cloud Sync</b><em class="good">${currentSession?'Enabled':'Offline'}</em></button><button onclick="exportData()"><span>⇧</span><b>Export Data</b><em>›</em></button><button onclick="idq('importfile').click()"><span>⇩</span><b>Import Data</b><em>›</em></button><button onclick="createBackupV48()"><span>▣</span><b>Create Backup</b><em>›</em></button><button onclick="showSyncStatusV48()"><span>↻</span><b>Sync Status</b><em>${esc(cloudStatusText())}</em></button></section><input id="importfile" hidden type="file" accept="application/json"><button class="primary" onclick="syncNowV48()">Sync Now</button></div>`;idq('importfile').onchange=importData}

function dataPermissionsV48(){modal(`<div class="modalhead"><b>Data Permissions</b><button onclick="closeModal(this)">✕</button></div><div class="notice">HiveDash uses hive records, photos, voice input and location only for enabled features. Change individual smart-feature permissions from Smart Features.</div><button class="primary" onclick="closeModal(this);go('smart-features')">Manage Permissions</button>`)}
function twoFactorV48(){modal(`<div class="modalhead"><b>Two-Factor Authentication</b><button onclick="closeModal(this)">✕</button></div><div class="notice">Two-factor enrollment requires the production Supabase MFA flow. This control is routed correctly but is not falsely marked as enabled.</div>`)}
function securityPage(r){r.innerHTML=`<div class="vs"><section class="setmenu"><button onclick="go('privacy')"><span>◉</span><b>Privacy Policy</b><em>›</em></button><button onclick="go('terms')"><span>◉</span><b>Terms of Service</b><em>›</em></button><button onclick="dataPermissionsV48()"><span>◇</span><b>Data Permissions</b><em>›</em></button><button onclick="go('account')"><span>⌁</span><b>Account Security</b><em>›</em></button><button onclick="twoFactorV48()"><span>✦</span><b>Two-Factor Auth</b><em>Off</em></button></section><button class="primary" onclick="go('account')">Manage Security</button></div>`}


/* =========================================================
   V139 — SETTINGS / AUXILIARY ROUTE FIX
   Targeted repair only: restores missing Settings entries/pages.
   Existing Hive, Timeline, Photos, Supabase, Actions and Insights
   behavior is intentionally untouched.
   ========================================================= */

function notificationPrefs(r){
  const s=v45s(),x=s.settings.notifications;
  r.innerHTML=`<div class="vs"><section class="formlist">
    <label class="switchline"><span>Inspection Reminders</span><input data-v139-notif="inspection" type="checkbox" ${x.inspection?'checked':''}></label>
    <label class="switchline"><span>Varroa Alerts</span><input data-v139-notif="varroa" type="checkbox" ${x.varroa?'checked':''}></label>
    <label class="switchline"><span>Treatment Follow-up</span><input data-v139-notif="treatment" type="checkbox" ${x.treatment?'checked':''}></label>
    <label class="switchline"><span>Feeding Reminders</span><input data-v139-notif="feeding" type="checkbox" ${x.feeding?'checked':''}></label>
    <label class="switchline"><span>Weather Alerts</span><input data-v139-notif="weather" type="checkbox" ${x.weather?'checked':''}></label>
    <label class="switchline"><span>Seasonal Updates</span><input data-v139-notif="seasonal" type="checkbox" ${x.seasonal?'checked':''}></label>
    <label class="switchline"><span>Push Notifications</span><input data-v139-notif="push" type="checkbox" ${x.push?'checked':''}></label>
  </section><button class="primary" onclick="saveNotificationPrefsV139()">Save Settings</button></div>`;
}
function saveNotificationPrefsV139(){
  const s=v45s(),x=s.settings.notifications;
  document.querySelectorAll('[data-v139-notif]').forEach(el=>x[el.dataset.v139Notif]=el.checked);
  save(s);toast('Notification preferences saved');
}

function smartFeatures(r){
  const s=v45s(),x=s.settings.smart;
  const rows=[
    ['voice','Voice Notes'],['photo','Photo Analysis'],['varroaCount','Varroa Count'],
    ['aiHealth','AI Health Analysis'],['recommendations','Health Recommendations'],
    ['seasonWeather','Season & Weather Intelligence'],['qr','QR Hive Access']
  ];
  r.innerHTML=`<div class="vs"><section class="formlist">${rows.map(([k,label])=>`<label class="switchline"><span>${label}</span><input data-smart="${k}" type="checkbox" ${x[k]?'checked':''}></label>`).join('')}</section><button class="primary" onclick="saveSmart()">Save Settings</button></div>`;
}
function saveSmart(){
  const s=v45s(),x=s.settings.smart;
  document.querySelectorAll('[data-smart]').forEach(el=>x[el.dataset.smart]=el.checked);
  save(s);toast('Smart features saved');
}

function aboutPage(r){
  r.innerHTML=`<div class="vs"><section class="vc"><div class="vhead"><b>HiveDash</b></div><div class="small muted">Family Beekeeping Log</div></section><section class="setmenu"><button onclick="go('version')"><span>ⓘ</span><b>Version</b><em>›</em></button><button onclick="go('privacy')"><span>◉</span><b>Privacy Policy</b><em>›</em></button><button onclick="go('terms')"><span>◉</span><b>Terms of Service</b><em>›</em></button><button onclick="go('help')"><span>?</span><b>Help Center</b><em>›</em></button></section></div>`;
}
function versionPageV139(r){
  r.innerHTML=`<div class="vs"><section class="vc"><div class="vhead"><b>HiveDash</b></div><div class="small muted">Version 139</div></section></div>`;
}

settings=function(r){
  const s=v45s();
  const plan=esc(s.user.plan||'Free');
  r.innerHTML=`<style>
    /* ==========================================================
       V145 — SETTINGS VISUAL MASTER FINAL
       VISUAL-ONLY SCOPE:
       - no route changes
       - no entry changes
       - no navigation changes
       - no data / action logic changes
       ========================================================== */

    .v145-settings{
      width:100%;
      margin:0;
      padding:24px 6px 42px;
      position:relative;
      box-sizing:border-box;
    }
    .v145-settings *{box-sizing:border-box}

    .v145-settings .v145-settings-head{
      padding:8px 4px 20px;
    }
    .v145-settings .v145-settings-title{
      margin:0;
      color:#1f2f27;
      font-size:34px;
      line-height:1.05;
      font-weight:800;
      letter-spacing:-.8px;
    }
    .v145-settings .v145-settings-sub{
      max-width:330px;
      margin-top:8px;
      color:#626d66;
      font-size:15.5px;
      line-height:1.42;
      font-weight:500;
    }

    .v145-settings .v145-settings-hero{
      position:relative;
      overflow:hidden;
      min-height:148px;
      margin:0 0 28px;
      border:1px solid rgba(47,59,51,.09);
      border-radius:20px;
      background:
        #edf1e8
        url('assets/settings_apiary.jpg')
        69% center/cover no-repeat;
      box-shadow:
        0 12px 28px rgba(47,59,51,.10),
        0 2px 6px rgba(47,59,51,.05);
    }
    .v145-settings .v145-settings-hero:before{
      content:'';
      position:absolute;
      inset:0;
      background:linear-gradient(
        90deg,
        rgba(255,254,251,.99) 0%,
        rgba(255,254,251,.96) 28%,
        rgba(255,254,251,.78) 52%,
        rgba(255,254,251,.24) 73%,
        rgba(255,254,251,.05) 100%
      );
    }
    .v145-settings .v145-settings-hero:after{
      content:'';
      position:absolute;
      inset:0;
      pointer-events:none;
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.30);
      border-radius:20px;
    }
    .v145-settings .v145-settings-hero-copy{
      position:relative;
      z-index:1;
      display:flex;
      align-items:center;
      gap:16px;
      width:72%;
      min-height:148px;
      padding:24px 20px;
    }
    .v145-settings .v145-settings-hero-icon{
      display:grid;
      place-items:center;
      flex:0 0 52px;
      width:52px;
      height:52px;
      border-radius:50%;
      background:#5E7350;
      color:#fff;
      font-size:25px;
      line-height:1;
      box-shadow:0 5px 14px rgba(47,59,51,.18);
    }
    .v145-settings .v145-settings-hero-copy b{
      display:block;
      margin:0 0 6px;
      color:#203028;
      font-size:18px;
      line-height:1.18;
      font-weight:800;
      letter-spacing:-.2px;
    }
    .v145-settings .v145-settings-hero-copy span:not(.v145-settings-hero-icon){
      display:block;
      color:#59655d;
      font-size:14.5px;
      line-height:1.48;
      font-weight:500;
    }

    .v145-settings .v145-group{
      margin:0 0 26px;
    }
    .v145-settings .v145-group-title{
      display:flex;
      align-items:center;
      gap:10px;
      margin:0 4px 11px;
      color:#4f653f;
      font-size:16.5px;
      line-height:1.2;
      font-weight:800;
      letter-spacing:.01em;
    }
    .v145-settings .v145-group-title:after{
      content:'';
      height:1px;
      flex:1;
      background:linear-gradient(
        90deg,
        rgba(94,115,80,.22),
        rgba(94,115,80,.03)
      );
    }

    .v145-settings .v145-menu{
      overflow:hidden;
      border:1px solid rgba(47,59,51,.09);
      border-radius:20px;
      background:rgba(255,255,255,.97);
      box-shadow:
        0 10px 26px rgba(47,59,51,.085),
        0 2px 5px rgba(47,59,51,.035);
    }

    .v145-settings .v145-row{
      width:100%;
      min-height:78px;
      display:grid;
      grid-template-columns:54px minmax(0,1fr) auto;
      align-items:center;
      gap:13px;
      padding:12px 17px;
      border:0;
      border-bottom:1px solid rgba(47,59,51,.085);
      background:transparent;
      color:#2F3B33;
      text-align:left;
      cursor:pointer;
      font:inherit;
      -webkit-tap-highlight-color:transparent;
    }
    .v145-settings .v145-row:last-child{border-bottom:0}
    .v145-settings .v145-row:hover{background:#fbfaf6}
    .v145-settings .v145-row:active{background:#f4f2eb}

    .v145-settings .v145-ico{
      display:grid;
      place-items:center;
      width:48px;
      height:48px;
      border-radius:50%;
      font-size:21px;
      line-height:1;
      font-style:normal;
      font-weight:700;
      background:#eef3e9;
      color:#536b45;
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.52);
    }
    .v145-settings .v145-ico.amber{
      background:#fff0ca;
      color:#b77800;
    }
    .v145-settings .v145-ico.blue{
      background:#e7f2f8;
      color:#2f82b5;
    }
    .v145-settings .v145-ico.violet{
      background:#f0e9fb;
      color:#7450b0;
    }
    .v145-settings .v145-ico.sage{
      background:#edf4e7;
      color:#557044;
    }

    .v145-settings .v145-copy{min-width:0}
    .v145-settings .v145-copy b{
      display:block;
      color:#24332b;
      font-size:17px;
      line-height:1.2;
      font-weight:800;
      letter-spacing:-.15px;
    }
    .v145-settings .v145-copy small{
      display:block;
      margin-top:4px;
      color:#727b74;
      font-size:13.5px;
      line-height:1.38;
      font-weight:500;
      white-space:normal;
    }

    .v145-settings .v145-meta{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      min-width:26px;
      padding-left:4px;
      color:#68736b;
      font-size:15px;
      line-height:1;
      font-style:normal;
      white-space:nowrap;
    }
    .v145-settings .v145-chevron{
      font-size:29px;
      color:#778279;
      font-weight:300;
      transform:translateY(-1px);
    }
    .v145-settings .v145-version{
      color:#667058;
      font-size:15px;
      font-weight:800;
    }

    .v145-settings .v145-store{
      background:linear-gradient(90deg,#fffaf0 0%,#fff3d0 100%);
    }
    .v145-settings .v145-store:hover{
      background:linear-gradient(90deg,#fff8e8 0%,#ffedbc 100%);
    }
    .v145-settings .v145-store .v145-copy b{
      color:#785600;
    }
    .v145-settings .v145-store .v145-meta{
      color:#a46e00;
    }

    @media(max-width:370px){
      .v145-settings{padding-left:4px;padding-right:4px}
      .v145-settings .v145-settings-title{font-size:31px}
      .v145-settings .v145-settings-sub{font-size:14.5px}
      .v145-settings .v145-settings-hero{min-height:136px}
      .v145-settings .v145-settings-hero-copy{
        min-height:136px;
        width:77%;
        gap:13px;
        padding:20px 16px;
      }
      .v145-settings .v145-settings-hero-icon{
        width:48px;
        height:48px;
        flex-basis:48px;
        font-size:22px;
      }
      .v145-settings .v145-row{
        min-height:74px;
        grid-template-columns:50px minmax(0,1fr) auto;
        gap:11px;
        padding:11px 14px;
      }
      .v145-settings .v145-ico{
        width:44px;
        height:44px;
        font-size:19px;
      }
      .v145-settings .v145-copy b{font-size:16px}
      .v145-settings .v145-copy small{font-size:12.8px}
    }
  
    /* V146 SETTINGS TYPOGRAPHY UNIFIED */
    .v145-settings,
    .v145-settings button,
    .v145-settings input,
    .v145-settings select,
    .v145-settings textarea{
      font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      color:#2F3B33;
    }

    .v145-settings .v145-settings-title{
      color:#2F3B33;
      font-size:26px;
      line-height:1.16;
      font-weight:700;
      letter-spacing:-.35px;
    }
    .v145-settings .v145-settings-sub{
      color:#667068;
      font-size:14px;
      line-height:1.42;
      font-weight:400;
    }

    .v145-settings .v145-settings-hero-copy b{
      color:#2F3B33;
      font-size:16px;
      line-height:1.24;
      font-weight:700;
      letter-spacing:0;
    }
    .v145-settings .v145-settings-hero-copy span:not(.v145-settings-hero-icon){
      color:#626C65;
      font-size:13px;
      line-height:1.42;
      font-weight:400;
    }

    .v145-settings .v145-group-title{
      color:#5E7350;
      font-size:14px;
      line-height:1.3;
      font-weight:700;
      letter-spacing:0;
    }

    .v145-settings .v145-copy b{
      color:#2F3B33;
      font-size:15px;
      line-height:1.25;
      font-weight:600;
      letter-spacing:0;
    }
    .v145-settings .v145-copy small{
      color:#737B75;
      font-size:12px;
      line-height:1.38;
      font-weight:400;
    }

    .v145-settings .v145-meta{
      color:#68736B;
      font-size:13px;
      font-weight:400;
    }
    .v145-settings .v145-version{
      color:#5E7350;
      font-size:13px;
      font-weight:600;
    }
    .v145-settings .v145-store .v145-copy b{
      color:#7A5900;
      font-weight:600;
    }

    @media(max-width:370px){
      .v145-settings .v145-settings-title{font-size:26px}
      .v145-settings .v145-settings-sub{font-size:14px}
      .v145-settings .v145-copy b{font-size:15px}
      .v145-settings .v145-copy small{font-size:12px}
    }

  
    /* V147 SETTINGS — LOCKED GLOBAL TYPOGRAPHY + SPACING SYNC
       Exact values taken from the existing locked HiveDash CSS:
       V70 Global Typography:
       - page title: 18px
       - section title: 14px
       - primary/card title: 12px
       - secondary/metadata: 10px
       - base/form text: 13px
       V73/V75 colors:
       - primary text: #2F3B33
       - secondary text: #6B736D
       - brand/section green: #5E7350
       Existing locked vertical rhythm:
       - .vs gap: 9px
       - .vhead margin-bottom: 8px
    */

    .v145-settings,
    .v145-settings button,
    .v145-settings input,
    .v145-settings select,
    .v145-settings textarea{
      font-family:"Inter";
      color:#2F3B33;
    }

    /* Typography: use existing global HiveDash scale, no page-specific scale */
    .v145-settings .v145-settings-title{
      color:#2F3B33;
      font-size:18px!important;
      line-height:1.25!important;
      font-weight:800!important;
      letter-spacing:0!important;
    }
    .v145-settings .v145-settings-sub{
      color:#6B736D;
      font-size:10px!important;
      line-height:1.4!important;
      font-weight:400!important;
    }

    .v145-settings .v145-settings-hero-copy b{
      color:#2F3B33;
      font-size:12px!important;
      line-height:1.3!important;
      font-weight:800!important;
      letter-spacing:0!important;
    }
    .v145-settings .v145-settings-hero-copy span:not(.v145-settings-hero-icon){
      color:#6B736D;
      font-size:10px!important;
      line-height:1.4!important;
      font-weight:400!important;
    }

    .v145-settings .v145-group-title{
      color:#5E7350;
      font-size:14px!important;
      line-height:1.25!important;
      font-weight:800!important;
      letter-spacing:0!important;
    }

    .v145-settings .v145-copy b{
      color:#2F3B33;
      font-size:12px!important;
      line-height:1.3!important;
      font-weight:800!important;
      letter-spacing:0!important;
    }
    .v145-settings .v145-copy small{
      color:#6B736D;
      font-size:10px!important;
      line-height:1.35!important;
      font-weight:400!important;
    }

    .v145-settings .v145-meta,
    .v145-settings .v145-version{
      font-size:10px!important;
      line-height:1.2!important;
    }
    .v145-settings .v145-meta{
      color:#6B736D;
      font-weight:400!important;
    }
    .v145-settings .v145-version{
      color:#5E7350;
      font-weight:800!important;
    }
    .v145-settings .v145-store .v145-copy b{
      color:#2F3B33!important;
      font-weight:800!important;
    }

    /* Spacing: sync to locked HiveDash 8–9px vertical rhythm */
    .v145-settings{
      padding-top:12px!important;
      padding-bottom:24px!important;
    }
    .v145-settings .v145-settings-head{
      padding:4px 4px 9px!important;
    }
    .v145-settings .v145-settings-sub{
      margin-top:4px!important;
    }
    .v145-settings .v145-settings-hero{
      margin-bottom:9px!important;
    }
    .v145-settings .v145-group{
      margin-bottom:9px!important;
    }
    .v145-settings .v145-group-title{
      margin:0 4px 8px!important;
    }

    @media(max-width:370px){
      .v145-settings .v145-settings-title{font-size:18px!important}
      .v145-settings .v145-settings-sub{font-size:10px!important}
      .v145-settings .v145-copy b{font-size:12px!important}
      .v145-settings .v145-copy small{font-size:10px!important}
    }

  
    /* V148 SETTINGS — HERO CLEANUP + ROW DENSITY FINAL
       Scope is intentionally limited:
       1) Hero background cleanup
       2) Settings list-row density
       V147 typography remains untouched.
    */

    /* Replace the old settings_apiary.jpg because that asset itself
       contains baked-in Settings text/arrows. Use an existing clean,
       real apiary photo already shipped with HiveDash instead. */
    .v145-settings .v145-settings-hero{
      min-height:118px!important;
      background:
        #edf1e8
        url('assets/home_apiary.jpg')
        70% center/cover no-repeat!important;
    }
    .v145-settings .v145-settings-hero:before{
      background:linear-gradient(
        90deg,
        rgba(255,254,251,.99) 0%,
        rgba(255,254,251,.96) 32%,
        rgba(255,254,251,.82) 52%,
        rgba(255,254,251,.30) 72%,
        rgba(255,254,251,.08) 100%
      )!important;
    }
    .v145-settings .v145-settings-hero-copy{
      min-height:118px!important;
      width:70%!important;
      gap:12px!important;
      padding:16px 16px!important;
    }
    .v145-settings .v145-settings-hero-icon{
      width:42px!important;
      height:42px!important;
      flex-basis:42px!important;
      font-size:19px!important;
      box-shadow:0 4px 10px rgba(47,59,51,.16)!important;
    }

    /* Compact rows: keep V147 type sizes/colors exactly as-is. */
    .v145-settings .v145-row{
      min-height:58px!important;
      grid-template-columns:42px minmax(0,1fr) auto!important;
      gap:10px!important;
      padding:7px 13px!important;
    }
    .v145-settings .v145-ico{
      width:36px!important;
      height:36px!important;
      font-size:16px!important;
    }
    .v145-settings .v145-copy small{
      margin-top:2px!important;
    }

    @media(max-width:370px){
      .v145-settings .v145-settings-hero{
        min-height:112px!important;
      }
      .v145-settings .v145-settings-hero-copy{
        min-height:112px!important;
        width:74%!important;
        gap:10px!important;
        padding:14px 13px!important;
      }
      .v145-settings .v145-settings-hero-icon{
        width:40px!important;
        height:40px!important;
        flex-basis:40px!important;
      }
      .v145-settings .v145-row{
        min-height:56px!important;
        grid-template-columns:40px minmax(0,1fr) auto!important;
        gap:9px!important;
        padding:6px 12px!important;
      }
      .v145-settings .v145-ico{
        width:34px!important;
        height:34px!important;
        font-size:15px!important;
      }
    }

  </style>

  <div class="vs v145-settings">
    <div class="v145-settings-head">
      <h1 class="v145-settings-title">Settings</h1>
      <div class="v145-settings-sub">Manage your app preferences and beekeeping setup</div>
    </div>

    <section class="v145-settings-hero" aria-label="HiveDash settings overview">
      <div class="v145-settings-hero-copy">
        <span class="v145-settings-hero-icon" aria-hidden="true">⚙</span>
        <div>
          <b>HiveDash settings</b>
          <span>Your preferences, account and beekeeping setup in one place.</span>
        </div>
      </div>
    </section>

    <section class="v145-group">
      <div class="v145-group-title">Preferences</div>
      <div class="v145-menu">
        <button class="v145-row" onclick="go('account')"><i class="v145-ico sage">●</i><span class="v145-copy"><b>Account</b><small>Profile, sign-in and personal information</small></span><em class="v145-meta v145-chevron">›</em></button>
        <button class="v145-row" onclick="go('subscription')"><i class="v145-ico amber">★</i><span class="v145-copy"><b>Subscription</b><small>Manage your HiveDash plan</small></span><em class="v145-meta v145-version">${plan}</em></button>
        <button class="v145-row" onclick="go('apiary')"><i class="v145-ico amber">⌂</i><span class="v145-copy"><b>Apiary & Hive Management</b><small>Manage apiaries, locations and hives</small></span><em class="v145-meta v145-chevron">›</em></button>
        <button class="v145-row" onclick="go('seasonal-settings')"><i class="v145-ico sage">☀</i><span class="v145-copy"><b>Seasonal Settings</b><small>Configure seasonal reminders and guidance</small></span><em class="v145-meta v145-chevron">›</em></button>
        <button class="v145-row" onclick="go('notification-preferences')"><i class="v145-ico violet">●</i><span class="v145-copy"><b>Notification Preferences</b><small>Customize notification settings</small></span><em class="v145-meta v145-chevron">›</em></button>
        <button class="v145-row" onclick="go('units-region')"><i class="v145-ico blue">◇</i><span class="v145-copy"><b>Units & Region</b><small>Units and regional preferences</small></span><em class="v145-meta v145-chevron">›</em></button>
      </div>
    </section>

    <section class="v145-group">
      <div class="v145-group-title">App & Data</div>
      <div class="v145-menu">
        <button class="v145-row" onclick="go('smart-features')"><i class="v145-ico violet">✦</i><span class="v145-copy"><b>Smart Features</b><small>AI insights and smart recommendations</small></span><em class="v145-meta v145-chevron">›</em></button>
        <button class="v145-row" onclick="go('data-backup')"><i class="v145-ico blue">☁</i><span class="v145-copy"><b>Data & Backup</b><small>Import, export and backup your data</small></span><em class="v145-meta v145-chevron">›</em></button>
        <button class="v145-row" onclick="go('security')"><i class="v145-ico sage">◆</i><span class="v145-copy"><b>Privacy & Security</b><small>Privacy and account security settings</small></span><em class="v145-meta v145-chevron">›</em></button>
      </div>
    </section>

    <section class="v145-group">
      <div class="v145-group-title">Support & About</div>
      <div class="v145-menu">
        <button class="v145-row v145-store" onclick="window.open('https://www.skoghive.com','_blank','noopener')"><i class="v145-ico amber">⌂</i><span class="v145-copy"><b>SkogHive Store</b><small>Browse beekeeping equipment and accessories</small></span><em class="v145-meta v145-chevron">↗</em></button>
        <button class="v145-row" onclick="go('help')"><i class="v145-ico blue">?</i><span class="v145-copy"><b>Help Center</b><small>Guides, answers and app help</small></span><em class="v145-meta v145-chevron">›</em></button>
        <button class="v145-row" onclick="go('support')"><i class="v145-ico sage">✉</i><span class="v145-copy"><b>Contact Support</b><small>Get help from HiveDash support</small></span><em class="v145-meta v145-chevron">›</em></button>
        <button class="v145-row" onclick="go('about')"><i class="v145-ico sage">ⓘ</i><span class="v145-copy"><b>About HiveDash</b><small>Product information and legal links</small></span><em class="v145-meta v145-chevron">›</em></button>
        <button class="v145-row" onclick="go('version')"><i class="v145-ico sage">ⓘ</i><span class="v145-copy"><b>Version</b><small>Installed HiveDash app version</small></span><em class="v145-meta v145-version">139</em></button>
      </div>
    </section>
  </div>`;
}

const V48_NOTIFICATIONS=[['Critical','High temperature alert','hive/h3','Alerts'],['Action Required','Inspect Oak Meadow','inspection/h1','Alerts'],['Reminder','Varroa treatment due','treatment-record/h3','Reminders'],['AI Risk','Queen failure risk','risk','Alerts'],['Treatment','Follow-up recommended','treatment-record/h1','Reminders'],['Seasonal','Spring nectar flow','season','Reminders'],['System','HiveDash Pro enabled','subscription','System']];
function drawNotificationsV48(group='All'){const box=idq('v48notifs');if(!box)return;const rows=V48_NOTIFICATIONS.filter(x=>group==='All'||x[3]===group);box.innerHTML=rows.map((x,i)=>`<button onclick="go('${x[2]}')"><i class="${x[0]==='Critical'?'critical':x[0]==='Action Required'?'attention':'good'}"></i><div><b>${x[0]}</b><span>${x[1]}</span></div><time>${9+i}:30 AM</time></button>`).join('')}
/* V77 removed superseded filterNotificationsV48 */
/* V77 removed superseded notifications */

const V48_FAQ={
 'How do I add a hive?':'Open Hives and use the + button to add a hive.',
 'How does AI analysis work?':'Insights combines your recorded hive data into health, risk and recommendation views. Predictions remain clearly labeled as forecasts.',
 'How do I export my data?':'Open Settings → Data & Backup → Export Data.'
};
function openFaqV48(q){modal(`<div class="modalhead"><b>${esc(q)}</b><button onclick="closeModal(this)">✕</button></div><div class="notice">${esc(V48_FAQ[q]||'Help article unavailable.')}</div>`)}
function showFaqModeV48(mode,btn){selectTab(btn);idq('v48faqbox').style.display=mode==='FAQ'?'block':'none';idq('v48reportbox').style.display=mode==='Report'?'block':'none'}
function faqPage(r){r.innerHTML=`<div class="vs"><div class="seg"><button class="active" onclick="showFaqModeV48('FAQ',this)">FAQ</button><button onclick="showFaqModeV48('Report',this)">Report Problem</button></div><div id="v48faqbox">${Vcard('Frequently Asked Questions','<div class="lines">'+Object.keys(V48_FAQ).map(q=>`<button onclick="openFaqV48('${q.replace(/'/g,"\\'")}')"><span>${q}</span><em>›</em></button>`).join('')+'</div>')}</div><section id="v48reportbox" class="formlist" style="display:none"><label><span>Report a Problem</span><textarea id="v48report" placeholder="Describe the problem…"></textarea></label><button class="primary" onclick="submitReportV48()">Submit Report</button></section></div>`}
function submitReportV48(){const text=idq('v48report').value.trim();if(!text)return toast('Describe the problem first');const s=v45s();s.supportRequests=s.supportRequests||[];s.supportRequests.push({id:'rp'+Date.now(),type:'Bug report',message:text,date:new Date().toISOString()});save(s);toast('Report submitted');idq('v48report').value=''}
function supportPage(r){r.innerHTML=`<div class="vs"><section class="formlist"><label><span>Issue Type</span><select id="v48issue"><option>General</option><option>Account</option><option>Billing</option><option>Bug</option></select></label><label><span>Subject</span><input id="v48subject" placeholder="Brief summary"></label><label><span>Message</span><textarea id="v48message" placeholder="Describe your issue in detail…"></textarea></label><label><span>Attachments</span><input id="v48attach" type="file" multiple></label></section><button class="primary" onclick="submitSupportV48()">Send Message</button></div>`}
function submitSupportV48(){const subject=idq('v48subject').value.trim(),message=idq('v48message').value.trim();if(!subject||!message)return toast('Enter a subject and message');const s=v45s();s.supportRequests=s.supportRequests||[];s.supportRequests.push({id:'sp'+Date.now(),type:idq('v48issue').value,subject,message,attachments:[...idq('v48attach').files].map(f=>f.name),date:new Date().toISOString()});save(s);toast('Support request saved');go('help')}

function helpPage(r){r.innerHTML=`<div class="vs"><div class="search"><span>⌕</span><input id="v48helpsearch" placeholder="Search help articles…"></div><section class="setmenu" id="v48helpmenu"><button data-help="Getting Started" onclick="openFaqV48('How do I add a hive?')"><span>◉</span><b>Getting Started</b><em>›</em></button><button data-help="Hive Management" onclick="go('hives')"><span>⌂</span><b>Hive Management</b><em>›</em></button><button data-help="Inspection" onclick="go('inspection/${v45s().hives[0]?.id||''}')"><span>⌕</span><b>Inspection</b><em>›</em></button><button data-help="FAQ" onclick="go('faq')"><span>?</span><b>FAQ</b><em>›</em></button><button data-help="Contact Support" onclick="go('support')"><span>✉</span><b>Contact Support</b><em>›</em></button></section></div>`;idq('v48helpsearch').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('[data-help]').forEach(b=>b.style.display=b.dataset.help.toLowerCase().includes(q)?'grid':'none')}}


/* =========================================================
   V49 — RUNTIME / DATA CONSISTENCY AUDIT FIX
   No locked feature architecture, entry relationship, bottom-nav,
   page structure, or visual design is changed. These overrides only
   connect existing UI to live state and remove dead interactions.
   ========================================================= */

let V49_TIMELINE_LIMIT=10;
let V49_TIMELINE_CACHE=[];
let V49_TIMELINE_FILTER='All';
let V49_TIMELINE_FILTER_ROUTE='';
function v49TimelineRows(hiveId=''){
  const s=v45s(), rows=[];
  const add=(type,x,detail,img='')=>{if(!hiveId||x.hiveId===hiveId)rows.push({key:type+':'+x.id,type,hiveId:x.hiveId,date:x.date||'',detail:detail||'',img})};
  s.logs.inspections.forEach(x=>add('Inspection',x,x.notes||'Inspection saved',V45.inspection));
  s.logs.feedings.forEach(x=>add('Feeding',x,[x.type,x.ratio,x.amount].filter(Boolean).join(' · ')));
  s.logs.treatments.forEach(x=>add('Treatment',x,[x.type,x.product,x.dose].filter(Boolean).join(' · ')));
  s.logs.harvests.forEach(x=>add('Harvest',x,[formatWeight(x.weightLb||0,s),x.moisture?x.moisture+'% moisture':''].filter(Boolean).join(' · '),V45.harvest));
  s.hives.forEach(h=>hivePhotos(h).forEach(p=>{if(!hiveId||h.id===hiveId)rows.push({key:'Photo:'+p.id,type:'Photo',hiveId:h.id,date:p.date||h.lastInspection||'',detail:'Hive photo',img:p.data})}));
  return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function openTimelineEventV49(key){
  const e=V49_TIMELINE_CACHE.find(x=>x.key===key);if(!e)return;
  const s=v45s(),h=hive(s,e.hiveId);
  modal(`<div class="modalhead"><b>${esc(e.type)} · ${esc(h?.name||'Hive')}</b><button onclick="closeModal(this)">✕</button></div><div class="notice">${fmtDate(e.date)}<br>${esc(e.detail)}</div><button class="primary" onclick="closeModal(this);go('hive/${e.hiveId}')">Open Hive</button>`)
}
function applyTimelineFilterV49(){
  const q=(idq('v49tsearch')?.value||'').toLowerCase(), route=(location.hash||'#timeline').slice(1), active=V49_TIMELINE_FILTER_ROUTE===route?(V49_TIMELINE_FILTER||'All'):'All';
  document.querySelectorAll('[data-v49-timeline]').forEach((el,i)=>{const matchType=active==='All'||el.dataset.type===active, matchQ=!q||el.dataset.search.includes(q);el.style.display=(i<V49_TIMELINE_LIMIT&&matchType&&matchQ)?'grid':'none'});
  const more=idq('v49loadmore');if(more)more.style.display=V49_TIMELINE_CACHE.length>V49_TIMELINE_LIMIT?'block':'none';
}
function filterTimelineV49(type,btn){V49_TIMELINE_FILTER=type||'All';V49_TIMELINE_FILTER_ROUTE=(location.hash||'#timeline').slice(1);selectTab(btn);applyTimelineFilterV49()}
function loadMoreTimelineV49(){V49_TIMELINE_LIMIT+=10;applyTimelineFilterV49()}
function timelinePage(r){
  const route=(location.hash||'#timeline').slice(1),parts=route.split('/'),hiveId=parts[1]||'';
  /* V136: preserve the currently active Timeline filter across same-route realtime re-renders. */
  const activeFilter=r?.querySelector?.('.timeline-filters button.active[data-type]');
  if(activeFilter&&V49_TIMELINE_FILTER_ROUTE===route)V49_TIMELINE_FILTER=activeFilter.dataset.type||V49_TIMELINE_FILTER;
  if(V49_TIMELINE_FILTER_ROUTE!==route){V49_TIMELINE_FILTER='All';V49_TIMELINE_FILTER_ROUTE=route}
  V49_TIMELINE_LIMIT=10;V49_TIMELINE_CACHE=v49TimelineRows(hiveId);
  const s=v45s(), title=hiveId?esc(hive(s,hiveId)?.name||'Hive'):'';
  r.innerHTML=`<div class="vs v88-timeline timeline"><div class="fadephoto" style="--hero:url('assets/hive_detail_hero.jpg')"></div>${title?`<div class="small muted timeline-history-title">${title} history</div>`:''}<div class="search"><span>⌕</span><input id="v49tsearch" placeholder="Search timeline"></div><div class="filters timeline-filters"><button class="timeline-event ${V49_TIMELINE_FILTER==='All'?'active':''}" data-type="All" onclick="filterTimelineV49('All',this)">All</button><button class="${V49_TIMELINE_FILTER==='Inspection'?'active':''}" data-type="Inspection" onclick="filterTimelineV49('Inspection',this)">Inspection</button><button class="${V49_TIMELINE_FILTER==='Feeding'?'active':''}" data-type="Feeding" onclick="filterTimelineV49('Feeding',this)">Feeding</button><button class="${V49_TIMELINE_FILTER==='Treatment'?'active':''}" data-type="Treatment" onclick="filterTimelineV49('Treatment',this)">Treatment</button><button class="${V49_TIMELINE_FILTER==='Harvest'?'active':''}" data-type="Harvest" onclick="filterTimelineV49('Harvest',this)">Harvest</button><button class="${V49_TIMELINE_FILTER==='Photo'?'active':''}" data-type="Photo" onclick="filterTimelineV49('Photo',this)">Photos</button></div><div class="tlist">${V49_TIMELINE_CACHE.map(e=>{const h=hive(s,e.hiveId);return `<button data-v49-timeline data-type="${e.type}" data-search="${esc((e.type+' '+(h?.name||'')+' '+e.detail).toLowerCase())}" onclick="openTimelineEventV49('${e.key}')"><time>${fmtDate(e.date)}</time><i></i><div><b>${e.type}</b><span>${esc(h?.name||'Hive')}</span><small>${esc(e.detail)}</small></div>${e.img?`<img src="${e.img}">`:''}</button>`}).join('')||'<div class="vc small muted">No history yet.</div>'}</div><button id="v49loadmore" class="secondary" onclick="loadMoreTimelineV49()">Load More</button></div>`;
  idq('v49tsearch').oninput=applyTimelineFilterV49;applyTimelineFilterV49();
}

function hiveDetail(r,id){
  const s=v45s(),h=vh(id),photos=hivePhotos(h),lastTx=s.logs.treatments.filter(x=>x.hiveId===h.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
  r.innerHTML=`<div class="vs v82-hive-detail">${Vhero(v101HivePrimaryPhoto(h),`<div class="dover"><div><b>${esc(h.name)}</b><span>${esc(s.settings.location)}</span></div><div class="score"><b>${h.score}%</b><span>${Vstatus(h)}</span></div></div>`,'dhero')}<div class="meta"><span>Last inspection: ${fmtDate(h.lastInspection)}</span><span>Created Mar 5, 2025</span></div><div class="groups">${hg('Queen',[['Queen seen',h.queen],['Eggs',h.eggs?'Seen':'None'],['Larvae',h.larvae?'Seen':'None'],['Queen cells',h.queenCells?'Present':'None']])}${hg('Brood',[['Pattern',h.brood],['Strength',h.strength],['Abnormalities','None']])}${hg('Colony',[['Size',h.strength],['Population','8 frames'],['Temperament','Calm']])}${hg('Food Stores',[['Honey',h.honey],['Pollen',h.pollen],['Feeding need',h.honey==='Low'?'Yes':'No']])}${hg('Varroa',[['Last count',`${h.varroa}/100`],['Risk',h.varroa>=3?'High':'Low'],['Test date',fmtDate(h.lastInspection)]])}${hg('Treatment',[['History',lastTx?.type||'None'],['Active',lastTx&&!lastTx.endDate?'Active':'None'],['Follow-up',lastTx?.followUp?fmtDate(lastTx.followUp):'—'],['Withdrawal',lastTx?.withdrawal||'None']])}</div>${Vcard('Photos',`
  <div class="photo-card-head-actions">
    <button class="photo-card-viewall" type="button" onclick="openHivePhotoGallery('${h.id}')">View All</button>
  </div>
  <div class="photos managed-photos">
    ${photos.slice(0,3).map((p,i)=>`<div class="managed-photo">
      <button class="photo-open" type="button" onclick="openHivePhotoGallery('${h.id}')" aria-label="Open photo ${i+1}">
        <img src="${p.data}" alt="${esc(h.name)} photo ${i+1}">
      </button>
    </div>`).join('')}
    <button class="photo-add-tile" type="button" onclick="idq('phinput').click()"><b>＋</b><span>Add Photo</span></button>
  </div>
  <input id="phinput" hidden type="file" accept="image/*" multiple onchange="addHivePhotos('${h.id}',this)">`)}${Vcard('Timeline',`<div class="tease">${v49TimelineRows(h.id).slice(0,2).map(x=>`<span>${x.type} · ${fmtDate(x.date)}</span>`).join('')||'<span>No history yet</span>'}</div>`,`<button onclick="go('timeline/${h.id}')">View History</button>`)}<button class="primary" onclick="go('inspection/${h.id}')">Start Inspection</button></div>`;
  idq('phinput').onchange=e=>addHivePhotos(h.id,e.target)
}

let V49_INSPECTION_DRAFT=null;
function editInspectionV49(field,type='text'){
  if(!V49_INSPECTION_DRAFT)return;let old=V49_INSPECTION_DRAFT[field];
  const msg=field.replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase());let val=prompt(msg+':',old??'');if(val===null)return;
  if(type==='number'){val=Math.max(0,Math.min(10,Number(val)||0))} V49_INSPECTION_DRAFT[field]=val; inspectionPage(idq('view'),V49_INSPECTION_DRAFT.hiveId);chrome('inspection');
}
function inspectionPage(r,id){
  const s=v45s(),h=vh(id);if(!V49_INSPECTION_DRAFT||V49_INSPECTION_DRAFT.hiveId!==h.id)V49_INSPECTION_DRAFT={hiveId:h.id,queenStatus:h.queen||'Confirmed',strength:Number(String(h.strength).match(/\d+/)?.[0]||8),brood:h.brood||'Good',honey:h.honey||'Medium',pollen:h.pollen||'Medium',queenCells:h.queenCells?'Present':'None',varroa:Number(h.varroa||0),pests:h.shb||h.waxMoth?'Present':'None',disease:h.disease?'Present':'None',swarming:h.swarm?'Signs':'None',super:h.superStatus||'Installed',treatment:'None',voiceNotes:'',nextInspection:'',notes:h.notes||''};const d=V49_INSPECTION_DRAFT;
  r.innerHTML=`<div class="vs v86-inspection"><section class="vc switchh"><img src="${v101HivePrimaryPhoto(h)}"><div><b>${esc(h.name)}</b><span>${fmtDate(h.lastInspection)} · Inspection</span></div><select id="ihsel">${(isPro(s)?s.hives:s.hives.slice(0,3)).map(x=>`<option value="${x.id}" ${x.id===h.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></section><section class="iform"><div class="irow section-start section-colony" onclick="editInspectionV49('queenStatus')"><span>Queen Status</span><b>${esc(d.queenStatus)}</b><em>›</em></div><div class="irow slide" onclick="editInspectionV49('strength','number')"><span>Colony Strength</span><i><u style="width:${d.strength*10}%"></u></i><b>${d.strength} / 10</b></div><div class="irow" onclick="editInspectionV49('brood')"><span>Brood Pattern</span><b>${esc(d.brood)}</b><em>›</em></div><div class="irow section-start section-stores status-row" onclick="editInspectionV49('honey')"><span>Honey Stores</span><b class="${String(d.honey).toLowerCase()==='low'?'value-warn':'value-good'}">${esc(d.honey)}</b><em>›</em></div><div class="irow status-row" onclick="editInspectionV49('pollen')"><span>Pollen Stores</span><b class="${String(d.pollen).toLowerCase()==='low'?'value-warn':'value-good'}">${esc(d.pollen)}</b><em>›</em></div><div class="irow" onclick="editInspectionV49('queenCells')"><span>Queen Cells</span><b>${esc(d.queenCells)}</b><em>›</em></div><div class="irow section-start section-risk risk-row" onclick="editInspectionV49('varroa')"><span>Varroa Count</span><b class="${Number(d.varroa)>=3?'value-danger':Number(d.varroa)>=2?'value-warn':'value-good'}">${esc(d.varroa)}</b><em>›</em></div><div class="irow risk-row" onclick="editInspectionV49('pests')"><span>Pests</span><b class="${String(d.pests).toLowerCase()!=='none'?'value-danger':'value-good'}">${esc(d.pests)}</b><em>›</em></div><div class="irow risk-row" onclick="editInspectionV49('disease')"><span>Disease</span><b class="${String(d.disease).toLowerCase()!=='none'?'value-danger':'value-good'}">${esc(d.disease)}</b><em>›</em></div><div class="irow risk-row" onclick="editInspectionV49('swarming')"><span>Swarming</span><b class="${String(d.swarming).toLowerCase()!=='none'?'value-danger':'value-good'}">${esc(d.swarming)}</b><em>›</em></div><div class="irow section-start section-care" onclick="editInspectionV49('super')"><span>Super</span><b>${esc(d.super)}</b><em>›</em></div><div class="irow" onclick="editInspectionV49('treatment')"><span>Treatment</span><b>${esc(d.treatment)}</b><em>›</em></div><div class="irow section-start section-capture capture-row photo-row" onclick="idq('phinput2').click()"><span>Photos</span><b>Add photos</b><em>›</em></div><input id="phinput2" hidden type="file" accept="image/*" multiple><div class="irow capture-row voice-row" onclick="editInspectionV49('voiceNotes')"><span>Voice Notes</span><b>${d.voiceNotes?'Added':'Add voice note'}</b><em>›</em></div><div class="irow section-start section-followup" onclick="editInspectionV49('nextInspection')"><span>Next Inspection</span><b>${esc(d.nextInspection||'Set date')}</b><em>›</em></div><label class="notes"><span>Notes</span><textarea id="inotes">${esc(d.notes)}</textarea></label></section><div class="dual"><button onclick="V49_INSPECTION_DRAFT.notes=idq('inotes').value;toast('Draft saved')">Save Draft</button><button onclick="vSaveInspection('${h.id}')">Save Inspection</button></div></div>`;
  idq('ihsel').onchange=e=>{V49_INSPECTION_DRAFT=null;go('inspection/'+e.target.value)};idq('phinput2').onchange=e=>addHivePhotos(h.id,e.target)
}
function vSaveInspection(id){
  const s=v45s(),h=hive(s,id),d=V49_INSPECTION_DRAFT||{};if(!h)return;d.notes=idq('inotes')?.value||d.notes||h.notes;const date=new Date().toISOString().slice(0,10);
  h.lastInspection=date;h.notes=d.notes;h.queen=d.queenStatus||h.queen;h.brood=d.brood||h.brood;h.honey=d.honey||h.honey;h.pollen=d.pollen||h.pollen;h.queenCells=String(d.queenCells).toLowerCase().includes('present');h.varroa=Number(d.varroa)||0;h.shb=String(d.pests).toLowerCase()!=='none';h.disease=String(d.disease).toLowerCase()!=='none';h.swarm=String(d.swarming).toLowerCase()!=='none';h.superStatus=d.super||h.superStatus;h.strength=String(d.strength||h.strength);
  s.logs.inspections.push({id:'i'+Date.now(),hiveId:id,date,queenStatus:d.queenStatus,strength:Number(d.strength)||0,brood:d.brood,honey:d.honey,pollen:d.pollen,queenCells:d.queenCells,varroa:Number(d.varroa)||0,pests:d.pests,disease:d.disease,swarming:d.swarming,superStatus:d.super,treatment:d.treatment,voiceNotes:d.voiceNotes,nextInspection:d.nextInspection,notes:d.notes});
  save(s);V49_INSPECTION_DRAFT=null;toast('Inspection saved');go('hive/'+id)
}

function barsV49(monthly){const max=Math.max(1,...monthly);return `<section class="vc"><div class="vhead"><b>Monthly Harvest (${v45s().settings.units==='metric'?'kg':'lb'})</b></div><div class="bars">${monthly.map((n,i)=>`<div><i style="height:${Math.max(2,n/max*75)}px"></i><span>${'JFMAMJJASOND'[i]}</span></div>`).join('')}</div></section>`}
function openHarvestRecordViewV49(id){const s=v45s(),x=s.logs.harvests.find(y=>y.id===id);if(!x)return;const h=hive(s,x.hiveId);modal(`<div class="modalhead"><b>Harvest · ${esc(h?.name||'Hive')}</b><button onclick="closeModal(this)">✕</button></div><div class="notice">${fmtDate(x.date)} · ${formatWeight(x.weightLb||0,s)} · ${x.moisture||'—'}% moisture<br>${x.frames||0} frames${x.batch?` · ${esc(x.batch)}`:''}</div><button class="primary" onclick="closeModal(this);go('hive/${x.hiveId}')">Open Hive</button>`)}
function honeyPage(r){
  const s=v45s();
  const logs=[...s.logs.harvests].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const totalLb=logs.reduce((n,x)=>n+Number(x.weightLb||0),0);
  const avg=logs.length?logs.reduce((n,x)=>n+Number(x.moisture||0),0)/logs.length:0;
  const monthly=Array(12).fill(0);
  logs.forEach(x=>{
    const m=Number(String(x.date||'').slice(5,7))-1;
    if(m>=0&&m<12)monthly[m]+=Number(x.weightLb||0);
  });

  const metric=s.settings?.units==='metric'||s.settings?.region?.measurement==='Metric';
  const totalDisplay=metric?(totalLb/2.20462):totalLb;
  const unit=metric?'kg':'lb';
  const maxMonth=Math.max(1,...monthly);
  const monthLabels=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const recent=logs.slice(0,4).map(x=>{
    const h=hive(s,x.hiveId);
    const w=metric?Number(x.weightLb||0)/2.20462:Number(x.weightLb||0);
    return `<button class="harvest-recent-row" onclick="openHarvestRecordViewV49('${x.id}')">
      <span class="harvest-date">${fmtDate(x.date)}</span>
      <span class="harvest-recent-main">
        <b>${esc(h?.name||'Hive')}</b>
        <small>${esc(x.batch||'Harvest batch')}</small>
      </span>
      <span class="harvest-recent-value">
        <b>${w.toFixed(1)} ${unit}</b>
        <small>${Number(x.moisture||0).toFixed(1)}% moisture</small>
      </span>
      <em>›</em>
    </button>`;
  }).join('') || `<div class="harvest-empty">
    <b>No harvest records yet</b>
    <span>Add your first harvest record to start tracking honey production.</span>
  </div>`;

  r.innerHTML=`<div class="vs harvest-main-v106">
    <section class="harvest-hero-v106">
      <div class="harvest-hero-overlay"></div>
      <div class="harvest-hero-copy">
        <span>Harvest Overview</span>
        <b>${totalDisplay.toFixed(1)} ${unit}</b>
        <small>Total recorded honey</small>
      </div>
      <button class="harvest-add-v106" onclick="go('harvest-record/${s.hives[0]?.id||''}')">＋ Add Harvest</button>
    </section>

    <section class="harvest-stats-v106">
      <div><span>Total Harvest</span><b>${totalDisplay.toFixed(1)} ${unit}</b></div>
      <div><span>Total Batches</span><b>${logs.length}</b></div>
      <div><span>Avg Moisture</span><b>${logs.length?avg.toFixed(1):'—'}${logs.length?'%':''}</b></div>
    </section>

    <section class="harvest-card-v106">
      <div class="harvest-card-head">
        <div><b>Monthly Harvest</b><span>${new Date().getFullYear()}</span></div>
        <small>${unit}</small>
      </div>
      <div class="harvest-bars-v106">
        ${monthly.map((n,i)=>{
          const display=metric?n/2.20462:n;
          const h=Math.max(4,Math.round((n/maxMonth)*86));
          return `<div class="harvest-bar-item">
            <div class="harvest-bar-track"><i style="height:${h}px" title="${display.toFixed(1)} ${unit}"></i></div>
            <span>${monthLabels[i][0]}</span>
          </div>`;
        }).join('')}
      </div>
    </section>

    <section class="harvest-card-v106">
      <div class="harvest-card-head">
        <div><b>Recent Harvests</b><span>${logs.length} ${logs.length===1?'record':'records'}</span></div>
        <button onclick="openHarvestHistory()">View All</button>
      </div>
      <div class="harvest-recent-list">${recent}</div>
    </section>

    <button class="harvest-primary-v106" onclick="go('harvest-record/${s.hives[0]?.id||''}')">＋ Add Harvest Record</button>
  </div>`;
}

let V49_MAP_MODE='Apiaries',V49_MAP_ZOOM=false;
function v109MapHives(){const s=v45s();return isPro(s)?s.hives:s.hives.slice(0,3)}
function setMapModeV49(mode,btn){V49_MAP_MODE=mode;selectTab(btn);drawMapListV49()}
function zoomMapV49(){
  V49_MAP_ZOOM=!V49_MAP_ZOOM;
  const box=document.querySelector('.v109-map-canvas');
  if(box){box.classList.toggle('is-zoomed',V49_MAP_ZOOM);const b=box.querySelector('.v109-map-zoom');if(b)b.textContent=V49_MAP_ZOOM?'−':'+'}
}
function drawMapListV49(){
  const s=v45s(),box=idq('v49maplist');if(!box)return;
  const visible=v109MapHives();
  if(V49_MAP_MODE==='Forage'){
    box.innerHTML=`<section class="v109-map-info"><div class="v109-map-info-icon">✿</div><div><b>Forage Intelligence</b><small>Nectar flow, seasonal forage and timing guidance.</small></div><button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">${isPro(s)?'Open':'Pro'} <em>›</em></button></section>`;
    return;
  }
  if(V49_MAP_MODE==='Apiaries'){
    box.innerHTML=`<section class="v109-map-info"><div class="v109-map-info-icon">⌂</div><div><b>${esc(s.settings.apiaryName)}</b><small>${esc(s.settings.location)} · ${visible.length} ${visible.length===1?'hive':'hives'}${!isPro(s)?' on Free plan':''}</small></div><button onclick="go('all-hives')">View Hives <em>›</em></button></section>`;
    return;
  }
  box.innerHTML=`<div class="v109-map-hive-list">${visible.map(h=>`<button onclick="go('hive/${h.id}')"><img src="${v101HivePrimaryPhoto(h)}" alt="${esc(h.name)}"><span><b>${esc(h.name)}</b><small>${esc(String(h.score||0))}% health · Last ${fmtDate(h.lastInspection)}</small></span><em>›</em></button>`).join('')}</div>${!isPro(s)?'<div class="v109-map-free">Free plan · Map shows Hive #1–#3 only</div>':''}`;
}
let V110_MAP_ZOOM=1;
function mapZoomV110(direction){
  const canvas=document.querySelector('.v109-map-canvas');
  if(!canvas)return;
  V110_MAP_ZOOM=Math.max(1,Math.min(1.45,+(V110_MAP_ZOOM+(direction>0?.1:-.1)).toFixed(2)));
  canvas.style.setProperty('--v110-map-scale',V110_MAP_ZOOM);
}

function mapPage(r){
  const s=v45s(),visible=v109MapHives();V49_MAP_MODE='Apiaries';V49_MAP_ZOOM=false;
  const dots=visible.map((h,i)=>`<button class="v109-map-pin p${i+1}" onclick="go('hive/${h.id}')" aria-label="Open ${esc(h.name)}"><span>${i+1}</span></button>`).join('');
  r.innerHTML=`<div class="vs v109-map-page">
    <section class="v109-map-head">
      <div><b>Apiary Map</b><span>${esc(s.settings.location)}</span></div>
      <small>${visible.length} ${visible.length===1?'hive':'hives'} shown</small>
    </section>
    <div class="filters v109-map-tabs"><button class="active" onclick="setMapModeV49('Apiaries',this)">Apiaries</button><button onclick="setMapModeV49('Hives',this)">Hives</button><button onclick="setMapModeV49('Forage',this)">Forage</button></div>
    <section class="v109-map-canvas" style="--hero:url('${V45.map}')">
      <div class="v109-map-shade"></div>${dots}
      <div class="v109-map-label"><b>${esc(s.settings.apiaryName)}</b><span>${esc(s.settings.location)}</span></div>
      <div class="v110-map-zoom" aria-label="Map zoom controls">
        <button type="button" onclick="mapZoomV110(1)" aria-label="Zoom in">+</button>
        <button type="button" onclick="mapZoomV110(-1)" aria-label="Zoom out">−</button>
      </div>
    </section>
    <div class="v109-map-list" id="v49maplist"></div>
  </div>`;
  drawMapListV49();
}
/* V77 removed superseded insights */

let V49_TREND_RANGE='30D';
function setTrendRangeV49(range,btn){V49_TREND_RANGE=range;selectTab(btn);toast(range+' trend range selected')}
/* V120 — Inspection History Sync
   Backfill only from already-stored Hive snapshot data + lastInspection date.
   No synthetic dates and no invented trend points. */
function v120SyncInspectionHistory(s){
  s.logs=s.logs||{};
  s.logs.inspections=Array.isArray(s.logs.inspections)?s.logs.inspections:[];
  let changed=false;

  (s.hives||[]).forEach(h=>{
    const date=String(h.lastInspection||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;

    const exists=s.logs.inspections.some(x=>x && x.hiveId===h.id && String(x.date||'').slice(0,10)===date);
    if(exists)return;

    const score=Number(h.score);
    s.logs.inspections.push({
      id:`legacy-${h.id}-${date}`,
      hiveId:h.id,
      date,
      queenStatus:h.queen||'',
      brood:h.brood||'',
      honey:h.honey||'',
      pollen:h.pollen||'',
      varroa:Number.isFinite(Number(h.varroa))?Number(h.varroa):null,
      notes:h.notes||'',
      scoreSnapshot:Number.isFinite(score)?score:null,
      legacySnapshot:true
    });
    changed=true;
  });

  if(changed){
    s.logs.inspections.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
    save(s);
  }
  return changed;
}

function v119TrendStart(range,now=new Date()){
  const end=new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59,999);
  let start;
  if(range==='7D'){
    start=new Date(end); start.setDate(start.getDate()-6); start.setHours(0,0,0,0);
  }else if(range==='30D'){
    start=new Date(end); start.setDate(start.getDate()-29); start.setHours(0,0,0,0);
  }else if(range==='90D'){
    start=new Date(end); start.setDate(start.getDate()-89); start.setHours(0,0,0,0);
  }else{
    start=new Date(end.getFullYear(),0,1,0,0,0,0);
  }
  return {start,end};
}

function v119DateValue(v){
  if(!v)return null;
  const d=new Date(String(v).slice(0,10)+'T12:00:00');
  return Number.isNaN(d.getTime())?null:d;
}

function v119EnumValue(v,map){
  const key=String(v||'').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(map,key)?map[key]:null;
}

function v119InspectionHealth(x){
  const snapshot=Number(x.scoreSnapshot);
  if(Number.isFinite(snapshot) && snapshot>=0 && snapshot<=100)return Math.round(snapshot);
  const vals=[];
  const strength=Number(x.strength);
  if(Number.isFinite(strength) && strength>=0 && strength<=10)vals.push(strength*10);

  const brood=v119EnumValue(x.brood,{excellent:100,good:82,fair:60,poor:35});
  if(brood!==null)vals.push(brood);

  const honey=v119EnumValue(x.honey,{high:100,medium:70,low:40,none:10});
  const pollen=v119EnumValue(x.pollen,{high:100,medium:70,low:40,none:10});
  if(honey!==null || pollen!==null){
    const stores=[honey,pollen].filter(v=>v!==null);
    vals.push(stores.reduce((a,b)=>a+b,0)/stores.length);
  }

  const varroa=Number(x.varroa);
  if(Number.isFinite(varroa) && varroa>=0){
    vals.push(varroa<=1?95:varroa<=2?80:varroa<=3?62:varroa<=4?44:25);
  }

  const queen=v119EnumValue(x.queenStatus,{confirmed:95,'not confirmed':55,unknown:50,missing:20,absent:20});
  if(queen!==null)vals.push(queen);

  // Strict rule: do not manufacture a score from a fragmentary legacy record.
  if(vals.length<3)return null;
  return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
}

function v119MetricPoint(x,key){
  if(key==='health')return v119InspectionHealth(x);
  if(key==='varroa'){
    const n=Number(x.varroa); return Number.isFinite(n)&&n>=0?n:null;
  }
  if(key==='stores'){
    const a=v119EnumValue(x.honey,{high:3,medium:2,low:1,none:0});
    const b=v119EnumValue(x.pollen,{high:3,medium:2,low:1,none:0});
    const vals=[a,b].filter(v=>v!==null);
    return vals.length?vals.reduce((m,n)=>m+n,0)/vals.length:null;
  }
  if(key==='brood')return v119EnumValue(x.brood,{excellent:4,good:3,fair:2,poor:1});
  if(key==='queen'){
    const q=String(x.queenStatus||'').trim().toLowerCase();
    if(!q)return null;
    return q==='confirmed'?1:0;
  }
  return null;
}

function v119Series(rows,key){
  const grouped={};
  rows.forEach(x=>{
    const d=String(x.date||'').slice(0,10);
    const v=v119MetricPoint(x,key);
    if(!d || v===null || !Number.isFinite(v))return;
    (grouped[d]||(grouped[d]=[])).push(v);
  });
  return Object.keys(grouped).sort().map(date=>{
    const a=grouped[date];
    return {date,value:a.reduce((m,n)=>m+n,0)/a.length,count:a.length};
  });
}

function v119TrendStatus(series,threshold,invert=false){
  if(series.length<2)return {label:'Not enough history',cls:'muted',delta:null};
  const first=series[0].value,last=series[series.length-1].value,delta=last-first;
  if(Math.abs(delta)<threshold)return {label:'Stable',cls:'stable',delta};
  const up=delta>0;
  const positive=invert?!up:up;
  return {label:(up?'↑ ':'↓ ')+Math.abs(delta).toFixed(1),cls:positive?'good':'bad',delta};
}

function v119MetricText(key,series){
  if(series.length<2)return 'Not enough history';
  const v=series[series.length-1].value;
  if(key==='health')return Math.round(v).toString();
  if(key==='varroa')return v.toFixed(1);
  if(key==='stores')return v>=2.5?'High':v>=1.5?'Medium':'Low';
  if(key==='brood')return v>=3.5?'Excellent':v>=2.5?'Good':v>=1.5?'Fair':'Poor';
  if(key==='queen')return Math.round(v*100)+'%';
  return '—';
}

function v119HealthChart(series){
  if(series.length<2){
    return `<div class="v119-chart-empty"><b>Not enough history</b><span>At least two dated inspections with sufficient health fields are required in this range.</span></div>`;
  }
  const w=320,h=130,pad=16;
  const vals=series.map(x=>x.value);
  let min=Math.min(...vals),max=Math.max(...vals);
  if(max-min<10){min=Math.max(0,min-5);max=Math.min(100,max+5)}
  const t0=v119DateValue(series[0].date).getTime();
  const t1=v119DateValue(series[series.length-1].date).getTime();
  const span=Math.max(1,t1-t0);
  const pts=series.map(x=>{
    const t=v119DateValue(x.date).getTime();
    const px=pad+((t-t0)/span)*(w-pad*2);
    const py=h-pad-((x.value-min)/Math.max(1,max-min))*(h-pad*2);
    return {x:px,y:py,...x};
  });
  const line=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const first=series[0],last=series[series.length-1];
  return `<div class="v119-chart-wrap">
    <svg class="v119-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Health score trend">
      <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" class="axis"/>
      <polyline points="${line}" class="trendline"/>
      ${pts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2"/>`).join('')}
    </svg>
    <div class="v119-chart-labels"><span>${fmtDate(first.date)}</span><span>${fmtDate(last.date)}</span></div>
  </div>`;
}

function trendPage(r){
  const s=v45s();
  v120SyncInspectionHistory(s);
  const allowedHives=isPro(s)?s.hives:s.hives.slice(0,3);
  const allowedIds=new Set(allowedHives.map(h=>h.id));
  const {start,end}=v119TrendStart(V49_TREND_RANGE);

  // Timeline's Inspection events come from this same source of truth.
  const rows=(s.logs?.inspections||[])
    .filter(x=>allowedIds.has(x.hiveId))
    .filter(x=>{
      const d=v119DateValue(x.date);
      return d && d>=start && d<=end;
    })
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)));

  const series={
    health:v119Series(rows,'health'),
    varroa:v119Series(rows,'varroa'),
    stores:v119Series(rows,'stores'),
    brood:v119Series(rows,'brood'),
    queen:v119Series(rows,'queen')
  };

  const trend={
    health:v119TrendStatus(series.health,3,false),
    varroa:v119TrendStatus(series.varroa,.35,true),
    stores:v119TrendStatus(series.stores,.2,false),
    brood:v119TrendStatus(series.brood,.2,false),
    queen:v119TrendStatus(series.queen,.12,false)
  };

  const metrics=[
    ['Health Score','health','Derived only from sufficiently complete inspection records.'],
    ['Varroa Level','varroa','Average recorded mite level.'],
    ['Food Stores','stores','Average honey + pollen store rating.'],
    ['Brood Pattern','brood','Average recorded brood quality.'],
    ['Queen Status','queen','Share of inspections with queen confirmed.']
  ];

  const usableHealth=series.health.length;
  const scopeText=`${rows.length} inspection ${rows.length===1?'record':'records'} · ${allowedHives.length} ${allowedHives.length===1?'hive':'hives'} in scope`;

  r.innerHTML=`<div class="vs v119-health-trends">
    <section class="v119-trend-summary">
      <div>
        <small>HEALTH TRENDS</small>
        <b>${V49_TREND_RANGE}</b>
        <span>${esc(scopeText)}</span>
      </div>
      <strong>${usableHealth>=2?v119MetricText('health',series.health):'—'}</strong>
    </section>

    <div class="filters v119-trend-ranges">
      ${['7D','30D','90D','Season'].map(x=>`<button class="${V49_TREND_RANGE===x?'active':''}" onclick="setTrendRangeV119('${x}')">${x}</button>`).join('')}
    </div>

    <section class="vc v119-chart-card">
      <div class="vhead"><b>Health Score</b><span>${usableHealth>=2?trend.health.label:'Not enough history'}</span></div>
      ${v119HealthChart(series.health)}
    </section>

    <section class="v119-trend-grid">
      ${metrics.map(([label,key,note])=>{
        const st=trend[key];
        return `<div class="v119-trend-card">
          <span>${label}</span>
          <b>${v119MetricText(key,series[key])}</b>
          <em class="${st.cls}">${st.label}</em>
          <small>${note}</small>
        </div>`;
      }).join('')}
    </section>

    <section class="vc v119-source-note">
      <b>Data source</b>
      <span>Uses dated Inspection records shown in Timeline. Range filters never create synthetic history.</span>
      <span>${isPro(s)?'Pro scope: all hives.':'Free scope: Hive #1–#3 only.'}</span>
    </section>
  </div>`;
}

function setTrendRangeV119(range){
  V49_TREND_RANGE=range;
  trendPage(idq('view'));
}




function v127RecommendationItems(s){
  const items=[];
  const seasonal=typeof v124SeasonAssessment==='function' ? v124SeasonAssessment(s) : null;
  const seasonalByKey={};
  (seasonal?.actions||[]).forEach(x=>seasonalByKey[x.key]=x);

  (s.hives||[]).forEach(h=>{
    const risk=typeof riskAssessment==='function'
      ? riskAssessment(h)
      : {level:'Low',reasons:[]};

    const hiveName=h.name||'Hive';
    const varroa=Number(h.varroa);
    const queen=String(h.queen||'').trim().toLowerCase();
    const honey=String(h.honey||'').trim().toLowerCase();
    const pollen=String(h.pollen||'').trim().toLowerCase();

    if(Number.isFinite(varroa) && varroa>=3){
      const seasonBoost=seasonalByKey.mites?.priority==='Priority';
      items.push({
        key:`${h.id}:varroa`,
        hiveId:h.id,
        hiveName,
        priority:risk.level==='High' || seasonBoost ? 'Priority' : 'Action',
        rank:risk.level==='High' || seasonBoost ? 100 : 70,
        title:'Verify elevated Varroa',
        why:`${hiveName} has a recorded Varroa count of ${varroa}.`,
        action:'Recheck the mite count and decide whether treatment is needed.',
        when:risk.level==='High'?'Within 24 hours':'Within 3 days',
        cta:'Start Inspection',
        route:`inspection/${h.id}`
      });
    }

    if(queen==='missing' || queen==='absent'){
      items.push({
        key:`${h.id}:queen`,
        hiveId:h.id,
        hiveName,
        priority:'Priority',
        rank:95,
        title:'Confirm queen status',
        why:`${hiveName} has a missing or absent queen status.`,
        action:'Inspect for the queen, eggs, larvae, and queen cells before making a queen-management decision.',
        when:'Within 24 hours',
        cta:'Start Inspection',
        route:`inspection/${h.id}`
      });
    }else if(queen && queen!=='confirmed'){
      const seasonBoost=seasonalByKey.queen?.priority==='Priority';
      items.push({
        key:`${h.id}:queen`,
        hiveId:h.id,
        hiveName,
        priority:seasonBoost?'Priority':'Action',
        rank:seasonBoost?80:60,
        title:'Confirm queen status',
        why:`${hiveName} has an unconfirmed queen status.`,
        action:'Use the next inspection to confirm the queen or fresh brood evidence.',
        when:seasonBoost?'Within 3 days':'Next inspection',
        cta:'Start Inspection',
        route:`inspection/${h.id}`
      });
    }

    if(honey==='low' || pollen==='low'){
      const both=honey==='low' && pollen==='low';
      const seasonBoost=seasonalByKey.food?.priority==='Priority';
      items.push({
        key:`${h.id}:food`,
        hiveId:h.id,
        hiveName,
        priority:both || seasonBoost || risk.level==='High' ? 'Priority' : 'Action',
        rank:both || seasonBoost || risk.level==='High' ? 90 : 55,
        title:'Review food stores',
        why:both
          ? `${hiveName} has low honey and pollen stores.`
          : `${hiveName} has low ${honey==='low'?'honey':'pollen'} stores.`,
        action:'Check available stores and record feeding only if supplemental feed is actually needed.',
        when:seasonBoost?'This week':'Before the next inspection',
        cta:'Record Feeding',
        route:`feeding-record/${h.id}`
      });
    }
  });

  items.sort((a,b)=>b.rank-a.rank || a.hiveName.localeCompare(b.hiveName) || a.title.localeCompare(b.title));
  return items;
}

function recommendations(r){
  const s=v45s();
  if(!isPro(s)){
    subscriptionModal('Professional Recommendations');
    go('insights');
    return;
  }

  const items=v127RecommendationItems(s);
  const priorityCount=items.filter(x=>x.priority==='Priority').length;
  const hiveCount=new Set(items.map(x=>x.hiveId)).size;

  r.innerHTML=`<div class="vs v127-recommendations-page">
    <section class="v127-reco-summary">
      <div>
        <small>CURRENT RECOMMENDATIONS</small>
        <b>${items.length} ${items.length===1?'action':'actions'}</b>
        <span>${hiveCount} ${hiveCount===1?'hive':'hives'} need attention</span>
      </div>
      <div class="v127-reco-summary-pill">${priorityCount} priority</div>
    </section>

    ${items.length ? `
      <section class="v127-reco-list">
        ${items.map(x=>`
          <article class="v127-reco-card ${x.priority==='Priority'?'priority':''}">
            <div class="v127-reco-top">
              <div>
                <small>${esc(x.hiveName)}</small>
                <b>${esc(x.title)}</b>
              </div>
              <span>${esc(x.priority)}</span>
            </div>

            <div class="v127-reco-grid">
              <div><small>Why</small><p>${esc(x.why)}</p></div>
              <div><small>What to do</small><p>${esc(x.action)}</p></div>
              <div><small>When</small><p>${esc(x.when)}</p></div>
            </div>

            <button type="button" onclick="go('${x.route}')">${esc(x.cta)} <em>›</em></button>
          </article>`).join('')}
      </section>` : `
      <section class="v127-reco-empty">
        <b>No current recommendations</b>
        <span>Current hive records do not trigger a Varroa, queen-status, or food-store recommendation.</span>
      </section>`}

    <section class="v127-reco-source">
      <div>
        <b>How recommendations are generated</b>
        <span>Uses current Hive records, Risk Assessment rules, and Seasonal Settings.</span>
      </div>
      <small>No weather, bloom, or future forecast is invented.</small>
    </section>
  </div>`;
}

/* =========================================================
   V50 — RESILIENCE / EDGE-CASE AUDIT FIX
   No locked feature architecture, entry relationship, navigation,
   page structure, or visual design changes.
   ========================================================= */

// Reconnect global state/cloud helpers to V50 behavior after the locked visual overlay loads.
window.addEventListener('online',()=>{setCloudStatus('Saving…');if(isAuthenticated())scheduleCloudSave(state())});
window.addEventListener('offline',()=>setCloudStatus('Offline'));

// ---------- Pro entitlement gating ----------
const V50_PRO_FEATURES=new Set(['photo','varroaCount','aiHealth','recommendations','seasonWeather']);
function v50GuardPro(feature,fallback='insights'){
  if(isPro(v45s()))return true;
  setTimeout(()=>subscriptionModal(feature),0);
  if((location.hash||'').replace(/^#/,'').split('/')[0]!==fallback)go(fallback);
  return false;
}
const V50_OLD_ANALYSIS=healthAnalysis,V50_OLD_TREND=trendPage,V50_OLD_RISK=riskPage,V50_OLD_SEASON=seasonPage,V50_OLD_HONEY=honeyAnalytics,V50_OLD_RECO=recommendations,V50_OLD_SMART=smartFeatures;
healthAnalysis=function(r){if(!v50GuardPro('AI Health Analysis'))return;V50_OLD_ANALYSIS(r)};
trendPage=function(r){if(!v50GuardPro('Advanced Health Trends'))return;V50_OLD_TREND(r)};
riskPage=function(r){if(!v50GuardPro('Risk Prediction'))return;V50_OLD_RISK(r)};
seasonPage=function(r){if(!v50GuardPro('Season Intelligence','home'))return;V50_OLD_SEASON(r)};
honeyAnalytics=function(r){if(!v50GuardPro('Honey Analytics'))return;V50_OLD_HONEY(r)};
recommendations=function(r){if(!v50GuardPro('Professional Recommendations'))return;V50_OLD_RECO(r)};
smartFeatures=function(r){
  V50_OLD_SMART(r);const s=v45s();document.querySelectorAll('[data-smart]').forEach(el=>{
    const key=el.dataset.smart;if(!V50_PRO_FEATURES.has(key))return;
    el.onchange=()=>{if(!isPro(s)&&el.checked){el.checked=false;subscriptionModal(el.closest('label')?.querySelector('span')?.textContent||'this smart feature')}};
  });
};
const V50_OLD_SAVE_SMART=saveSmart;
saveSmart=function(){
  const s=v45s();document.querySelectorAll('[data-smart]').forEach(e=>{if(!isPro(s)&&V50_PRO_FEATURES.has(e.dataset.smart))e.checked=false});V50_OLD_SAVE_SMART();
};

// ---------- Persistent inspection drafts + bounded values ----------
function v50DraftKey(id){return 'hivedash_inspection_draft_'+id}
function persistInspectionDraftV50(){if(!V49_INSPECTION_DRAFT)return;try{V49_INSPECTION_DRAFT.notes=idq('inotes')?.value||V49_INSPECTION_DRAFT.notes||'';localStorage.setItem(v50DraftKey(V49_INSPECTION_DRAFT.hiveId),JSON.stringify(V49_INSPECTION_DRAFT))}catch(e){toast('Draft could not be saved') }}
function loadInspectionDraftV50(id){try{const raw=localStorage.getItem(v50DraftKey(id));return raw?JSON.parse(raw):null}catch(e){return null}}
const V50_OLD_EDIT_INSPECTION=editInspectionV49,V50_OLD_INSPECTION_PAGE=inspectionPage;
editInspectionV49=function(field,type='text'){V50_OLD_EDIT_INSPECTION(field,type);if(V49_INSPECTION_DRAFT){if(field==='varroa')V49_INSPECTION_DRAFT.varroa=Math.max(0,Math.min(100,Number(V49_INSPECTION_DRAFT.varroa)||0));persistInspectionDraftV50()}};
inspectionPage=function(r,id){
  if(!V49_INSPECTION_DRAFT||V49_INSPECTION_DRAFT.hiveId!==id){const d=loadInspectionDraftV50(id);if(d)V49_INSPECTION_DRAFT=d}
  V50_OLD_INSPECTION_PAGE(r,id);
  const draftBtn=[...r.querySelectorAll('.dual button')].find(b=>b.textContent.includes('Draft'));if(draftBtn)draftBtn.onclick=()=>{persistInspectionDraftV50();toast('Draft saved')};
};
const V50_OLD_SAVE_INSPECTION=vSaveInspection;let V50_INSPECTION_SAVING=false;
vSaveInspection=function(id){
  if(V50_INSPECTION_SAVING)return;const d=V49_INSPECTION_DRAFT||loadInspectionDraftV50(id)||{};
  const strength=Number(d.strength),varroa=Number(d.varroa);if(!Number.isFinite(strength)||strength<0||strength>10)return toast('Colony strength must be between 0 and 10');if(!Number.isFinite(varroa)||varroa<0||varroa>100)return toast('Varroa value must be between 0 and 100');
  if(d.nextInspection && d.nextInspection<new Date().toISOString().slice(0,10))return toast('Next inspection cannot be in the past');
  V50_INSPECTION_SAVING=true;try{V50_OLD_SAVE_INSPECTION(id);localStorage.removeItem(v50DraftKey(id))}finally{setTimeout(()=>V50_INSPECTION_SAVING=false,500)}
};

// ---------- Record validation / duplicate-submit protection ----------
let V50_RECORD_SAVING=false;
function validDateV50(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||'')) && !Number.isNaN(Date.parse(v+'T12:00:00'))}
const V50_OLD_SAVE_REC=saveRec;
saveRec=function(type){
  if(V50_RECORD_SAVING)return;const form=idq('rform');if(!form)return;const fd=new FormData(form),s=v45s(),hiveId=fd.get('hiveId');if(!hive(s,hiveId))return toast('Select a valid hive');
  const today=new Date().toISOString().slice(0,10),notes=String(fd.get('Notes')||'');if(notes.length>2000)return toast('Notes are too long');
  if(type==='feeding'){
    const date=fd.get('Date'),next=fd.get('Next_Feeding'),qty=String(fd.get('Quantity')||'').trim();if(!validDateV50(date)||date>today)return toast('Feeding date is invalid');if(!qty||qty.length>40)return toast('Enter a valid feeding quantity');if(next&&(!validDateV50(next)||next<date))return toast('Next feeding must be after the feeding date');
  }else if(type==='treatment'){
    const start=fd.get('Start_Date'),end=fd.get('End_Date'),follow=fd.get('Follow_up');for(const k of ['Problem','Treatment','Product','Dose'])if(!String(fd.get(k)||'').trim())return toast(k.replace('_',' ')+' is required');if(!validDateV50(start)||start>today)return toast('Treatment start date is invalid');if(end&&(!validDateV50(end)||end<start))return toast('End date cannot be before start date');if(follow&&(!validDateV50(follow)||follow<start))return toast('Follow-up cannot be before start date');
  }else if(type==='harvest'){
    const date=fd.get('Date'),frames=Number(fd.get('Frames_Harvested')),weight=Number(fd.get('Honey_Weight')),moisture=Number(fd.get('Moisture'));if(!validDateV50(date)||date>today)return toast('Harvest date is invalid');if(!Number.isInteger(frames)||frames<1||frames>500)return toast('Frames must be a whole number from 1 to 500');if(!Number.isFinite(weight)||weight<=0||weight>5000)return toast('Honey weight must be greater than 0');if(!Number.isFinite(moisture)||moisture<0||moisture>100)return toast('Moisture must be between 0% and 100%');
  }
  V50_RECORD_SAVING=true;try{V50_OLD_SAVE_REC(type)}finally{setTimeout(()=>V50_RECORD_SAVING=false,500)}
};

// ---------- Safe backup import: schema check, size limit, no entitlement/account escalation ----------
function validateBackupV50(x){return !!(x&&typeof x==='object'&&Array.isArray(x.hives)&&x.settings&&typeof x.settings==='object'&&x.logs&&['inspections','feedings','treatments','harvests'].every(k=>Array.isArray(x.logs[k]||[]))&&x.hives.every(h=>h&&typeof h.id==='string'&&typeof h.name==='string'))}
importData=function(e){
  const f=e.target.files?.[0];if(!f)return;if(f.size>5*1024*1024){e.target.value='';return toast('Backup file is too large')}
  const reader=new FileReader();reader.onerror=()=>toast('Backup file could not be read');reader.onload=()=>{try{
    const incoming=JSON.parse(reader.result);if(!validateBackupV50(incoming))throw new Error('Invalid HiveDash backup structure');const current=v45s(),clean=normalizeStateV50(incoming);clean.user={...current.user};clean.meta={schema:50,userId:currentSession?.user?.id||current.meta?.userId||'',updatedAt:new Date().toISOString()};if(!save(clean))throw new Error('Imported backup is too large for local storage');toast('Data imported');render();
  }catch(err){console.error(err);toast('Invalid or incompatible backup file')}finally{e.target.value=''}};reader.readAsText(f)
};

// ---------- Photo extremes: file type/size/compressed-size/quota + safe delete ----------
compressHivePhoto=function(file,maxSide=800,quality=.66){
  return new Promise((resolve,reject)=>{if(!file||file.size>15*1024*1024)return reject(new Error('Photo is larger than 15 MB'));const ok=['image/jpeg','image/png','image/webp'];if(!ok.includes(file.type))return reject(new Error('Use JPG, PNG or WebP. HEIC must be converted first.'));const reader=new FileReader();reader.onerror=()=>reject(new Error('Unable to read photo'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Unsupported or damaged image'));img.onload=()=>{if(!img.width||!img.height)return reject(new Error('Invalid image dimensions'));const scale=Math.min(1,maxSide/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)return reject(new Error('Image processing is unavailable'));ctx.drawImage(img,0,0,w,h);const data=canvas.toDataURL('image/jpeg',quality);if(data.length>900000)return reject(new Error('Compressed photo is still too large'));resolve(data)};img.src=reader.result};reader.readAsDataURL(file)})
};
addHivePhotos=async function(hiveId,input){
  const files=[...(input?.files||[])];if(!files.length)return;const galleryModal=input?.closest?.('.photo-gallery-modal-shell')||null;const s=v45s(),h=hive(s,hiveId);if(!h){input.value='';return toast('Hive not found')}h.photos=Array.isArray(h.photos)?h.photos:[];let room=Math.max(0,12-h.photos.length);if(!room){input.value='';return toast('Maximum 12 photos per hive')}if(files.length>room)toast(`Only ${room} more photo${room===1?'':'s'} can be added`);
  const before=clone(h.photos);let added=0;try{for(const file of files.slice(0,room)){const data=await compressHivePhoto(file);h.photos.push({id:'p'+Date.now()+Math.random().toString(36).slice(2,7),data,date:new Date().toISOString().slice(0,10),name:String(file.name||'photo').slice(0,120)});added++;if(JSON.stringify(s).length>4300000)throw new Error('Photo storage limit reached')}if(!added)throw new Error('No supported photos selected');if(save(s)===false)throw new Error('Photo storage limit reached');toast(added===1?'Photo added':`${added} photos added`);render();if(galleryModal){galleryModal.remove();setTimeout(()=>openHivePhotoGallery(hiveId),0)}}catch(err){h.photos=before;console.error(err);toast(err.message||'Could not add photo')}finally{input.value=''}
};


/* =========================================================
   V138 — PHOTO GALLERY STATE SOURCE FIX
   Fix only: gallery count/cards now read the same normalized current hive state
   used by upload/Timeline. Locked visual structure and navigation are unchanged.
   ========================================================= */
openHivePhotoGallery=function(hiveId){
  const s=v45s(),h=hive(s,hiveId);if(!h)return;
  const photos=Array.isArray(h.photos)?h.photos:[];
  const galleryHtml=photos.length
    ? photos.map((p,i)=>`<div class="gallery-photo-card">
        <button class="gallery-photo-open" type="button" aria-label="Open photo ${i+1}">
          <img src="${p.data}" alt="${esc(h.name)} photo ${i+1}">
        </button>
        <button class="gallery-photo-menu" type="button" aria-label="Photo options" onclick="event.stopPropagation();openHivePhotoMenu('${h.id}','${p.id}',this)">•••</button>
      </div>`).join('')
    : '<div class="gallery-empty"><b>No photos yet</b><span>Add your first hive photo.</span></div>';
  const m=modal(`<div class="modalhead photo-gallery-head">
      <div>
        <div class="h2">${esc(h.name)} Photos</div>
        <div class="small muted">${photos.length} ${photos.length===1?'photo':'photos'}</div>
      </div>
      <button class="iconbtn" onclick="closeModal(this)">✕</button>
    </div>
    <div class="photo-gallery-toolbar">
      <button class="photo-gallery-add" type="button" onclick="document.getElementById('galleryPhotoInput').click()">＋ Add Photo</button>
      <input id="galleryPhotoInput" hidden type="file" accept="image/*" multiple onchange="addHivePhotos('${h.id}',this)">
    </div>
    <div class="hive-gallery-modal">${galleryHtml}</div>`);
  m.classList.add('photo-gallery-modal-shell');
  m.querySelectorAll('.gallery-photo-open').forEach((btn,i)=>btn.onclick=()=>{
    const latest=v45s(),latestHive=hive(latest,hiveId),latestPhotos=Array.isArray(latestHive?.photos)?latestHive.photos:[];
    const p=latestPhotos[i];if(!p)return;
    modal(`<div class="modalhead"><div class="h2">Photo · ${esc(latestHive.name)}</div><button type="button" class="iconbtn" onclick="closeModal(this)">✕</button></div><div class="setting"><img src="${p.data}" alt="${esc(latestHive.name)} photo" style="width:100%;border-radius:14px;display:block"><div class="small muted" style="margin-top:10px">${fmtDate(p.date||'')} · Hive photo</div></div>`);
  });
};

// V138: after a successful Gallery upload, rebuild that Gallery from current saved state.
const V138_ADD_HIVE_PHOTOS=addHivePhotos;
addHivePhotos=async function(hiveId,input){
  const fromGallery=!!input?.closest?.('.photo-gallery-modal-shell');
  await V138_ADD_HIVE_PHOTOS(hiveId,input);
  if(fromGallery){
    document.querySelectorAll('.photo-gallery-modal-shell').forEach(el=>el.remove());
    openHivePhotoGallery(hiveId);
  }
};
deleteHivePhoto=function(hiveId,photoId){const s=v45s(),h=hive(s,hiveId);if(!h)return;const before=clone(h.photos||[]);h.photos=before.filter(p=>p.id!==photoId);if(save(s)===false){h.photos=before;return toast('Photo could not be deleted')}document.querySelector('.modal')?.remove();toast('Photo deleted');render()};

// ---------- Empty-state safety without changing normal locked screens ----------
const V50_OLD_HOME=home;
home=function(r){const s=v45s();if(!s.hives.length){r.innerHTML=`<div class="vs homev"><section class="vc"><div class="vhead"><b>Hive Overview</b></div><div class="empty-master">No hives yet. Add your first hive from Hives.</div><button class="primary" onclick="go('hives')">Open Hives</button></section></div>`;return}V50_OLD_HOME(r)};

// Free/Pro smart state is enforced even if an old backup had Pro switches enabled.
const V50_OLD_V45S=v45s;
v45s=function(){const s=V50_OLD_V45S();if(!isPro(s)){for(const k of V50_PRO_FEATURES)s.settings.smart[k]=false}return s};

/* =========================================================
   V51 — RELEASE-PREFLIGHT: BACK PATH + FIRST-USE/EMPTY STATES
   Locked UI architecture/navigation preserved. Only safety behavior.
   ========================================================= */
function safeBackV51(fallback='home'){
  if(history.length>1){history.back();return}
  go(fallback)
}
Vback=function(title,right=''){
  const raw=(location.hash||'#home').slice(1).split('/'),page=raw[0],id=raw[1]||'';
  const fallback={hive:'hives',inspection:id?'hive/'+id:'hives',timeline:id?'hive/'+id:'home',honey:'home',map:'home','all-hives':'hives','all-actions':'actions','feeding-record':'actions','treatment-record':'actions','harvest-record':'honey',analysis:'insights',trend:'insights',risk:'insights',season:'insights','honey-analytics':'insights',recommendations:'insights',settings:'home',account:'settings',subscription:'settings',apiary:'settings','seasonal-settings':'apiary','notification-preferences':'settings','units-region':'settings','smart-features':'settings','data-backup':'settings',security:'settings',store:'settings',notifications:'home',help:'settings',faq:'help',support:'help',about:'settings',version:'about',privacy:'security',terms:'security'}[page]||'home';
  return `<button class="iconbtn" onclick="safeBackV51('${fallback}')">‹</button><div class="pagebar-title">${title}</div>${right||'<span></span>'}`
};
function noHiveStateV51(r,title='No hives yet'){
  r.innerHTML=`<div class="vs"><section class="vc"><div class="vhead"><b>${esc(title)}</b></div><div class="empty-master">Add your first hive before recording inspections, feeding, treatment, harvest, or hive-specific history.</div><button class="primary" onclick="go('hives')">Open Hives</button></section></div>`
}
const V51_OLD_HIVES=hives;
hives=function(r){V51_OLD_HIVES(r);const s=v45s();if(!s.hives.length){const box=idq('hlist');if(box)box.innerHTML=`<section class="vc"><div class="empty-master">No hives yet.</div><button class="primary" onclick="addHive()">+ Add First Hive</button></section>`}}
const V51_OLD_HIVE_DETAIL=hiveDetail;
hiveDetail=function(r,id){if(!v45s().hives.length)return noHiveStateV51(r);if(!hive(v45s(),id))return noHiveStateV51(r,'Hive not found');V51_OLD_HIVE_DETAIL(r,id)};
const V51_OLD_INSPECTION=inspectionPage;
inspectionPage=function(r,id){if(!v45s().hives.length)return noHiveStateV51(r);if(!hive(v45s(),id))id=v45s().hives[0].id;V51_OLD_INSPECTION(r,id)};
const V51_OLD_RECORD=recordPage;
recordPage=function(r,type,id){if(!v45s().hives.length)return noHiveStateV51(r);if(!hive(v45s(),id))id=v45s().hives[0].id;V51_OLD_RECORD(r,type,id)};
const V51_OLD_ACTIONS=actions;
actions=function(r){if(!v45s().hives.length){r.innerHTML=`<div class="vs"><div class="split"><img src="${V45.actions}"><div><div class="filters"><button class="active">Pending</button><button>Completed</button><button>All</button></div><div class="alist"><div class="vc small muted">No actions yet. Add a hive first.</div></div></div></div><button class="primary" onclick="go('hives')">+ Add Hive</button></div>`;return}V51_OLD_ACTIONS(r)};
allActions=function(r,mode){actions(r);if(!v45s().hives.length)return;if(mode){const want=String(mode).toLowerCase().startsWith('complete')?'Completed':String(mode).toLowerCase().startsWith('all')?'All':'Pending';const btn=[...document.querySelectorAll('.filters button')].find(b=>b.textContent.trim()===want);if(btn)filterActions(want,btn)}};
const V51_OLD_INSIGHTS=insights;
insights=function(r){const s=v45s();if(!s.hives.length){r.innerHTML=`<div class="vs">${Vhero(V45.flowers,'<div class="insighttitle">Overview</div>','inshero')}<section class="vc"><div class="vhead"><b>No hive data yet</b></div><div class="empty-master">Health analysis, risk prediction, trends, and recommendations will appear after you add a hive and record inspections.</div><button class="primary" onclick="go('hives')">Add a Hive</button></section></div>`;return}V51_OLD_INSIGHTS(r)};
function v51NotifRows(){const s=v45s(),first=s.hives[0]?.id,critical=s.hives.find(h=>h.status==='Critical')?.id||first,attention=s.hives.find(h=>h.status==='Attention')?.id||first;const rows=[];if(first){rows.push(['v49n1','Critical','High temperature alert','hive/'+critical,'Alerts'],['v49n2','Action Required','Inspect '+(hive(s,first)?.name||'Hive'),'inspection/'+first,'Alerts'],['v49n3','Reminder','Varroa treatment due','treatment-record/'+critical,'Reminders'],['v49n4','AI Risk','Queen failure risk','risk','Alerts'],['v49n5','Treatment','Follow-up recommended','treatment-record/'+attention,'Reminders'],['v49n6','Seasonal','Spring nectar flow','season','Reminders'])}rows.push(['v49n7','System','HiveDash Pro status','subscription','System']);return rows}
drawNotificationsV49=function(group='All'){const box=idq('v48notifs');if(!box)return;const rows=v51NotifRows().filter(x=>group==='All'||x[4]===group);box.innerHTML=rows.length?rows.map((x,i)=>`<button style="opacity:${v49NotifRead(x[0])?.6:1}" onclick="openNotifV49('${x[0]}','${x[3]}')"><i class="${x[1]==='Critical'?'critical':x[1]==='Action Required'?'attention':'good'}"></i><div><b>${x[1]}</b><span>${esc(x[2])}</span></div><time>${9+i}:30 AM</time></button>`).join(''):'<div class="vc small muted">No notifications.</div>'};


/* ==============================================================
   V53 VISUAL RESTORATION — STAGE 1
   Locked scope: Home / Hives / Actions / Insights only.
   No architecture, route, entry-point, data, or navigation changes.
   ============================================================== */

function v53HiveThumb(h){
  return v101HivePrimaryPhoto(h);
}

/* V77 removed superseded home */

function v53HiveCard(h){
  return `<button class="hcard v53-hcard" onclick="go('hive/${h.id}')">
    <img src="${v53HiveThumb(h)}" alt="${esc(h.name)}">
    <span class="v53-hi"><b>${esc(h.name)}</b><small>${h.score}% · Last ${fmtDate(h.lastInspection)}</small></span>
    <em class="${Vclass(h)}">${Vstatus(h)}</em>
  </button>`;
}

/* V77 removed superseded hives */

function v53ActionRows(mode='Pending'){
  const s=v45s();
  const allowedHives=isPro(s)?(s.hives||[]):(s.hives||[]).slice(0,3);
  const allowedIds=new Set(allowedHives.map(h=>h.id));

  // Pending actions are current rule-derived recommendations only.
  const pending=(s.actions||[])
    .filter(a=>allowedIds.has(a.hiveId))
    .filter(a=>a.status!=='Completed' && a.priority!=='Done');

  // Completed is real recorded work history. Do not mark a recommendation
  // completed merely because a record of another type exists.
  const completed=[
    ...(s.logs?.inspections||[]).map(x=>({
      id:`completed-inspection-${x.id||x.hiveId+'-'+x.date}`,
      hiveId:x.hiveId,type:'Inspection',title:'Inspection recorded',
      priority:'Done',status:'Completed',due:fmtDate(x.date),date:x.date
    })),
    ...(s.logs?.feedings||[]).map(x=>({
      id:`completed-feeding-${x.id||x.hiveId+'-'+x.date}`,
      hiveId:x.hiveId,type:'Feeding',title:'Feeding recorded',
      priority:'Done',status:'Completed',due:fmtDate(x.date),date:x.date
    })),
    ...(s.logs?.treatments||[]).map(x=>({
      id:`completed-treatment-${x.id||x.hiveId+'-'+x.date}`,
      hiveId:x.hiveId,type:'Treatment',title:'Treatment recorded',
      priority:'Done',status:'Completed',due:fmtDate(x.date),date:x.date
    })),
    ...(s.logs?.harvests||[]).map(x=>({
      id:`completed-harvest-${x.id||x.hiveId+'-'+x.date}`,
      hiveId:x.hiveId,type:'Harvest',title:'Harvest recorded',
      priority:'Done',status:'Completed',due:fmtDate(x.date),date:x.date
    }))
  ]
    .filter(a=>allowedIds.has(a.hiveId))
    .sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));

  const normalized=String(mode||'Pending').toLowerCase();
  if(normalized==='completed') return completed;
  if(normalized==='all') return [...pending,...completed];
  return pending;
}

function v53DrawActions(mode='Pending'){
  const box=idq('alist'); if(!box)return;
  const s=v45s(),rows=v53ActionRows(mode);
  box.innerHTML=rows.length?rows.map(a=>{
    const h=hive(s,a.hiveId)||s.hives[0];
    if(!h)return '';
    const done=a.priority==='Done'||a.status==='Completed';
    return `<button onclick="${done?`go('hive/${h.id}')`:`openActionByType('${a.type||'inspection'}','${h.id}')`}">
      <span>${esc(h.name)}</span><b>${esc(a.title||a.type||'Action')}</b>
      <em class="${done?'good':a.priority==='High'?'critical':a.priority==='Medium'?'attention':'good'}">${esc(a.priority||'Low')}</em>
      <small>${esc(a.due||'')}</small>
    </button>`;
  }).join(''):'<div class="v53-empty-inline">No matching actions.</div>';
}

function actions(r){
  const first=v45s().hives[0]?.id||'';
  r.innerHTML=`<div class="vs v53-actions">
    <div class="split v53-action-split">
      <img src="${V45.actions}" alt="Beekeeper inspecting hive">
      <div>
        <div class="filters v53-action-tabs">
          <button class="active" data-v53-action="Pending">Pending</button>
          <button data-v53-action="Completed">Completed</button>
          <button data-v53-action="All">All</button>
        </div>
        <div class="alist" id="alist"></div>
      </div>
    </div>
    <button class="primary v53-add-action" onclick="openRecordPicker()">+ Add Action</button>
    <div class="shortcuts v53-shortcuts">
      <button onclick="go('inspection/${first}')">Inspection</button>
      <button onclick="go('feeding-record/${first}')">Feeding</button>
      <button onclick="go('treatment-record/${first}')">Treatment</button>
      <button onclick="go('harvest-record/${first}')">Harvest</button>
    </div>
  </div>`;
  document.querySelectorAll('[data-v53-action]').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('[data-v53-action]').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      v53DrawActions(btn.dataset.v53Action);
    };
  });
  v53DrawActions('Pending');
}

function insights(r){
  const s=v45s(),score=avgHealth(s);
  const critical=s.hives.filter(h=>h.status==='Critical').length;
  const pending=(s.actions||[]).filter(a=>a.priority!=='Done'&&a.status!=='Completed').length;
  const risk=critical?'High':s.hives.some(h=>h.status==='Attention')?'Medium':'Low';
  r.innerHTML=`<div class="vs v53-insights">
    ${Vhero(V45.flowers,`<div class="insighttitle">Overview</div>`,'inshero')}
    <div class="isum">
      <button onclick="${isPro(s)?"go('analysis')":"requirePro('AI Health Analysis')"}"><span>Health Score</span><b>${score}</b><small>${score>=80?'Good':score>=65?'Attention':'Critical'}</small></button>
      <button onclick="${isPro(s)?"go('risk')":"requirePro('Risk Prediction')"}"><span>Risk Level</span><b>${risk}</b><small>Overall Risk</small></button>
    </div>
    ${Vcard("Today's Highlights",`<ul class="bullets"><li>${s.hives.length} hives monitored</li><li>${pending} pending actions</li><li>${critical} critical hives</li></ul>`)}
    ${Vcard('AI Recommendation',`<div class="recol"><button onclick="${isPro(s)?"go('recommendations')":"requirePro('Professional Recommendations')"}">${pending?'Review priority actions':'Continue regular inspection'}</button><button onclick="${isPro(s)?"go('risk')":"requirePro('Risk Prediction')"}">Review current risk forecast</button></div>`)}
    <div class="inav v53-insight-grid">
      <button class="v108-harvest-entry" onclick="go('honey')"><span>Harvest</span><small>Records & totals</small></button>
      <button onclick="${isPro(s)?"go('analysis')":"requirePro('AI Health Analysis')"}">AI Health</button>
      <button onclick="${isPro(s)?"go('trend')":"requirePro('Advanced Trends')"}">Trends</button>
      <button onclick="${isPro(s)?"go('risk')":"requirePro('Risk Prediction')"}">Risk</button>
      <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">Season</button>
      <button onclick="${isPro(s)?"go('honey-analytics')":"requirePro('Honey Analytics')"}">Honey Analytics</button>
      <button onclick="${isPro(s)?"go('recommendations')":"requirePro('Professional Recommendations')"}">Recommendations</button>
    </div>
  </div>`;
}



/* ==============================================================
   V54 HOME VISUAL RESTORATION
   Locked Home architecture:
   1. Hive Overview
   2. Action Center
   3. Risk Alerts
   4. Season Intelligence
   5. Quick Actions

   VISUAL ONLY:
   - no route changes
   - no data-model changes
   - no bottom-nav changes
   - no entry-point changes
   ============================================================== */

function v54TopAction(){
  const s=v45s();
  const pending=(s.actions||[]).filter(a=>a.status!=='Completed'&&a.priority!=='Done');
  const rank={High:3,Medium:2,Low:1};
  pending.sort((a,b)=>(rank[b.priority]||0)-(rank[a.priority]||0));
  return pending[0]||null;
}

function v54ActionCTA(a){
  const s=v45s(), first=s.hives[0]?.id||'';
  if(!a) return {label:'View Actions',route:"go('all-actions')",hive:first};
  const hid=a.hiveId||first;
  const type=String(a.type||'inspection').toLowerCase();
  if(type.includes('feed')) return {label:'Record Feeding',route:`go('feeding-record/${hid}')`,hive:hid};
  if(type.includes('treat')||type.includes('varroa')) return {label:'Start Treatment',route:`go('treatment-record/${hid}')`,hive:hid};
  if(type.includes('harvest')) return {label:'Record Harvest',route:`go('harvest-record/${hid}')`,hive:hid};
  if(type.includes('inspect')) return {label:'Inspect Now',route:`go('inspection/${hid}')`,hive:hid};
  return {label:'Open',route:`go('hive/${hid}')`,hive:hid};
}

/* V77 removed superseded home */



/* ==============================================================
   V55 HOME EXACT RESTORE
   Visual source of truth: locked five-module Home mother board.
   No feature, route, entry, data-model, or navigation changes.
   ============================================================== */

function v55TopAction(){
  const s=v45s();
  const rows=(s.actions||[]).filter(a=>a.status!=='Completed'&&a.priority!=='Done');
  const rank={High:3,Medium:2,Low:1};
  rows.sort((a,b)=>(rank[b.priority]||0)-(rank[a.priority]||0));
  return rows[0]||null;
}

function v55ActionRoute(a){
  const s=v45s();
  const first=s.hives[0]?.id||'';
  if(!a) return {label:'Inspect Now', onclick:`go('inspection/${first}')`, hive:first};
  const hid=a.hiveId||first;
  const t=String(a.type||a.title||'inspection').toLowerCase();
  if(t.includes('feed')) return {label:'Record Feeding', onclick:`go('feeding-record/${hid}')`, hive:hid};
  if(t.includes('treat')||t.includes('varroa')) return {label:'Start Treatment', onclick:`go('treatment-record/${hid}')`, hive:hid};
  if(t.includes('harvest')) return {label:'Record Harvest', onclick:`go('harvest-record/${hid}')`, hive:hid};
  if(t.includes('inspect')) return {label:'Inspect Now', onclick:`go('inspection/${hid}')`, hive:hid};
  return {label:'Open', onclick:`go('hive/${hid}')`, hive:hid};
}

/* V77 removed superseded home */



/* ==============================================================
   V56 HOME — FINAL LOCKED BOARD RESTORE
   Source of truth: user-approved final UI board (2026-08-18).
   This override changes Home presentation only.
   Routes, entry relationships, data, permissions and nav logic stay unchanged.
   ============================================================== */

function v56HomeAction(){
  const s=v45s(), first=s.hives[0]?.id||'';
  const rows=(s.actions||[]).filter(a=>a.status!=='Completed' && a.priority!=='Done');
  const rank={High:3,Medium:2,Low:1};
  rows.sort((a,b)=>(rank[b.priority]||0)-(rank[a.priority]||0));
  const a=rows[0]||null, hid=a?.hiveId||first, txt=String(a?.type||a?.title||'inspection').toLowerCase();
  if(txt.includes('feed')) return {a,hid,label:'Open',click:`go('feeding-record/${hid}')`};
  if(txt.includes('treat')||txt.includes('varroa')) return {a,hid,label:'Open',click:`go('treatment-record/${hid}')`};
  if(txt.includes('harvest')) return {a,hid,label:'Open',click:`go('harvest-record/${hid}')`};
  if(txt.includes('inspect')) return {a,hid,label:'Open',click:`go('inspection/${hid}')`};
  return {a,hid,label:'Open',click:`go('hive/${hid}')`};
}

function home(r){
  const s=v45s(), score=avgHealth(s);
  const strong=s.hives.filter(h=>h.status==='Healthy').length;
  const attention=s.hives.filter(h=>h.status==='Attention').length;
  const critical=s.hives.filter(h=>h.status==='Critical').length;
  const first=s.hives[0]?.id||'';
  const action=v56HomeAction();
  const actionHive=hive(s,action.hid);
  const riskRows=s.hives
    .map(h=>({h,res:riskAssessment(h)}))
    .sort((a,b)=>{
      const rank={High:3,Medium:2,Low:1};
      return (rank[b.res.level]||0)-(rank[a.res.level]||0);
    });
  const riskRow=riskRows.find(x=>x.res.level!=='Low')||riskRows[0]||null;
  const riskHive=riskRow?.h||null;
  const riskResult=riskRow?.res||null;
  const riskReason=riskResult?.reasons?.length
    ? riskResult.reasons.join(' · ')
    : 'No current rule-based risk signal';

  r.innerHTML=`
  <div class="vs v56-home">

    <section class="v56-hero">
      <div class="v56-hero-shade"></div>
      <div class="v56-greeting">
        <span>Good Morning!</span>
        <button onclick="go('hives')">${esc(s.settings.apiaryName||'Oak Meadow Apiary')} <b>⌄</b></button>
      </div>

      <button class="v56-health-ring" onclick="go('all-hives/All')" aria-label="View overall hive health">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="46" class="track"></circle>
          <circle cx="60" cy="60" r="46" class="value"
            style="stroke-dasharray:${Math.max(0,Math.min(100,score))*2.89},289"></circle>
        </svg>
        <strong>${score}<small>%</small></strong>
        <span>Overall Health</span>
      </button>

      <div class="v56-health-stats">
        <button onclick="go('all-hives/All')"><b>${s.hives.length}</b><span>Total Hives</span></button>
        <button onclick="go('all-hives/Healthy')"><b>${strong}</b><span>Strong</span></button>
        <button onclick="go('all-hives/Attention')"><b>${attention}</b><span>Attention</span></button>
        <button onclick="go('all-hives/Critical')"><b>${critical}</b><span>Critical</span></button>
      </div>
    </section>

    <section class="v56-row-card">
      <div class="v56-row-copy">
        <span>Action Center</span>
        <small>High Priority</small>
        <b>${esc(action.a?.title||'Inspect Hive #2')}</b>
        <em>${esc(action.a?.reason||action.a?.due||'Due Today')}</em>
      </div>
      <button class="v56-soft-btn" onclick="${action.click}">${action.label}</button>
    </section>

    <section class="v56-row-card">
      <div class="v56-row-copy">
        <span>Risk Alerts</span>
        <b>${esc(riskReason)}</b>
        <em>${riskHive?`${esc(riskHive.name)} · ${esc(riskResult.level)} risk`:'No hive risk data'}</em>
      </div>
      <button class="v56-soft-btn" onclick="${riskHive?`go('hive/${riskHive.id}')`:"go('risk')"}">View</button>
    </section>

    <section class="v56-row-card">
      <div class="v56-row-copy">
        <span>Season Intelligence</span>
        <b>Spring Nectar Flow</b>
        <em>Peak flow in 12 days</em>
      </div>
      <button class="v56-soft-btn" onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">Learn More</button>
    </section>

    <section class="v56-quickbar" aria-label="Quick Actions">
      <button onclick="go('inspection/${first}')"><i>⌕</i><span>Inspection</span></button>
      <button onclick="go('feeding-record/${first}')"><i>▤</i><span>Feeding</span></button>
      <button onclick="go('treatment-record/${first}')"><i>✚</i><span>Treatment</span></button>
      <button onclick="go('harvest-record/${first}')"><i>⌁</i><span>Harvest</span></button>
      <button onclick="openRecordPicker()"><i>•••</i><span>More</span></button>
    </section>

  </div>`;
}



/* ==============================================================
   V60 HIVES VISUAL RESTORE
   Scope: Hives page presentation only.
   Locked: search, 4 filters, hive-card routes, add action, bottom nav.
   Typography follows locked V59 Home visual scale.
   ============================================================== */

function v60HiveThumb(h){
  const s=v45s();
  const idx=Math.max(0,s.hives.findIndex(x=>x.id===h.id));
  const n=(idx%6)+1;
  return `assets/hive_thumb_${n}.jpg`;
}

function v60HiveCard(h){
  return `<button class="v60-hive-card" onclick="go('hive/${h.id}')">
    <img src="${v60HiveThumb(h)}" alt="${esc(h.name)}">
    <span class="v60-hive-copy">
      <b>${esc(h.name)}</b>
      <small>${esc(String(h.score||0))}% · Last ${fmtDate(h.lastInspection)}</small>
    </span>
    <em class="${Vclass(h)}">${Vstatus(h)}</em>
  </button>`;
}

/* V77 removed superseded hives */



/* ==============================================================
   V61 HIVES EXACT RESTORE
   Visual source of truth: user-approved Hives locked UI screenshot.
   Visual-only restore:
   - keeps search
   - keeps status filtering behind the filter icon
   - keeps hive-card -> Hive Detail routes
   - keeps global bottom navigation
   ============================================================== */

function v61HiveThumb(h){
  const s=v45s();
  const idx=Math.max(0,s.hives.findIndex(x=>x.id===h.id));
  return `assets/hives_locked_thumb_${(idx%6)+1}.jpg`;
}

function v61StatusLabel(h){
  if(h.status==='Critical') return 'Risk';
  if(h.status==='Attention') return 'Attention';
  return 'Good';
}

function v61HiveCard(h){
  return `<button class="v61-hive-card" onclick="go('hive/${h.id}')">
    <img src="${v61HiveThumb(h)}" alt="${esc(h.name)}">
    <span class="v61-hive-text">
      <b>${esc(h.name)}</b>
      <small>${esc(String(h.score||0))}% · Last: ${fmtDate(h.lastInspection)}</small>
    </span>
    <em class="${Vclass(h)}">${v61StatusLabel(h)}</em>
  </button>`;
}

function v61FilterMenu(){
  const cur=document.querySelector('.v61-filter-pop');
  if(cur){cur.remove();return}
  const box=document.createElement('div');
  box.className='v61-filter-pop';
  box.innerHTML=`
    <button data-v61-filter="All">All</button>
    <button data-v61-filter="Healthy">Healthy</button>
    <button data-v61-filter="Attention">Attention</button>
    <button data-v61-filter="Critical">Critical</button>`;
  document.body.appendChild(box);

  const fbtn=document.querySelector('.v61-filter-btn');
  if(fbtn){
    const r=fbtn.getBoundingClientRect();
    box.style.top=`${Math.round(r.bottom+6)}px`;
    box.style.left=`${Math.round(Math.max(12,r.right-150))}px`;
  }

  box.querySelectorAll('[data-v61-filter]').forEach(btn=>{
    btn.onclick=()=>{
      window.__v61HiveFilter=btn.dataset.v61Filter;
      box.remove();
      if(window.__v61RedrawHives) window.__v61RedrawHives();
    };
  });
}

/* V77 removed superseded hives */



/* ==============================================================
   V62 HIVES LOCKED UI EXACT
   Visual source of truth: user-approved Hives screenshot.
   ============================================================== */

function v62Thumb(h){
  const s=v45s();
  const idx=Math.max(0,s.hives.findIndex(x=>x.id===h.id));
  return `assets/hives_ui_thumb_${(idx%6)+1}.jpg`;
}
function v62Label(h){
  if(h.status==='Critical') return 'Risk';
  if(h.status==='Attention') return 'Attention';
  return 'Good';
}
function v62Card(h){
  return `<button class="v62-card" onclick="go('hive/${h.id}')">
    <img src="${v62Thumb(h)}" alt="${esc(h.name)}">
    <span class="v62-copy">
      <b>${esc(h.name)}</b>
      <small>${esc(String(h.score||0))}% · Last: ${fmtDate(h.lastInspection)}</small>
    </span>
    <em class="${Vclass(h)}">${v62Label(h)}</em>
  </button>`;
}
function v62Menu(){
  const old=document.querySelector('.v62-menu'); if(old){old.remove();return;}
  const box=document.createElement('div');
  box.className='v62-menu';
  box.innerHTML=`
    <button onclick="addHive();this.parentElement.remove()">Add Hive</button>
    <button onclick="go('settings');this.parentElement.remove()">Settings</button>`;
  document.body.appendChild(box);
}
function v62FilterMenu(){
  const old=document.querySelector('.v62-filter-pop'); if(old){old.remove();return;}
  const box=document.createElement('div');
  box.className='v62-filter-pop';
  box.innerHTML=`
    <button data-f="All">All Hives</button>
    <button data-f="Healthy">Healthy</button>
    <button data-f="Attention">Attention</button>
    <button data-f="Critical">Critical</button>`;
  document.body.appendChild(box);
  box.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{
    window.__v62Filter=b.dataset.f;
    box.remove();
    window.__v62Redraw?.();
  });
}
/* V77 removed superseded hives */



/* ==============================================================
   V63 HIVES — 3 HIVE FREE PLAN EXACT RESTORE
   Visual source: user-approved Hives screenshot.
   Free users: only 3 hives shown / max 3 hives.
   Pro users: existing additional hives remain available.
   ============================================================== */

function v101HivePrimaryPhoto(h){
  const photos=(typeof hivePhotos==='function'?hivePhotos(h):(Array.isArray(h?.photos)?h.photos:[]));
  if(photos.length && photos[0]?.data) return photos[0].data;
  const s=v45s(),idx=Math.max(0,s.hives.findIndex(x=>x.id===h.id));
  const fallback=['assets/hive_detail_hero.jpg','assets/home_final_apiary.jpg','assets/hive_detail_hero.jpg'];
  return fallback[idx%fallback.length];
}

function v63VisibleHives(){
  const s=v45s();
  return isPro(s) ? s.hives : s.hives.slice(0,3);
}

function v63Thumb(h){
  return v101HivePrimaryPhoto(h);
}

function v63Status(h){
  if(h.status==='Critical') return 'Risk';
  if(h.status==='Attention') return 'Attention';
  return 'Good';
}

function v63Card(h){
  const rows=v63VisibleHives();
  const idx=Math.max(0,rows.findIndex(x=>x.id===h.id));
  return `<button class="v63-card" onclick="go('hive/${h.id}')">
    <img class="v65-thumb v65-thumb-${(idx%3)+1}" src="${v63Thumb(h)}" alt="${esc(h.name)}">
    <span class="v63-copy">
      <b>${esc(h.name)}</b>
      <small>${esc(String(h.score||0))}% · Last: ${fmtDate(h.lastInspection)}</small>
    </span>
    <em class="${Vclass(h)}">${v63Status(h)}</em>
  </button>`;
}

function v63Menu(){
  const old=document.querySelector('.v63-menu');
  if(old){old.remove();return;}
  const s=v45s();
  const freeFull=!isPro(s) && s.hives.length>=3;
  const box=document.createElement('div');
  box.className='v63-menu';
  box.innerHTML=`
    <button onclick="go('map');this.parentElement.remove()">Map</button>
    <button onclick="${freeFull ? "subscriptionModal('more than 3 hives')" : "addHive()"};this.parentElement.remove()">
      ${freeFull?'Upgrade for More Hives':'Add Hive'}
    </button>
    <button onclick="go('settings');this.parentElement.remove()">Settings</button>`;
  document.body.appendChild(box);
}

function v63FilterMenu(){
  const old=document.querySelector('.v63-filter-pop');
  if(old){old.remove();return;}
  const box=document.createElement('div');
  box.className='v63-filter-pop';
  box.innerHTML=`
    <button data-v63-filter="All">All Hives</button>
    <button data-v63-filter="Healthy">Healthy</button>
    <button data-v63-filter="Attention">Attention</button>
    <button data-v63-filter="Critical">Critical</button>`;
  document.body.appendChild(box);

  box.querySelectorAll('[data-v63-filter]').forEach(btn=>{
    btn.onclick=()=>{
      window.__v63Filter=btn.dataset.v63Filter;
      box.remove();
      window.__v63Redraw?.();
    };
  });
}

function hives(r){
  const s=v45s();
  window.__v63Filter=window.__v63Filter||'All';
  const visible=v63VisibleHives();

  r.innerHTML=`<div class="vs v63-hives">
    <section class="v63-stage">
      <div class="v63-overlay"></div>

      <header class="v63-head">
        <b>2. Hives</b>
        <button onclick="v63Menu()" aria-label="More options">⋮</button>
      </header>

      <div class="v63-search-row">
        <label class="v63-search">
          <span>⌕</span>
          <input id="hsearch" placeholder="Search hives" autocomplete="off">
        </label>
        <button class="v63-filter-btn" onclick="v63FilterMenu()" aria-label="Filter hives">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16l-6.2 7.2v5.5l-3.6 1.8v-7.3L4 5Z"></path>
          </svg>
        </button>
      </div>

      <div id="hlist" class="v63-list">
        ${visible.map(v63Card).join('')}
      </div>

      ${!isPro(s) ? `<div class="v63-free-note">Free plan · 3 hive limit</div>` : ``}
    </section>
  </div>`;

  const input=idq('hsearch');

  window.__v63Redraw=()=>{
    const q=(input?.value||'').trim().toLowerCase();
    const f=window.__v63Filter||'All';
    const rows=v63VisibleHives().filter(h=>
      (f==='All'||h.status===f) &&
      (!q||h.name.toLowerCase().includes(q))
    );
    idq('hlist').innerHTML=rows.length
      ? rows.map(v63Card).join('')
      : `<div class="v63-empty"><b>No hives found</b><span>Try another search or filter.</span></div>`;
  };

  if(input) input.oninput=window.__v63Redraw;
}


/* V140 - Version initial-load refresh fallback */
(function(){
  function renderVersionOnInitialLoadV140(){
    const page=(location.hash||'#home').slice(1).split('/')[0];
    if(page==='version' && typeof render==='function'){
      render();
    }
  }

  if(document.readyState==='loading'){
    window.addEventListener('DOMContentLoaded',renderVersionOnInitialLoadV140,{once:true});
  }else{
    renderVersionOnInitialLoadV140();
  }
})();


/* V141 - Privacy Policy single-point replacement */
const V141_OLD_INFO_PAGE=infoPage;
infoPage=function(r,title){
  if(title!=='Privacy Policy')return V141_OLD_INFO_PAGE(r,title);
  r.innerHTML=`<section><div class="h1" style="margin-top:12px">Privacy Policy</div></section><section class="setting body">
    <div class="small muted">Effective date: August 23, 2026</div>
    <p>HiveDash is a family beekeeping log designed to help beekeepers manage hives, inspections, actions, photos, reminders, seasonal settings, and related records. This Privacy Policy explains what information HiveDash collects, how it is used, when it is shared, and the choices available to you.</p>

    <div class="h3">1. Information We Collect</div>
    <p><b>Account information.</b> When you create or use a cloud account, HiveDash may process information such as your email address, account identifier, authentication information handled by the authentication provider, and subscription or entitlement status.</p>
    <p><b>Beekeeping records.</b> HiveDash processes information you enter about apiaries and hives, including hive names, locations you provide, inspections, colony condition, queen observations, feeding, treatments, harvests, reminders, notes, seasonal settings, and related history.</p>
    <p><b>Photos and optional inputs.</b> If you choose to add hive photos, use supported voice-input features, or enable smart features, HiveDash processes the information you submit for those features. Features marked as unavailable or coming soon do not collect data merely because they are displayed in the app.</p>
    <p><b>Location.</b> HiveDash may request device location only when you actively use a location-based feature and grant permission. You can deny or revoke location permission through your browser or device settings. Apiary locations that you type into HiveDash are also stored as part of your beekeeping records.</p>
    <p><b>Technical information.</b> The app and the services used to operate it may process basic technical information needed for security and operation, such as browser or device information, IP address, timestamps, network status, and diagnostic error information.</p>

    <div class="h3">2. How We Use Information</div>
    <p>We use information to provide and maintain HiveDash; save and synchronize your hive records; authenticate accounts; display reminders, alerts, analytics, and seasonal information; provide features you request; preserve settings across sessions and devices; troubleshoot problems; protect the service; and comply with applicable legal obligations.</p>

    <div class="h3">3. Local Storage and Cloud Sync</div>
    <p>HiveDash can store application data in your browser or device. When cloud sync is enabled and you are signed in, HiveDash also synchronizes application state with its cloud backend so your records can be available across signed-in devices. Local data may remain on a device after sign-out unless you clear it, reset local data, or remove it through available controls.</p>

    <div class="h3">4. Service Providers</div>
    <p>HiveDash uses service providers to operate certain functions. The current cloud authentication, database, and synchronization backend uses Supabase. Service providers process information only as needed to provide their services to HiveDash and are subject to their own security and privacy obligations. HiveDash may also rely on hosting, network, or platform providers that process limited technical information necessary to deliver the app.</p>

    <div class="h3">5. Photos, Smart Features, and Permissions</div>
    <p>You control whether to add photos or grant device permissions. HiveDash does not require access to your entire photo library or precise device location simply to maintain ordinary hive records. Where a feature requires a permission, you can decline it; the related feature may then be unavailable. Smart-feature permissions can be managed from the app where those controls are provided.</p>

    <div class="h3">6. Sharing of Information</div>
    <p>HiveDash does not sell your personal information. We may disclose information to service providers that help operate HiveDash, when you direct us to do so, when required by law or valid legal process, or when reasonably necessary to protect users, the service, or the rights and safety of others. If the business responsible for HiveDash is involved in a merger, acquisition, financing, reorganization, or sale of assets, information may be transferred as part of that transaction subject to applicable law.</p>

    <div class="h3">7. Data Retention and Deletion</div>
    <p>We retain information for as long as reasonably necessary to provide HiveDash, maintain your account and records, comply with legal obligations, resolve disputes, and protect the service. You may use available export, reset, account, or support tools to manage your data. For requests to access, correct, or delete cloud-account information that cannot be completed directly in the app, use Contact Support in HiveDash.</p>

    <div class="h3">8. Security</div>
    <p>We use reasonable technical and organizational measures intended to protect information against unauthorized access, loss, misuse, alteration, or disclosure. No method of storage or transmission is completely secure, so absolute security cannot be guaranteed.</p>

    <div class="h3">9. Your Choices and Privacy Rights</div>
    <p>You can manage notification, smart-feature, location, and other permissions through HiveDash and your browser or device. Depending on where you live, you may have rights to request access to, correction of, deletion of, or a copy of certain personal information, or to object to or restrict certain processing. We will respond to verified requests as required by applicable law.</p>
    <p>HiveDash does not sell personal information or use personal information for cross-context behavioral advertising. If applicable law gives you additional rights, you may exercise them through Contact Support.</p>

    <div class="h3">10. Children</div>
    <p>HiveDash is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If we learn that such information has been collected, we will take appropriate steps to delete it.</p>

    <div class="h3">11. International Processing</div>
    <p>HiveDash and its service providers may process information in countries other than the country where you live. Where required, we use appropriate safeguards for international transfers and handle information in accordance with applicable privacy law.</p>

    <div class="h3">12. Changes to This Policy</div>
    <p>We may update this Privacy Policy as HiveDash changes or as legal requirements evolve. When we make material changes, we will update the effective date and provide notice when required.</p>

    <div class="h3">13. Contact</div>
    <p>For privacy questions or requests, open HiveDash and use <b>Settings &gt; Help Center &gt; Contact Support</b>. Please include enough information for us to understand and verify your request.</p>
  </section>`;
};

/* V142 - Terms of Service single-point replacement + initial-load refresh fallback */
const V142_OLD_INFO_PAGE=infoPage;
infoPage=function(r,title){
  if(title!=='Terms of Service')return V142_OLD_INFO_PAGE(r,title);
  r.innerHTML=`<section><div class="h1" style="margin-top:12px">Terms of Service</div></section><section class="setting body">
    <div class="small muted">Effective date: August 23, 2026</div>
    <p>These Terms of Service govern your access to and use of HiveDash, a family beekeeping log for managing hives, inspections, actions, photos, reminders, seasonal settings, analytics, and related records. By accessing or using HiveDash, you agree to these Terms.</p>

    <div class="h3">1. Eligibility and Accounts</div>
    <p>You must be legally able to enter into these Terms in the place where you live. HiveDash is not directed to children under 13. If you create an account, you are responsible for providing accurate account information, protecting access to your account, and for activity that occurs through your account unless prohibited by applicable law.</p>

    <div class="h3">2. HiveDash Is a Recordkeeping and Decision-Support Tool</div>
    <p>HiveDash helps organize beekeeping information and may display reminders, health indicators, trends, forecasts, risk estimates, recommendations, weather-related information, or other automated outputs. These outputs are informational and may be incomplete, delayed, or inaccurate. HiveDash does not replace your own inspection, judgment, local regulations, product labels, veterinary advice where applicable, or qualified professional advice. You remain responsible for decisions affecting bees, people, property, food, treatments, and equipment.</p>

    <div class="h3">3. Your Records and Content</div>
    <p>You retain responsibility for the hive records, notes, photos, locations, and other content you submit to HiveDash. You represent that you have the right to submit that content. You grant HiveDash the limited rights necessary to store, process, display, back up, synchronize, and otherwise handle your content solely to operate, maintain, secure, and improve the features you use.</p>

    <div class="h3">4. Acceptable Use</div>
    <p>You may not misuse HiveDash, interfere with its operation or security, attempt unauthorized access to accounts or systems, introduce malicious code, use the service to violate law or the rights of others, scrape or extract data in a manner that materially burdens the service, or attempt to bypass access, subscription, or security controls.</p>

    <div class="h3">5. Free and Paid Features</div>
    <p>HiveDash may offer free and paid features. The features, limits, and pricing shown in the app may change prospectively. Where a paid subscription is offered through a payment provider or app marketplace, billing, renewal, cancellation, refund, and payment processing may also be subject to that provider's terms. Paid access should be treated as active only when a valid entitlement is confirmed by the applicable billing system.</p>

    <div class="h3">6. Trials, Changes, and Availability</div>
    <p>We may add, modify, suspend, or discontinue features when reasonably necessary for product, security, legal, or operational reasons. We may also use limits or staged availability for features. We do not guarantee that every feature will be available at all times, on every device, or in every location.</p>

    <div class="h3">7. Third-Party Services</div>
    <p>HiveDash may depend on third-party services for functions such as authentication, cloud storage, synchronization, hosting, maps, weather information, analytics, payments, or other integrations. Those services may be subject to their own terms and policies. HiveDash is not responsible for third-party services that are outside its control.</p>

    <div class="h3">8. Data, Backup, and Export</div>
    <p>HiveDash may provide local storage, cloud synchronization, or export tools. You are responsible for keeping any additional copies of records that are important to you. Although we take reasonable steps to preserve service data, no storage or synchronization system is guaranteed to be error-free or permanently available.</p>

    <div class="h3">9. Privacy</div>
    <p>Our handling of personal information is described in the HiveDash Privacy Policy. The Privacy Policy is available from Privacy &amp; Security and About HiveDash in the app.</p>

    <div class="h3">10. Intellectual Property</div>
    <p>HiveDash, including its software, interface, branding, visual design, and service content other than user-submitted content, is protected by applicable intellectual-property law. These Terms give you a limited, non-exclusive, non-transferable right to use HiveDash for its intended purpose. They do not transfer ownership of HiveDash or its intellectual property to you.</p>

    <div class="h3">11. Suspension and Termination</div>
    <p>You may stop using HiveDash at any time. We may restrict or suspend access when reasonably necessary to protect users or the service, respond to unlawful activity, enforce these Terms, or meet legal obligations. Where appropriate and practicable, we will provide notice or an opportunity to address the issue. Rights and obligations that by their nature should survive termination will continue to apply.</p>

    <div class="h3">12. Disclaimers</div>
    <p>To the extent permitted by applicable law, HiveDash is provided on an "as is" and "as available" basis. We do not warrant that the service will be uninterrupted, error-free, or that recommendations, predictions, weather information, health indicators, or other outputs will always be accurate or suitable for a particular beekeeping decision. Nothing in these Terms excludes warranties or rights that cannot legally be excluded.</p>

    <div class="h3">13. Limitation of Liability</div>
    <p>To the extent permitted by applicable law, HiveDash and the persons or entities responsible for operating it will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost data, lost honey production, colony loss, or business interruption arising from use of or inability to use the service. Any limitation applies only to the maximum extent allowed by law and does not limit liability that cannot legally be limited.</p>

    <div class="h3">14. Changes to These Terms</div>
    <p>We may update these Terms as HiveDash changes or as legal requirements evolve. When material changes are made, we will update the effective date and provide notice when required. Continued use after an updated version takes effect means the updated Terms apply, except where applicable law requires additional consent.</p>

    <div class="h3">15. Applicable Law and Consumer Rights</div>
    <p>These Terms are subject to applicable law. Nothing in these Terms limits mandatory consumer rights, privacy rights, or other protections that cannot be waived by contract. Any governing-law or venue requirement that applies by law remains unaffected.</p>

    <div class="h3">16. Contact</div>
    <p>For questions about these Terms, open HiveDash and use <b>Settings &gt; Help Center &gt; Contact Support</b>.</p>
  </section>`;
};

(function(){
  function renderTermsOnInitialLoadV142(){
    const page=(location.hash||'#home').slice(1).split('/')[0];
    if(page==='terms' && typeof render==='function'){
      render();
    }
  }

  if(document.readyState==='loading'){
    window.addEventListener('DOMContentLoaded',renderTermsOnInitialLoadV142,{once:true});
  }else{
    renderTermsOnInitialLoadV142();
  }
})();
