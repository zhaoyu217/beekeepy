/* HiveDash V45 — LOCKED FEATURE + LOCKED VISUAL OVERLAY
   No feature architecture, entry-point, route, or bottom-navigation changes.
*/
const V45={
  home:'assets/home_apiary.jpg',hives:'assets/hives_apiary.jpg',hive:'assets/hive_detail.jpg',actions:'assets/actions_field.jpg',inspection:'assets/inspection_beekeeper.jpg',feeding:'assets/feeding_bucket.jpg',treatment:'assets/treatment_apiary.jpg',harvest:'assets/harvest_honey.jpg',flowers:'assets/flowers.jpg',honeycomb:'assets/honeycomb.jpg',settings:'assets/settings_apiary.jpg',season:'assets/season_apiary.jpg',map:'assets/map_bg.jpg',insights:'assets/insights_bee.jpg'
};
function v45s(){const s=state();s.settings=s.settings||{};s.settings.notifications={inspection:true,varroa:true,treatment:true,feeding:true,weather:true,seasonal:true,push:true,...(s.settings.notifications||{})};s.settings.smart={voice:true,photo:true,varroaCount:true,aiHealth:true,recommendations:true,seasonWeather:true,qr:true,...(s.settings.smart||{})};s.settings.seasonal={mode:'Auto',nectar:true,swarm:'Apr – Jul',varroa:'Aug – Oct',feeding:'Aug – Oct',winter:'Oct – Feb',super:'Auto',focus:'Auto',...(s.settings.seasonal||{})};s.settings.region={measurement:s.settings.units==='metric'?'Metric':'Imperial (US)',temperature:s.settings.units==='metric'?'°C':'°F',weight:s.settings.units==='metric'?'kg':'lb',date:'MM/DD/YYYY',language:'English',timezone:s.settings.timezone||'America/Denver',...(s.settings.region||{})};s.settings.apiaryName=s.settings.apiaryName||'Oak Meadow Apiary';s.settings.location=s.settings.location||'Colorado, USA';s.hives=s.hives||[];[
{id:'h4',name:'Willow Creek',score:84,status:'Healthy',queen:'Confirmed',eggs:true,larvae:true,queenCells:false,brood:'Good',strength:'Strong',honey:'High',pollen:'High',varroa:1,superStatus:'Installed',lastInspection:'2026-08-12',notes:'Calm and productive.'},
{id:'h5',name:'South Field #2',score:76,status:'Healthy',queen:'Confirmed',eggs:true,larvae:true,queenCells:false,brood:'Good',strength:'Medium',honey:'Medium',pollen:'Medium',varroa:2,superStatus:'Installed',lastInspection:'2026-08-10',notes:'Good nectar intake.'},
{id:'h6',name:'East Field #1',score:61,status:'Attention',queen:'Not confirmed',eggs:true,larvae:true,queenCells:false,brood:'Fair',strength:'Medium',honey:'Medium',pollen:'Low',varroa:3,superStatus:'Installed',lastInspection:'2026-08-06',notes:'Queen confirmation needed.'}
].forEach(h=>{if(!s.hives.some(x=>x.id===h.id))s.hives.push(h)});return s}
function vh(id){const s=v45s();return hive(s,id)||s.hives[0]}
function vphoto(h,i=0){const a=[V45.hive,V45.hives,V45.home,V45.season],s=v45s(),n=Math.max(0,s.hives.findIndex(x=>x.id===h.id));return a[(n+i)%a.length]}
function Vcard(title,body,action=''){return `<section class="vc"><div class="vhead"><b>${title}</b>${action}</div>${body}</section>`}
function Vhero(img,html,cls=''){return `<section class="vhero ${cls}" style="--hero:url('${img}')"><i></i>${html}</section>`}
function Vback(title,right=''){return `<button class="iconbtn" onclick="history.back()">‹</button><div class="pagebar-title">${title}</div>${right||'<span></span>'}`}
function Vstatus(h){return h.status==='Healthy'?'Good':h.status==='Attention'?'Needs Attention':'Critical'}
function Vclass(h){return h.status==='Healthy'?'good':h.status==='Attention'?'attention':'critical'}

function chrome(page){const s=v45s(),top=idq('topbar'),bottom=idq('bottomnav'),raw=(location.hash||'#home').slice(1).split('/'),id=raw[1]||s.hives[0]?.id||'h1';top.className='topbar vtop';if(page==='home')top.innerHTML=`<button class="iconbtn" onclick="go('settings')">${icon('settings')}</button><div class="brand"><span class="brand-hive">${icon('hive')}</span>HiveDash</div><button class="iconbtn" onclick="go('notifications')">${icon('bell')}${unread(s)?`<span class="badge">${unread(s)}</span>`:''}</button>`;else if(['hives','actions','insights'].includes(page))top.innerHTML=`<button class="iconbtn" onclick="go('settings')">${icon('settings')}</button><div class="pagebar-title">${page[0].toUpperCase()+page.slice(1)}</div><button class="iconbtn plusbtn" onclick="${page==='hives'?'addHive()':page==='actions'?`go('inspection/${id}')`:`go('analysis')`}">+</button>`;else{const t={'hive':'Hive Detail','inspection':'Inspection','timeline':'Timeline','honey':'Harvest','map':'Map','all-hives':'All Hives','all-actions':'All Actions','feeding-record':'Feeding Record','treatment-record':'Treatment Record','harvest-record':'Harvest Record','analysis':'AI Health Analysis','trend':'Health Trends','risk':'Risk Prediction','season':'Season Intelligence','honey-analytics':'Honey Analytics','recommendations':'Professional Recommendations','settings':'Settings','account':'Account','subscription':'HiveDash Pro','apiary':'Apiary & Hive','seasonal-settings':'Seasonal Settings','notification-preferences':'Notification Preferences','units-region':'Units & Region','smart-features':'Smart Features','data-backup':'Data & Backup','security':'Privacy & Security','store':'Store','notifications':'Notifications','help':'Help Center','faq':'FAQ / Report Problem','support':'Contact Support','about':'About HiveDash','privacy':'Privacy Policy','terms':'Terms of Service'}[page]||'HiveDash';let right='';if(page==='hive')right=`<button class="iconbtn" onclick="openHiveDetailMenu('${id}')">•••</button>`;if(page==='inspection')right=`<button class="csave" onclick="vSaveInspection('${id}')">Save</button>`;if(page==='honey')right=`<button class="iconbtn plusbtn" onclick="go('harvest-record/${id}')">+</button>`;top.innerHTML=Vback(t,right)}
const hide=['settings','account','subscription','apiary','seasonal-settings','notification-preferences','units-region','smart-features','data-backup','security','store','notifications','help','faq','support','about','privacy','terms','feeding-record','treatment-record','harvest-record'];bottom.classList.toggle('hidden',hide.includes(page));const active=page==='home'?'home':['hives','hive','map','all-hives'].includes(page)?'hives':['actions','inspection','all-actions','feeding-record','treatment-record','harvest-record','honey'].includes(page)?'actions':'insights';bottom.innerHTML=[['home','Home','home'],['hives','Hives','hive'],['actions','Actions','check'],['insights','Insights','chart']].map(x=>`<button class="navitem ${active===x[0]?'active':''}" onclick="go('${x[0]}')">${icon(x[2])}<span>${x[1]}</span></button>`).join('')}

function render(){const p=(location.hash||'#home').slice(1).split('/'),page=p[0]||'home',id=p[1],r=idq('view');r.className='view vview '+(['settings','account','subscription','apiary','seasonal-settings','notification-preferences','units-region','smart-features','data-backup','security','store','notifications','help','faq','support','about','privacy','terms','feeding-record','treatment-record','harvest-record'].includes(page)?'secondary':'main');const m={home:()=>home(r),hives:()=>hives(r),hive:()=>hiveDetail(r,id),inspection:()=>inspectionPage(r,id),timeline:()=>timelinePage(r),honey:()=>honeyPage(r),map:()=>mapPage(r),insights:()=>insights(r),actions:()=>actions(r),'all-hives':()=>allHives(r),'all-actions':()=>allActions(r,id),'feeding-record':()=>recordPage(r,'feeding',id),'treatment-record':()=>recordPage(r,'treatment',id),'harvest-record':()=>recordPage(r,'harvest',id),analysis:()=>healthAnalysis(r),trend:()=>trendPage(r),risk:()=>riskPage(r),season:()=>seasonPage(r),'honey-analytics':()=>honeyAnalytics(r),recommendations:()=>recommendations(r),settings:()=>settings(r),account:()=>accountPage(r),subscription:()=>subscriptionPage(r),apiary:()=>apiaryPage(r),'seasonal-settings':()=>seasonalSettings(r),'notification-preferences':()=>notificationPrefs(r),'units-region':()=>unitsRegion(r),'smart-features':()=>smartFeatures(r),'data-backup':()=>dataBackup(r),security:()=>securityPage(r),store:()=>storePage(r),notifications:()=>notifications(r),help:()=>helpPage(r),faq:()=>faqPage(r),support:()=>supportPage(r),about:()=>aboutPage(r),privacy:()=>infoPage(r,'Privacy Policy'),terms:()=>infoPage(r,'Terms of Service')};(m[page]||m.home)();chrome(page)}


function selectTab(btn){btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('active'));btn.classList.add('active')}
function filterHives(status,btn){selectTab(btn);const s=v45s(),rows=status==='All'?s.hives:s.hives.filter(h=>h.status===status);idq('hlist').innerHTML=rows.map(hcard).join('')}
function filterTimeline(type,btn){selectTab(btn);document.querySelectorAll('[data-timeline-type]').forEach(el=>el.style.display=(type==='All'||el.dataset.timelineType===type)?'grid':'none')}
function filterActions(mode,btn){selectTab(btn);const box=idq('alist');if(!box)return;if(mode==='Completed')box.innerHTML='<button onclick="go(\'hive/h4\')"><span>Willow Creek</span><b>Inspection completed</b><em class="good">Done</em><small>Yesterday</small></button>';else if(mode==='Pending')render();}

function home(r){const s=v45s(),score=avgHealth(s),strong=s.hives.filter(x=>x.status==='Healthy').length,att=s.hives.filter(x=>x.status==='Attention').length,crit=s.hives.filter(x=>x.status==='Critical').length;r.innerHTML=`<div class="vs homev">${Vhero(V45.home,`<div class="greet"><span>Good Morning!</span><b>${esc(s.settings.apiaryName)}</b></div><div class="hring"><strong>${score}%</strong><span>Overall Health</span></div><div class="hstats"><div><b>${s.hives.length}</b><span>Total Hives</span></div><div><b>${strong}</b><span>Strong</span></div><div><b>${att}</b><span>Attention</span></div><div><b>${crit}</b><span>Critical</span></div></div>`,'homehero')}${Vcard('Action Center',`<div class="actrow"><div><small>High Priority</small><b>Inspect Hive #2</b><span>Queen confirmation due</span></div><button onclick="go('inspection/h2')">Open</button></div>`)}${Vcard('Risk Alerts',`<div class="alerts"><button onclick="go('risk')"><b>High Varroa Risk</b><span>Hive #3 · 4 mites / 100 bees</span><em>View</em></button><button onclick="go('hive/h2')"><b>Queen status unconfirmed</b><span>Hive #2 needs verification</span><em>View</em></button></div>`)}${Vcard('Season Intelligence',`<div class="actrow"><div><b>Spring Nectar Flow</b><span>Peak flow · next 12 days</span></div><button onclick="go('season')">Learn More</button></div>`)}${Vcard('Quick Actions',`<div class="quick"><button onclick="go('inspection/h1')"><i>⌕</i><b>Inspection</b></button><button onclick="go('feeding-record/h1')"><i>▣</i><b>Feeding</b></button><button onclick="go('treatment-record/h1')"><i>✚</i><b>Treatment</b></button><button onclick="go('harvest-record/h1')"><i>⌁</i><b>Harvest</b></button><button onclick="go('actions')"><i>•••</i><b>More</b></button></div>`)}</div>`}
function hives(r){const s=v45s();r.innerHTML=`<div class="vs"><div class="phead" style="--hero:url('${V45.hives}')"><i></i><b>Hives</b><div class="search"><span>⌕</span><input id="hsearch" placeholder="Search hives"></div></div><div class="filters"><button class="active" onclick="filterHives('All',this)">All (${s.hives.length})</button><button onclick="filterHives('Healthy',this)">Healthy</button><button onclick="filterHives('Attention',this)">Attention</button><button onclick="filterHives('Critical',this)">Critical</button></div><div id="hlist" class="hlist">${s.hives.map(hcard).join('')}</div></div>`;idq('hsearch').oninput=e=>{const q=e.target.value.toLowerCase();idq('hlist').innerHTML=s.hives.filter(h=>h.name.toLowerCase().includes(q)).map(hcard).join('')}}
function hcard(h){return `<button class="hcard" onclick="go('hive/${h.id}')"><img src="${vphoto(h)}"><div><b>${esc(h.name)}</b><span>${h.score}% · Last ${fmtDate(h.lastInspection)}</span></div><em class="${Vclass(h)}">${Vstatus(h)}</em></button>`}function allHives(r){hives(r)}
function hiveDetail(r,id){const s=v45s(),h=vh(id),photos=hivePhotos(h);r.innerHTML=`<div class="vs">${Vhero(vphoto(h),`<div class="dover"><div><b>${esc(h.name)}</b><span>${esc(s.settings.location)}</span></div><div class="score"><b>${h.score}%</b><span>${Vstatus(h)}</span></div></div>`,'dhero')}<div class="meta"><span>Last inspection: ${fmtDate(h.lastInspection)}</span><span>Created Mar 5, 2025</span></div><div class="groups">${hg('Queen',[['Queen seen',h.queen],['Eggs',h.eggs?'Seen':'None'],['Larvae',h.larvae?'Seen':'None'],['Queen cells',h.queenCells?'Present':'None']])}${hg('Brood',[['Pattern',h.brood],['Strength',h.strength],['Abnormalities','None']])}${hg('Colony',[['Size',h.strength],['Population','8 frames'],['Temperament','Calm']])}${hg('Food Stores',[['Honey',h.honey],['Pollen',h.pollen],['Feeding need',h.honey==='Low'?'Yes':'No']])}${hg('Varroa',[['Last count',`${h.varroa}/100`],['Risk',h.varroa>=3?'High':'Low'],['Test date',fmtDate(h.lastInspection)]])}${hg('Treatment',[['History','Oxalic Acid'],['Active','None'],['Follow-up','May 20'],['Withdrawal','None']])}</div>${Vcard('Photos',`<div class="photos">${photos.slice(0,3).map(p=>`<img src="${p.data}">`).join('')||`<img src="${V45.honeycomb}"><img src="${V45.inspection}"><img src="${V45.hive}">`}<button onclick="idq('phinput').click()">+${Math.max(0,12-photos.length)}</button></div><input id="phinput" hidden type="file" accept="image/*" multiple>`)}${Vcard('Timeline',`<div class="tease"><span>Inspection · ${fmtDate(h.lastInspection)}</span><span>Treatment · Apr 28</span></div>`,`<button onclick="go('timeline')">View History</button>`)}<button class="primary" onclick="go('inspection/${h.id}')">Start Inspection</button></div>`;idq('phinput').onchange=e=>addHivePhotos(h.id,e.target)}
function hg(t,rows){return `<section class="hg"><b>${t}</b>${rows.map(x=>`<div><span>${x[0]}</span><strong>${esc(x[1])}</strong></div>`).join('')}</section>`}
function inspectionPage(r,id){const s=v45s(),h=vh(id);r.innerHTML=`<div class="vs"><section class="vc switchh"><img src="${vphoto(h)}"><div><b>${esc(h.name)}</b><span>${fmtDate(h.lastInspection)} · 9:30 AM</span></div><select id="ihsel">${s.hives.map(x=>`<option value="${x.id}" ${x.id===h.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></section><section class="iform">${ifield('Queen Status','Seen laying')}${islider('Colony Strength',8)}${ifield('Brood Pattern','Good')}${islider('Honey Stores',7)}${ifield('Pollen Stores','Medium')}${ifield('Queen Cells','None')}${ifield('Varroa Count','2.1%')}${ifield('Pests','None')}${ifield('Disease','None')}${ifield('Swarming','None')}${ifield('Super','On (1 Super)')}${ifield('Treatment','None')}${ifield('Photos','Add photos')}${ifield('Voice Notes','Add voice note')}${ifield('Next Inspection','May 24, 2025')}<label class="notes"><span>Notes</span><textarea id="inotes">${esc(h.notes||'')}</textarea></label></section><div class="dual"><button onclick="toast('Draft saved')">Save Draft</button><button onclick="vSaveInspection('${h.id}')">Save Inspection</button></div></div>`;idq('ihsel').onchange=e=>go('inspection/'+e.target.value)}
function ifield(a,b){return `<div class="irow"><span>${a}</span><b>${b}</b><em>›</em></div>`}function islider(a,n){return `<div class="irow slide"><span>${a}</span><i><u style="width:${n*10}%"></u></i><b>${n} / 10</b></div>`}function vSaveInspection(id){const s=v45s(),h=hive(s,id);h.lastInspection=new Date().toISOString().slice(0,10);h.notes=idq('inotes')?.value||h.notes;s.logs.inspections.push({id:'i'+Date.now(),hiveId:id,date:h.lastInspection,notes:h.notes});save(s);toast('Inspection saved');go('hive/'+id)}
function timelinePage(r){const data=[['May 10','Inspection','Oak Meadow','Colony strength 8/10 · Queen laying',V45.inspection,'hive/h1'],['May 5','Treatment','Oak Meadow','Formic Acid · Varroa treatment','', 'treatment-record/h1'],['Apr 28','Feeding','Oak Meadow','2:1 Sugar Syrup · 2.0 L','', 'feeding-record/h1'],['Apr 20','Inspection','Oak Meadow','Colony strength 7/10 · Varroa 2.1%','', 'hive/h1'],['Apr 15','Harvest','Pine Ridge','24.0 lb · Moisture 16.6%',V45.harvest,'honey']];r.innerHTML=`<div class="vs timeline"><div class="fadephoto" style="--hero:url('${V45.season}')"></div><div class="search"><span>⌕</span><input placeholder="Search timeline"></div><div class="filters"><button class="active" onclick="filterTimeline('All',this)">All</button><button onclick="filterTimeline('Inspection',this)">Inspection</button><button onclick="filterTimeline('Feeding',this)">Feeding</button><button onclick="filterTimeline('Treatment',this)">Treatment</button><button onclick="filterTimeline('Harvest',this)">Harvest</button></div><div class="tlist">${data.map(x=>`<button data-timeline-type="${x[1]}" onclick="go('${x[5]}')"><time>${x[0]}</time><i></i><div><b>${x[1]}</b><span>${x[2]}</span><small>${x[3]}</small></div>${x[4]?`<img src="${x[4]}">`:''}</button>`).join('')}</div><button class="secondary">Load More</button></div>`}
function honeyPage(r){r.innerHTML=`<div class="vs harvest"><div class="bgphoto" style="--hero:url('${V45.season}')"></div><div class="stats3"><div><span>Total Harvest</span><b>248 lb</b></div><div><span>Total Batches</span><b>12</b></div><div><span>Avg Moisture</span><b>17.2%</b></div></div>${bars()}${Vcard('Recent Harvests',`<div class="lines"><button onclick="go('harvest-record/h1')"><span>May 12, 2025</span><b>Oak Meadow</b><em>28 lb · 16.8%</em></button><button onclick="go('harvest-record/h2')"><span>May 4, 2025</span><b>Pine Ridge</b><em>24 lb · 17.1%</em></button><button onclick="go('harvest-record/h3')"><span>May 1, 2025</span><b>South Field</b><em>26 lb · 16.5%</em></button></div>`)}<button class="primary" onclick="openHarvestHistory()">View All Harvest Records</button></div>`}function bars(){const v=[12,22,35,54,68,49,62,75,53,28,17,10];return `<section class="vc"><div class="vhead"><b>Monthly Harvest (lb)</b></div><div class="bars">${v.map((n,i)=>`<div><i style="height:${n}px"></i><span>${'JFMAMJJASOND'[i]}</span></div>`).join('')}</div></section>`}
function mapPage(r){const s=v45s();r.innerHTML=`<div class="vs"><div class="filters"><button class="active" onclick="selectTab(this)">Apiaries</button><button onclick="selectTab(this)">Hives</button><button onclick="selectTab(this)">Forage</button></div><section class="mapbox" style="--hero:url('${V45.map}')"><i class="p1">●</i><i class="p2">●</i><i class="p3">●</i><i class="p4">●</i><button>+</button></section><div class="maplist">${s.hives.slice(0,4).map(h=>`<button onclick="go('hive/${h.id}')"><span>⌂</span><div><b>${esc(h.name)}</b><small>${h.score}% · Last ${fmtDate(h.lastInspection)}</small></div><em>›</em></button>`).join('')}</div></div>`}
function insights(r){r.innerHTML=`<div class="vs">${Vhero(V45.flowers,'<div class="insighttitle">Overview</div>','inshero')}<div class="isum"><div><span>Health Score</span><b>78</b><small>Good</small></div><div><span>Risk Level</span><b>Low</b><small>Overall Risk</small></div></div>${Vcard("Today's Highlights",'<ul class="bullets"><li>All hives are healthy</li><li>No urgent actions</li><li>Good nectar flow ahead</li></ul>')}${Vcard('AI Recommendation','<div class="recol"><button onclick="go(\'recommendations\')">Continue regular inspection</button><button onclick="go(\'risk\')">Check varroa in 7 days</button></div>')}<div class="inav"><button onclick="go('analysis')">AI Health</button><button onclick="go('trend')">Trends</button><button onclick="go('risk')">Risk</button><button onclick="go('season')">Season</button><button onclick="go('honey-analytics')">Honey</button><button onclick="go('recommendations')">Recommendations</button></div></div>`}
function actions(r){r.innerHTML=`<div class="vs"><div class="split"><img src="${V45.actions}"><div><div class="filters"><button class="active" onclick="filterActions('Pending',this)">Pending</button><button onclick="filterActions('Completed',this)">Completed</button><button onclick="filterActions('All',this)">All</button></div><div class="alist" id="alist"><button onclick="go('inspection/h1')"><span>Oak Meadow</span><b>Inspect colony</b><em>High</em><small>Due today</small></button><button onclick="go('treatment-record/h3')"><span>Hive #3</span><b>Varroa follow-up</b><em>High</em><small>Due in 2 days</small></button><button onclick="go('feeding-record/h2')"><span>Hive #2</span><b>Feed colony</b><em>Medium</em><small>Due in 5 days</small></button><button onclick="go('harvest-record/h1')"><span>Oak Meadow</span><b>Harvest batch</b><em>Low</em><small>Due in 10 days</small></button></div></div></div><button class="primary" onclick="go('all-actions')">+ Add Action</button><div class="shortcuts"><button onclick="go('inspection/h1')">Inspection</button><button onclick="go('feeding-record/h1')">Feeding</button><button onclick="go('treatment-record/h1')">Treatment</button><button onclick="go('harvest-record/h1')">Harvest</button></div></div>`}function allActions(r){actions(r)}
function recordPage(r,type,id){const s=v45s(),h=vh(id),cfg={feeding:['Feeding Record',V45.feeding],treatment:['Treatment Record',V45.treatment],harvest:['Harvest Record',V45.harvest]}[type],f=type==='feeding'?[['Feed Type','2:1 Sugar Syrup'],['Quantity','2.0 L'],['Method','Top Feeder'],['Frames Fed','2'],['Date','May 7, 2025'],['Next Feeding','May 19, 2025']]:type==='treatment'?[['Problem','Varroa Mites'],['Treatment','Oxalic Acid (Dribble)'],['Product','Oxalic Acid Solution'],['Dose','5 ml / seam'],['Start Date','May 10, 2025'],['End Date','May 21, 2025'],['Follow-up','May 24, 2025'],['Withdrawal','None']]:[['Date','May 1, 2025'],['Frames Harvested','8'],['Honey Weight','28.0 lb'],['Moisture','16.4%'],['Batch Name','2025-05-01-01']];r.innerHTML=`<div class="vs"><div class="split rec"><img src="${cfg[1]}"><form id="rform"><label><span>Hive</span><select name="hiveId">${s.hives.map(x=>`<option value="${x.id}" ${x.id===h.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>${f.map(x=>`<label><span>${x[0]}</span><input name="${x[0].replace(/\W/g,'_')}" value="${x[1]}"></label>`).join('')}<label><span>Notes</span><textarea name="Notes">${type==='feeding'?'Colony building up':type==='treatment'?'Day 1 of treatment':'Nice light amber honey'}</textarea></label></form></div><button class="primary" onclick="saveRec('${type}')">Save Record</button></div>`}function saveRec(type){const s=v45s(),fd=new FormData(idq('rform')),hiveId=fd.get('hiveId'),row={id:type[0]+Date.now(),hiveId,date:new Date().toISOString().slice(0,10),notes:fd.get('Notes')||''};if(type==='feeding'){row.type=fd.get('Feed_Type');row.amount=fd.get('Quantity');s.logs.feedings.push(row)}else if(type==='treatment'){row.type=fd.get('Treatment');s.logs.treatments.push(row)}else{row.weightLb=parseFloat(fd.get('Honey_Weight'))||28;row.moisture=parseFloat(fd.get('Moisture'))||16.4;s.logs.harvests.push(row)}save(s);toast('Record saved');go(type==='harvest'?'honey':'actions')}
function healthAnalysis(r){r.innerHTML=aipage(V45.honeycomb,`<div class="aiscore"><b>82</b><span>Good</span></div><div class="riskchip">Risk Level <b>Low</b></div>${Vcard('Top Reasons','<ul class="bullets"><li>Strong colony population</li><li>Good brood pattern</li><li>Low varroa level</li></ul>')}${Vcard('Recommended Action','<div class="recol"><button onclick="go(\'inspection/h1\')">Continue regular inspection</button><button onclick="go(\'risk\')">Monitor for swarm signs</button></div>')}<button class="primary" onclick="go('recommendations')">View Detailed Analysis</button>`)}
function aipage(img,body){return `<div class="vs aip" style="--hero:url('${img}')"><div class="aio">${body}</div></div>`}function trendPage(r){r.innerHTML=aipage(V45.hive,`<div class="filters"><button>7D</button><button class="active">30D</button><button>90D</button><button>Season</button></div>${['Health Score','Varroa Level','Colony Size','Food Stores','Brood Pattern','Queen Status'].map((x,i)=>trend(x,[78,2.1,8,7,'Good','Seen'][i])).join('')}<button class="primary" onclick="toast('Trend detail range updated')">View Trend Details</button>`)}function trend(a,b){return `<section class="trendc"><div><b>${a}</b><span>${b}</span></div><svg viewBox="0 0 260 45"><polyline points="0,32 40,24 80,29 120,18 160,23 200,12 260,16" fill="none" stroke="currentColor" stroke-width="2"/></svg></section>`}
function riskPage(r){const a=[['Varroa Risk','Medium'],['Swarm Risk','Low'],['Queen Failure','Low'],['Food Shortage','Medium'],['Disease Risk','Low'],['Winter Survival','High']];r.innerHTML=`<div class="vs">${Vcard('Predicted Risks · Next 30 Days',a.map(x=>`<div class="riskrow"><span>${x[0]}</span><b class="${x[1]==='High'?'critical':x[1]==='Medium'?'attention':'good'}">${x[1]}</b></div>`).join(''))}<div class="note">Predictions are forecasts, not confirmed events.</div><button class="primary" onclick="go('recommendations')">View Details</button></div>`}
function seasonPage(r){r.innerHTML=`<div class="vs">${Vhero(V45.season,'<div class="seasont"><span>Spring Nectar Flow</span><b>Peak flow · next 12 days</b></div>','shero')}${Vcard('Conditions','<div class="weather"><div><b>65°F</b><span>Temp</span></div><div><b>60%</b><span>Humidity</span></div><div><b>10 mph</b><span>Wind</span></div><div><b>Light</b><span>Rain</span></div></div>')}${Vcard('Recommendations','<ul class="bullets"><li>Good nectar flow ahead</li><li>Prepare for super expansion</li><li>Monitor for swarm signs</li><li>Keep varroa testing cadence</li></ul>')}<button class="primary" onclick="go('seasonal-settings')">View Details</button></div>`}
function honeyAnalytics(r){r.innerHTML=aipage(V45.harvest,`<div class="stats3"><div><span>Total Honey</span><b>248 lb</b></div><div><span>Goal</span><b>300 lb</b></div><div><span>Progress</span><b>83%</b></div></div>${bars()}${Vcard('Top Hives','<div class="lines"><button><span>Oak Meadow</span><b>96 lb</b></button><button><span>Pine Ridge</span><b>72 lb</b></button><button onclick="go(&quot;all-hives&quot;)"><span>West Field</span><b>48 lb</b></button></div>')}<button class="primary" onclick="go('honey')">View Details</button>`)}function recommendations(r){r.innerHTML=`<div class="vs">${[['Varroa monitoring','Varroa level increasing','Check and treat if needed','Within 7 days'],['Prepare for flow','Nectar flow starting','Add honey super','This week'],['Queen verification','Hive #2 not confirmed','Inspect queen status','Next inspection']].map(x=>`<section class="vc reco"><div><span>What</span><b>${x[0]}</b></div><div><span>Why</span><b>${x[1]}</b></div><div><span>What to do</span><b>${x[2]}</b></div><div><span>When</span><b>${x[3]}</b></div><button onclick="go('actions')">Create Action</button></section>`).join('')}</div>`}
function settings(r){const s=v45s(),items=[['account','Account'],['subscription','HiveDash Pro'],['apiary','Apiary Environment'],['notification-preferences','Notifications'],['units-region','Units & Region'],['smart-features','Smart Features'],['data-backup','Data & Backup'],['store','Store'],['security','Privacy & Security'],['help','Help'],['about','About']];r.innerHTML=`<div class="vs setv"><div class="setphoto" style="--hero:url('${V45.settings}')"><div><b>${esc(s.settings.apiaryName)}</b><span>${esc(s.settings.location)}</span></div></div><section class="setmenu">${items.map(x=>`<button onclick="go('${x[0]}')"><span>◉</span><b>${x[1]}</b><em>›</em></button>`).join('')}</section><button class="secondary danger" onclick="signOutCloud()">Sign Out</button></div>`}
function accountPage(r){const s=v45s();r.innerHTML=`<div class="vs"><section class="vc acct"><div class="avatar">${esc(s.user.name[0])}</div><b>${esc(s.user.name)}</b><span>${esc(s.user.email)}</span></section><section class="formlist"><label><span>Full Name</span><input id="aname" value="${esc(s.user.name)}"></label><label><span>Email</span><input id="aemail" value="${esc(s.user.email)}"></label><label><span>Google Account</span><input value="Connected" readonly></label><label><span>Password</span><button type="button" onclick="sendReset()">Change Password</button></label></section><button class="primary" onclick="saveAcct()">Save</button><button class="secondary danger" onclick="toast('Delete request recorded')">Delete Account</button></div>`}function saveAcct(){const s=v45s();s.user.name=idq('aname').value.trim();s.user.email=idq('aemail').value.trim();save(s);toast('Account saved')}async function sendReset(){const s=v45s(),email=prompt('Send password reset link to:',s.user.email);if(!email)return;if(supabaseClient){const{error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:oauthRedirectUrl()});if(error)return toast(error.message)}toast('Password reset email sent')}
function subscriptionPage(r){const s=v45s();r.innerHTML=`<div class="vs"><section class="procard"><span>Current Plan</span><b>${s.user.plan} Plan</b><small>Renews Jun 30, 2027</small><button onclick="setPlan('Pro')">${s.user.plan==='Pro'?'Manage Subscription':'Upgrade to Pro'}</button></section>${Vcard('Pro includes','<ul class="checks"><li>AI Health Analysis</li><li>Risk Prediction</li><li>Advanced Trends</li><li>Season Intelligence</li><li>Honey Analytics</li><li>Photo AI</li><li>Professional Recommendations</li><li>Reports & Export</li></ul>')}<button class="secondary" onclick="toast('Purchase restored')">Restore Purchase</button></div>`}function setPlan(p){const s=v45s();s.user.plan=p;save(s);toast('Plan updated');render()}
function apiaryPage(r){r.innerHTML=`<div class="vs">${Vcard('Apiaries & Hives','<div class="lines"><button onclick="go(&quot;all-hives&quot;)"><span>North Field</span><b>4 hives</b><em>›</em></button><button onclick="go(&quot;all-hives&quot;)"><span>East Field</span><b>2 hives</b><em>›</em></button><button onclick="go(&quot;all-hives&quot;)"><span>West Field</span><b>3 hives</b><em>›</em></button></div>')}<section class="formlist"><label><span>Default Inspection Interval</span><select><option>7 days</option><option>14 days</option></select></label><label><span>Hive Type</span><select><option>Langstroth</option><option>Flow Hive</option></select></label></section><button class="primary" onclick="go('seasonal-settings')">Seasonal Settings</button></div>`}
function seasonalSettings(r){const s=v45s(),x=s.settings.seasonal;r.innerHTML=`<div class="vs">${Vhero(V45.season,'<div class="seasont"><span>Current Season</span><b>'+esc(x.mode)+'</b></div>','shero')}<section class="formlist"><label><span>Current Season</span><select id="smode"><option>Auto</option><option>Spring</option><option>Summer</option><option>Fall</option><option>Winter</option></select></label><label class="switchline"><span>Nectar Flow Tracking</span><input id="nectar" type="checkbox" ${x.nectar?'checked':''}></label><label><span>Swarm Season</span><input value="${esc(x.swarm)}"></label><label><span>Varroa Season</span><input value="${esc(x.varroa)}"></label><label><span>Feeding Season</span><input value="${esc(x.feeding)}"></label><label><span>Winter Preparation</span><input value="${esc(x.winter)}"></label><label><span>Super Management</span><select><option>Auto</option><option>Manual</option></select></label><label><span>Seasonal Inspection Focus</span><select><option>Auto</option><option>Queen</option><option>Varroa</option></select></label></section><button class="primary" onclick="saveSeason()">Save Settings</button></div>`}function saveSeason(){const s=v45s();s.settings.seasonal.mode=idq('smode').value;s.settings.seasonal.nectar=idq('nectar').checked;save(s);toast('Seasonal settings saved')}
function notificationPrefs(r){const s=v45s(),x=s.settings.notifications,rows=[['inspection','Inspection Reminders'],['varroa','Varroa Risk'],['treatment','Treatment Follow-up'],['feeding','Feeding Reminders'],['weather','Weather Alerts'],['seasonal','Seasonal Alerts'],['push','Push Notifications']];r.innerHTML=`<div class="vs"><section class="toggles">${rows.map(x=>`<label><span>${x[1]}</span><input data-pref="${x[0]}" type="checkbox" ${s.settings.notifications[x[0]]?'checked':''}></label>`).join('')}</section><button class="primary" onclick="savePrefs()">Save Preferences</button></div>`}function savePrefs(){const s=v45s();document.querySelectorAll('[data-pref]').forEach(e=>s.settings.notifications[e.dataset.pref]=e.checked);save(s);toast('Preferences saved')}
function unitsRegion(r){const s=v45s();r.innerHTML=`<div class="vs"><section class="formlist"><label><span>Measurement System</span><select id="measure"><option>Imperial (US)</option><option>Metric</option></select></label><label><span>Temperature</span><select><option>°F</option><option>°C</option></select></label><label><span>Weight</span><select><option>lb</option><option>kg</option></select></label><label><span>Date Format</span><select><option>MM/DD/YYYY</option><option>DD/MM/YYYY</option></select></label><label><span>Language</span><select><option>English</option></select></label><label><span>Time Zone</span><select><option>(GMT-07:00) Mountain Time</option></select></label></section><button class="primary" onclick="const s=v45s();s.settings.units=idq('measure').value==='Metric'?'metric':'imperial';save(s);toast('Units saved')">Save Settings</button></div>`}
function smartFeatures(r){const s=v45s(),rows=[['voice','Voice Inspection'],['photo','Photo Analysis'],['varroaCount','Smart Varroa Count'],['aiHealth','AI Health Analysis'],['recommendations','Smart Recommendations'],['seasonWeather','Season & Weather Intelligence'],['qr','Hive QR Code']];r.innerHTML=`<div class="vs"><div class="smartphoto"><img src="${V45.flowers}"></div><section class="toggles">${rows.map(x=>`<label><span>${x[1]}</span><input data-smart="${x[0]}" type="checkbox" ${s.settings.smart[x[0]]?'checked':''}></label>`).join('')}</section><button class="secondary" onclick="qrModal()">Preview Hive QR Code</button><button class="primary" onclick="saveSmart()">Save Settings</button></div>`}function saveSmart(){const s=v45s();document.querySelectorAll('[data-smart]').forEach(e=>s.settings.smart[e.dataset.smart]=e.checked);save(s);toast('Smart features saved')}function qrModal(){modal('<div class="modalhead"><b>Hive QR Code</b><button onclick="closeModal(this)">✕</button></div><div class="qr"></div><div class="small muted">Scan to open Hive Detail and Start Inspection.</div>')}
function dataBackup(r){r.innerHTML=`<div class="vs"><section class="setmenu"><button><span>☁</span><b>Cloud Sync</b><em class="good">Enabled</em></button><button onclick="exportData()"><span>⇧</span><b>Export Data</b><em>›</em></button><button onclick="idq('importfile').click()"><span>⇩</span><b>Import Data</b><em>›</em></button><button onclick="toast('Backup created')"><span>▣</span><b>Create Backup</b><em>›</em></button><button><span>↻</span><b>Sync Status</b><em>${esc(cloudStatusText())}</em></button></section><input id="importfile" hidden type="file" accept="application/json"><button class="primary" onclick="toast('Sync started')">Sync Now</button></div>`;idq('importfile').onchange=importData}function importData(e){const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(JSON.parse(reader.result)));toast('Data imported');render()}catch(e){toast('Invalid backup file')}};reader.readAsText(f)}
function securityPage(r){r.innerHTML=`<div class="vs"><section class="setmenu"><button onclick="go('privacy')"><span>◉</span><b>Privacy Policy</b><em>›</em></button><button onclick="go('terms')"><span>◉</span><b>Terms of Service</b><em>›</em></button><button onclick="toast('Data permissions opened')"><span>◇</span><b>Data Permissions</b><em>›</em></button><button onclick="go('account')"><span>⌁</span><b>Account Security</b><em>›</em></button><button onclick="toast('Two-factor setup opened')"><span>✦</span><b>Two-Factor Auth</b><em>Off</em></button></section><button class="primary" onclick="toast('Security settings saved')">Manage Security</button></div>`}
function storePage(r){r.innerHTML=`<div class="vs"><div class="storehero"><img src="${V45.hive}"><div><span>Beekeeping Equipment Store</span><b>SkogHive</b><small>Premium hives · Flow Frames · Accessories</small></div></div><button class="primary" onclick="window.open('https://www.skoghive.com','_blank','noopener')">Shop Now ↗</button></div>`}
function notifications(r){const rows=[['Critical','High temperature alert','hive/h3'],['Action Required','Inspect Oak Meadow','inspection/h1'],['Reminder','Varroa treatment due','treatment-record/h3'],['AI Risk','Queen failure risk','risk'],['Treatment','Follow-up recommended','treatment-record/h1'],['Seasonal','Spring nectar flow','season'],['System','HiveDash Pro enabled','subscription']];r.innerHTML=`<div class="vs"><div class="filters"><button class="active">All</button><button>Alerts</button><button>Reminders</button><button>System</button></div><section class="notifs">${rows.map((x,i)=>`<button onclick="go('${x[2]}')"><i class="${x[0]==='Critical'?'critical':x[0]==='Action Required'?'attention':'good'}"></i><div><b>${x[0]}</b><span>${x[1]}</span></div><time>${9+i}:30 AM</time></button>`).join('')}</section><button class="secondary" onclick="markAllRead()">Mark All Read</button></div>`}
function helpPage(r){r.innerHTML=`<div class="vs"><div class="search"><span>⌕</span><input placeholder="Search help articles…"></div><section class="setmenu"><button onclick="toast('Getting Started opened')"><span>◉</span><b>Getting Started</b><em>›</em></button><button onclick="go('hives')"><span>⌂</span><b>Hive Management</b><em>›</em></button><button onclick="go('inspection/h1')"><span>⌕</span><b>Inspection</b><em>›</em></button><button onclick="go('honey')"><span>⌁</span><b>Harvest</b><em>›</em></button><button onclick="go('faq')"><span>?</span><b>FAQ</b><em>›</em></button><button onclick="go('support')"><span>✉</span><b>Contact Support</b><em>›</em></button></section></div>`}
function faqPage(r){r.innerHTML=`<div class="vs"><div class="seg"><button class="active">FAQ</button><button>Report Problem</button></div>${Vcard('Frequently Asked Questions','<div class="lines"><button><span>How do I add a hive?</span><em>›</em></button><button><span>How does AI analysis work?</span><em>›</em></button><button><span>How do I export my data?</span><em>›</em></button></div>')}<section class="formlist"><label><span>Report a Problem</span><textarea placeholder="Describe the problem…"></textarea></label></section><button class="primary" onclick="toast('Report submitted')">Submit Report</button></div>`}
function supportPage(r){r.innerHTML=`<div class="vs"><section class="formlist"><label><span>Issue Type</span><select><option>General</option><option>Account</option><option>Billing</option><option>Bug</option></select></label><label><span>Subject</span><input placeholder="Brief summary"></label><label><span>Message</span><textarea placeholder="Describe your issue in detail…"></textarea></label><label><span>Attachments</span><input type="file" multiple></label></section><button class="primary" onclick="toast('Support request sent')">Send Message</button></div>`}
function aboutPage(r){r.innerHTML=`<div class="vs about"><section><div class="abouticon">${icon('hive')}</div><b>HiveDash</b><span>Version 1.2.0 (Build 120)</span></section><div class="setmenu"><button onclick="toast('You are on the latest HiveDash build')"><b>What's New</b><em>›</em></button><button onclick="toast('HiveDash is up to date')"><b>Check for Updates</b><em>›</em></button><button onclick="window.open('https://hivedash.app','_blank')"><b>Official Website</b><em>›</em></button><button onclick="go('privacy')"><b>Privacy Policy</b><em>›</em></button><button onclick="go('terms')"><b>Terms of Service</b><em>›</em></button><button onclick="toast('Open-source licenses opened')"><b>Open-source Licenses</b><em>›</em></button><button onclick="go('support')"><b>Contact Support</b><em>›</em></button></div><small>© HiveDash</small></div>`}
function infoPage(r,title){r.innerHTML=`<div class="vs legal"><h2>${esc(title)}</h2><p>Last updated: August 18, 2026</p><section class="vc body"><h3>1. Information and use</h3><p>HiveDash stores the information needed to manage hives, inspections, actions and preferences.</p><h3>2. Your data</h3><p>You control export, cloud sync and account deletion.</p><h3>3. Security</h3><p>Authentication and data-access controls protect your account.</p><h3>4. Contact</h3><p>Use Contact Support for questions.</p></section></div>`}


/* =========================================================
   V48 — REMAINING ROUTE / INTERACTION AUDIT FIX
   Scope: Actions + record pages + Settings subtree +
   Notifications + Subscription + Login / Account.
   LOCKED UI architecture and navigation are unchanged.
   ========================================================= */

function v48ActionRows(mode='Pending'){
  const s=v45s();
  const pending=s.actions||[];
  const completed=[
    ...s.logs.inspections.map(x=>({type:'Inspection',hiveId:x.hiveId,title:'Inspection completed',due:fmtDate(x.date),priority:'Done'})),
    ...s.logs.feedings.map(x=>({type:'Feeding',hiveId:x.hiveId,title:'Feeding recorded',due:fmtDate(x.date),priority:'Done'})),
    ...s.logs.treatments.map(x=>({type:'Treatment',hiveId:x.hiveId,title:'Treatment recorded',due:fmtDate(x.date),priority:'Done'})),
    ...s.logs.harvests.map(x=>({type:'Harvest',hiveId:x.hiveId,title:'Harvest recorded',due:fmtDate(x.date),priority:'Done'}))
  ].slice(-12).reverse();
  if(mode==='Completed') return completed;
  if(mode==='All') return [...pending,...completed];
  return pending;
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
  modal(`<div class="modalhead"><b>Add Action / Record</b><button onclick="closeModal(this)">✕</button></div><div class="quick core-menu-actions">
    <button class="qbtn" onclick="closeModal(this);go('inspection/${v45s().hives[0]?.id||''}')"><b>Inspection</b></button>
    <button class="qbtn" onclick="closeModal(this);go('feeding-record/${v45s().hives[0]?.id||''}')"><b>Feeding</b></button>
    <button class="qbtn" onclick="closeModal(this);go('treatment-record/${v45s().hives[0]?.id||''}')"><b>Treatment</b></button>
    <button class="qbtn" onclick="closeModal(this);go('harvest-record/${v45s().hives[0]?.id||''}')"><b>Harvest</b></button>
  </div>`)
}
function actions(r){
  r.innerHTML=`<div class="vs"><div class="split"><img src="${V45.actions}"><div><div class="filters"><button class="active" onclick="filterActions('Pending',this)">Pending</button><button onclick="filterActions('Completed',this)">Completed</button><button onclick="filterActions('All',this)">All</button></div><div class="alist" id="alist"></div></div></div><button class="primary" onclick="openRecordPicker()">+ Add Action</button><div class="shortcuts"><button onclick="go('inspection/${v45s().hives[0]?.id||''}')">Inspection</button><button onclick="go('feeding-record/${v45s().hives[0]?.id||''}')">Feeding</button><button onclick="go('treatment-record/${v45s().hives[0]?.id||''}')">Treatment</button><button onclick="go('harvest-record/${v45s().hives[0]?.id||''}')">Harvest</button></div></div>`;
  drawV48Actions('Pending');
}
function allActions(r,mode){actions(r); if(mode){const want=String(mode).toLowerCase().startsWith('complete')?'Completed':String(mode).toLowerCase().startsWith('all')?'All':'Pending';const btn=[...document.querySelectorAll('.filters button')].find(b=>b.textContent.trim()===want);if(btn)filterActions(want,btn)}}

function recordPage(r,type,id){
  const s=v45s(),h=vh(id),cfg={feeding:['Feeding Record',V45.feeding],treatment:['Treatment Record',V45.treatment],harvest:['Harvest Record',V45.harvest]}[type];
  const today=new Date().toISOString().slice(0,10);
  const fields=type==='feeding'?`
    <label><span>Feed Type</span><select name="Feed_Type"><option>Sugar Syrup</option><option>Pollen Patty</option><option>Dry Sugar</option></select></label>
    <label><span>Syrup Ratio</span><select name="Syrup_Ratio"><option>1:1</option><option selected>2:1</option><option>N/A</option></select></label>
    <label><span>Quantity</span><input name="Quantity" value="2.0 L"></label>
    <label><span>Date</span><input name="Date" type="date" value="${today}"></label>
    <label><span>Next Feeding</span><input name="Next_Feeding" type="date"></label>`:
  type==='treatment'?`
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
function saveRec(type){
  const s=v45s(),fd=new FormData(idq('rform')),hiveId=fd.get('hiveId'),today=new Date().toISOString().slice(0,10),notes=fd.get('Notes')||'';
  if(type==='feeding'){
    s.logs.feedings.push({id:'f'+Date.now(),hiveId,date:fd.get('Date')||today,type:fd.get('Feed_Type'),ratio:fd.get('Syrup_Ratio'),amount:fd.get('Quantity'),notes,nextFeeding:fd.get('Next_Feeding')||''});
  }else if(type==='treatment'){
    s.logs.treatments.push({id:'t'+Date.now(),hiveId,date:fd.get('Start_Date')||today,problem:fd.get('Problem'),type:fd.get('Treatment'),product:fd.get('Product'),dose:fd.get('Dose'),endDate:fd.get('End_Date')||'',followUp:fd.get('Follow_up')||'',withdrawal:fd.get('Withdrawal')||'',notes});
  }else{
    s.logs.harvests.push({id:'hv'+Date.now(),hiveId,date:fd.get('Date')||today,frames:Number(fd.get('Frames_Harvested')||0),weightLb:Number(fd.get('Honey_Weight')||0),moisture:Number(fd.get('Moisture')||0),batch:fd.get('Batch_Name')||'',notes});
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

const V48_NOTIFICATIONS=[['Critical','High temperature alert','hive/h3','Alerts'],['Action Required','Inspect Oak Meadow','inspection/h1','Alerts'],['Reminder','Varroa treatment due','treatment-record/h3','Reminders'],['AI Risk','Queen failure risk','risk','Alerts'],['Treatment','Follow-up recommended','treatment-record/h1','Reminders'],['Seasonal','Spring nectar flow','season','Reminders'],['System','HiveDash Pro enabled','subscription','System']];
function drawNotificationsV48(group='All'){const box=idq('v48notifs');if(!box)return;const rows=V48_NOTIFICATIONS.filter(x=>group==='All'||x[3]===group);box.innerHTML=rows.map((x,i)=>`<button onclick="go('${x[2]}')"><i class="${x[0]==='Critical'?'critical':x[0]==='Action Required'?'attention':'good'}"></i><div><b>${x[0]}</b><span>${x[1]}</span></div><time>${9+i}:30 AM</time></button>`).join('')}
function filterNotificationsV48(group,btn){selectTab(btn);drawNotificationsV48(group)}
function notifications(r){r.innerHTML=`<div class="vs"><div class="filters"><button class="active" onclick="filterNotificationsV48('All',this)">All</button><button onclick="filterNotificationsV48('Alerts',this)">Alerts</button><button onclick="filterNotificationsV48('Reminders',this)">Reminders</button><button onclick="filterNotificationsV48('System',this)">System</button></div><section class="notifs" id="v48notifs"></section><button class="secondary" onclick="markAllRead()">Mark All Read</button></div>`;drawNotificationsV48('All')}

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

function helpPage(r){r.innerHTML=`<div class="vs"><div class="search"><span>⌕</span><input id="v48helpsearch" placeholder="Search help articles…"></div><section class="setmenu" id="v48helpmenu"><button data-help="Getting Started" onclick="openFaqV48('How do I add a hive?')"><span>◉</span><b>Getting Started</b><em>›</em></button><button data-help="Hive Management" onclick="go('hives')"><span>⌂</span><b>Hive Management</b><em>›</em></button><button data-help="Inspection" onclick="go('inspection/${v45s().hives[0]?.id||''}')"><span>⌕</span><b>Inspection</b><em>›</em></button><button data-help="Harvest" onclick="go('honey')"><span>⌁</span><b>Harvest</b><em>›</em></button><button data-help="FAQ" onclick="go('faq')"><span>?</span><b>FAQ</b><em>›</em></button><button data-help="Contact Support" onclick="go('support')"><span>✉</span><b>Contact Support</b><em>›</em></button></section></div>`;idq('v48helpsearch').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('[data-help]').forEach(b=>b.style.display=b.dataset.help.toLowerCase().includes(q)?'grid':'none')}}


/* =========================================================
   V49 — RUNTIME / DATA CONSISTENCY AUDIT FIX
   No locked feature architecture, entry relationship, bottom-nav,
   page structure, or visual design is changed. These overrides only
   connect existing UI to live state and remove dead interactions.
   ========================================================= */

let V49_TIMELINE_LIMIT=10;
let V49_TIMELINE_CACHE=[];
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
  const q=(idq('v49tsearch')?.value||'').toLowerCase(), active=document.querySelector('.timeline .filters button.active')?.dataset.type||'All';
  document.querySelectorAll('[data-v49-timeline]').forEach((el,i)=>{const matchType=active==='All'||el.dataset.type===active, matchQ=!q||el.dataset.search.includes(q);el.style.display=(i<V49_TIMELINE_LIMIT&&matchType&&matchQ)?'grid':'none'});
  const more=idq('v49loadmore');if(more)more.style.display=V49_TIMELINE_CACHE.length>V49_TIMELINE_LIMIT?'block':'none';
}
function filterTimelineV49(type,btn){selectTab(btn);applyTimelineFilterV49()}
function loadMoreTimelineV49(){V49_TIMELINE_LIMIT+=10;applyTimelineFilterV49()}
function timelinePage(r){
  const parts=(location.hash||'#timeline').slice(1).split('/'),hiveId=parts[1]||'';V49_TIMELINE_LIMIT=10;V49_TIMELINE_CACHE=v49TimelineRows(hiveId);
  const s=v45s(), title=hiveId?esc(hive(s,hiveId)?.name||'Hive'):'';
  r.innerHTML=`<div class="vs timeline"><div class="fadephoto" style="--hero:url('${V45.season}')"></div>${title?`<div class="small muted">${title} history</div>`:''}<div class="search"><span>⌕</span><input id="v49tsearch" placeholder="Search timeline"></div><div class="filters"><button class="active" data-type="All" onclick="filterTimelineV49('All',this)">All</button><button data-type="Inspection" onclick="filterTimelineV49('Inspection',this)">Inspection</button><button data-type="Feeding" onclick="filterTimelineV49('Feeding',this)">Feeding</button><button data-type="Treatment" onclick="filterTimelineV49('Treatment',this)">Treatment</button><button data-type="Harvest" onclick="filterTimelineV49('Harvest',this)">Harvest</button><button data-type="Photo" onclick="filterTimelineV49('Photo',this)">Photos</button></div><div class="tlist">${V49_TIMELINE_CACHE.map(e=>{const h=hive(s,e.hiveId);return `<button data-v49-timeline data-type="${e.type}" data-search="${esc((e.type+' '+(h?.name||'')+' '+e.detail).toLowerCase())}" onclick="openTimelineEventV49('${e.key}')"><time>${fmtDate(e.date)}</time><i></i><div><b>${e.type}</b><span>${esc(h?.name||'Hive')}</span><small>${esc(e.detail)}</small></div>${e.img?`<img src="${e.img}">`:''}</button>`}).join('')||'<div class="vc small muted">No history yet.</div>'}</div><button id="v49loadmore" class="secondary" onclick="loadMoreTimelineV49()">Load More</button></div>`;
  idq('v49tsearch').oninput=applyTimelineFilterV49;applyTimelineFilterV49();
}

function hiveDetail(r,id){
  const s=v45s(),h=vh(id),photos=hivePhotos(h),lastTx=s.logs.treatments.filter(x=>x.hiveId===h.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
  r.innerHTML=`<div class="vs">${Vhero(vphoto(h),`<div class="dover"><div><b>${esc(h.name)}</b><span>${esc(s.settings.location)}</span></div><div class="score"><b>${h.score}%</b><span>${Vstatus(h)}</span></div></div>`,'dhero')}<div class="meta"><span>Last inspection: ${fmtDate(h.lastInspection)}</span><span>Created Mar 5, 2025</span></div><div class="groups">${hg('Queen',[['Queen seen',h.queen],['Eggs',h.eggs?'Seen':'None'],['Larvae',h.larvae?'Seen':'None'],['Queen cells',h.queenCells?'Present':'None']])}${hg('Brood',[['Pattern',h.brood],['Strength',h.strength],['Abnormalities','None']])}${hg('Colony',[['Size',h.strength],['Population','8 frames'],['Temperament','Calm']])}${hg('Food Stores',[['Honey',h.honey],['Pollen',h.pollen],['Feeding need',h.honey==='Low'?'Yes':'No']])}${hg('Varroa',[['Last count',`${h.varroa}/100`],['Risk',h.varroa>=3?'High':'Low'],['Test date',fmtDate(h.lastInspection)]])}${hg('Treatment',[['History',lastTx?.type||'None'],['Active',lastTx&&!lastTx.endDate?'Active':'None'],['Follow-up',lastTx?.followUp?fmtDate(lastTx.followUp):'—'],['Withdrawal',lastTx?.withdrawal||'None']])}</div>${Vcard('Photos',`<div class="photos">${photos.slice(0,3).map(p=>`<img src="${p.data}">`).join('')||`<img src="${V45.honeycomb}"><img src="${V45.inspection}"><img src="${V45.hive}">`}<button onclick="idq('phinput').click()">+${Math.max(0,12-photos.length)}</button></div><input id="phinput" hidden type="file" accept="image/*" multiple>`)}${Vcard('Timeline',`<div class="tease">${v49TimelineRows(h.id).slice(0,2).map(x=>`<span>${x.type} · ${fmtDate(x.date)}</span>`).join('')||'<span>No history yet</span>'}</div>`,`<button onclick="go('timeline/${h.id}')">View History</button>`)}<button class="primary" onclick="go('inspection/${h.id}')">Start Inspection</button></div>`;
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
  r.innerHTML=`<div class="vs"><section class="vc switchh"><img src="${vphoto(h)}"><div><b>${esc(h.name)}</b><span>${fmtDate(h.lastInspection)} · Inspection</span></div><select id="ihsel">${s.hives.map(x=>`<option value="${x.id}" ${x.id===h.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></section><section class="iform"><div class="irow" onclick="editInspectionV49('queenStatus')"><span>Queen Status</span><b>${esc(d.queenStatus)}</b><em>›</em></div><div class="irow slide" onclick="editInspectionV49('strength','number')"><span>Colony Strength</span><i><u style="width:${d.strength*10}%"></u></i><b>${d.strength} / 10</b></div><div class="irow" onclick="editInspectionV49('brood')"><span>Brood Pattern</span><b>${esc(d.brood)}</b><em>›</em></div><div class="irow" onclick="editInspectionV49('honey')"><span>Honey Stores</span><b>${esc(d.honey)}</b><em>›</em></div><div class="irow" onclick="editInspectionV49('pollen')"><span>Pollen Stores</span><b>${esc(d.pollen)}</b><em>›</em></div><div class="irow" onclick="editInspectionV49('queenCells')"><span>Queen Cells</span><b>${esc(d.queenCells)}</b><em>›</em></div><div class="irow" onclick="editInspectionV49('varroa')"><span>Varroa Count</span><b>${esc(d.varroa)}</b><em>›</em></div><div class="irow" onclick="editInspectionV49('pests')"><span>Pests</span><b>${esc(d.pests)}</b><em>›</em></div><div class="irow" onclick="editInspectionV49('disease')"><span>Disease</span><b>${esc(d.disease)}</b><em>›</em></div><div class="irow" onclick="editInspectionV49('swarming')"><span>Swarming</span><b>${esc(d.swarming)}</b><em>›</em></div><div class="irow" onclick="editInspectionV49('super')"><span>Super</span><b>${esc(d.super)}</b><em>›</em></div><div class="irow" onclick="editInspectionV49('treatment')"><span>Treatment</span><b>${esc(d.treatment)}</b><em>›</em></div><div class="irow" onclick="idq('phinput2').click()"><span>Photos</span><b>Add photos</b><em>›</em></div><input id="phinput2" hidden type="file" accept="image/*" multiple><div class="irow" onclick="editInspectionV49('voiceNotes')"><span>Voice Notes</span><b>${d.voiceNotes?'Added':'Add voice note'}</b><em>›</em></div><div class="irow" onclick="editInspectionV49('nextInspection')"><span>Next Inspection</span><b>${esc(d.nextInspection||'Set date')}</b><em>›</em></div><label class="notes"><span>Notes</span><textarea id="inotes">${esc(d.notes)}</textarea></label></section><div class="dual"><button onclick="V49_INSPECTION_DRAFT.notes=idq('inotes').value;toast('Draft saved')">Save Draft</button><button onclick="vSaveInspection('${h.id}')">Save Inspection</button></div></div>`;
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
  const s=v45s(),logs=[...s.logs.harvests].sort((a,b)=>String(b.date).localeCompare(String(a.date))),total=logs.reduce((n,x)=>n+Number(x.weightLb||0),0),avg=logs.length?logs.reduce((n,x)=>n+Number(x.moisture||0),0)/logs.length:0,monthly=Array(12).fill(0);logs.forEach(x=>{const m=Number(String(x.date||'').slice(5,7))-1;if(m>=0&&m<12)monthly[m]+=Number(x.weightLb||0)});
  r.innerHTML=`<div class="vs harvest"><div class="bgphoto" style="--hero:url('${V45.season}')"></div><div class="stats3"><div><span>Total Harvest</span><b>${formatWeight(total,s)}</b></div><div><span>Total Batches</span><b>${logs.length}</b></div><div><span>Avg Moisture</span><b>${avg.toFixed(1)}%</b></div></div>${barsV49(monthly)}${Vcard('Recent Harvests',`<div class="lines">${logs.slice(0,3).map(x=>`<button onclick="openHarvestRecordViewV49('${x.id}')"><span>${fmtDate(x.date)}</span><b>${esc(hive(s,x.hiveId)?.name||'Hive')}</b><em>${formatWeight(x.weightLb||0,s)} · ${x.moisture||'—'}%</em></button>`).join('')||'<div class="small muted">No harvest records yet.</div>'}</div>`)}<button class="primary" onclick="openHarvestHistory()">View All Harvest Records</button></div>`
}

let V49_MAP_MODE='Apiaries',V49_MAP_ZOOM=false;
function setMapModeV49(mode,btn){V49_MAP_MODE=mode;selectTab(btn);drawMapListV49()}
function zoomMapV49(){V49_MAP_ZOOM=!V49_MAP_ZOOM;const box=document.querySelector('.mapbox');if(box)box.style.backgroundSize=V49_MAP_ZOOM?'140%':'cover'}
function drawMapListV49(){const s=v45s(),box=idq('v49maplist');if(!box)return;if(V49_MAP_MODE==='Forage'){box.innerHTML=`<button onclick="go('season')"><span>✿</span><div><b>Season Intelligence</b><small>Nectar flow and forage guidance</small></div><em>›</em></button>`;return}if(V49_MAP_MODE==='Apiaries'){box.innerHTML=`<button onclick="go('all-hives')"><span>⌂</span><div><b>${esc(s.settings.apiaryName)}</b><small>${s.hives.length} hives · ${esc(s.settings.location)}</small></div><em>›</em></button>`;return}box.innerHTML=s.hives.slice(0,6).map(h=>`<button onclick="go('hive/${h.id}')"><span>⌂</span><div><b>${esc(h.name)}</b><small>${h.score}% · Last ${fmtDate(h.lastInspection)}</small></div><em>›</em></button>`).join('')}
function mapPage(r){const s=v45s();V49_MAP_MODE='Apiaries';r.innerHTML=`<div class="vs"><div class="filters"><button class="active" onclick="setMapModeV49('Apiaries',this)">Apiaries</button><button onclick="setMapModeV49('Hives',this)">Hives</button><button onclick="setMapModeV49('Forage',this)">Forage</button></div><section class="mapbox" style="--hero:url('${V45.map}')"><i class="p1">●</i><i class="p2">●</i><i class="p3">●</i><i class="p4">●</i><button onclick="zoomMapV49()">+</button></section><div class="maplist" id="v49maplist"></div></div>`;drawMapListV49()}

function insights(r){const s=v45s(),score=avgHealth(s),critical=s.hives.filter(h=>h.status==='Critical').length,pending=(s.actions||[]).length;const risk=critical?'High':s.hives.some(h=>h.status==='Attention')?'Medium':'Low';r.innerHTML=`<div class="vs">${Vhero(V45.flowers,'<div class="insighttitle">Overview</div>','inshero')}<div class="isum"><div><span>Health Score</span><b>${score}</b><small>${score>=80?'Good':score>=65?'Attention':'Critical'}</small></div><div><span>Risk Level</span><b>${risk}</b><small>Overall Risk</small></div></div>${Vcard("Today's Highlights",`<ul class="bullets"><li>${s.hives.length} hives monitored</li><li>${pending} pending actions</li><li>${critical} critical hives</li></ul>`)}${Vcard('AI Recommendation',`<div class="recol"><button onclick="go('recommendations')">${pending?'Review priority actions':'Continue regular inspection'}</button><button onclick="go('risk')">Review current risk forecast</button></div>`)}<div class="inav"><button onclick="go('analysis')">AI Health</button><button onclick="go('trend')">Trends</button><button onclick="go('risk')">Risk</button><button onclick="go('season')">Season</button><button onclick="go('honey-analytics')">Honey</button><button onclick="go('recommendations')">Recommendations</button></div></div>`}

let V49_TREND_RANGE='30D';
function setTrendRangeV49(range,btn){V49_TREND_RANGE=range;selectTab(btn);toast(range+' trend range selected')}
function trendPage(r){const s=v45s(),score=avgHealth(s),avgVar=s.hives.length?s.hives.reduce((n,h)=>n+Number(h.varroa||0),0)/s.hives.length:0,avgHoney=s.hives.length?s.hives.filter(h=>h.honey==='High').length/s.hives.length*10:0;r.innerHTML=aipage(V45.hive,`<div class="filters"><button onclick="setTrendRangeV49('7D',this)">7D</button><button class="active" onclick="setTrendRangeV49('30D',this)">30D</button><button onclick="setTrendRangeV49('90D',this)">90D</button><button onclick="setTrendRangeV49('Season',this)">Season</button></div>${[['Health Score',score],['Varroa Level',avgVar.toFixed(1)],['Colony Size',s.hives.length],['Food Stores',avgHoney.toFixed(1)],['Brood Pattern',s.hives.filter(h=>h.brood==='Excellent'||h.brood==='Good').length],['Queen Status',s.hives.filter(h=>h.queen==='Confirmed').length+'/'+s.hives.length]].map(x=>trend(x[0],x[1])).join('')}<button class="primary" onclick="toast(V49_TREND_RANGE+' trend details active')">View Trend Details</button>`)}
function honeyAnalytics(r){const s=v45s(),total=s.logs.harvests.reduce((n,x)=>n+Number(x.weightLb||0),0),goal=300,monthly=Array(12).fill(0),byHive={};s.logs.harvests.forEach(x=>{const m=Number(String(x.date||'').slice(5,7))-1;if(m>=0&&m<12)monthly[m]+=Number(x.weightLb||0);byHive[x.hiveId]=(byHive[x.hiveId]||0)+Number(x.weightLb||0)});const top=Object.entries(byHive).sort((a,b)=>b[1]-a[1]).slice(0,3);r.innerHTML=aipage(V45.harvest,`<div class="stats3"><div><span>Total Honey</span><b>${formatWeight(total,s)}</b></div><div><span>Goal</span><b>${formatWeight(goal,s)}</b></div><div><span>Progress</span><b>${Math.min(100,Math.round(total/goal*100))}%</b></div></div>${barsV49(monthly)}${Vcard('Top Hives',`<div class="lines">${top.map(([id,w])=>`<button onclick="go('hive/${id}')"><span>${esc(hive(s,id)?.name||'Hive')}</span><b>${formatWeight(w,s)}</b></button>`).join('')||'<div class="small muted">No harvest data yet.</div>'}</div>`)}<button class="primary" onclick="go('honey')">View Details</button>`)}

const V49_NOTIFS=[['v49n1','Critical','High temperature alert','hive/h3','Alerts'],['v49n2','Action Required','Inspect Oak Meadow','inspection/h1','Alerts'],['v49n3','Reminder','Varroa treatment due','treatment-record/h3','Reminders'],['v49n4','AI Risk','Queen failure risk','risk','Alerts'],['v49n5','Treatment','Follow-up recommended','treatment-record/h1','Reminders'],['v49n6','Seasonal','Spring nectar flow','season','Reminders'],['v49n7','System','HiveDash Pro enabled','subscription','System']];
function v49NotifRead(id){const s=v45s();return s.v49NotificationReadAll||(s.v49NotificationRead||{})[id]}
function openNotifV49(id,target){const s=v45s();s.v49NotificationRead=s.v49NotificationRead||{};s.v49NotificationRead[id]=true;save(s);go(target)}
function drawNotificationsV49(group='All'){const box=idq('v48notifs');if(!box)return;const rows=V49_NOTIFS.filter(x=>group==='All'||x[4]===group);box.innerHTML=rows.map((x,i)=>`<button style="opacity:${v49NotifRead(x[0])?.6:1}" onclick="openNotifV49('${x[0]}','${x[3]}')"><i class="${x[1]==='Critical'?'critical':x[1]==='Action Required'?'attention':'good'}"></i><div><b>${x[1]}</b><span>${x[2]}</span></div><time>${9+i}:30 AM</time></button>`).join('')}
function filterNotificationsV48(group,btn){selectTab(btn);drawNotificationsV49(group)}
function markAllReadV49(){const s=v45s();s.v49NotificationReadAll=true;s.notifications.forEach(n=>n.read=true);save(s);toast('All read');drawNotificationsV49(document.querySelector('.filters button.active')?.textContent.trim()||'All');chrome('notifications')}
function notifications(r){r.innerHTML=`<div class="vs"><div class="filters"><button class="active" onclick="filterNotificationsV48('All',this)">All</button><button onclick="filterNotificationsV48('Alerts',this)">Alerts</button><button onclick="filterNotificationsV48('Reminders',this)">Reminders</button><button onclick="filterNotificationsV48('System',this)">System</button></div><section class="notifs" id="v48notifs"></section><button class="secondary" onclick="markAllReadV49()">Mark All Read</button></div>`;drawNotificationsV49('All')}


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
  const files=[...(input?.files||[])];if(!files.length)return;const s=v45s(),h=hive(s,hiveId);if(!h){input.value='';return toast('Hive not found')}h.photos=Array.isArray(h.photos)?h.photos:[];let room=Math.max(0,12-h.photos.length);if(!room){input.value='';return toast('Maximum 12 photos per hive')}if(files.length>room)toast(`Only ${room} more photo${room===1?'':'s'} can be added`);
  const before=clone(h.photos);let added=0;try{for(const file of files.slice(0,room)){const data=await compressHivePhoto(file);h.photos.push({id:'p'+Date.now()+Math.random().toString(36).slice(2,7),data,date:new Date().toISOString().slice(0,10),name:String(file.name||'photo').slice(0,120)});added++;if(JSON.stringify(s).length>4300000)throw new Error('Photo storage limit reached')}if(!added)throw new Error('No supported photos selected');if(save(s)===false)throw new Error('Photo storage limit reached');toast(added===1?'Photo added':`${added} photos added`);render()}catch(err){h.photos=before;console.error(err);toast(err.message||'Could not add photo')}finally{input.value=''}
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
  const fallback={hive:'hives',inspection:id?'hive/'+id:'hives',timeline:id?'hive/'+id:'home',honey:'home',map:'home','all-hives':'hives','all-actions':'actions','feeding-record':'actions','treatment-record':'actions','harvest-record':'honey',analysis:'insights',trend:'insights',risk:'insights',season:'insights','honey-analytics':'insights',recommendations:'insights',settings:'home',account:'settings',subscription:'settings',apiary:'settings','seasonal-settings':'apiary','notification-preferences':'settings','units-region':'settings','smart-features':'settings','data-backup':'settings',security:'settings',store:'settings',notifications:'home',help:'settings',faq:'help',support:'help',about:'settings',privacy:'security',terms:'security'}[page]||'home';
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
  const idx=Math.max(0,v45s().hives.findIndex(x=>x.id===h.id));
  const imgs=[V45.hive,V45.hives,V45.home,V45.inspection,V45.treatment,V45.harvest];
  return imgs[idx%imgs.length];
}

function home(r){
  const s=v45s(),score=avgHealth(s);
  const strong=s.hives.filter(x=>x.status==='Healthy').length;
  const att=s.hives.filter(x=>x.status==='Attention').length;
  const crit=s.hives.filter(x=>x.status==='Critical').length;
  const first=s.hives[0]?.id||'';
  r.innerHTML=`<div class="vs homev v53-home">
    ${Vhero(V45.home,`
      <div class="greet"><span>Good Morning!</span><b>${esc(s.settings.apiaryName||'Oak Meadow Apiary')}</b></div>
      <div class="hring"><strong>${score}%</strong><span>Overall Health</span></div>
      <div class="hstats">
        <button onclick="go('all-hives/All')"><b>${s.hives.length}</b><span>Total Hives</span></button>
        <button onclick="go('all-hives/Healthy')"><b>${strong}</b><span>Strong</span></button>
        <button onclick="go('all-hives/Attention')"><b>${att}</b><span>Attention</span></button>
        <button onclick="go('all-hives/Critical')"><b>${crit}</b><span>Critical</span></button>
      </div>`,'homehero')}
    ${Vcard('Action Center',`
      <div class="actrow">
        <div><small>High Priority</small><b>Inspect Hive #2</b><span>Queen confirmation due</span></div>
        <button onclick="go('inspection/h2')">Open</button>
      </div>`)}
    ${Vcard('Risk Alerts',`
      <div class="alerts">
        <button onclick="go('treatment-record/h3')"><b>High Varroa Risk</b><span>Hive #3 · 4 mites / 100 bees</span><em>View</em></button>
        <button onclick="go('hive/h2')"><b>Queen status unconfirmed</b><span>Hive #2 needs verification</span><em>View</em></button>
      </div>`)}
    ${Vcard('Season Intelligence',`
      <div class="actrow"><div><b>Spring Nectar Flow</b><span>Peak flow · next 12 days</span></div><button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">Learn More</button></div>`)}
    ${Vcard('Quick Actions',`
      <div class="quick">
        <button onclick="go('inspection/${first}')"><i>⌕</i><b>Inspection</b></button>
        <button onclick="go('feeding-record/${first}')"><i>▣</i><b>Feeding</b></button>
        <button onclick="go('treatment-record/${first}')"><i>✚</i><b>Treatment</b></button>
        <button onclick="go('harvest-record/${first}')"><i>⌁</i><b>Harvest</b></button>
        <button onclick="openRecordPicker()"><i>•••</i><b>More</b></button>
      </div>`)}
  </div>`;
}

function v53HiveCard(h){
  return `<button class="hcard v53-hcard" onclick="go('hive/${h.id}')">
    <img src="${v53HiveThumb(h)}" alt="${esc(h.name)}">
    <span class="v53-hi"><b>${esc(h.name)}</b><small>${h.score}% · Last ${fmtDate(h.lastInspection)}</small></span>
    <em class="${Vclass(h)}">${Vstatus(h)}</em>
  </button>`;
}

function hives(r){
  const s=v45s();
  r.innerHTML=`<div class="vs v53-hives">
    <div class="phead" style="--hero:url('${V45.hives}')"><i></i><b>Hives</b>
      <div class="search"><span>⌕</span><input id="hsearch" placeholder="Search hives"></div>
    </div>
    <div class="filters v53-filters">
      <button class="active" data-v53-status="All">All (${s.hives.length})</button>
      <button data-v53-status="Healthy">Healthy</button>
      <button data-v53-status="Attention">Attention</button>
      <button data-v53-status="Critical">Critical</button>
    </div>
    <div id="hlist" class="hlist">${s.hives.map(v53HiveCard).join('')}</div>
  </div>`;
  const input=idq('hsearch');
  let status='All';
  function draw(){
    const q=(input?.value||'').toLowerCase().trim();
    const rows=s.hives.filter(h=>(status==='All'||h.status===status)&&(!q||h.name.toLowerCase().includes(q)));
    idq('hlist').innerHTML=rows.length?rows.map(v53HiveCard).join(''):'<section class="vc v53-empty"><b>No hives found</b><span>Try another search or filter.</span></section>';
  }
  document.querySelectorAll('[data-v53-status]').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('[data-v53-status]').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active'); status=btn.dataset.v53Status; draw();
    };
  });
  if(input) input.oninput=draw;
}

function v53ActionRows(mode='Pending'){
  const s=v45s();
  if(typeof v48ActionRows==='function') return v48ActionRows(mode);
  return (s.actions||[]);
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
      <button onclick="${isPro(s)?"go('analysis')":"requirePro('AI Health Analysis')"}">AI Health</button>
      <button onclick="${isPro(s)?"go('trend')":"requirePro('Advanced Trends')"}">Trends</button>
      <button onclick="${isPro(s)?"go('risk')":"requirePro('Risk Prediction')"}">Risk</button>
      <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">Season</button>
      <button onclick="${isPro(s)?"go('honey-analytics')":"requirePro('Honey Analytics')"}">Honey</button>
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

function home(r){
  const s=v45s();
  const score=avgHealth(s);
  const strong=s.hives.filter(x=>x.status==='Healthy').length;
  const att=s.hives.filter(x=>x.status==='Attention').length;
  const crit=s.hives.filter(x=>x.status==='Critical').length;
  const first=s.hives[0]?.id||'';
  const top=v54TopAction();
  const cta=v54ActionCTA(top);
  const topHive=hive(s,cta.hive);
  const topTitle=top?.title||'Inspection overdue';
  const topReason=top?.reason||top?.due||'Last inspection needs review';
  const attentionHive=s.hives.find(h=>h.status==='Attention')||s.hives[1]||s.hives[0];
  const criticalHive=s.hives.find(h=>h.status==='Critical')||s.hives[2]||s.hives[0];

  r.innerHTML=`
  <div class="vs v54-home">

    <!-- 1. Hive Overview -->
    <section class="v54-card v54-overview">
      <div class="v54-section-title">
        <b>Hive Overview</b>
        <span class="v54-info">i</span>
      </div>

      <div class="v54-overview-main">
        <button class="v54-score" onclick="go('all-hives/All')" aria-label="View all hives">
          <svg viewBox="0 0 120 120" class="v54-score-ring" aria-hidden="true">
            <circle class="v54-ring-bg" cx="60" cy="60" r="47"></circle>
            <circle class="v54-ring-value" cx="60" cy="60" r="47"
                    style="stroke-dasharray:${Math.max(0,Math.min(100,score))*2.953},295.3"></circle>
          </svg>
          <span class="v54-score-number">${score}<small>%</small></span>
          <b>${score>=80?'Good':score>=65?'Attention':'Critical'}</b>
          <small>Overall Health</small>
        </button>

        <div class="v54-overview-stats">
          <button onclick="go('all-hives/All')">
            <span class="v54-stat-icon">▤</span>
            <span>Total Hives</span>
            <b>${s.hives.length}</b>
          </button>
          <button onclick="go('all-hives/Healthy')">
            <i class="v54-dot v54-green"></i>
            <span>Strong</span>
            <b>${strong}</b>
          </button>
          <button onclick="go('all-hives/Attention')">
            <i class="v54-dot v54-orange"></i>
            <span>Needs Attention</span>
            <b>${att}</b>
          </button>
          <button onclick="go('all-hives/Critical')">
            <i class="v54-dot v54-red"></i>
            <span>Critical</span>
            <b>${crit}</b>
          </button>
        </div>
      </div>

      <div class="v54-apiary-strip" role="img" aria-label="Apiary"></div>

      <button class="v54-view-row" onclick="go('all-hives/All')">
        <span class="v54-view-icon">▤</span>
        <span><b>View All Hives</b><small>Check detailed hive status</small></span>
        <em>›</em>
      </button>
    </section>

    <!-- 2. Action Center -->
    <section class="v54-card">
      <div class="v54-section-title">
        <b>Action Center</b>
      </div>
      <div class="v54-action-primary">
        <span class="v54-action-icon">✓</span>
        <span class="v54-action-copy">
          <b>${esc(topTitle)}</b>
          <small>${topHive?esc(topHive.name):'Hive'} · ${esc(topReason)}</small>
        </span>
        <button onclick="${cta.route}">${cta.label}</button>
      </div>
      <div class="v54-action-meta">
        <span>▧&nbsp; Due: <b>${esc(top?.due||'Now')}</b></span>
        <span>◷&nbsp; Est. time: 15 min</span>
        <button onclick="go('all-actions')">View All Actions ›</button>
      </div>
    </section>

    <!-- 3. Risk Alerts -->
    <section class="v54-card">
      <div class="v54-section-title">
        <b>Risk Alerts</b>
        <button onclick="go('all-hives/Critical')">View All Alerts ›</button>
      </div>
      <div class="v54-risk-scroll">
        <button class="v54-risk-card high" onclick="${criticalHive?`go('treatment-record/${criticalHive.id}')`:"go('all-hives/Critical')"}">
          <span class="v54-risk-symbol">!</span>
          <span><b>${criticalHive?esc(criticalHive.name):'Hive'}</b><small>Varroa test overdue</small><em>High Risk</em></span>
          <i>›</i>
        </button>
        <button class="v54-risk-card medium" onclick="${attentionHive?`go('hive/${attentionHive.id}')`:"go('all-hives/Attention')"}">
          <span class="v54-risk-symbol">!</span>
          <span><b>${attentionHive?esc(attentionHive.name):'Hive'}</b><small>Queen status unconfirmed</small><em>Medium Risk</em></span>
          <i>›</i>
        </button>
        <button class="v54-risk-card high" onclick="${criticalHive?`go('hive/${criticalHive.id}')`:"go('all-hives/Critical')"}">
          <span class="v54-risk-symbol">!</span>
          <span><b>${criticalHive?esc(criticalHive.name):'Hive'}</b><small>Inspection overdue</small><em>High Risk</em></span>
          <i>›</i>
        </button>
      </div>
      <div class="v54-pager"><i class="active"></i><i></i><i></i><i></i></div>
    </section>

    <!-- 4. Season Intelligence -->
    <section class="v54-card">
      <div class="v54-section-title">
        <b>Season Intelligence</b>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">Spring Build-Up ›</button>
      </div>
      <div class="v54-season-grid">
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">
          <i>✿</i><b>Nectar Flow</b><em>Good</em><small>Flow is strong in your area</small><span>Learn more ›</span>
        </button>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">
          <i>⌁</i><b>Swarm Watch</b><em>Low Risk</em><small>High swarm risk in 2–4 weeks</small><span>Learn more ›</span>
        </button>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">
          <i>▣</i><b>Add Super Soon</b><em class="warn">Recommended</em><small>Prepare to add honey super</small><span>Learn more ›</span>
        </button>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">
          <i>◉</i><b>Varroa Rising</b><em class="warn">Elevated</em><small>Increase monitoring frequency</small><span>Learn more ›</span>
        </button>
      </div>
      <div class="v54-pager season"><i class="active"></i><i></i><i></i><i></i><i></i></div>
    </section>

    <!-- 5. Quick Actions -->
    <section class="v54-card v54-quick-section">
      <div class="v54-section-title"><b>Quick Actions</b></div>
      <div class="v54-quick-grid">
        <button onclick="go('inspection/${first}')"><i>✓</i><b>Inspection</b><small>Record hive inspection</small></button>
        <button onclick="go('feeding-record/${first}')"><i>▤</i><b>Feeding</b><small>Record feeding activity</small></button>
        <button onclick="go('treatment-record/${first}')"><i>✚</i><b>Treatment</b><small>Record treatment</small></button>
        <button onclick="go('harvest-record/${first}')"><i>⌁</i><b>Harvest</b><small>Record honey harvest</small></button>
        <button onclick="openRecordPicker()"><i>•••</i><b>More</b><small>More actions & tools</small></button>
      </div>
    </section>

  </div>`;
}



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

function home(r){
  const s=v45s(), score=avgHealth(s);
  const strong=s.hives.filter(h=>h.status==='Healthy').length;
  const att=s.hives.filter(h=>h.status==='Attention').length;
  const crit=s.hives.filter(h=>h.status==='Critical').length;
  const total=Math.max(1,s.hives.length);
  const pct=n=>Math.round((n/total)*100);
  const first=s.hives[0]?.id||'';
  const top=v55TopAction();
  const ar=v55ActionRoute(top);
  const th=hive(s,ar.hive);
  const riskA=s.hives.find(h=>h.status==='Attention')||s.hives[0];
  const riskC=s.hives.find(h=>h.status==='Critical')||s.hives[0];

  r.innerHTML=`
  <div class="vs v55-home">

    <section class="v55-overview">
      <div class="v55-title">Hive Overview <span>i</span></div>

      <div class="v55-overview-body">
        <button class="v55-health" onclick="go('all-hives/All')" aria-label="View all hives">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="47" class="bg"></circle>
            <circle cx="60" cy="60" r="47" class="val"
              style="stroke-dasharray:${Math.max(0,Math.min(100,score))*2.953},295.3"></circle>
          </svg>
          <div class="num">${score}<small>%</small></div>
          <b>${score>=80?'Good':score>=65?'Attention':'Critical'}</b>
          <em>Overall Health</em>
        </button>

        <div class="v55-stat-list">
          <button onclick="go('all-hives/All')">
            <i class="ico">▤</i><span>Total Hives</span><b>${s.hives.length}</b>
          </button>
          <button onclick="go('all-hives/Healthy')">
            <i class="dot green"></i><span>Strong</span><b>${strong}</b><em>(${pct(strong)}%)</em>
          </button>
          <button onclick="go('all-hives/Attention')">
            <i class="dot orange"></i><span>Needs Attention</span><b>${att}</b><em>(${pct(att)}%)</em>
          </button>
          <button onclick="go('all-hives/Critical')">
            <i class="dot red"></i><span>Critical</span><b>${crit}</b><em>(${pct(crit)}%)</em>
          </button>
        </div>
      </div>

      <div class="v55-landscape"></div>

      <button class="v55-view-all" onclick="go('all-hives/All')">
        <i>▤</i>
        <span><b>View All Hives</b><small>Check detailed hive status</small></span>
        <em>›</em>
      </button>
    </section>

    <section class="v55-section v55-action">
      <div class="v55-section-title">Action Center</div>
      <div class="v55-action-row">
        <i class="cal">✓</i>
        <span class="copy">
          <b>${esc(top?.title||'Varroa Check Overdue')}</b>
          <small>${th?esc(th.name):'Hive'} · ${esc(top?.reason||'Last inspection: 35 days ago')}</small>
        </span>
        <button onclick="${ar.onclick}">${ar.label}</button>
      </div>
      <div class="v55-meta">
        <span>▧ &nbsp; Due: <b>${esc(top?.due||'Now')}</b></span>
        <span>◷ &nbsp; Est. time: 15 min</span>
        <button onclick="go('all-actions')">View All Actions <b>›</b></button>
      </div>
    </section>

    <section class="v55-section v55-risks">
      <div class="v55-section-head">
        <span>Risk Alerts</span>
        <button onclick="go('all-hives/Critical')">View All Alerts <b>›</b></button>
      </div>
      <div class="v55-risk-row">
        <button class="high" onclick="${riskA?`go('hive/${riskA.id}')`:"go('all-hives/Attention')"}">
          <i>!</i><span><b>${riskA?esc(riskA.name):'Hive #2'}</b><small>Queen status<br>unconfirmed</small><em>High Risk</em></span><strong>›</strong>
        </button>
        <button class="medium" onclick="${riskA?`go('feeding-record/${riskA.id}')`:"go('all-hives/Attention')"}">
          <i>!</i><span><b>${riskA?esc(riskA.name):'Hive #4'}</b><small>Low food<br>stores</small><em>Medium Risk</em></span><strong>›</strong>
        </button>
        <button class="high" onclick="${riskC?`go('treatment-record/${riskC.id}')`:"go('all-hives/Critical')"}">
          <i>!</i><span><b>${riskC?esc(riskC.name):'Hive #1'}</b><small>Varroa test<br>overdue</small><em>High Risk</em></span><strong>›</strong>
        </button>
        <button class="more-risk" onclick="go('all-hives/Critical')"><i>!</i></button>
      </div>
      <div class="v55-dots"><b></b><i></i><i></i><i></i><i></i></div>
    </section>

    <section class="v55-section v55-season">
      <div class="v55-section-head">
        <span>Season Intelligence</span>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}">Spring Build-Up <b>›</b></button>
      </div>
      <div class="v55-season-grid">
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><i>✿</i><b>Nectar Flow</b><em>Good</em><small>Flow is strong in your area</small><span>Learn more ›</span></button>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><i>⌁</i><b>Swarm Watch</b><em>Low Risk</em><small>High swarm risk in 2–4 weeks</small><span>Learn more ›</span></button>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><i>▤</i><b>Add Super Soon</b><em class="orange">Recommended</em><small>Prepare to add honey super</small><span>Learn more ›</span></button>
        <button onclick="${isPro(s)?"go('season')":"requirePro('Season Intelligence')"}"><i>◉</i><b>Varroa Rising</b><em class="orange">Elevated</em><small>Increase monitoring frequency</small><span>Learn more ›</span></button>
      </div>
      <div class="v55-dots season-dots"><b></b><i></i><i></i><i></i><i></i></div>
    </section>

    <section class="v55-section v55-quick">
      <div class="v55-section-title">Quick Actions</div>
      <div class="v55-quick-grid">
        <button onclick="go('inspection/${first}')"><i>✓</i><b>Inspection</b><small>Record hive<br>inspection</small></button>
        <button onclick="go('feeding-record/${first}')"><i>▤</i><b>Feeding</b><small>Record feeding<br>activity</small></button>
        <button onclick="go('treatment-record/${first}')"><i>✚</i><b>Treatment</b><small>Record<br>treatment</small></button>
        <button onclick="go('harvest-record/${first}')"><i>⌁</i><b>Harvest</b><small>Record honey<br>harvest</small></button>
        <button onclick="openRecordPicker()"><i>•••</i><b>More</b><small>More actions<br>& tools</small></button>
      </div>
    </section>

  </div>`;
}



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
  const riskHive=s.hives.find(h=>h.status==='Critical')||s.hives.find(h=>h.status==='Attention')||s.hives[0];

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
        <b>${riskHive?.varroa>=3?'High Varroa Risk':'Queen status unconfirmed'}</b>
        <em>${riskHive?esc(riskHive.name):'Hive'} · ${riskHive?.varroa>=3?esc(String(riskHive.varroa))+' mites / 100 bees':'needs verification'}</em>
      </div>
      <button class="v56-soft-btn" onclick="${riskHive?.varroa>=3?`go('treatment-record/${riskHive.id}')`:riskHive?`go('hive/${riskHive.id}')`:"go('all-hives/Critical')"}">View</button>
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

