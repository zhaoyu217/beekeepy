const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {chromium}=require('playwright');const dir='native-smoke-results';fs.mkdirSync(dir,{recursive:true});
const adb=(...x)=>execFileSync('adb',x,{encoding:'utf8',timeout:30000}).trim();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const report={source:'original Android APK on API35 emulator',checks:[],fail:null};
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});if(!pass)throw Error(name+' '+JSON.stringify(detail))}
async function run(){let browser;
try{
 check('Installed original APK',adb('shell','pm','path','app.hivefield.mobile.fix').includes('package:'));
 const pid=adb('shell','pidof','app.hivefield.mobile.fix').split(/\s+/)[0];check('Android process launched',!!pid,pid);
 report.debuggable=adb('shell','dumpsys','package','app.hivefield.mobile.fix').split('\n').filter(x=>/DEBUGGABLE|debuggable/i.test(x)).slice(0,4);
 try{report.remoteSockets=adb('shell','cat','/proc/net/unix').split('\n').filter(x=>/devtools_remote|chrome_devtools|webview_devtools/.test(x)).slice(0,20)}catch(e){report.remoteSocketsError=String(e).slice(0,350)}
 adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid);
 report.forwarded=adb('forward','--list');
 const http=require('node:http');
 async function probe(url){return new Promise(done=>{const req=http.get(url,res=>{let s='';res.setEncoding('utf8');res.on('data',t=>s+=t);res.on('end',()=>done({status:res.statusCode,body:s.slice(0,1800)}));});req.setTimeout(2500,()=>req.destroy(new Error('timeout')));req.on('error',e=>done({error:String(e)}));});}
 report.devtoolsProbe=await probe('http://127.0.0.1:9222/json/version');

 for(let i=0;i<10&&!browser;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:4000})}catch(e){report.connectError=String(e).slice(0,1200);await wait(1500)}}
 check('Real native WebView CDP available',!!browser);
 const pages=browser.contexts().flatMap(c=>c.pages());report.pages=pages.map(x=>x.url());const p=pages.find(x=>x.url().includes('localhost'))||pages[0];check('WebView page accessible',!!p,report.pages);
 const errors=[];p.on('pageerror',x=>errors.push(String(x.stack||x)));
 const initial=await p.evaluate(()=>({go:typeof window.go,r08:typeof window.v2p2e5r08Evaluate,r10:typeof window.HiveDashTaskEngineCoreV1?.evaluateSplitVerification,ready:document.readyState}));report.initial=initial;
 check('Runtime loaded R08 and R10',initial.go==='function'&&initial.r08==='function'&&initial.r10==='function',initial);
 const fixture=await p.evaluate(()=>{window.HIVEDASH_CONFIG.REQUIRE_AUTH=false;location.hash='home';if(typeof window.render==='function')window.render();return {hash:location.hash,nav:document.querySelectorAll('#bottomnav .navitem').length}});
 check('Isolated demo route available',fixture.nav===4,fixture);
 await p.screenshot({path:path.join(dir,'webview-home.png')});
 report.geometry=await p.evaluate(()=>{const top=document.getElementById('topbar').getBoundingClientRect(),bottom=document.getElementById('bottomnav').getBoundingClientRect();return {viewport:innerHeight,dpr:devicePixelRatio,top:top.top,topHeight:top.height,navHeight:bottom.height,navBottom:bottom.bottom,buttons:[...document.querySelectorAll('#bottomnav .navitem')].map(x=>x.getBoundingClientRect().bottom)}});
 check('Real WebView header and nav visible',report.geometry.topHeight>0&&report.geometry.navHeight>=60,report.geometry);
 for(const [n,h] of [['Hives','hives'],['Actions','actions'],['Insights','insights'],['Home','home']]){await p.locator('#bottomnav .navitem').filter({hasText:n}).click({timeout:12000});await p.waitForFunction(expected=>location.hash==='#'+expected,h);check(n+' navigates in real WebView',await p.evaluate(()=>location.hash)==='#'+h)}
 await p.evaluate(()=>window.v2p2e5lHomeQuick('inspection'));const modal=p.locator('#app > .modal.v215-more-modal');await modal.waitFor({state:'visible',timeout:12000});
 const id=await modal.locator('#v2p2e5l-quick-hive').inputValue();check('Select Hive has an active ID',!!id,id);await p.screenshot({path:path.join(dir,'webview-modal.png')});
 await modal.getByRole('button',{name:'Continue'}).click();await p.waitForFunction(id=>location.hash==='#inspection/'+id,id);check('Continue opens selected hive',await p.evaluate(()=>location.hash)==='#inspection/'+id);
 await p.screenshot({path:path.join(dir,'webview-inspection.png')});check('No detected runtime exception',errors.length===0,errors);
}catch(e){report.fail=String(e.stack||e);process.exitCode=1}
finally{try{await browser?.close()}catch(_){}fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log('ANDROID_NATIVE_REPORT '+JSON.stringify(report))}}
run().catch(e=>{console.error(e);process.exitCode=1});