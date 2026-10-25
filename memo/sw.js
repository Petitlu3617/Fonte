/* Mémo : cache de l'appli pour l'utiliser hors ligne. Changer VERSION à chaque mise à jour des fichiers. */
const VERSION='memo-v1';
const SHELL=['./','index.html','style.css','app.js','manifest.webmanifest','icons/memo-icon.svg','icons/memo-icon-192.png','icons/memo-icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
/* Ne supprime que les anciens caches de Mémo (Fonte partage la même origine). */
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('memo-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
/* Réseau d'abord (pour avoir la dernière version), cache en secours ; les polices passent aussi par le cache. */
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url), same=u.origin===location.origin, font=/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if(!same&&!font)return;
  e.respondWith(fetch(r).then(res=>{
    if(res.ok||res.type==='opaque'){const c=res.clone();caches.open(VERSION).then(x=>x.put(r,c))}
    return res;
  }).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):Response.error()))));
});
