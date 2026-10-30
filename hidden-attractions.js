const part=(value,label)=>{
 if(typeof value!=='string'||!value||value.length>200||!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value))throw new Error(`${label} is invalid.`);
 return value;
};

export const hiddenAttractionId=(guideId,dayId,attractionId)=>`${part(guideId,'Guide ID')}::${part(dayId,'Place ID')}::${part(attractionId,'Attraction ID')}`;

export function normalizeHiddenAttraction(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Hidden attraction must be an object.');
 const guideId=part(raw.guideId,'Guide ID'),dayId=part(raw.dayId,'Place ID'),attractionId=part(raw.attractionId,'Attraction ID'),id=hiddenAttractionId(guideId,dayId,attractionId),updatedAt=Number(raw.updatedAt);
 if(raw.id!==id)throw new Error('Hidden attraction ID does not match its guide, place, and attraction.');
 if(!Number.isFinite(updatedAt)||updatedAt<0)throw new Error('Hidden attraction update time is invalid.');
 return {id,guideId,dayId,attractionId,updatedAt};
}
