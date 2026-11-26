
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

// Advisory content checks after schema validation; no network requests.
export function importQualityReport(trip){
 const species=trip.wildlife?.species||[],sites=(trip.days||[]).flatMap(day=>(day.attractions||[]).map(a=>({...a,place:day.title||''}))),issues=[];
 const photos=item=>new Set((item.photos||[]).map(p=>p.url).filter(Boolean));
 const label=s=>s.name+(s.scientificName?' ('+s.scientificName+')':s.place?' — '+s.place:'');
 const group=(id,severity,title,description,items)=>{if(items.length)issues.push({id,severity,title,description,items});};
 const check=(id,severity,title,description,rows,predicate)=>group(id,severity,title,description,rows.filter(predicate).map(label));
 check('species-no-photos','warning','Species without photographs','These species cannot appear as photograph-identification questions.',species,s=>photos(s).size===0);
 check('species-one-photo','warning','Species with only one distinct photograph','Add different views of the same species to improve recognition practice.',species,s=>photos(s).size===1);
 const taxa=new Map();for(const s of species){const key=s.kind+':'+taxonName(s);if(taxonName(s))taxa.set(key,[...(taxa.get(key)||[]),s]);}
 group('duplicate-taxa','warning','Potentially duplicated scientific names','Review these groups before importing. They may represent duplicate taxa.',[...taxa.values()].filter(rows=>rows.length>1).map(rows=>rows[0].scientificName+': '+rows.map(s=>s.name+' ['+s.id+']').join(', ')));
 check('species-no-lookalikes','info','Species without lookalike comparisons','Explicit distinctions help the game explain mistakes and select plausible alternatives.',species,s=>!s.lookalikes?.length);
 check('species-no-sources','info','Species without cited sources','Add references so identification and descriptive claims can be checked.',species,s=>!s.sources?.length);
 check('species-no-wikipedia','info','Species without Wikipedia links','Optional reference links are missing.',species,s=>!s.wikipediaUrl);
 check('attractions-no-photos','warning','Attractions without photographs','These entries will use a placeholder rather than a reference image.',sites,s=>photos(s).size===0);
 check('attractions-no-sources','info','Attractions without cited sources','Add references for historical or descriptive claims.',sites,s=>!s.sources?.length);
 check('attractions-no-wikipedia','info','Attractions without Wikipedia links','Optional reference links are missing.',sites,s=>!s.wikipediaUrl);
 check('repeated-photos','warning','Entries with repeated photo URLs','Repeated URLs within the same entry do not provide additional visual variety.',[...species,...sites],s=>(s.photos||[]).filter(p=>p.url).length>photos(s).size);
 const photoOwners=new Map();for(const s of species)for(const url of photos(s))photoOwners.set(url,[...(photoOwners.get(url)||[]),s]);
 group('shared-species-photos','warning','Photographs shared by different species','Check that each image depicts the intended species. Shared photographs may make quiz questions ambiguous.',[...photoOwners.values()].filter(rows=>new Set(rows.map(s=>s.kind+':'+taxonName(s))).size>1).map(rows=>rows.map(label).join(' / ')));
 const photographed=species.filter(s=>photos(s).size>0),distinctByKind=new Map();for(const s of photographed){if(!distinctByKind.has(s.kind))distinctByKind.set(s.kind,new Set());distinctByKind.get(s.kind).add(taxonName(s)||s.id);}
 group('small-quiz-pools','warning','Wildlife categories with too few quiz candidates','At least two distinct photographed species of the same kind are needed for a question.', ['flora','fauna'].filter(kind=>species.some(s=>s.kind===kind)&&(distinctByKind.get(kind)?.size||0)<2).map(kind=>(kind==='flora'?'Plants':'Animals')+': '+(distinctByKind.get(kind)?.size||0)+' distinct photographed species'));
 const photoUrls=new Set([trip.headerUrl,trip.coverUrl,...(trip.glossary||[]).flatMap(g=>[g.photo?.url,g.photo?.thumbnailUrl]),...[...species,...sites].flatMap(s=>(s.photos||[]).flatMap(p=>[p.url,p.thumbnailUrl]))].filter(Boolean));
 return {species:species.length,plants:species.filter(s=>s.kind==='flora').length,animals:species.filter(s=>s.kind==='fauna').length,attractions:sites.length,photoUrls:photoUrls.size,issues,warnings:issues.filter(x=>x.severity==='warning').length,suggestions:issues.filter(x=>x.severity==='info').length};
}
