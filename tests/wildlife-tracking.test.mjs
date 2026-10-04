import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWildlifeRecord,normalizeWildlifeOuting,normalizeWildlifeSighting,wildlifeRecordId,outingSightingId,activeOuting,speciesStats,applyWildlifeRecords} from '../wildlife-tracking.js';

test('wildlife records keep notes and a personal default photo',()=>{
 const value=normalizeWildlifeRecord({id:'trip::fox',guideId:'trip',speciesId:'fox',notes:'Seen near the water.',photo:{url:'https://res.cloudinary.com/demo/fox.jpg',thumbnailUrl:'https://res.cloudinary.com/demo/fox-small.jpg',publicId:'glauco/trip/wildlife_fox'},updatedAt:12});
 assert.equal(value.id,wildlifeRecordId('trip','fox'));assert.equal(value.photo.publicId,'glauco/trip/wildlife_fox');
 const trip={id:'trip',wildlife:{species:[{id:'fox',photos:[{url:'https://upload.wikimedia.org/fox.jpg',thumbnailUrl:'https://upload.wikimedia.org/fox-small.jpg'}]}]}};
 assert.equal(applyWildlifeRecords(trip,new Map([[value.id,value]])).wildlife.species[0].photos[0].url,value.photo.url);
});

test('outings and sightings support active sessions and derived species totals',()=>{
 const outing=normalizeWildlifeOuting({id:'outing-1',guideId:'trip',location:'Local refuge',startedAt:'2026-10-04T12:00:00Z',endedAt:'',notes:'',updatedAt:1});
 assert.equal(activeOuting(new Map([[outing.id,outing]]),'trip').id,'outing-1');
 const one=normalizeWildlifeSighting({id:outingSightingId(outing.id,'fox'),guideId:'trip',speciesId:'fox',outingId:outing.id,observedAt:'2026-10-04T12:04:00Z',count:2,notes:'',updatedAt:2});
 const two=normalizeWildlifeSighting({id:'standalone-1',guideId:'trip',speciesId:'fox',observedAt:'2026-10-05T12:00:00Z',count:1,notes:'',updatedAt:3});
 assert.deepEqual(speciesStats(new Map([[one.id,one],[two.id,two]]),'trip','fox'),{count:2,total:3,first:one.observedAt,latest:two.observedAt});
});

test('invalid tracking data is rejected',()=>{
 assert.throws(()=>normalizeWildlifeRecord({id:'wrong',guideId:'trip',speciesId:'fox'}),/does not match/);
 assert.throws(()=>normalizeWildlifeOuting({id:'outing',guideId:'trip',location:'',startedAt:'now'}));
 assert.throws(()=>normalizeWildlifeSighting({id:'s',guideId:'trip',speciesId:'fox',observedAt:'2026-10-04',count:0}),/count/);
});
