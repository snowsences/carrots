// Deploy this file as the travel-guide Cloudflare Worker. Store secrets with Wrangler or the Cloudflare dashboard.
const json=(body,status=200,origin='')=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}});
const safeId=value=>String(value||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
const hex=buffer=>[...new Uint8Array(buffer)].map(value=>value.toString(16).padStart(2,'0')).join('');
async function signature(params,secret){const text=Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join('&')+secret;return hex(await crypto.subtle.digest('SHA-1',new TextEncoder().encode(text)));}
async function member(request,env){const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/,'');if(!token)return false;const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});if(!response.ok)return false;const data=await response.json(),allowed=new Set(String(env.ALLOWED_UIDS||'').split(',').map(value=>value.trim()).filter(Boolean));return allowed.has(data.users?.[0]?.localId);}
const delivery=(cloud,publicId,transform)=>`https://res.cloudinary.com/${cloud}/image/upload/${transform}/${publicId.split('/').map(encodeURIComponent).join('/')}`;
export default {async fetch(request,env){
 const origin=request.headers.get('Origin')||'',allowedOrigin=env.ALLOWED_ORIGIN||'https://snowsences.github.io';if(origin!==allowedOrigin)return json({error:'Origin not allowed.'},403,allowedOrigin);if(request.method==='OPTIONS')return json({},204,origin);if(request.method!=='POST'||!await member(request,env))return json({error:'Not authorized.'},401,origin);
 const path=new URL(request.url).pathname.replace(/^\/+|\/+$/g,'');
 if(path==='upload'){
  const data=await request.formData(),file=data.get('file'),tripId=safeId(data.get('tripId')),attractionId=safeId(data.get('attractionId'));if(!(file instanceof File)||!file.type.startsWith('image/')||file.size>10*1024*1024||!tripId||!attractionId)return json({error:'Invalid image upload.'},400,origin);
  const timestamp=Math.floor(Date.now()/1000),folder=`glauco/${tripId}/${attractionId}`,params={folder,timestamp},signed=await signature(params,env.CLOUDINARY_API_SECRET),body=new FormData();body.append('file',file);body.append('folder',folder);body.append('timestamp',timestamp);body.append('api_key',env.CLOUDINARY_API_KEY);body.append('signature',signed);
  const response=await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,{method:'POST',body}),result=await response.json();if(!response.ok)return json({error:'Cloudinary rejected the upload.'},502,origin);return json({publicId:result.public_id,url:delivery(env.CLOUDINARY_CLOUD_NAME,result.public_id,'f_auto,q_auto,w_2400,c_limit'),thumbnailUrl:delivery(env.CLOUDINARY_CLOUD_NAME,result.public_id,'f_auto,q_auto,w_640,c_limit')},200,origin);
 }
 if(path==='destroy'){
  const data=await request.json().catch(()=>({})),ids=Array.isArray(data.publicIds)?data.publicIds.filter(id=>typeof id==='string'&&id.startsWith('glauco/')).slice(0,12):[];for(const public_id of ids){const timestamp=Math.floor(Date.now()/1000),params={public_id,timestamp},signed=await signature(params,env.CLOUDINARY_API_SECRET),body=new URLSearchParams({...params,api_key:env.CLOUDINARY_API_KEY,signature:signed});await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`,{method:'POST',body});}return json({success:true},200,origin);
 }
 return json({error:'Not found.'},404,origin);
}};
