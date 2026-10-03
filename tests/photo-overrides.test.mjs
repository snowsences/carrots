import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPhotoOverrides,normalizePhotoOverride,overrideRevision,photoOverrideId} from '../photo-overrides.js';

const originalPhoto={url:'https://upload.wikimedia.org/original.jpg',thumbnailUrl:'https://upload.wikimedia.org/thumb.jpg'};
const replacement={url:'https://res.cloudinary.com/myranker/image/upload/full.jpg',thumbnailUrl:'https://res.cloudinary.com/myranker/image/upload/thumb.jpg',publicId:'glauco/trip/site/photo'};
const trip={id:'trip',days:[{id:'day',attractions:[{id:'site',name:'Site',photos:[originalPhoto]}]}],wildlife:{species:[{id:'bird',photos:[originalPhoto]}]}};

test('photo overrides replace attraction galleries without changing wildlife',()=>{
 const value=normalizePhotoOverride({id:photoOverrideId('trip','site'),tripId:'trip',attractionId:'site',photos:[replacement],updatedAt:42});
 const result=applyPhotoOverrides(trip,new Map([[value.id,value]]));
 assert.deepEqual(result.days[0].attractions[0].photos,[replacement]);
 assert.deepEqual(result.wildlife,trip.wildlife);
 assert.deepEqual(trip.days[0].attractions[0].photos,[originalPhoto]);
});

test('photo overrides require safe IDs and HTTPS photos',()=>{
 assert.throws(()=>normalizePhotoOverride({id:'wrong',tripId:'trip',attractionId:'site',photos:[replacement]}),/Invalid photo override/);
 assert.throws(()=>normalizePhotoOverride({id:'trip::site',tripId:'trip',attractionId:'site',photos:[{url:'http://example.com/photo.jpg'}]}),/Invalid replacement photo/);
 assert.throws(()=>normalizePhotoOverride({id:'trip::site',tripId:'trip',attractionId:'site',photos:Array(13).fill(replacement)}),/Invalid photo override/);
});

test('photo revision is the newest replacement timestamp for one trip',()=>{
 const values=new Map([
  ['trip::one',{tripId:'trip',updatedAt:10}],
  ['trip::two',{tripId:'trip',updatedAt:25}],
  ['other::one',{tripId:'other',updatedAt:99}],
 ]);
 assert.equal(overrideRevision(values,'trip'),25);
 assert.equal(overrideRevision(values,'missing'),0);
});
