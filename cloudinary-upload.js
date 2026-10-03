import {config} from './config.js';
const MAX_SOURCE=30*1024*1024,MAX_EDGE=2400;
export const uploadConfigured=()=>/^https:\/\//.test(config.cloudinary?.workerUrl||'');
async function bitmap(file){try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch{const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}}}
async function prepare(file){
 if(!file?.type.startsWith('image/'))throw new Error('Choose an image file.');if(file.size>MAX_SOURCE)throw new Error('The image is larger than 30 MB.');
 const source=await bitmap(file),sourceWidth=source.naturalWidth||source.width,sourceHeight=source.naturalHeight||source.height,scale=Math.min(1,MAX_EDGE/Math.max(sourceWidth,sourceHeight)),width=Math.max(1,Math.round(sourceWidth*scale)),height=Math.max(1,Math.round(sourceHeight*scale)),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d',{alpha:false}).drawImage(source,0,0,width,height);source.close?.();
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('The image could not be prepared.')),'image/jpeg',.88));return new File([blob],`${file.name.replace(/\.[^.]+$/,'')||'photo'}.jpg`,{type:'image/jpeg'});
}
const workerUrl=path=>new URL(path,config.cloudinary.workerUrl).href;
export async function uploadAttractionPhoto(file,context,token){
 if(!uploadConfigured())throw new Error('Photo uploads are not configured.');const prepared=await prepare(file),body=new FormData();body.append('file',prepared);body.append('tripId',context.tripId);body.append('attractionId',context.attractionId);
 const response=await fetch(workerUrl('upload'),{method:'POST',headers:{Authorization:`Bearer ${token}`},body});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'The photo could not be uploaded.');if(!/^https:\/\/res\.cloudinary\.com\//.test(data.url)||!/^https:\/\/res\.cloudinary\.com\//.test(data.thumbnailUrl)||typeof data.publicId!=='string')throw new Error('The upload service returned an invalid photo.');return {url:data.url,thumbnailUrl:data.thumbnailUrl,publicId:data.publicId};
}
export async function destroyAttractionPhotos(publicIds,token){if(!uploadConfigured()||!publicIds.length)return;for(let offset=0;offset<publicIds.length;offset+=12)await fetch(workerUrl('destroy'),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({publicIds:publicIds.slice(offset,offset+12)})}).catch(()=>{});}
