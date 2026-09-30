import {photoUrls,bytes,uid} from './model.js';
import {all,put,remove} from './storage.js';
const PREFIX='glauco-trip-';
export async function downloadTrip(entry,progress,signal) {
  const urls=photoUrls(entry.trip), cacheName=`${PREFIX}${entry.id}-${uid()}`;
  const cache=await caches.open(cacheName);let imageBytes=0;
  try {
    for(let i=0;i<urls.length;i++) {
      signal.throwIfAborted();progress({completed:i,total:urls.length,bytes:imageBytes});
      const response=await fetch(urls[i],{mode:'cors',credentials:'omit',signal,cache:'no-cache'});
      if(!response.ok || !/^image\/(jpeg|png|webp|avif|gif)/i.test(response.headers.get('content-type')||''))throw new Error('An image could not be downloaded. Check the image URL and that its host permits browser downloads.');
      const limit=8*1024*1024;
      if(Number(response.headers.get('content-length'))>limit)throw new Error('An image is larger than 8 MB. Use a smaller image URL in the trip file.');
      const reader=response.body.getReader(),chunks=[];let length=0;
      try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw new Error('An image is larger than 8 MB. Use a smaller image URL in the trip file.');}chunks.push(value);}}finally{reader.releaseLock();}
      const blob=new Blob(chunks,{type:response.headers.get('content-type').split(';')[0]});
      imageBytes+=blob.size;if(imageBytes>300*1024*1024)throw new Error('This trip exceeds the 300 MB download limit.');
      // Decoding validates image bytes before declaring the trip ready.
      const bitmap=await createImageBitmap(blob);const tooLarge=bitmap.width*bitmap.height>50000000;bitmap.close();if(tooLarge)throw new Error('An image has excessive dimensions. Use a smaller image URL.');
      await cache.put(urls[i],new Response(blob,{headers:{'Content-Type':blob.type,'Content-Length':String(blob.size)}}));
    }
    signal.throwIfAborted();
    const previous=(await all('downloads')).find(d=>d.id===entry.id);
    const download={id:entry.id,name:entry.meta.name,revision:entry.revision,cacheName,bytes:imageBytes+bytes(entry.trip),imageBytes,imageCount:urls.length,downloadedAt:Date.now(),trip:entry.trip};
    await put('downloads',download);
    if(previous?.cacheName)await caches.delete(previous.cacheName);
    progress({completed:urls.length,total:urls.length,bytes:download.bytes,done:true});
    return download;
  }catch(error){await caches.delete(cacheName);throw error;}
}
export async function deleteDownload(id) {const item=(await all('downloads')).find(d=>d.id===id);if(item)await caches.delete(item.cacheName);await remove('downloads',id);}
export async function removeOrphans() {const used=new Set((await all('downloads')).map(d=>d.cacheName));for(const key of await caches.keys())if(key.startsWith(PREFIX)&&!used.has(key))await caches.delete(key);}
