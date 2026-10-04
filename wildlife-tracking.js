const COMPONENT=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
const DOC=/^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,249}$/;
const cleanText=(value,max,label,required=false)=>{if(value==null&&!required)return '';if(typeof value!=='string')throw new Error(`${label} must be text.`);const result=value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,'').trim();if((required&&!result)||result.length>max)throw new Error(`${label} is invalid.`);return result;};
const component=(value,label)=>{const result=cleanText(value,100,label,true);if(!COMPONENT.test(result))throw new Error(`${label} is invalid.`);return result;};
const docId=(value,label)=>{const result=cleanText(value,250,label,true);if(!DOC.test(result))throw new Error(`${label} is invalid.`);return result;};
const date=(value,label)=>{const result=cleanText(value,10,label,true);if(!/^\d{4}-\d{2}-\d{2}$/.test(result)||new Date(`${result}T12:00:00Z`).toISOString().slice(0,10)!==result)throw new Error(`${label} is invalid.`);return result;};
const cleanPhoto=value=>{if(!value)return null;if(typeof value!=='object')throw new Error('Wildlife photo is invalid.');const cleanUrl=input=>{if(typeof input!=='string'||input.length>2000)return '';try{const parsed=new URL(input);return parsed.protocol==='https:'?parsed.href:'';}catch{return '';}};const url=cleanUrl(value.url),thumbnailUrl=cleanUrl(value.thumbnailUrl||value.url),publicId=cleanText(value.publicId,300,'Photo ID');if(!url||!thumbnailUrl)throw new Error('Wildlife photo is invalid.');return {url,thumbnailUrl,...(publicId?{publicId}:{})};};

export const wildlifeRecordId=(guideId,speciesId)=>`${guideId}::${speciesId}`;
export const legacyWildlifeNoteId=(guideId,speciesId)=>`${guideId}::${speciesId}::legacy-note`;
export const UNIDENTIFIED_SPECIES_ID='journal-unidentified';

export function normalizeWildlifeRecord(value){
 if(!value||typeof value!=='object')throw new Error('Wildlife record is invalid.');
 const guideId=component(value.guideId,'Guide ID'),speciesId=component(value.speciesId,'Species ID'),id=docId(value.id,'Wildlife record ID');
 if(id!==wildlifeRecordId(guideId,speciesId))throw new Error('Wildlife record ID does not match.');
 const photo=cleanPhoto(value.photo);
 return {id,guideId,speciesId,seen:value.seen===true,seenMigrated:value.seenMigrated===true,notesMigrated:value.notesMigrated===true,notes:cleanText(value.notes,5000,'Species notes'),...(photo?{photo}:{}),updatedAt:Number.isFinite(value.updatedAt)?value.updatedAt:0};
}

export function normalizeWildlifeNote(value){
 if(!value||typeof value!=='object')throw new Error('Wildlife note is invalid.');
 const id=docId(value.id,'Wildlife note ID'),guideId=component(value.guideId,'Guide ID'),speciesId=component(value.speciesId,'Species ID'),note=cleanText(value.note,5000,'Wildlife note'),photo=cleanPhoto(value.photo);
 if(!note&&!photo)throw new Error('A wildlife note needs text or a photo.');
 return {id,guideId,speciesId,date:date(value.date,'Wildlife note date'),note,...(photo?{photo}:{}),createdAt:Number.isFinite(value.createdAt)?value.createdAt:0,updatedAt:Number.isFinite(value.updatedAt)?value.updatedAt:0};
}

export const speciesNotes=(notes,guideId,speciesId)=>[...notes.values()].filter(value=>value.guideId===guideId&&value.speciesId===speciesId).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt||b.updatedAt-a.updatedAt);
export const guideNotes=(notes,guideId)=>[...notes.values()].filter(value=>value.guideId===guideId).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt||b.updatedAt-a.updatedAt);

export function applyWildlifeRecords(trip,records){
 if(!trip.wildlife)return trip;let changed=false;
 const species=trip.wildlife.species.map(item=>{const record=records.get(wildlifeRecordId(trip.id,item.id));if(!record?.photo)return item;changed=true;const photos=[record.photo,...item.photos.filter(photo=>photo.url!==record.photo.url)];return {...item,photos};});
 return changed?{...trip,wildlife:{...trip.wildlife,species}}:trip;
}
