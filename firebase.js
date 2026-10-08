import { initializeApp } from './vendor/firebase/12.18.0/firebase-app.js';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from './vendor/firebase/12.18.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, onSnapshot, writeBatch, runTransaction, disableNetwork, enableNetwork } from './vendor/firebase/12.18.0/firebase-firestore.js';
import {config} from './config.js';
import {attractions,tripMeta,hydrateTrip,uid} from './model.js';
export const configured=()=>Boolean(config.firebase.apiKey && config.firebase.projectId && config.firebase.authDomain && config.ownerUids.length>0 && new Set(config.ownerUids).size===config.ownerUids.length && config.ownerUids.every(u=>u && !u.startsWith('REPLACE_')));
export const authorized=user=>Boolean(user && config.ownerUids.includes(user.uid));
let auth, db;
export function startAuth(callback) {
  const app=initializeApp(config.firebase,'glauco');
  auth=initializeAuth(app,{persistence:[indexedDBLocalPersistence,browserLocalPersistence],popupRedirectResolver:browserPopupRedirectResolver});
  db=getFirestore(app);return onAuthStateChanged(auth,callback);
}
export function login(){const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return signInWithPopup(auth,provider);}
export const logout=()=>signOut(auth);
export const authToken=()=>auth.currentUser?.getIdToken()||Promise.reject(new Error('Sign in again before uploading.'));
const tripsRef=()=>collection(db,'glauco','shared','trips');
const overridesRef=()=>collection(db,'glauco','shared','photoOverrides');
const wildlifeRef=kind=>collection(db,'glauco','shared',kind);
const tripRef=id=>doc(tripsRef(),id);
export function listen(callback,error){return onSnapshot(tripsRef(),s=>callback(s.docs.map(d=>d.data())),error);}
export function listenPhotoOverrides(callback,error){return onSnapshot(overridesRef(),s=>callback(s.docs.map(d=>d.data())),error);}
export async function savePhotoOverride(value){const batch=writeBatch(db);batch.set(doc(overridesRef(),value.id),value);await batch.commit();}
export async function deletePhotoOverride(id){const batch=writeBatch(db);batch.delete(doc(overridesRef(),id));await batch.commit();}
export function listenWildlife(kind,callback,error){return onSnapshot(wildlifeRef(kind),s=>callback(s.docs.map(d=>d.data())),error);}
export async function saveWildlife(kind,value){const batch=writeBatch(db);batch.set(doc(wildlifeRef(kind),value.id),value);await batch.commit();}
export async function deleteWildlife(kind,id){const batch=writeBatch(db);batch.delete(doc(wildlifeRef(kind),id));await batch.commit();}
export async function readRemote(meta) {const base=tripRef(meta.id);const [snap,wildlife]=await Promise.all([getDocs(collection(base,'versions',meta.revision,'attractions')),meta.wildlife?.speciesIds.length?getDocs(collection(base,'versions',meta.revision,'species')):Promise.resolve({docs:[]})]);return hydrateTrip(meta,snap.docs.map(d=>d.data()),wildlife.docs.map(d=>d.data()));}
export async function saveImport(entry, expectedRevision, isCancelled=()=>false) {
  const reference=tripRef(entry.id), revision=entry.revision;
  const current=await getDoc(reference);
  if((current.exists()&&!current.data().deleted?current.data().revision:null)!==expectedRevision)throw new Error('CONFLICT');
  const content=[...attractions(entry.trip).map(({attraction})=>['attractions',attraction]),...(entry.trip.wildlife?.species || []).map(species=>['species',species])];
  // Commit immutable content in bounded batches, then change the revision pointer.
  // Cancellation or a failed batch leaves the previous complete guide selected.
  for(let offset=0;offset<content.length;offset+=200){
    if(isCancelled())throw new Error('CANCELLED');
    const batch=writeBatch(db);
    for(const [kind,record] of content.slice(offset,offset+200))batch.set(doc(reference,'versions',revision,kind,record.id),record);
    await batch.commit();
  }
  if(isCancelled())throw new Error('CANCELLED');
  await runTransaction(db,async tx=>{const s=await tx.get(reference);if((s.exists()&&!s.data().deleted?s.data().revision:null)!==expectedRevision)throw new Error('CONFLICT');if(isCancelled())throw new Error('CANCELLED');tx.set(reference,{...tripMeta(entry.trip),revision,archived:entry.archived,archiveRevision:entry.archiveRevision,updatedAt:Date.now()});});
}
export async function saveArchive(entry,expectedRevision,expectedArchiveRevision,isCancelled=()=>false) {
  await runTransaction(db,async tx=>{const s=await tx.get(tripRef(entry.id));if(!s.exists() || s.data().deleted || s.data().revision!==expectedRevision || s.data().archiveRevision!==expectedArchiveRevision)throw new Error('CONFLICT');if(isCancelled())throw new Error('CANCELLED');tx.update(tripRef(entry.id),{archived:entry.archived,archiveRevision:entry.archiveRevision,updatedAt:Date.now()});});
}
export async function deleteGuidebook(entry,isCancelled=()=>false) {
  await runTransaction(db,async tx=>{const reference=tripRef(entry.id),s=await tx.get(reference);if(!s.exists()||s.data().deleted||s.data().archived!==entry.archived||s.data().revision!==entry.revision||s.data().archiveRevision!==entry.archiveRevision)throw new Error('CONFLICT');if(isCancelled())throw new Error('CANCELLED');tx.set(reference,{id:entry.id,deleted:true,revision:uid(),updatedAt:Date.now()});});
}
export async function restorePersonalData(value){
 const writes=[...value.photoOverrides.map(item=>[doc(overridesRef(),item.id),item]),...value.wildlifeRecords.map(item=>[doc(wildlifeRef('wildlifeRecords'),item.id),item]),...value.wildlifeNotes.map(item=>[doc(wildlifeRef('wildlifeSightings'),item.id),item])];
 for(let offset=0;offset<writes.length;offset+=200){const batch=writeBatch(db);for(const [reference,item] of writes.slice(offset,offset+200))batch.set(reference,item);await batch.commit();}
}
export const remoteMeta=async id=>{const s=await getDoc(tripRef(id));return s.exists()?s.data():null;};
export const setNetwork=online=>online?enableNetwork(db):disableNetwork(db);
