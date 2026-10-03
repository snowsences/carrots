import {config} from './config.js';
const MAX_SOURCE=30*1024*1024,MAX_EDGE=2400,MAX_UPLOAD=8*1024*1024;
export const uploadConfigured=()=>/^https:\/\//.test(config.cloudinary?.workerUrl||'');
async function bitmap(file){try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch{const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}}}
const jpeg=(canvas,quality)=>new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('The image could not be prepared.')),'image/jpeg',quality));
export async function prepareAttractionPhoto(file){
 if(!file?.type.startsWith('image/'))throw new Error('Choose an image file.');if(file.size>MAX_SOURCE)throw new Error('The image is larger than 30 MB.');
 const source=await bitmap(file),sourceWidth=source.naturalWidth||source.width,sourceHeight=source.naturalHeight||source.height,canvas=document.createElement('canvas'),context=canvas.getContext('2d',{alpha:false});let edge=MAX_EDGE,quality=.86,blob;
 try{for(let attempt=0;attempt<5;attempt++){const scale=Math.min(1,edge/Math.max(sourceWidth,sourceHeight));canvas.width=Math.max(1,Math.round(sourceWidth*scale));canvas.height=Math.max(1,Math.round(sourceHeight*scale));context.drawImage(source,0,0,canvas.width,canvas.height);blob=await jpeg(canvas,quality);if(blob.size<=MAX_UPLOAD)break;edge=Math.max(1200,Math.round(edge*.82));quality=Math.max(.68,quality-.06);}}finally{source.close?.();}
 if(!blob||blob.size>MAX_UPLOAD)throw new Error('The image could not be reduced below 8 MB.');return new File([blob],`${file.name.replace(/\.[^.]+$/,'')||'photo'}.jpg`,{type:'image/jpeg'});
}
const workerUrl=path=>new URL(path,config.cloudinary.workerUrl).href;
export async function uploadAttractionPhoto(file,context,token){
 if(!uploadConfigured())throw new Error('Photo uploads are not configured.');const prepared=await prepareAttractionPhoto(file),body=new FormData();body.append('file',prepared);body.append('tripId',context.tripId);body.append('attractionId',context.attractionId);
 const response=await fetch(workerUrl('upload'),{method:'POST',headers:{Authorization:`Bearer ${token}`},body});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'The photo could not be uploaded.');if(!/^https:\/\/res\.cloudinary\.com\//.test(data.url)||!/^https:\/\/res\.cloudinary\.com\//.test(data.thumbnailUrl)||typeof data.publicId!=='string')throw new Error('The upload service returned an invalid photo.');return {url:data.url,thumbnailUrl:data.thumbnailUrl,publicId:data.publicId};
}
export async function destroyAttractionPhotos(publicIds,token){if(!uploadConfigured()||!publicIds.length)return;for(let offset=0;offset<publicIds.length;offset+=12)await fetch(workerUrl('destroy'),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({publicIds:publicIds.slice(offset,offset+12)})}).catch(()=>{});}
