const NAME = 'glauco-local-v1';
let promise;
export function openDB() {
  if (!promise) promise = new Promise((resolve,reject)=>{
    const request = indexedDB.open(NAME,2);
    request.onupgradeneeded = () => { for (const name of ['trips','outbox','downloads','overrides'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'}); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => {promise=null;reject(request.error);};
  });
  return promise;
}
export async function all(store) { const db=await openDB(); return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}); }
export async function get(store,id) { const db=await openDB(); return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}); }
export async function change(operations) {
  const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction([...new Set(operations.map(o=>o.store))],'readwrite');
    for(const o of operations) {const s=tx.objectStore(o.store); if(o.type==='delete')s.delete(o.id);else if(o.type==='clear')s.clear();else s.put(o.value);}
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
export const put=(store,value)=>change([{store,value}]);
export const remove=(store,id)=>change([{store,type:'delete',id}]);
export async function clearPrivate() {await change(['trips','outbox','downloads','overrides'].map(store=>({store,type:'clear'})));for(const name of await caches.keys())if(name.startsWith('glauco-trip-'))await caches.delete(name);}
