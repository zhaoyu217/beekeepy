
const STORAGE_KEY='hivedash_v9';
const FREE_HIVE_LIMIT=3;

const DEFAULT_STATE={
  user:{name:'Alex',email:'beekeeper@example.com',plan:'Free'},
  settings:{
    apiaryName:'Backyard Apiary',
    location:'Colorado, USA',
    timezone:'America/Denver',
    units:'imperial',
    hiveType:'Langstroth',
    inspectionCycle:7,
    notifications:{inspection:true,treatment:true,queen:true,swarm:true,weather:true},
    seasonIntel:true,
    aiRecommendations:true,
    photoAnalysis:false,
    voiceNotes:false,
    cloudBackup:false
  },
  hives:[
    {id:'h1',name:'Hive #1',score:92,status:'Healthy',queen:'Confirmed',eggs:true,larvae:true,queenCells:false,brood:'Excellent',strength:'Strong',honey:'High',pollen:'High',varroa:1,shb:false,waxMoth:false,disease:false,swarm:false,superStatus:'Installed',lastInspection:'2026-08-06',notes:'Strong colony.'},
    {id:'h2',name:'Hive #2',score:78,status:'Attention',queen:'Not confirmed',eggs:true,larvae:true,queenCells:false,brood:'Good',strength:'Medium',honey:'Medium',pollen:'Medium',varroa:2,shb:false,waxMoth:false,disease:false,swarm:false,superStatus:'Installed',lastInspection:'2026-07-26',notes:'Queen not confirmed.'},
    {id:'h3',name:'Hive #3',score:65,status:'Critical',queen:'Confirmed',eggs:true,larvae:true,queenCells:false,brood:'Fair',strength:'Medium',honey:'Low',pollen:'Low',varroa:4,shb:false,waxMoth:false,disease:false,swarm:false,superStatus:'Installed',lastInspection:'2026-07-08',notes:'Mite level elevated.'}
  ],
  actions:[],
  notifications:[
    {id:'n1',title:'Hive #3 needs attention',body:'Varroa follow-up is recommended.',read:false,target:'#hive/h3'},
    {id:'n2',title:'Queen status',body:'Hive #2 queen has not been confirmed.',read:false,target:'#hive/h2'}
  ],
  logs:{inspections:[],feedings:[],treatments:[],harvests:[]}
};

function clone(v){return JSON.parse(JSON.stringify(v))}
function state(){
  const raw=localStorage.getItem(STORAGE_KEY);
  if(!raw){localStorage.setItem(STORAGE_KEY,JSON.stringify(DEFAULT_STATE));return clone(DEFAULT_STATE)}
  try{
    const s=JSON.parse(raw);
    s.actions=generateActions(s);
    return s;
  }catch(e){return clone(DEFAULT_STATE)}
}
function save(s){s.actions=generateActions(s);localStorage.setItem(STORAGE_KEY,JSON.stringify(s))}
function resetState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(DEFAULT_STATE));location.hash='home';location.reload()}

function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function idq(id){return document.getElementById(id)}
function fmtDate(d){if(!d)return'—';return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
function daysSince(date){return Math.floor((Date.now()-new Date(date+'T12:00:00').getTime())/86400000)}
function hive(s,id){return s.hives.find(h=>h.id===id)}
function unread(s){return s.notifications.filter(n=>!n.read).length}
function avgHealth(s){return Math.round(s.hives.reduce((n,h)=>n+h.score,0)/Math.max(1,s.hives.length))}
function isPro(s){return s.user.plan==='Pro'}
function statusPill(status){return `<span class="pill ${status==='Critical'?'danger':status==='Attention'?'warn':''}">${esc(status)}</span>`}
function toast(msg){const t=idq('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1500)}
function modal(html){const el=document.createElement('div');el.className='modal';el.innerHTML=`<div class="modalpanel">${html}</div>`;el.addEventListener('click',e=>{if(e.target===el)el.remove()});document.body.appendChild(el);return el}
function closeModal(el){el.closest('.modal').remove()}
function go(hash){location.hash=hash}
function requirePro(feature){
  const s=state();
  if(isPro(s))return true;
  subscriptionModal(feature);
  return false;
}
function subscriptionModal(feature='this feature'){
  const s=state(),m=modal(`<div class="modalhead"><div class="h2">Unlock HiveDash Pro</div><button class="iconbtn" onclick="closeModal(this)">✕</button></div>
  <div class="setting"><div class="small muted">Upgrade to use ${esc(feature)}.</div><div class="h2" style="margin-top:10px">$59.99 / year</div><div class="small" style="margin-top:6px">Unlimited hives · Health Analysis · Risk Prediction · Season Intelligence · Reports · Cloud features</div><button class="btn primary block" id="upgradeBtn" style="margin-top:12px">Upgrade Demo</button></div>
  <div class="notice">Prototype billing only. Production must validate entitlement from a billing provider.</div>`);
  m.querySelector('#upgradeBtn').onclick=()=>{s.user.plan='Pro';save(s);m.remove();toast('Pro enabled in demo');render()}
}

function icon(name){
  const icons={
    settings:'<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19 13.5v-3l-2-.7a7.4 7.4 0 0 0-.8-1.8l.9-1.9-2.2-2.2-1.9.9a7.4 7.4 0 0 0-1.8-.8L10.5 2h-3l-.7 2a7.4 7.4 0 0 0-1.8.8l-1.9-.9L.9 6.1 1.8 8a7.4 7.4 0 0 0-.8 1.8l-2 .7v3l2 .7a7.4 7.4 0 0 0 .8 1.8l-.9 1.9 2.2 2.2 1.9-.9a7.4 7.4 0 0 0 1.8.8l.7 2h3l.7-2a7.4 7.4 0 0 0 1.8-.8l1.9.9 2.2-2.2-.9-1.9a7.4 7.4 0 0 0 .8-1.8Z" transform="translate(2.5 0) scale(.8)"/></svg>',
    bell:'<svg class="icon" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    home:'<svg class="icon" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/></svg>',
    hive:'<svg class="icon" viewBox="0 0 24 24"><path d="M8 3h8l4 5-2 12H6L4 8l4-5Z"/><path d="M6 8h12M7 12h10M7 16h10"/></svg>',
    check:'<svg class="icon" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12a9 9 0 1 1-5.3-8.2"/></svg>',
    chart:'<svg class="icon" viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/></svg>'
  };return icons[name]
}

function chrome(page,secondary){
  const s=state();
  idq('topbar').innerHTML=`<button class="iconbtn" onclick="go('settings')" aria-label="Settings">${icon('settings')}</button><div class="brand">HiveDash</div><button class="iconbtn" onclick="go('notifications')" aria-label="Notifications">${icon('bell')}${unread(s)?`<span class="badge">${unread(s)}</span>`:''}</button>`;
  idq('bottomnav').classList.toggle('hidden',secondary);
  idq('bottomnav').innerHTML=[
    ['home','Home','home'],
    ['hives','Hives','hive'],
    ['actions','Actions','check'],
    ['insights','Insights','chart']
  ].map(([key,label,ico])=>`<button class="navitem ${page===key?'active':''}" onclick="go('${key}')">${icon(ico)}<span>${label}</span></button>`).join('')
}

function generateActions(s){
  const list=[];
  for(const h of s.hives){
    const overdue=daysSince(h.lastInspection)-Number(s.settings.inspectionCycle||7);
    if(overdue>0)list.push({id:`inspect-${h.id}`,hiveId:h.id,type:'Inspection',priority:overdue>14?'High':'Medium',title:'Inspection overdue',reason:`Last inspection ${daysSince(h.lastInspection)} days ago.`,due:'Now',status:'Pending'});
    if(h.varroa>=3)list.push({id:`varroa-${h.id}`,hiveId:h.id,type:'Treatment',priority:'High',title:'Varroa follow-up',reason:`Latest Varroa result is ${h.varroa}%.`,due:'Now',status:'Pending'});
    if(h.queen!=='Confirmed')list.push({id:`queen-${h.id}`,hiveId:h.id,type:'Inspection',priority:'Medium',title:'Confirm queen status',reason:'Queen has not been confirmed.',due:'Next check',status:'Pending'});
    if(h.honey==='Low'||h.pollen==='Low')list.push({id:`food-${h.id}`,hiveId:h.id,type:'Feeding',priority:'Medium',title:'Review food stores',reason:'Honey or pollen stores are low.',due:'Soon',status:'Pending'});
  }
  const rank={High:3,Medium:2,Routine:1};
  return list.sort((a,b)=>rank[b.priority]-rank[a.priority])
}

function calculateHealth(h){
  let score=100,why=[];
  if(h.queen!=='Confirmed'){score-=15;why.push(['Queen status',-15])}
  if(!h.eggs){score-=10;why.push(['No eggs recorded',-10])}
  if(h.brood==='Fair'){score-=10;why.push(['Brood quality',-10])}
  if(h.brood==='Poor'){score-=20;why.push(['Brood quality',-20])}
  if(h.strength==='Weak'){score-=15;why.push(['Weak colony',-15])}
  if(h.honey==='Low'){score-=10;why.push(['Low honey stores',-10])}
  if(h.pollen==='Low'){score-=7;why.push(['Low pollen stores',-7])}
  if(h.varroa>=3){score-=25;why.push(['Varroa level',-25])}else if(h.varroa>=2){score-=10;why.push(['Varroa level',-10])}
  if(h.disease){score-=20;why.push(['Disease flag',-20])}
  if(h.swarm){score-=8;why.push(['Swarm signs',-8])}
  const overdue=daysSince(h.lastInspection)-7;
  if(overdue>14){score-=8;why.push(['Inspection overdue',-8])}else if(overdue>0){score-=4;why.push(['Inspection overdue',-4])}
  score=Math.max(0,Math.min(100,score));
  return {score,why,status:score>=85?'Healthy':score>=70?'Attention':'Critical'}
}

function formatWeight(lb,s){
  if(s.settings.units==='metric')return `${(Number(lb)*0.453592).toFixed(1)} kg`;
  return `${Number(lb).toFixed(1)} lb`
}
function formatTemp(f,s){return s.settings.units==='metric'?`${Math.round((f-32)*5/9)}°C`:`${Math.round(f)}°F`}

function render(){
  const raw=(location.hash||'#home').slice(1),parts=raw.split('/'),page=parts[0],id=parts[1];
  const secondary=['all-hives','hive','all-actions','settings','notifications','subscription','analysis','trend','risk','honey','season','privacy','terms','help','support'].includes(page);
  const view=idq('view');view.className=`view ${secondary?'secondary':'main'}`;
  if(page==='home')home(view);
  else if(page==='hives')hives(view);
  else if(page==='actions')actions(view);
  else if(page==='insights')insights(view);
  else if(page==='all-hives')allHives(view);
  else if(page==='hive')hiveDetail(view,id);
  else if(page==='all-actions')allActions(view);
  else if(page==='settings')settings(view);
  else if(page==='notifications')notifications(view);
  else if(page==='subscription')subscriptionPage(view);
  else if(page==='analysis')healthAnalysis(view);
  else if(page==='trend')trendPage(view);
  else if(page==='risk')riskPage(view);
  else if(page==='honey')honeyPage(view);
  else if(page==='season')seasonPage(view);
  else if(page==='privacy')infoPage(view,'Privacy Policy');
  else if(page==='terms')infoPage(view,'Terms of Service');
  else if(page==='help')infoPage(view,'Help Center');
  else if(page==='support')infoPage(view,'Contact Support');
  else{go('home');return}
  chrome(page,secondary)
}

function home(r){
  const s=state(),score=avgHealth(s),stat=score>=85?'Healthy':score>=70?'Attention':'Critical',a=s.actions[0],h=a?hive(s,a.hiveId):null;
  const risks=s.hives.filter(x=>x.status!=='Healthy').slice(0,3);
  r.innerHTML=`<div class="screen home-screen">
    <section class="card pad card-button" onclick="go('hives')">
      <div class="row between"><div><div class="h2">Hive Overview</div><div class="tiny muted">Apiary health control center</div></div>${statusPill(stat)}</div>
      <div class="healthgrid" style="margin-top:4px">
        <div class="gauge"><svg viewBox="0 0 160 160"><path d="M20 100 A60 60 0 0 1 140 100" fill="none" stroke="#E8ECE5" stroke-width="18" stroke-linecap="round"/><path d="M20 100 A60 60 0 0 1 140 100" fill="none" stroke="#2F5D50" stroke-width="18" stroke-linecap="round" pathLength="100" stroke-dasharray="${score} 100"/></svg><div class="gauge-score">${score}%</div></div>
        <div><div class="h3">Overall Health</div><div class="tiny muted">${stat==='Healthy'?'Good':stat==='Attention'?'Needs attention':'High risk'}</div><div class="metricgrid" style="margin-top:8px"><div class="metric"><strong>${s.hives.length}</strong><span>Total</span></div><div class="metric"><strong>${s.hives.filter(x=>x.status==='Healthy').length}</strong><span>Healthy</span></div><div class="metric"><strong>${s.hives.filter(x=>x.status==='Attention').length}</strong><span>Attention</span></div><div class="metric"><strong>${s.hives.filter(x=>x.status==='Critical').length}</strong><span>Critical</span></div></div></div>
      </div>
    </section>

    <section class="card pad">
      <div class="row between"><div><div class="h3">Action Center</div><div class="tiny muted">Highest priority</div></div>${a?`<span class="pill ${a.priority==='High'?'danger':'warn'}">${a.priority}</span>`:''}</div>
      ${a?`<div class="compact ${a.priority==='High'?'danger':'alert'}" style="margin-top:7px"><span style="font-size:18px">⚠️</span><div class="grow"><div class="small"><b>${esc(h.name)} · ${esc(a.title)}</b></div><div class="tiny muted">${esc(a.reason)}</div></div><button class="btn primary" onclick="event.stopPropagation();go('actions')">Open</button></div>`:`<div class="compact" style="margin-top:7px"><div class="small">No urgent actions.</div></div>`}
    </section>

    <section class="card pad">
      <div class="row between"><div class="h3">Risk Alerts</div><button class="pill" onclick="go('hives')">View</button></div>
      <div class="row" style="margin-top:8px;gap:6px">${risks.length?risks.map(x=>`<button class="pill ${x.status==='Critical'?'danger':'warn'}" onclick="go('hive/${x.id}')">${esc(x.name)}</button>`).join(''):`<span class="small muted">No active risk flags.</span>`}</div>
    </section>

    <section class="card pad card-button" onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">
      <div class="row between"><div><div class="h3">Season Intelligence</div><div class="tiny muted">${isPro(s)?'Personalized guidance':'Pro feature'}</div></div><span class="pill warn">${isPro(s)?'Season':'PRO'}</span></div>
      <div class="compact alert" style="margin-top:7px"><span>🍃</span><div class="grow"><div class="small"><b>Monitor mites closely</b></div><div class="tiny muted">Review overdue colonies and food stores.</div></div><span class="chev">›</span></div>
    </section>

    <section><div class="sectionlabel">Quick Actions</div><div class="quick">
      <button class="qbtn" onclick="actionForm('inspection')"><span class="emo">🔎</span><b>Inspection</b></button>
      <button class="qbtn" onclick="actionForm('treatment')"><span class="emo">🧪</span><b>Treatment</b></button>
      <button class="qbtn" onclick="actionForm('harvest')"><span class="emo">🍯</span><b>Harvest</b></button>
    </div></section>
  </div>`
}

function hives(r){
  const s=state(),ordered=[...s.hives].sort((a,b)=>a.score-b.score),shown=ordered.slice(0,4);
  r.innerHTML=`<div class="screen hives-screen">
    <section class="row between"><div><div class="h1">Hives</div><div class="tiny muted">${isPro(s)?'Unlimited hives':'Free: up to '+FREE_HIVE_LIMIT+' hives'}</div></div><button class="btn primary" onclick="addHive()">+ Add</button></section>
    <section class="card pad"><div class="row between"><div><div class="h3">Needs Attention</div><div class="tiny muted">${s.hives.filter(x=>x.status!=='Healthy').length} flagged colonies</div></div><span class="pill">${avgHealth(s)}% overall</span></div></section>
    <section class="hivelist">${shown.map(h=>hiveCard(h)).join('')}</section>
    <section><button class="btn secondarybtn block" onclick="go('all-hives')">View All Hives</button></section>
  </div>`
}
function hiveCard(h){
  return `<div class="card hivecard card-button" onclick="go('hive/${h.id}')"><div class="hivethumb">🏠</div><div class="grow"><div class="row between"><div class="h3">${esc(h.name)}</div>${statusPill(h.status)}</div><div class="tiny muted">Last inspection ${fmtDate(h.lastInspection)}</div><div class="row between" style="margin-top:5px"><span class="score">${h.score}%</span><span class="tiny muted">Varroa ${h.varroa}%</span></div><div class="track"><div class="progress" style="width:${h.score}%"></div></div></div><span class="chev">›</span></div>`
}
function addHive(){
  const s=state();
  if(!isPro(s)&&s.hives.length>=FREE_HIVE_LIMIT){subscriptionModal('more than 3 hives');return}
  const m=modal(`<div class="modalhead"><div class="h2">Add Hive</div><button class="iconbtn" onclick="closeModal(this)">✕</button></div>
  <div class="formgroup"><label>Hive Name</label><input id="newHiveName" maxlength="40" placeholder="Hive #4"></div>
  <div class="formgroup"><label>Hive Type</label><select id="newHiveType"><option>Langstroth</option><option>Flow Hive</option><option>Top Bar</option></select></div>
  <button class="btn primary block" id="saveHive">Create Hive</button>`);
  m.querySelector('#saveHive').onclick=()=>{
    const name=m.querySelector('#newHiveName').value.trim()||`Hive #${s.hives.length+1}`;
    const h={id:'h'+Date.now(),name,score:80,status:'Attention',queen:'Not confirmed',eggs:false,larvae:false,queenCells:false,brood:'Good',strength:'Medium',honey:'Medium',pollen:'Medium',varroa:0,shb:false,waxMoth:false,disease:false,swarm:false,superStatus:'None',lastInspection:new Date().toISOString().slice(0,10),notes:'New hive.'};
    s.hives.push(h);save(s);m.remove();toast('Hive added');render()
  }
}

function allHives(r){
  const s=state();
  r.innerHTML=`<section class="row between"><div><button class="btn secondarybtn" onclick="go('hives')">← Hives</button><div class="h1" style="margin-top:12px">All Hives</div></div><button class="btn primary" onclick="addHive()">+ Add</button></section>
  <section class="searchrow"><input id="hiveSearch" placeholder="Search hives"><select id="hiveFilter"><option>All</option><option>Healthy</option><option>Attention</option><option>Critical</option></select></section>
  <section id="allHiveList"></section>`;
  const draw=()=>{
    const q=idq('hiveSearch').value.toLowerCase(),f=idq('hiveFilter').value;
    const list=s.hives.filter(h=>(f==='All'||h.status===f)&&h.name.toLowerCase().includes(q)).sort((a,b)=>a.score-b.score);
    idq('allHiveList').innerHTML=list.map(h=>`<div style="margin-bottom:8px">${hiveCard(h)}</div>`).join('')||'<div class="setting small muted">No matching hives.</div>'
  };
  idq('hiveSearch').oninput=draw;idq('hiveFilter').onchange=draw;draw()
}

function actions(r){
  const s=state(),top=s.actions.slice(0,2);
  r.innerHTML=`<div class="screen actions-screen">
    <section class="row between"><div><div class="h1">Actions</div><div class="tiny muted">Highest-priority work</div></div><button class="pill" onclick="go('all-actions')">View All</button></section>
    <section class="tabs"><button class="tab active">Priority</button><button class="tab" onclick="go('all-actions')">All</button><button class="tab" onclick="go('all-actions')">Completed</button></section>
    <section class="actionlist">${top.length?top.map(a=>actionCard(s,a)).join(''):'<div class="card pad small muted">No pending actions.</div>'}</section>
    <section><div class="sectionlabel">Record Action</div><div class="quick"><button class="qbtn" onclick="actionForm('inspection')"><span class="emo">🔎</span><b>Inspection</b></button><button class="qbtn" onclick="actionForm('feeding')"><span class="emo">🥣</span><b>Feeding</b></button><button class="qbtn" onclick="moreActions()"><span class="emo">＋</span><b>More</b></button></div></section>
  </div>`
}
function actionCard(s,a){
  const h=hive(s,a.hiveId);
  return `<div class="card actioncard"><div class="row between"><span class="pill ${a.priority==='High'?'danger':'warn'}">${a.priority}</span><span class="tiny muted">${esc(a.due)}</span></div><div class="action-title">${esc(h?.name||'Hive')} · ${esc(a.title)}</div><div class="action-reason">${esc(a.reason)}</div><div class="row between action-foot"><span class="tiny muted">${esc(a.type)}</span><button class="btn secondarybtn" onclick="${a.type==='Inspection'?"actionForm('inspection','"+a.hiveId+"')":a.type==='Feeding'?"actionForm('feeding','"+a.hiveId+"')":"actionForm('treatment','"+a.hiveId+"')"}">Start</button></div></div>`
}
function allActions(r){
  const s=state();
  r.innerHTML=`<section><button class="btn secondarybtn" onclick="go('actions')">← Actions</button><div class="h1" style="margin-top:12px">All Actions</div><div class="tiny muted">Generated from hive records and settings</div></section>
  <section class="setting">${s.actions.length?s.actions.map(a=>{const h=hive(s,a.hiveId);return `<div class="srow"><div class="scopy"><div class="row"><span class="pill ${a.priority==='High'?'danger':'warn'}">${a.priority}</span><b>${esc(h?.name||'Hive')}</b></div><div class="small" style="margin-top:5px">${esc(a.title)}</div><div class="tiny muted">${esc(a.reason)}</div></div><button class="btn secondarybtn" onclick="${a.type==='Inspection'?"actionForm('inspection','"+a.hiveId+"')":a.type==='Feeding'?"actionForm('feeding','"+a.hiveId+"')":"actionForm('treatment','"+a.hiveId+"')"}">Start</button></div>`}).join(''):'<div class="small muted">No pending actions.</div>'}</section>`
}
function moreActions(){
  const m=modal(`<div class="modalhead"><div class="h2">Record Action</div><button class="iconbtn" onclick="closeModal(this)">✕</button></div><div class="quick"><button class="qbtn" onclick="closeModal(this);actionForm('treatment')"><span class="emo">🧪</span><b>Treatment</b></button><button class="qbtn" onclick="closeModal(this);actionForm('harvest')"><span class="emo">🍯</span><b>Harvest</b></button><button class="qbtn" onclick="closeModal(this);actionForm('inspection')"><span class="emo">🔎</span><b>Inspection</b></button></div>`)
}

function actionForm(type,selectedHive){
  const s=state(),hiveOptions=s.hives.map(h=>`<option value="${h.id}" ${h.id===selectedHive?'selected':''}>${esc(h.name)}</option>`).join('');
  let fields='';
  if(type==='inspection')fields=`
    <div class="formgroup"><label>Queen Status</label><select id="queen"><option>Confirmed</option><option>Not confirmed</option><option>Queen cells observed</option></select></div>
    <div class="row"><label style="flex:1"><input id="eggs" type="checkbox" style="width:auto;min-height:auto"> Eggs present</label><label style="flex:1"><input id="larvae" type="checkbox" style="width:auto;min-height:auto"> Larvae present</label></div>
    <div class="formgroup"><label>Brood Quality</label><select id="brood"><option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option></select></div>
    <div class="formgroup"><label>Colony Strength</label><select id="strength"><option>Strong</option><option>Medium</option><option>Weak</option></select></div>
    <div class="row"><div class="formgroup grow"><label>Honey Stores</label><select id="honey"><option>High</option><option>Medium</option><option>Low</option></select></div><div class="formgroup grow"><label>Pollen Stores</label><select id="pollen"><option>High</option><option>Medium</option><option>Low</option></select></div></div>
    <div class="formgroup"><label>Varroa %</label><input id="varroa" type="number" min="0" max="10" step=".1" value="1"></div>
    <div class="row"><label style="flex:1"><input id="shb" type="checkbox" style="width:auto;min-height:auto"> Small hive beetle</label><label style="flex:1"><input id="waxMoth" type="checkbox" style="width:auto;min-height:auto"> Wax moth</label></div>
    <div class="row"><label style="flex:1"><input id="disease" type="checkbox" style="width:auto;min-height:auto"> Disease concern</label><label style="flex:1"><input id="swarm" type="checkbox" style="width:auto;min-height:auto"> Swarm signs</label></div>
    <div class="formgroup"><label>Super Status</label><select id="superStatus"><option>Installed</option><option>Added today</option><option>Removed today</option><option>None</option></select></div>
    <div class="formgroup"><label>Notes</label><textarea id="notes" maxlength="1000" placeholder="Quick field note..."></textarea></div>`;
  if(type==='feeding')fields=`<div class="formgroup"><label>Feed Type</label><select id="feedType"><option>1:1 Syrup</option><option>2:1 Syrup</option><option>Pollen Patty</option></select></div><div class="formgroup"><label>Amount</label><input id="feedAmount" maxlength="40" placeholder="${s.settings.units==='metric'?'2 L':'2 gallons'}"></div>`;
  if(type==='treatment')fields=`<div class="formgroup"><label>Treatment Type</label><select id="treatmentType"><option>Oxalic Acid</option><option>Formic Acid</option><option>Apivar</option><option>Other</option></select></div><div class="notice">Follow the product label and applicable local rules. HiveDash does not replace label instructions.</div>`;
  if(type==='harvest')fields=`<div class="formgroup"><label>Weight (${s.settings.units==='metric'?'kg':'lb'})</label><input id="harvestWeight" type="number" step=".1"></div><div class="formgroup"><label>Frames</label><input id="harvestFrames" type="number"></div><div class="formgroup"><label>Moisture %</label><input id="harvestMoisture" type="number" step=".1"></div>`;
  const m=modal(`<div class="modalhead"><div class="h2">New ${type[0].toUpperCase()+type.slice(1)}</div><button class="iconbtn" onclick="closeModal(this)">✕</button></div><div class="formgroup"><label>Hive</label><select id="formHive">${hiveOptions}</select></div><div class="formgroup"><label>Date</label><input id="formDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>${fields}<button class="btn primary block" id="saveAction">Save</button>`);
  m.querySelector('#saveAction').onclick=()=>{
    const hiveId=m.querySelector('#formHive').value,date=m.querySelector('#formDate').value,h=hive(s,hiveId);
    if(type==='inspection'){
      Object.assign(h,{
        queen:m.querySelector('#queen').value,
        eggs:m.querySelector('#eggs').checked,
        larvae:m.querySelector('#larvae').checked,
        brood:m.querySelector('#brood').value,
        strength:m.querySelector('#strength').value,
        honey:m.querySelector('#honey').value,
        pollen:m.querySelector('#pollen').value,
        varroa:Number(m.querySelector('#varroa').value||0),
        shb:m.querySelector('#shb').checked,
        waxMoth:m.querySelector('#waxMoth').checked,
        disease:m.querySelector('#disease').checked,
        swarm:m.querySelector('#swarm').checked,
        superStatus:m.querySelector('#superStatus').value,
        notes:m.querySelector('#notes').value,
        lastInspection:date
      });
      const result=calculateHealth(h);h.score=result.score;h.status=result.status;s.logs.inspections.push({id:'i'+Date.now(),hiveId,date,...clone(h),why:result.why});
    }else if(type==='feeding'){
      s.logs.feedings.push({id:'f'+Date.now(),hiveId,date,type:m.querySelector('#feedType').value,amount:m.querySelector('#feedAmount').value})
    }else if(type==='treatment'){
      s.logs.treatments.push({id:'t'+Date.now(),hiveId,date,type:m.querySelector('#treatmentType').value})
    }else if(type==='harvest'){
      let weight=Number(m.querySelector('#harvestWeight').value||0);if(s.settings.units==='metric')weight=weight/0.453592;
      s.logs.harvests.push({id:'hv'+Date.now(),hiveId,date,weightLb:weight,frames:Number(m.querySelector('#harvestFrames').value||0),moisture:Number(m.querySelector('#harvestMoisture').value||0)})
    }
    save(s);m.remove();toast('Saved');render()
  }
}

function insights(r){
  const s=state(),worst=[...s.hives].sort((a,b)=>a.score-b.score)[0],total=s.logs.harvests.reduce((n,x)=>n+Number(x.weightLb||0),0);
  const pro=isPro(s);
  r.innerHTML=`<div class="screen insights-screen">
    <section class="row between"><div><div class="h1">Insights</div><div class="tiny muted">${pro?'Advanced analysis enabled':'Free summary · Pro unlocks advanced analysis'}</div></div>${pro?'<span class="pill">PRO</span>':'<button class="pill warn" onclick="go(\'subscription\')">Upgrade</button>'}</section>
    <section class="insightgrid">
      <div class="card icard card-button ${pro?'':'locked'}" onclick="${pro?"go('analysis')":"requirePro('Health Analysis')"}"><div class="row between"><div class="h3">Health Analysis</div><span class="protag">PRO</span></div><div class="big">${worst.score}%</div><div class="tiny muted">${esc(worst.name)} needs the closest review.</div></div>
      <div class="card icard card-button ${pro?'':'locked'}" onclick="${pro?"go('trend')":"requirePro('90-day trends')"}"><div class="row between"><div class="h3">Health Trend</div><span class="protag">PRO</span></div><div class="chart">${s.hives.map((h,i)=>`<div class="bar ${i===s.hives.length-1?'emph':''}" style="height:${Math.max(14,h.score)}%"><span>${i+1}</span></div>`).join('')}</div></div>
      <div class="card icard card-button ${pro?'':'locked'}" onclick="${pro?"go('risk')":"requirePro('Risk Prediction')"}"><div class="row between"><div class="h3">Risk Prediction</div><span class="protag">PRO</span></div><div class="big">${worst.varroa>=3?'High':'Watch'}</div><div class="tiny muted">${worst.varroa>=3?'Elevated mite follow-up priority.':'Review flagged signals.'}</div></div>
      <div class="card icard card-button" onclick="go('honey')"><div class="h3">Honey Analytics</div><div class="big">${formatWeight(total,s)}</div><div class="tiny muted">${s.logs.harvests.length} harvest batches</div></div>
    </section>
    <section class="card pad card-button ${pro?'':'locked'}" onclick="${pro?"go('season')":"requirePro('Season Intelligence')"}"><div class="row between"><div><div class="h3">Season Intelligence</div><div class="tiny muted">${pro?'Location-aware recommendations':'Pro feature'}</div></div><span class="pill warn">${pro?'Season':'PRO'}</span></div><div class="compact alert" style="margin-top:7px"><span>🍃</span><div class="grow"><div class="small"><b>Prioritize mite monitoring</b></div><div class="tiny muted">Review overdue colonies and low food stores.</div></div></div></section>
  </div>`
}

function healthAnalysis(r){
  const s=state();if(!isPro(s)){subscriptionModal('Health Analysis');go('insights');return}
  r.innerHTML=`<section><button class="btn secondarybtn" onclick="go('insights')">← Insights</button><div class="h1" style="margin-top:12px">Health Analysis</div><div class="tiny muted">Transparent rule-based explanation</div></section>
  ${s.hives.map(h=>{const res=calculateHealth(h);return `<section class="setting card-button" onclick="go('hive/${h.id}')"><div class="row between"><div><div class="h2">${esc(h.name)}</div><div class="tiny muted">${res.why.length?res.why.map(x=>`${esc(x[0])} ${x[1]}`).join(' · '):'No major negative signals'}</div></div>${statusPill(res.status)}</div><div class="score" style="margin-top:8px">${res.score}%</div></section>`}).join('')}`
}
function trendPage(r){
  const s=state();if(!isPro(s)){subscriptionModal('Health Trends');go('insights');return}
  r.innerHTML=`<section><button class="btn secondarybtn" onclick="go('insights')">← Insights</button><div class="h1" style="margin-top:12px">Health Trend</div></section><section class="setting">${s.hives.map(h=>`<div class="srow"><div class="scopy"><b>${esc(h.name)}</b><div class="track" style="margin-top:6px"><div class="progress" style="width:${h.score}%"></div></div></div><b>${h.score}%</b></div>`).join('')}</section>`
}
function riskPage(r){
  const s=state();if(!isPro(s)){subscriptionModal('Risk Prediction');go('insights');return}
  r.innerHTML=`<section><button class="btn secondarybtn" onclick="go('insights')">← Insights</button><div class="h1" style="margin-top:12px">Risk Prediction</div><div class="tiny muted">Current prototype uses transparent rules, not a black-box model.</div></section><section class="setting">${s.hives.map(h=>{const reasons=[];if(h.varroa>=3)reasons.push('Varroa elevated');if(h.queen!=='Confirmed')reasons.push('Queen uncertainty');if(h.honey==='Low'||h.pollen==='Low')reasons.push('Low food stores');const level=h.varroa>=3?'High':reasons.length?'Medium':'Low';return `<div class="srow card-button" onclick="go('hive/${h.id}')"><div class="scopy"><b>${esc(h.name)}</b><div class="tiny muted">${reasons.length?esc(reasons.join(' · ')):'No major current rule-based signal'}</div></div><span class="pill ${level==='High'?'danger':level==='Medium'?'warn':''}">${level}</span></div>`}).join('')}</section>`
}
function honeyPage(r){
  const s=state(),total=s.logs.harvests.reduce((n,x)=>n+Number(x.weightLb||0),0);
  r.innerHTML=`<section><button class="btn secondarybtn" onclick="go('insights')">← Insights</button><div class="h1" style="margin-top:12px">Honey Analytics</div></section><section class="setting"><div class="srow"><b>Total Logged Harvest</b><b>${formatWeight(total,s)}</b></div><div class="srow"><b>Harvest Batches</b><b>${s.logs.harvests.length}</b></div>${s.logs.harvests.map(x=>`<div class="srow"><div class="scopy"><b>${fmtDate(x.date)}</b><div class="tiny muted">${esc(hive(s,x.hiveId)?.name||'Hive')} · ${x.frames} frames · ${x.moisture}% moisture</div></div><b>${formatWeight(x.weightLb,s)}</b></div>`).join('')}</section><button class="btn primary block" onclick="actionForm('harvest')">Record Harvest</button>`
}
function seasonPage(r){
  const s=state();if(!isPro(s)){subscriptionModal('Season Intelligence');go('home');return}
  r.innerHTML=`<section><button class="btn secondarybtn" onclick="history.back()">← Back</button><div class="h1" style="margin-top:12px">Season Intelligence</div><div class="tiny muted">${esc(s.settings.location)} · ${new Date().toLocaleDateString('en-US',{month:'long'})}</div></section><section class="setting"><div class="srow"><div class="scopy"><b>Monitor mites closely</b><div class="tiny muted">Prioritize colonies with elevated Varroa or overdue checks.</div></div><span class="pill warn">Priority</span></div><div class="srow"><div class="scopy"><b>Review food stores</b><div class="tiny muted">Follow up on low honey or pollen stores before the next seasonal transition.</div></div></div><div class="srow"><div class="scopy"><b>Confirm queen status</b><div class="tiny muted">Recheck colonies where queen status remains uncertain.</div></div></div></section><div class="notice">V9 uses date, location setting and hive records. Real weather/bloom APIs are still required for production-grade recommendations.</div>`
}

function hiveDetail(r,id){
  const s=state(),h=hive(s,id);if(!h){go('hives');return}
  const result=calculateHealth(h);
  r.innerHTML=`<section><button class="btn secondarybtn" onclick="history.back()">← Back</button><div class="row between" style="margin-top:12px"><div><div class="h1">${esc(h.name)}</div><div class="tiny muted">Full colony record</div></div>${statusPill(h.status)}</div></section>
  <section class="setting"><div class="row between"><div><div class="h2">Health Score</div><div class="tiny muted">${result.why.length?result.why.map(x=>`${esc(x[0])} ${x[1]}`).join(' · '):'No major negative signals'}</div></div><div class="score">${h.score}%</div></div><div class="track" style="margin-top:8px"><div class="progress" style="width:${h.score}%"></div></div></section>
  <section><div class="sectionlabel">Health Details</div><div class="setting">
    <div class="srow"><b>Queen</b><b>${esc(h.queen)}</b></div><div class="srow"><b>Eggs / Larvae</b><b>${h.eggs?'Eggs ✓':'Eggs —'} · ${h.larvae?'Larvae ✓':'Larvae —'}</b></div><div class="srow"><b>Brood</b><b>${esc(h.brood)}</b></div><div class="srow"><b>Colony Strength</b><b>${esc(h.strength)}</b></div><div class="srow"><b>Honey / Pollen</b><b>${esc(h.honey)} / ${esc(h.pollen)}</b></div><div class="srow"><b>Varroa</b><b>${h.varroa}%</b></div><div class="srow"><b>Pests / Disease</b><b>${h.shb?'SHB ':''}${h.waxMoth?'Wax Moth ':''}${h.disease?'Disease':'None'}</b></div><div class="srow"><b>Swarm Signs</b><b>${h.swarm?'Yes':'No'}</b></div><div class="srow"><b>Super</b><b>${esc(h.superStatus)}</b></div>
  </div></section>
  <section><div class="sectionlabel">Timeline</div><div class="setting">${timelineRows(s,h.id)}</div></section>
  <section class="quick"><button class="qbtn" onclick="actionForm('inspection','${h.id}')"><span class="emo">🔎</span><b>Inspection</b></button><button class="qbtn" onclick="actionForm('feeding','${h.id}')"><span class="emo">🥣</span><b>Feeding</b></button><button class="qbtn" onclick="actionForm('treatment','${h.id}')"><span class="emo">🧪</span><b>Treatment</b></button></section>`
}
function timelineRows(s,hiveId){
  const rows=[
    ...s.logs.inspections.filter(x=>x.hiveId===hiveId).map(x=>({date:x.date,type:'Inspection',detail:x.notes||'Inspection saved'})),
    ...s.logs.feedings.filter(x=>x.hiveId===hiveId).map(x=>({date:x.date,type:'Feeding',detail:`${x.type} · ${x.amount}`})),
    ...s.logs.treatments.filter(x=>x.hiveId===hiveId).map(x=>({date:x.date,type:'Treatment',detail:x.type})),
    ...s.logs.harvests.filter(x=>x.hiveId===hiveId).map(x=>({date:x.date,type:'Harvest',detail:formatWeight(x.weightLb,s)}))
  ].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!rows.length)return `<div class="srow"><div class="scopy"><b>${fmtDate(hive(s,hiveId).lastInspection)} · Inspection</b><div class="tiny muted">${esc(hive(s,hiveId).notes)}</div></div></div>`;
  return rows.map(x=>`<div class="srow"><div class="scopy"><b>${fmtDate(x.date)} · ${esc(x.type)}</b><div class="tiny muted">${esc(x.detail)}</div></div></div>`).join('')
}

function settings(r){
  const s=state(),x=s.settings;
  r.innerHTML=`<section><div class="h1">Settings</div><div class="tiny muted">Account, apiary, alerts and preferences</div></section>
  <div class="sectionlabel">Account</div><section class="setting"><div class="srow"><div class="scopy"><b>${esc(s.user.name)}</b><div class="tiny muted">${esc(s.user.email)}</div></div><span class="pill">${esc(s.user.plan)}</span></div><div class="srow card-button" onclick="go('subscription')"><div class="scopy"><b>Subscription</b><div class="tiny muted">Free / Pro plans</div></div><span class="chev">›</span></div></section>

  <div class="sectionlabel">Apiary Settings</div><section class="setting"><div class="formgroup"><label>Apiary Name</label><input id="apiaryName" maxlength="60" value="${esc(x.apiaryName)}"></div><div class="formgroup"><label>Location</label><input id="location" maxlength="80" value="${esc(x.location)}"></div><div class="formgroup"><label>Time Zone</label><input id="timezone" maxlength="60" value="${esc(x.timezone)}"></div><div class="formgroup"><label>Default Hive Type</label><select id="hiveType"><option ${x.hiveType==='Langstroth'?'selected':''}>Langstroth</option><option ${x.hiveType==='Flow Hive'?'selected':''}>Flow Hive</option><option ${x.hiveType==='Top Bar'?'selected':''}>Top Bar</option></select></div><div class="formgroup"><label>Default Inspection Cycle</label><select id="inspectionCycle"><option value="7" ${x.inspectionCycle==7?'selected':''}>7 days</option><option value="14" ${x.inspectionCycle==14?'selected':''}>14 days</option><option value="21" ${x.inspectionCycle==21?'selected':''}>21 days</option></select></div></section>

  <div class="sectionlabel">Notifications</div><section class="setting">${Object.entries({inspection:'Inspection Reminders',treatment:'Treatment Follow-up',queen:'Queen Alerts',swarm:'Swarm Risk Alerts',weather:'Weather Alerts'}).map(([k,v])=>`<div class="srow"><b>${v}</b><label class="switch"><input data-notif="${k}" type="checkbox" ${x.notifications[k]?'checked':''}><span class="slider"></span></label></div>`).join('')}</section>

  <div class="sectionlabel">Preferences</div><section class="setting"><div class="formgroup"><label>Units</label><select id="units"><option value="imperial" ${x.units==='imperial'?'selected':''}>US / Imperial (°F, lb, mi)</option><option value="metric" ${x.units==='metric'?'selected':''}>Metric (°C, kg, km)</option></select></div><div class="srow"><div class="scopy"><b>Language</b><div class="tiny muted">English only in V9 to avoid a non-working language selector.</div></div><b>English</b></div></section>

  <div class="sectionlabel">Smart Features</div><section class="setting"><div class="srow"><div class="scopy"><b>AI Recommendations</b><div class="tiny muted">Advanced analysis requires Pro.</div></div><label class="switch"><input id="aiRecommendations" type="checkbox" ${x.aiRecommendations?'checked':''}><span class="slider"></span></label></div><div class="srow"><div class="scopy"><b>Photo Analysis</b><div class="tiny muted">Not connected yet.</div></div><span class="pill warn">Coming Soon</span></div><div class="srow"><div class="scopy"><b>Voice Notes</b><div class="tiny muted">Not connected yet.</div></div><span class="pill warn">Coming Soon</span></div><div class="srow"><div class="scopy"><b>Cloud Backup</b><div class="tiny muted">Local browser storage only in this prototype.</div></div><span class="pill warn">Coming Soon</span></div></section>

  <div class="sectionlabel">Beekeeping Store</div><section class="setting shop"><div class="h2">Shop Beekeeping Equipment</div><div class="small muted" style="margin-top:4px">Bee hives, Flow Frames, components and accessories.</div><div class="tiny muted" style="margin-top:3px">Powered by SkogHive</div><button class="btn goldbtn" style="margin-top:10px" onclick="window.open('https://www.skoghive.com','_blank','noopener')">Visit Store ↗</button></section>

  <div class="sectionlabel">Data & Backup</div><section class="setting"><div class="srow card-button" onclick="exportData()"><div class="scopy"><b>Export Data</b><div class="tiny muted">Download a JSON backup</div></div><span class="chev">›</span></div><div class="srow card-button" onclick="if(confirm('Reset demo data?'))resetState()"><b style="color:#92372F">Reset Demo Data</b><span class="chev">›</span></div></section>

  <div class="sectionlabel">Privacy & Support</div><section class="setting"><div class="srow card-button" onclick="go('privacy')"><b>Privacy Policy</b><span class="chev">›</span></div><div class="srow card-button" onclick="go('terms')"><b>Terms of Service</b><span class="chev">›</span></div><div class="srow card-button" onclick="go('help')"><b>Help Center</b><span class="chev">›</span></div><div class="srow card-button" onclick="go('support')"><b>Contact Support</b><span class="chev">›</span></div></section>
  <button class="btn primary block" id="saveSettings">Save Settings</button>`;

  idq('saveSettings').onclick=()=>{
    x.apiaryName=idq('apiaryName').value.trim();x.location=idq('location').value.trim();x.timezone=idq('timezone').value.trim();x.hiveType=idq('hiveType').value;x.inspectionCycle=Number(idq('inspectionCycle').value);x.units=idq('units').value;x.aiRecommendations=idq('aiRecommendations').checked;document.querySelectorAll('[data-notif]').forEach(el=>x.notifications[el.dataset.notif]=el.checked);save(s);toast('Settings saved')
  }
}
function exportData(){
  const s=state(),blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='hivedash-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)
}

function subscriptionPage(r){
  const s=state();
  r.innerHTML=`<section><button class="btn secondarybtn" onclick="go('settings')">← Settings</button><div class="h1" style="margin-top:12px">HiveDash Plans</div></section><section class="setting"><div class="row between"><div><div class="h2">Free</div><div class="small muted">Up to ${FREE_HIVE_LIMIT} hives · Basic records · Basic reminders</div></div>${s.user.plan==='Free'?'<span class="pill">Current</span>':''}</div><button class="btn secondarybtn block" data-plan="Free" style="margin-top:10px">Choose Free</button></section><section class="setting"><div class="row between"><div><div class="h2">HiveDash Pro</div><div class="small muted">Unlimited hives · Health Analysis · Risk Prediction · Season Intelligence · Advanced trends · Reports</div></div>${s.user.plan==='Pro'?'<span class="pill">Current</span>':'<span class="pill warn">Recommended</span>'}</div><div class="h2" style="margin-top:10px">$59.99 / year</div><button class="btn primary block" data-plan="Pro" style="margin-top:10px">Choose Pro</button></section><div class="notice">Prototype billing only. Production must validate paid entitlement from Stripe/Paddle/RevenueCat/App Store billing.</div>`;
  document.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{s.user.plan=b.dataset.plan;save(s);toast('Plan changed in demo');render()})
}

function notifications(r){
  const s=state();
  r.innerHTML=`<section><div class="h1">Notifications</div><div class="tiny muted">Alerts, reminders and seasonal updates</div></section><section>${s.notifications.length?s.notifications.map(n=>`<div class="setting card-button" style="opacity:${n.read?.65:1}" onclick="openNotification('${n.id}')"><div class="row"><div class="grow"><div class="h3">${esc(n.title)}</div><div class="small muted">${esc(n.body)}</div></div><span class="chev">›</span></div></div>`).join(''):'<div class="setting small muted">No notifications.</div>'}</section><button class="btn secondarybtn block" onclick="markAllRead()">Mark All Read</button>`
}
function openNotification(id){const s=state(),n=s.notifications.find(x=>x.id===id);if(!n)return;n.read=true;save(s);location.hash=(n.target||'#notifications').replace(/^#/,'')}
function markAllRead(){const s=state();s.notifications.forEach(n=>n.read=true);save(s);toast('All read');render()}

function infoPage(r,title){
  const copy={
    'Privacy Policy':'This route is working. Replace this prototype copy with the final privacy policy before launch.',
    'Terms of Service':'This route is working. Replace this prototype copy with the final terms before launch.',
    'Help Center':'Help topics should cover inspections, hive records, treatments, subscriptions, notifications, export and account management.',
    'Contact Support':'Connect this route to the final support email or support form before launch.'
  }[title];
  r.innerHTML=`<section><button class="btn secondarybtn" onclick="go('settings')">← Settings</button><div class="h1" style="margin-top:12px">${esc(title)}</div></section><section class="setting body">${esc(copy)}</section>`
}

window.addEventListener('hashchange',render);
window.addEventListener('DOMContentLoaded',()=>{if(!location.hash)location.hash='home';render()});
