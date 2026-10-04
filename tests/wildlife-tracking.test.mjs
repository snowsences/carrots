import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWildlifeRecord,normalizeWildlifeNote,wildlifeRecordId,legacyWildlifeNoteId,speciesNotes,applyWildlifeRecords} from '../wildlife-tracking.js';

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

test('wildlife notes support dated text, optional photos, and newest-first sorting',()=>{
 const older=normalizeWildlifeNote({id:'note-1',guideId:'trip',speciesId:'fox',date:'2026-10-03',note:'Near the water.',createdAt:1,updatedAt:1});
 const newer=normalizeWildlifeNote({id:'note-2',guideId:'trip',speciesId:'fox',date:'2026-10-04',note:'',photo:{url:'https://res.cloudinary.com/demo/note.jpg',thumbnailUrl:'https://res.cloudinary.com/demo/note-small.jpg'},createdAt:2,updatedAt:2});
 const sorted=speciesNotes(new Map([[older.id,older],[newer.id,newer]]),'trip','fox');
 assert.deepEqual(sorted.map(value=>value.id),['note-2','note-1']);assert.equal(legacyWildlifeNoteId('trip','fox'),'trip::fox::legacy-note');
});

test('invalid tracking data is rejected',()=>{
 assert.throws(()=>normalizeWildlifeRecord({id:'wrong',guideId:'trip',speciesId:'fox'}),/does not match/);
 assert.throws(()=>normalizeWildlifeNote({id:'note',guideId:'trip',speciesId:'fox',date:'2026-10-04',note:''}),/needs text or a photo/);
 assert.throws(()=>normalizeWildlifeNote({id:'note',guideId:'trip',speciesId:'fox',date:'2026-02-30',note:'Impossible date'}),/date/);
});
