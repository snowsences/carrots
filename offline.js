import {bytes,uid} from './model.js';
import {all,put,remove} from './storage.js';
import {localDateKey} from './navigation.js';
const PREFIX='glauco-trip-', IMAGE_LIMIT=8*1024*1024, TRIP_LIMIT=300*1024*1024;
const fatal=message=>Object.assign(new Error(message),{fatal:true});

// Photos in download order: the cover, then upcoming and past trip days, or destination places in source order.
// Within each group the small thumbnails come first so lists look right before the full-size photos arrive.
export function photoPlan(trip,today=localDateKey()) {
  const days=[...trip.days].sort((a,b)=>a.date.localeCompare(b.date));
  const ordered=trip.guideType==='destination'?days:[...days.filter(d=>d.date>=today),...days.filter(d=>d.date<today)];
  const seen=new Set(),plan=[];
  const add=(url,day)=>{if(url&&!seen.has(url)){seen.add(url);plan.push({url,day});}};
  add(trip.coverUrl,0);
  for(const day of ordered){const number=trip.days.indexOf(day)+1,photos=day.attractions.flatMap(a=>a.photos);for(const p of photos)add(p.thumbnailUrl,number);for(const p of photos)add(p.url,number);}
  const wildlife=trip.wildlife?.species || [];
  for(const s of wildlife)for(const p of s.photos)add(p.thumbnailUrl,0);
  for(const s of wildlife)for(const p of s.photos)add(p.url,0);
  return plan;
}
export function weakConnection() {
  const c=globalThis.navigator?.connection;
  return Boolean(c&&(c.saveData||['slow-2g','2g','3g'].includes(c.effectiveType)||(c.downlink>0&&c.downlink<1.5)));
}
const wait=(ms,signal)=>new Promise((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});});
// Retries stalled or interrupted requests; anything else (wrong type, too large) fails at once.
async function fetchImage(url,signal,weak) {
  let last;
  for(let attempt=0;attempt<3;attempt++) {
    signal.throwIfAborted();
    const control=new AbortController(),forward=()=>control.abort(signal.reason),timer=setTimeout(()=>control.abort(new Error('timeout')),weak?60000:30000);
    signal.addEventListener('abort',forward,{once:true});
    try {
      const response=await fetch(url,{mode:'cors',credentials:'omit',signal:control.signal,cache:'no-cache'});
      if(response.status>=500||response.status===429)throw new Error(`Server busy (${response.status})`);
      if(!response.ok || !/^image\/(jpeg|png|webp|avif|gif)/i.test(response.headers.get('content-type')||''))throw fatal('An image could not be downloaded. Check the image URL and that its host permits browser downloads.');
      const tooBig=()=>fatal('An image is larger than 8 MB. Use a smaller image URL in the guidebook file.');
      if(Number(response.headers.get('content-length'))>IMAGE_LIMIT)throw tooBig();
      const reader=response.body.getReader(),chunks=[];let length=0;
      try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>IMAGE_LIMIT){await reader.cancel();throw tooBig();}chunks.push(value);}}finally{reader.releaseLock();}
      return new Blob(chunks,{type:response.headers.get('content-type').split(';')[0]});
    } catch(error) {
      if(signal.aborted||error.fatal)throw error;
      last=error;
    } finally {clearTimeout(timer);signal.removeEventListener('abort',forward);}
    if(attempt<2)await wait(attempt?3000:1000,signal);
  }
  throw Object.assign(new Error('The connection was too slow or was interrupted.'),{network:true,cause:last});
}
// A download that loses its connection after some photos keeps them and is saved as partial, so it can continue later.
export async function downloadTrip(entry,progress,signal,{resume=null,today=localDateKey()}={}) {
  const plan=photoPlan(entry.trip,today),weak=weakConnection();
  const reuse=Boolean(resume?.cacheName&&resume.revision===entry.revision&&await caches.has(resume.cacheName));
  const cacheName=reuse?resume.cacheName:`${PREFIX}${entry.id}-${uid()}`;
  const cache=await caches.open(cacheName);let imageBytes=0,saved=0,interrupted=false;
  try {
    for(let i=0;i<plan.length;i++) {
      signal.throwIfAborted();progress({completed:i,total:plan.length,bytes:imageBytes,day:plan[i].day,weak});
      const hit=reuse?await cache.match(plan[i].url):null;
      if(hit){imageBytes+=Number(hit.headers.get('content-length'))||0;saved++;continue;}
      let blob;
      try{blob=await fetchImage(plan[i].url,signal,weak);}
      catch(error){if(error.network&&saved>0){interrupted=true;break;}throw error;}
      imageBytes+=blob.size;if(imageBytes>TRIP_LIMIT)throw fatal('This trip exceeds the 300 MB download limit.');
      // Decoding validates image bytes before declaring the trip ready.
      const bitmap=await createImageBitmap(blob);const tooLarge=bitmap.width*bitmap.height>50000000;bitmap.close();if(tooLarge)throw fatal('An image has excessive dimensions. Use a smaller image URL.');
      await cache.put(plan[i].url,new Response(blob,{headers:{'Content-Type':blob.type,'Content-Length':String(blob.size)}}));saved++;
    }
    signal.throwIfAborted();
    const previous=(await all('downloads')).find(d=>d.id===entry.id);
    const download={id:entry.id,name:entry.meta.name,revision:entry.revision,cacheName,bytes:imageBytes+bytes(entry.trip),imageBytes,imageCount:saved,photoTotal:plan.length,partial:interrupted,downloadedAt:Date.now(),trip:entry.trip};
    await put('downloads',download);
    if(previous?.cacheName&&previous.cacheName!==cacheName)await caches.delete(previous.cacheName);
    progress({completed:saved,total:plan.length,bytes:download.bytes,done:true,partial:interrupted});
    return download;
  }catch(error){if(!reuse)await caches.delete(cacheName);throw error;}
}
export async function deleteDownload(id) {const item=(await all('downloads')).find(d=>d.id===id);if(item)await caches.delete(item.cacheName);await remove('downloads',id);}
export async function removeOrphans() {const used=new Set((await all('downloads')).map(d=>d.cacheName));for(const key of await caches.keys())if(key.startsWith(PREFIX)&&!used.has(key))await caches.delete(key);}

// ---- storage view ----
async function cacheBytes(name) {const cache=await caches.open(name);let total=0;for(const request of await cache.keys()){const response=await cache.match(request);total+=Number(response?.headers.get('content-length'))||0;}return total;}
export async function storageReport(downloads) {
  const estimate=await navigator.storage?.estimate?.().catch(()=>null)||null;
  const trips=[];
  for(const d of downloads) {
    const cache=await caches.has(d.cacheName)?await caches.open(d.cacheName):null,has=async url=>Boolean(cache&&url&&await cache.match(url));
    const plan=photoPlan(d.trip);let cached=0;for(const item of plan)if(await has(item.url))cached++;
    const attractions=[];
    for(const a of [...d.trip.days.flatMap(day=>day.attractions),...(d.trip.wildlife?.species || [])]){const urls=[...new Set(a.photos.flatMap(p=>[p.thumbnailUrl,p.url]).filter(Boolean))];if(!urls.length)continue;let n=0;for(const url of urls)if(await has(url))n++;attractions.push({id:a.id,name:a.name,cached:n,total:urls.length});}
    trips.push({id:d.id,name:d.name,bytes:d.bytes,cached,total:plan.length,attractions});
  }
  const used=new Set(downloads.map(d=>d.cacheName)),names=(await caches.keys()).filter(k=>k.startsWith(PREFIX)&&!used.has(k));
  let orphanBytes=0;for(const name of names)orphanBytes+=await cacheBytes(name);
  return {usage:estimate?.usage??null,quota:estimate?.quota??null,trips,orphanBytes,orphanCount:names.length};
}
// Frees leftover partial downloads and the saved photos of archived trips. Active trips are never touched.
export async function freeUpSpace(downloads,archivedIds) {
  let freed=0;
  for(const d of downloads)if(archivedIds.has(d.id)){freed+=d.bytes;await deleteDownload(d.id);}
  const used=new Set((await all('downloads')).map(d=>d.cacheName));
  for(const key of await caches.keys())if(key.startsWith(PREFIX)&&!used.has(key)){freed+=await cacheBytes(key);await caches.delete(key);}
  return freed;
}
