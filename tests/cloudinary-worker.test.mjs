import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import worker from '../cloudinary-worker.js';

test('worker accepts normalized origin and sends a correctly signed prepared image to Cloudinary',async()=>{
 const originalFetch=globalThis.fetch,env={ALLOWED_ORIGIN:'https://snowsences.github.io/',ALLOWED_UIDS:'allowed-user',FIREBASE_API_KEY:'firebase',CLOUDINARY_CLOUD_NAME:' myranker ',CLOUDINARY_API_KEY:' api-key ',CLOUDINARY_API_SECRET:' secret '};let cloudinaryCalled=false;
 globalThis.fetch=async(url,options)=>{
  if(String(url).startsWith('https://identitytoolkit.googleapis.com/'))return Response.json({users:[{localId:'allowed-user'}]});
  assert.equal(url,'https://api.cloudinary.com/v1_1/myranker/image/upload');cloudinaryCalled=true;const body=options.body,timestamp=body.get('timestamp'),folder=body.get('folder'),expected=createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}secret`).digest('hex');assert.equal(body.get('api_key'),'api-key');assert.equal(body.get('signature'),expected);assert.ok(body.get('file') instanceof File);return Response.json({public_id:'glauco/trip/site/photo'});
 };
 try{const body=new FormData();body.append('file',new File(['photo'],'photo.jpg',{type:'image/jpeg'}));body.append('tripId','trip');body.append('attractionId','site');const request=new Request('https://worker.example/upload',{method:'POST',headers:{Origin:'https://snowsences.github.io/','Authorization':'Bearer token'},body}),response=await worker.fetch(request,env),result=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://snowsences.github.io/');assert.equal(cloudinaryCalled,true);assert.match(result.url,/res\.cloudinary\.com\/myranker/);}finally{globalThis.fetch=originalFetch;}
});
