const ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
const cleanUrl=value=>{if(typeof value!=='string'||value.length>2000)return '';try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
export const photoOverrideId=(tripId,attractionId)=>`${tripId}::${attractionId}`;
export function normalizePhotoOverride(value){
 if(!value||typeof value!=='object'||!ID.test(value.tripId)||!ID.test(value.attractionId)||value.id!==photoOverrideId(value.tripId,value.attractionId)||!Array.isArray(value.photos)||value.photos.length>12)throw new Error('Invalid photo override.');
 const photos=value.photos.map(photo=>{const url=cleanUrl(photo?.url),thumbnailUrl=cleanUrl(photo?.thumbnailUrl||photo?.url),publicId=typeof photo?.publicId==='string'&&photo.publicId.length<=300?photo.publicId:'';if(!url||!thumbnailUrl)throw new Error('Invalid replacement photo.');return {url,thumbnailUrl,...(publicId?{publicId}:{})};});
 if(!photos.length)throw new Error('A replacement gallery needs at least one photo.');
 return {id:value.id,tripId:value.tripId,attractionId:value.attractionId,photos,updatedAt:Number.isFinite(value.updatedAt)?value.updatedAt:0};
}
export function applyPhotoOverrides(trip,overrides){
 let changed=false;const days=trip.days.map(day=>{let dayChanged=false;const attractions=day.attractions.map(attraction=>{const override=overrides.get(photoOverrideId(trip.id,attraction.id));if(!override)return attraction;changed=dayChanged=true;return {...attraction,photos:override.photos};});return dayChanged?{...day,attractions}:day;});return changed?{...trip,days}:trip;
}
export function overrideRevision(overrides,tripId){let revision=0;for(const value of overrides.values())if(value.tripId===tripId)revision=Math.max(revision,value.updatedAt);return revision;}
