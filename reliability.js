
export function sameValue(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&sameValue(a[k],b[k]))}
export function changedFields(base,next){return [...new Set([...Object.keys(base||{}),...Object.keys(next||{})])].filter(k=>k!=='updatedAt'&&!sameValue(base?.[k],next?.[k]))}
export function reconcilePersonal(base,next,remote,fields=changedFields(base,next)){
 if(!remote&&base)throw Error('PERSONAL_CONFLICT: the entry was removed elsewhere.');
 if(!remote)return next;
 const result={...remote};for(const k of fields){if(!sameValue(remote[k],base?.[k])&&!sameValue(remote[k],next[k]))throw Error('PERSONAL_CONFLICT: '+k+' changed elsewhere.');if(Object.hasOwn(next,k))result[k]=next[k];else delete result[k];}
 result.updatedAt=Math.max(next.updatedAt||0,remote.updatedAt||0);return result;
}
export const taxonName=s=>String(s.scientificName||'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
export function guideWarnings(trip){const counts=new Map();for(const s of trip.wildlife?.species||[]){const key=s.kind+':'+taxonName(s);counts.set(key,(counts.get(key)||0)+1)}return [...counts].filter(([k,n])=>n>1).map(([k,n])=>n+' entries share '+k.slice(k.indexOf(':')+1))}
export function preserveSpeciesIds(oldTrip,nextTrip){
 const old=oldTrip.wildlife?.species||[],next=nextTrip.wildlife?.species||[],key=s=>s.kind+':'+taxonName(s),oldByKey=new Map(),newByKey=new Map(),used=new Set(next.map(s=>s.id)),remapped=[];
 for(const s of old){const k=key(s);oldByKey.set(k,[...(oldByKey.get(k)||[]),s])}for(const s of next){const k=key(s);newByKey.set(k,[...(newByKey.get(k)||[]),s])}
 const species=next.map(s=>{const matches=oldByKey.get(key(s))||[],oldMatch=matches[0];if(matches.length===1&&newByKey.get(key(s)).length===1&&oldMatch.id!==s.id&&!used.has(oldMatch.id)){remapped.push({from:s.id,to:oldMatch.id,name:s.name});return {...s,id:oldMatch.id}}return s});
 return {trip:nextTrip.wildlife?{...nextTrip,wildlife:{...nextTrip.wildlife,species}}:nextTrip,remapped};
}
export function revisionDiff(oldTrip,newTrip){
 const compare=(old,next)=>{const a=new Map(old.map(x=>[x.id,x])),b=new Map(next.map(x=>[x.id,x]));return {added:next.filter(x=>!a.has(x.id)),removed:old.filter(x=>!b.has(x.id)),modified:next.filter(x=>a.has(x.id)&&!sameValue(a.get(x.id),x)),reused:next.filter(x=>a.has(x.id)&&x.scientificName&&a.get(x.id).scientificName&&taxonName(x)!==taxonName(a.get(x.id)))}};
 return {species:compare(oldTrip.wildlife?.species||[],newTrip.wildlife?.species||[]),attractions:compare(oldTrip.days.flatMap(d=>d.attractions),newTrip.days.flatMap(d=>d.attractions))};
}
