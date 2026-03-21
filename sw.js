/**
 * Xperiences PWA — Service Worker v8.0
 * v8.0: FCM Push Notifications integrado
 */

// ── Firebase Messaging (background push) ─────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const _SW_FB = {
  apiKey:'AIzaSyANQPli3jWc_FApWG11pqT7ztqjJw9lN_g',
  authDomain:'mrxperiences-f2534.firebaseapp.com',
  projectId:'mrxperiences-f2534',
  storageBucket:'mrxperiences-f2534.firebasestorage.app',
  messagingSenderId:'288251563323',
  appId:'1:288251563323:web:b415ec410bfde65d497b1e'
};
if(!firebase.apps.length) firebase.initializeApp(_SW_FB);
const _messaging = firebase.messaging();

// ── Cache v8 ─────────────────────────────────────────────────
const CACHE_NAME='xperiences-v8-0';
const STATIC_ASSETS=['./','./index.html','./admin.html','./portal.html','./manifest.json','./manifest-admin.json','./manifest-portal.json','./assets/css/styles.css','./assets/js/core.js','./assets/js/app-public.js','./assets/js/app-admin.js','./assets/js/app-portal.js','./assets/data/seed.js','./assets/img/logo-xperiences.png','./assets/img/xp-icon-192.png','./assets/img/xp-icon-512.png','./assets/img/xp-apple-touch-icon.png','./assets/img/admin-icon-192.png','./assets/img/admin-icon-512.png','./assets/img/admin-apple-touch-icon.png','./assets/img/portal-icon-192.png','./assets/img/portal-icon-512.png','./assets/img/portal-apple-touch-icon.png','./assets/img/xp-favicon-16.png','./assets/img/xp-favicon-32.png','./favicon.ico'];
const NETWORK_FIRST=['firebase-config.js','index.html','admin.html','portal.html'];

self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return;
  const netFirst=e.request.mode==='navigate'||NETWORK_FIRST.some(p=>url.pathname.endsWith(p));
  if(netFirst){e.respondWith(fetch(e.request).then(r=>{if(r?.status===200)caches.open(CACHE_NAME).then(c=>c.put(e.request,r.clone()));return r;}).catch(()=>caches.match(e.request).then(c=>c||caches.match('./index.html'))));return;}
  e.respondWith(caches.match(e.request).then(cached=>{fetch(e.request).then(r=>{if(r?.status===200&&r.type!=='opaque')caches.open(CACHE_NAME).then(c=>c.put(e.request,r.clone()));}).catch(()=>{});return cached||fetch(e.request);}));
});

// ── FCM Background ───────────────────────────────────────────
_messaging.onBackgroundMessage(payload=>{
  const n=payload.notification||{};
  const d=payload.data||{};
  const title=n.title||d.title||'Xperiences';
  const body=n.body||d.body||'';
  const url=d.url||'/';
  const type=d.type||'xp-general';
  return self.registration.showNotification(title,{
    body,
    icon:'/assets/img/xp-icon-192.png',
    badge:'/assets/img/xp-icon-96.png',
    tag:type,
    data:{url,type},
    vibrate:[150,100,150],
    actions:[{action:'open',title:'Ver'},{action:'dismiss',title:'Cerrar'}]
  });
});

// ── Push data-only ────────────────────────────────────────────
self.addEventListener('push',e=>{
  if(!e.data)return;
  let p={};try{p=e.data.json();}catch{return;}
  if(p.notification)return; // ya manejado por Firebase Messaging
  const d=p.data||p;
  e.waitUntil(self.registration.showNotification(d.title||'Xperiences',{
    body:d.body||'',
    icon:'/assets/img/xp-icon-192.png',
    badge:'/assets/img/xp-icon-96.png',
    tag:d.type||'xp-general',
    data:{url:d.url||'/',type:d.type},
    vibrate:[150,100,150]
  }));
});

// ── Click en notificación ─────────────────────────────────────
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  if(e.action==='dismiss')return;
  const url=e.notification.data?.url||'/';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    const ex=cs.find(c=>c.url.startsWith(self.location.origin)&&'focus'in c);
    if(ex){ex.focus();return ex.navigate(url);}
    return clients.openWindow(url);
  }));
});
