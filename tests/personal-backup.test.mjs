import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersonalBackup,parsePersonalBackup,mergePersonalBackup,personalBackupCount} from '../personal-backup.js';

const photo={url:'https://res.cloudinary.com/demo/image/upload/example.jpg',thumbnailUrl:'https://res.cloudinary.com/demo/image/upload/w_640/example.jpg',publicId:'glauco/example'};
const override={id:'trip::site',tripId:'trip',attractionId:'site',photos:[photo],updatedAt:30};
const record={id:'guide::bird',guideId:'guide',speciesId:'bird',seen:true,photo,updatedAt:20};
const note={id:'note-1',guideId:'guide',speciesId:'bird',date:'2026-10-08',note:'Seen by the pond.',photo,createdAt:10,updatedAt:10};

test('creates and parses a personal-data-only backup',()=>{
 const backup=createPersonalBackup({photoOverrides:[override],wildlifeRecords:[record],wildlifeNotes:[note]},'2026-10-08T20:00:00.000Z');
 assert.equal(backup.format,'carrots-personal-data');
 assert.equal(personalBackupCount(backup.data),3);
 assert.deepEqual(parsePersonalBackup(JSON.stringify(backup)),backup);
 assert.equal('trips' in backup.data,false);
 assert.equal('downloads' in backup.data,false);
});

test('rejects guidebook JSON and malformed records',()=>{
 assert.throws(()=>parsePersonalBackup('{"format":"glauco-trip-file","version":6}'),/not a supported/);
 const backup=createPersonalBackup({photoOverrides:[],wildlifeRecords:[],wildlifeNotes:[]});
 backup.data.wildlifeRecords=[{...record,id:'wrong'}];
 assert.throws(()=>parsePersonalBackup(backup),/does not match/);
});

test('restores missing and newer records without overwriting newer current data',()=>{
 const backup=createPersonalBackup({photoOverrides:[override],wildlifeRecords:[record],wildlifeNotes:[note]});
 const merged=mergePersonalBackup(backup,{photoOverrides:new Map([[override.id,{...override,updatedAt:40}]]),wildlifeRecords:new Map(),wildlifeNotes:new Map([[note.id,{...note,updatedAt:10}]])});
 assert.deepEqual(merged.photoOverrides,[]);
 assert.equal(merged.wildlifeRecords.length,1);
 assert.equal(merged.wildlifeRecords[0].id,record.id);
 assert.deepEqual(merged.wildlifeNotes,[]);
});
