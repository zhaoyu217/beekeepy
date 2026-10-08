/* Android APK-bundle browser smoke test.
 * No credentials. Demo state is injected only into this local test server;
 * the app's repository config, data, science and persistence are untouched.
 * Chromium is not an Android system UI or Sherpa-ONNX device test. */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const dist=path.resolve(__dirname,'../dist');
const out=path.resolve(__dirname,'../../smoke-results');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/config.js'){
    res.writeHead(200,{'Content-Type':'application/javascript'});
    res.end('window.HIVEDASH_CONFIG={REQUIRE_AUTH:false};window.__LOCAL_TEST_FIXTURE__=true;');
    return;
  }
  if(pathname==='/vendor/supabase.min.js'){
    res.writeHead(200,{'Content-Type':'application/javascript'});
    res.end('window.supabase={};');
    return;
  }
  const file=path.resolve(dist,'.'+pathname);
  if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return}
  try{
    const data=fs.readFileSync(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  }catch(_){res.writeHead(404);res.end('Not found')}
});
async function go(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const result={mode:'headless chromium / locally packaged Android HTML',head:process.env.GITHUB_SHA||'',tests:[],pageErrors:[],missingLocalScripts:[],failedRequests:[],safeArea:null};
  let browser;
  const check=(name,ok,details)=>{result.tests.push({name,pass:!!ok,details:details||''});if(!ok)throw Error(name+' FAILED: '+(details||''))};
  let page;
  try{
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    page.on('pageerror',e=>result.pageErrors.push(String(e&&e.stack||e)));
    page.on('response',response=>{
      if(response.status()===404&&new URL(response.url()).host==='127.0.0.1:'+port)
        result.missingLocalScripts.push(new URL(response.url()).pathname);
    });
    page.on('requestfailed',request=>result.failedRequests.push({url:request.url().slice(0,200),err:request.failure()?.errorText}));
    await page.goto('http://127.0.0.1:'+port+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(1600);
    check('Test uses isolated no-login fixture',await page.evaluate(()=>window.__LOCAL_TEST_FIXTURE__===true));
    check('Application home renders',await page.locator('#view').innerText().then(x=>x.length>120));
    check('Authoritative Home quick selector loaded',await page.evaluate(()=>typeof window.v2p2e5lHomeQuick==='function'));
    check('Authoritative Home quick start loaded',await page.evaluate(()=>typeof window.v2p2e5lStartHomeQuick==='function'));
    await page.screenshot({path:path.join(out,'home.png')});
    for(const route of [['Hives','hives'],['Actions','actions'],['Insights','insights'],['Home','home']]){
      const button=page.locator('#bottomnav .navitem').filter({hasText:route[0]}).first();
      await button.click({timeout:15000});
      await page.waitForTimeout(250);
      const hash=await page.evaluate(()=>location.hash);
      check('Nav '+route[0],hash==='#'+route[1],hash);
    }
    await page.evaluate(()=>window.v2p2e5lHomeQuick('inspection'));
    await page.waitForTimeout(200);
    const panel=page.locator('#app > .modal.v215-more-modal').first();
    check('Select Hive modal is visible',await panel.isVisible());
    check('Select Hive exact copy',await panel.innerText().then(s=>s.includes('Choose the hive before starting this record.')));
    const select=panel.locator('#v2p2e5l-quick-hive');
    const firstHive=await select.inputValue();
    check('Hive selector has an ID',!!firstHive,firstHive);
    await page.screenshot({path:path.join(out,'select-hive.png')});
    await panel.getByRole('button',{name:'Continue'}).click({timeout:15000});
    await page.waitForTimeout(450);
    const routeAfterContinue=await page.evaluate(()=>location.hash);
    check('Continue opens correct inspection',routeAfterContinue==='#inspection/'+firstHive,routeAfterContinue);
    check('Continue closes blocking modal',await page.locator('#app > .modal.v215-more-modal').count()===0);
    await page.screenshot({path:path.join(out,'inspection.png')});
    await page.locator('#bottomnav .navitem').filter({hasText:'Home'}).click({timeout:15000});
    await page.evaluate(()=>window.v2p2e5lHomeQuick('feeding'));
    await page.waitForTimeout(100);
    check('Modal reopen before close',await panel.isVisible());
    await panel.locator('.modalhead .iconbtn').click();
    await page.waitForTimeout(100);
    check('Close clears overlay',await page.locator('#app > .modal.v215-more-modal').count()===0);
    check('Close restores nav clicks',await page.locator('#bottomnav').evaluate(n=>getComputedStyle(n).pointerEvents!=='none'&&getComputedStyle(n).visibility!=='hidden'));
    await page.locator('#bottomnav .navitem').filter({hasText:'Hives'}).click();
    check('Nav after modal close',await page.evaluate(()=>location.hash==='#hives'));
    await page.locator('#bottomnav .navitem').filter({hasText:'Home'}).click();
    await page.evaluate(()=>{document.documentElement.style.setProperty('--hd-android-safe-top','24px');document.documentElement.style.setProperty('--hd-android-safe-bottom','32px');});
    const metrics=await page.evaluate(()=>{
      const top=document.querySelector('#topbar'),nav=document.querySelector('#bottomnav'),view=document.querySelector('#view');
      const tr=top.getBoundingClientRect(),nr=nav.getBoundingClientRect();
      const buttons=[...nav.querySelectorAll('.navitem')].map(x=>({name:x.innerText,bottom:x.getBoundingClientRect().bottom}));
      return {top:tr.top,topHeight:tr.height,navHeight:nr.height,navBottom:nr.bottom,buttons,viewport:innerHeight,viewPaddingTop:getComputedStyle(view).paddingTop};
    });
    result.safeArea=metrics;
    check('24px top inset places header below OS bar',Math.abs(metrics.top-24)<2,JSON.stringify(metrics));
    check('32px bottom inset expands nav background',Math.abs(metrics.navHeight-102)<2,JSON.stringify(metrics));
    check('Nav buttons above 32px system region',metrics.buttons.every(x=>x.bottom<=metrics.viewport-31),JSON.stringify(metrics.buttons));
    await page.screenshot({path:path.join(out,'simulated-safe-insets.png')});
    const unexpectedMissing=[...new Set(result.missingLocalScripts)].filter(x=>!['/r08a1.js','/r10a5-observability.js'].includes(x));
    check('No new missing local assets',unexpectedMissing.length===0,JSON.stringify(unexpectedMissing));
    check('No uncaught JavaScript exceptions',result.pageErrors.length===0,JSON.stringify(result.pageErrors.slice(0,5)));
  }catch(error){
    result.failure=String(error.stack||error);
    if(page){try{await page.screenshot({path:path.join(out,'failure.png')})}catch(_){}}
    process.exitCode=1;
  }finally{
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));
    console.log('ANDROID_WEB_SMOKE_REPORT '+JSON.stringify(result));
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
go().catch(e=>{console.error(e);process.exitCode=1;server.close()});