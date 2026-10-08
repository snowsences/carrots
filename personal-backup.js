import {normalizePhotoOverride} from './photo-overrides.js';
import {normalizeWildlifeRecord,normalizeWildlifeNote} from './wildlife-tracking.js';

export const PERSONAL_BACKUP_FORMAT='carrots-personal-data';
export const PERSONAL_BACKUP_VERSION=1;
const LIMITS={photoOverrides:5000,wildlifeRecords:50000,wildlifeNotes:100000};

const unique=(values,label)=>{
 const result=new Map();
 for(const value of values){if(result.has(value.id))throw new Error(`${label} contains duplicate IDs.`);result.set(value.id,value);}
 return [...result.values()];
};

const cleanList=(value,key,normalize)=>{
 if(!Array.isArray(value))throw new Error(`${key} must be a list.`);
 if(value.length>LIMITS[key])throw new Error(`${key} contains too many records.`);
 return unique(value.map(normalize),key);
};

export function createPersonalBackup({photoOverrides=[],wildlifeRecords=[],wildlifeNotes=[]},exportedAt=new Date().toISOString()){
 return {
  format:PERSONAL_BACKUP_FORMAT,
  version:PERSONAL_BACKUP_VERSION,
  exportedAt,
  data:{
   photoOverrides:cleanList([...photoOverrides],'photoOverrides',normalizePhotoOverride),
   wildlifeRecords:cleanList([...wildlifeRecords],'wildlifeRecords',normalizeWildlifeRecord),
   wildlifeNotes:cleanList([...wildlifeNotes],'wildlifeNotes',normalizeWildlifeNote)
  }
 };
}

export function parsePersonalBackup(source){
 let raw;
 try{raw=typeof source==='string'?JSON.parse(source):source;}catch{throw new Error('This is not valid JSON.');}
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.format!==PERSONAL_BACKUP_FORMAT||raw.version!==PERSONAL_BACKUP_VERSION||!raw.data||typeof raw.data!=='object'||Array.isArray(raw.data))throw new Error('This is not a supported Carrots personal-data backup.');
 if(typeof raw.exportedAt!=='string'||!Number.isFinite(Date.parse(raw.exportedAt)))throw new Error('The backup date is invalid.');
 return createPersonalBackup({
  photoOverrides:raw.data.photoOverrides,
  wildlifeRecords:raw.data.wildlifeRecords,
  wildlifeNotes:raw.data.wildlifeNotes
 },new Date(raw.exportedAt).toISOString());
}

const newer=(incoming,current)=>!current||incoming.updatedAt>current.updatedAt;
export function mergePersonalBackup(backup,current){
 const data=backup.data||backup;
 return {
  photoOverrides:data.photoOverrides.filter(value=>newer(value,current.photoOverrides.get(value.id))),
  wildlifeRecords:data.wildlifeRecords.filter(value=>newer(value,current.wildlifeRecords.get(value.id))),
  wildlifeNotes:data.wildlifeNotes.filter(value=>newer(value,current.wildlifeNotes.get(value.id)))
 };
}

export const personalBackupCount=data=>data.photoOverrides.length+data.wildlifeRecords.length+data.wildlifeNotes.length;
