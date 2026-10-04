const VERSION='3.1.0',SHELL=`glauco-shell-${VERSION}`;
const FILES=['./','index.html','icons.svg','styles.css','motion.css','motion.js','wildlife.css','wildlife.js','wildlife-tracking.js','chevron.svg','app.js','navigation.js','customs.js','guide.js','photo-background.js','photo-overrides.js','cloudinary-upload.js','config.js','model.js','storage.js','firebase.js','offline.js','manifest.webmanifest','app-icon.png','app-icon-maskable.png','trip-headers/cambodia-thailand-2026-user-v2.webp','trip-headers/peru-2027-user.webp','trip-headers/venice-rome-user.webp','fonts/figtree-400.ttf','fonts/figtree-500.ttf','fonts/playfair.woff','fonts/playfair-italic.woff','fonts/notosans-thai.ttf','fonts/notosans-khmer.ttf','vendor/firebase/12.18.0/firebase-app.js','vendor/firebase/12.18.0/firebase-auth.js','vendor/firebase/12.18.0/firebase-firestore.js'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(SHELL);for(const file of FILES){const url=new URL(file,self.registration.scope);const response=await fetch(url,{cache:'reload'});if(!response.ok)throw new Error(`Could not cache ${file}`);await cache.put(url,response);}if(!self.registration.active)await self.skipWaiting();})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('glauco-shell-')&&name!==SHELL)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET')return;
 if(url.origin!==scope.origin){
  if(['upload.wikimedia.org','thumb.wikimedia.org','res.cloudinary.com','inaturalist-open-data.s3.amazonaws.com'].includes(url.hostname))event.respondWith((async()=>{for(const name of await caches.keys())if(name.startsWith('glauco-trip-')){const hit=await(await caches.open(name)).match(request.url);if(hit)return hit;}return fetch(request);})());
  return;
 }
 if(!url.pathname.startsWith(scope.pathname)||url.pathname.endsWith('release.json'))return;
 if(url.pathname.endsWith('config.js')){event.respondWith((async()=>{const cache=await caches.open(SHELL);try{const response=await fetch(request,{cache:'no-store'});if(response.ok)await cache.put(new URL('config.js',scope),response.clone());return response;}catch{const cached=await cache.match(new URL('config.js',scope));if(cached)return cached;throw new Error('No saved configuration');}})());return;}
 const path=url.pathname.slice(scope.pathname.length);
 if(request.mode==='navigate' && !path.endsWith('setup.html')){event.respondWith((async()=>{const cache=await caches.open(SHELL);return await cache.match(new URL('index.html',scope))||fetch(request);})());return;}
 if(FILES.includes(path)){event.respondWith((async()=>{const cache=await caches.open(SHELL);return await cache.match(request,{ignoreSearch:true})||fetch(request);})());}
});
