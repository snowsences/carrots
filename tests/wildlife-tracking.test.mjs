import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWildlifeRecord,normalizeWildlifeOuting,normalizeWildlifeSighting,wildlifeRecordId,outingSightingId,activeOuting,applyWildlifeRecords} from '../wildlife-tracking.js';

test('wildlife records keep notes and a personal default photo',()=>{
 const value=normalizeWildlifeRecord({id:'trip::fox',guideId:'trip',speciesId:'fox',seen:true,seenMigrated:true,notes:'Seen near the water.',photo:{url:'https://res.cloudinary.com/demo/fox.jpg',thumbnailUrl:'https://res.cloudinary.com/demo/fox-small.jpg',publicId:'glauco/trip/wildlife_fox'},updatedAt:12});
 assert.equal(value.id,wildlifeRecordId('trip','fox'));assert.equal(value.seen,true);assert.equal(value.seenMigrated,true);assert.equal(value.photo.publicId,'glauco/trip/wildlife_fox');
 const trip={id:'trip',wildlife:{species:[{id:'fox',photos:[{url:'https://upload.wikimedia.org/fox.jpg',thumbnailUrl:'https://upload.wikimedia.org/fox-small.jpg'}]}]}};
 assert.equal(applyWildlifeRecords(trip,new Map([[value.id,value]])).wildlife.species[0].photos[0].url,value.photo.url);
});

test('seen is a date-free boolean and defaults to false',()=>{
 const unseen=normalizeWildlifeRecord({id:'trip::fox',guideId:'trip',speciesId:'fox',seen:'2026-10-04',updatedAt:1});
 assert.equal(unseen.seen,false);assert.equal(unseen.seenMigrated,false);assert.equal('seenAt' in unseen,false);
});

test('outings retain dated checklist entries without adding a species-level seen date',()=>{
 const outing=normalizeWildlifeOuting({id:'outing-1',guideId:'trip',location:'Local refuge',startedAt:'2026-10-04T12:00:00Z',endedAt:'',notes:'',updatedAt:1});
 assert.equal(activeOuting(new Map([[outing.id,outing]]),'trip').id,'outing-1');
 const one=normalizeWildlifeSighting({id:outingSightingId(outing.id,'fox'),guideId:'trip',speciesId:'fox',outingId:outing.id,observedAt:'2026-10-04T12:04:00Z',count:2,notes:'',updatedAt:2});
 assert.equal(one.outingId,outing.id);assert.equal(one.observedAt,'2026-10-04T12:04:00.000Z');assert.equal('seenAt' in one,false);
});

test('invalid tracking data is rejected',()=>{
 assert.throws(()=>normalizeWildlifeRecord({id:'wrong',guideId:'trip',speciesId:'fox'}),/does not match/);
 assert.throws(()=>normalizeWildlifeOuting({id:'outing',guideId:'trip',location:'',startedAt:'now'}));
 assert.throws(()=>normalizeWildlifeSighting({id:'s',guideId:'trip',speciesId:'fox',observedAt:'2026-10-04',count:0}),/count/);
});
