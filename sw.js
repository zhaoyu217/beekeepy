// HiveDash service worker — offline-first app shell for field use.
// five-gaps-v1: precaches the current app shell and critical same-origin assets,
// uses network-first navigation, and cache-first static resources.
const CACHE='hivedash-field-v1';
const FALLBACK='/index.html';
const PRECACHE=[
  '/',
  '/index.html',
  '/manifest.json',
  '/style.css',
  '/v45.css',
  '/ui-final-polish.css',
  '/field-ops.css',
  '/config.js',
  '/app.js',
  '/v45.js',
  '/r04a-catalog.js',
  '/r05a-catalog.js',
  '/r03a4.js',
  '/r03a5.js',
  '/r08a.js',
  '/r08a1.js',
  '/r09a.js',
  '/r09a2.js',
  '/r09a3.js',
  '/r09a4.js',
  '/b41tz1.js',
  '/r10a15-core.js',
  '/r10a4-projection.js',
  '/r10a5-observability.js',
  '/r10a14-route.js',
  '/r10a10-closure.js',
  '/r10a16-authority-explanation.js',
  '/r11a.js',
  '/r12a.js',
  '/crossrule-x1.js',
  '/r09a5.js',
  '/crossrule-x2.js',
  '/perf-state-cache.js',
  '/select-stability.js',
  '/field-ops.js',
  '/assets/hivedash-login-logo.png',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(async cache=>{
      for(const url of PRECACHE){
        try{
          const resp=await fetch(url,{cache:'reload'});
          if(resp&&resp.ok)await cache.put(url,resp);
        }catch(_e){}
      }
    }).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  let url;
  try{url=new URL(req.url)}catch(_e){return}

  // Auth, cloud data and third-party APIs remain live-network requests.
  if(url.origin!==self.location.origin)return;

  if(req.mode==='navigate'){
    event.respondWith(
      fetch(req).then(resp=>{
        if(resp&&resp.ok){
          const copy=resp.clone();
          caches.open(CACHE).then(c=>c.put(FALLBACK,copy)).catch(()=>{});
        }
        return resp;
      }).catch(async()=>{
        return (await caches.match(req)) || (await caches.match(FALLBACK)) || Response.error();
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req,{ignoreSearch:true}).then(cached=>{
      if(cached)return cached;
      return fetch(req).then(resp=>{
        if(resp&&resp.ok){
          const copy=resp.clone();
          caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
        }
        return resp;
      });
    }).catch(()=>caches.match(req,{ignoreSearch:true}))
  );
});

// ---- Web Push ----
self.addEventListener('push',function(event){
  let data={};
  try{data=event.data?event.data.json():{}}catch(_e){try{data={body:event.data.text()}}catch(_e2){data={}}}
  const title=data.title||'HiveDash';
  const options={
    body:data.body||'A hive needs your attention.',
    icon:'/icon-192.png',
    badge:'/icon-192.png',
    tag:data.tag||'hivedash-reminder',
    data:{url:data.url||'/'}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',function(event){
  event.notification.close();
  const url=event.notification.data&&event.notification.data.url||'/';
  event.waitUntil(
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
      for(const win of windows){
        if('focus' in win)return win.focus();
      }
      if(self.clients.openWindow)return self.clients.openWindow(url);
    })
  );
});
