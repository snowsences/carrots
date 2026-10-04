const COMPONENT=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
const DOC=/^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,249}$/;
const cleanText=(value,max,label,required=false)=>{if(value==null&&!required)return '';if(typeof value!=='string')throw new Error(`${label} must be text.`);const result=value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,'').trim();if((required&&!result)||result.length>max)throw new Error(`${label} is invalid.`);return result;};
const component=(value,label)=>{const result=cleanText(value,100,label,true);if(!COMPONENT.test(result))throw new Error(`${label} is invalid.`);return result;};
const docId=(value,label)=>{const result=cleanText(value,250,label,true);if(!DOC.test(result))throw new Error(`${label} is invalid.`);return result;};
const time=(value,label,required=true)=>{const result=cleanText(value,40,label,required);if(!result&&!required)return '';if(!Number.isFinite(Date.parse(result)))throw new Error(`${label} is invalid.`);return new Date(result).toISOString();};
const cleanPhoto=value=>{if(!value)return null;if(typeof value!=='object')throw new Error('Wildlife photo is invalid.');const cleanUrl=input=>{if(typeof input!=='string'||input.length>2000)return '';try{const parsed=new URL(input);return parsed.protocol==='https:'?parsed.href:'';}catch{return '';}};const url=cleanUrl(value.url),thumbnailUrl=cleanUrl(value.thumbnailUrl||value.url),publicId=cleanText(value.publicId,300,'Photo ID');if(!url||!thumbnailUrl)throw new Error('Wildlife photo is invalid.');return {url,thumbnailUrl,...(publicId?{publicId}:{})};};

export const wildlifeRecordId=(guideId,speciesId)=>`${guideId}::${speciesId}`;
export const outingSightingId=(outingId,speciesId)=>`${outingId}::${speciesId}`;

export function normalizeWildlifeRecord(value){
 if(!value||typeof value!=='object')throw new Error('Wildlife record is invalid.');
 const guideId=component(value.guideId,'Guide ID'),speciesId=component(value.speciesId,'Species ID'),id=docId(value.id,'Wildlife record ID');
 if(id!==wildlifeRecordId(guideId,speciesId))throw new Error('Wildlife record ID does not match.');
 const photo=cleanPhoto(value.photo);
 return {id,guideId,speciesId,notes:cleanText(value.notes,5000,'Species notes'),...(photo?{photo}:{}),updatedAt:Number.isFinite(value.updatedAt)?value.updatedAt:0};
}

export function normalizeWildlifeOuting(value){
 if(!value||typeof value!=='object')throw new Error('Outing is invalid.');
 return {id:docId(value.id,'Outing ID'),guideId:component(value.guideId,'Guide ID'),location:cleanText(value.location,180,'Outing location',true),startedAt:time(value.startedAt,'Outing start'),endedAt:time(value.endedAt,'Outing end',false),notes:cleanText(value.notes,2000,'Outing notes'),updatedAt:Number.isFinite(value.updatedAt)?value.updatedAt:0};
}

export function normalizeWildlifeSighting(value){
 if(!value||typeof value!=='object')throw new Error('Sighting is invalid.');
 const count=Number(value.count??1);if(!Number.isInteger(count)||count<1||count>9999)throw new Error('Sighting count is invalid.');
 return {id:docId(value.id,'Sighting ID'),guideId:component(value.guideId,'Guide ID'),speciesId:component(value.speciesId,'Species ID'),outingId:value.outingId?docId(value.outingId,'Outing ID'):'',observedAt:time(value.observedAt,'Observation time'),count,notes:cleanText(value.notes,2000,'Sighting notes'),updatedAt:Number.isFinite(value.updatedAt)?value.updatedAt:0};
}

export const activeOuting=(outings,guideId)=>[...outings.values()].filter(value=>value.guideId===guideId&&!value.endedAt).sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0]||null;
export const guideOutings=(outings,guideId)=>[...outings.values()].filter(value=>value.guideId===guideId).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
export const speciesSightings=(sightings,guideId,speciesId)=>[...sightings.values()].filter(value=>value.guideId===guideId&&value.speciesId===speciesId).sort((a,b)=>b.observedAt.localeCompare(a.observedAt));
export function speciesStats(sightings,guideId,speciesId){const matches=speciesSightings(sightings,guideId,speciesId);return {count:matches.length,total:matches.reduce((sum,item)=>sum+item.count,0),first:matches.at(-1)?.observedAt||'',latest:matches[0]?.observedAt||''};}

export function applyWildlifeRecords(trip,records){
 if(!trip.wildlife)return trip;let changed=false;
 const species=trip.wildlife.species.map(item=>{const record=records.get(wildlifeRecordId(trip.id,item.id));if(!record?.photo)return item;changed=true;const photos=[record.photo,...item.photos.filter(photo=>photo.url!==record.photo.url)];return {...item,photos};});
 return changed?{...trip,wildlife:{...trip.wildlife,species}}:trip;
}
