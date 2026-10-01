import { initializeApp } from './vendor/firebase/12.18.0/firebase-app.js';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from './vendor/firebase/12.18.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, onSnapshot, writeBatch, runTransaction, disableNetwork, enableNetwork } from './vendor/firebase/12.18.0/firebase-firestore.js';
import {config} from './config.js';
import {attractions,tripMeta,hydrateTrip,uid} from './model.js';
export const configured=()=>Boolean(config.firebase.apiKey && config.firebase.projectId && config.firebase.authDomain && config.ownerUids.length===2 && new Set(config.ownerUids).size===2 && config.ownerUids.every(u=>u && !u.startsWith('REPLACE_')));
export const authorized=user=>Boolean(user && config.ownerUids.includes(user.uid));
let auth, db;
export function startAuth(callback) {
  const app=initializeApp(config.firebase,'glauco');
  auth=initializeAuth(app,{persistence:[indexedDBLocalPersistence,browserLocalPersistence],popupRedirectResolver:browserPopupRedirectResolver});
  db=getFirestore(app);return onAuthStateChanged(auth,callback);
}
export function login(){const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return signInWithPopup(auth,provider);}
export const logout=()=>signOut(auth);
const tripsRef=()=>collection(db,'glauco','shared','trips');
const tripRef=id=>doc(tripsRef(),id);
export function listen(callback,error){return onSnapshot(tripsRef(),s=>callback(s.docs.map(d=>d.data())),error);}
export async function readRemote(meta) {const snap=await getDocs(collection(tripRef(meta.id),'versions',meta.revision,'attractions'));return hydrateTrip(meta,snap.docs.map(d=>d.data()));}
export async function saveImport(entry, expectedRevision, isCancelled=()=>false) {
  const reference=tripRef(entry.id), revision=entry.revision;
  const current=await getDoc(reference);
  if((current.exists()&&!current.data().deleted?current.data().revision:null)!==expectedRevision)throw new Error('CONFLICT');
  const batch=writeBatch(db);
  for(const {attraction} of attractions(entry.trip))batch.set(doc(reference,'versions',revision,'attractions',attraction.id),attraction);
  // Immutable content first; the pointer changes only after every attraction is committed.
  await batch.commit();if(isCancelled())throw new Error('CANCELLED');
  await runTransaction(db,async tx=>{const s=await tx.get(reference);if((s.exists()&&!s.data().deleted?s.data().revision:null)!==expectedRevision)throw new Error('CONFLICT');if(isCancelled())throw new Error('CANCELLED');tx.set(reference,{...tripMeta(entry.trip),revision,archived:entry.archived,archiveRevision:entry.archiveRevision,updatedAt:Date.now()});});
}
export async function saveArchive(entry,expectedRevision,expectedArchiveRevision,isCancelled=()=>false) {
  await runTransaction(db,async tx=>{const s=await tx.get(tripRef(entry.id));if(!s.exists() || s.data().deleted || s.data().revision!==expectedRevision || s.data().archiveRevision!==expectedArchiveRevision)throw new Error('CONFLICT');if(isCancelled())throw new Error('CANCELLED');tx.update(tripRef(entry.id),{archived:entry.archived,archiveRevision:entry.archiveRevision,updatedAt:Date.now()});});
}
export async function deleteArchived(entry,isCancelled=()=>false) {
  await runTransaction(db,async tx=>{const reference=tripRef(entry.id),s=await tx.get(reference);if(!s.exists()||s.data().deleted||!s.data().archived||s.data().revision!==entry.revision||s.data().archiveRevision!==entry.archiveRevision)throw new Error('CONFLICT');if(isCancelled())throw new Error('CANCELLED');tx.set(reference,{id:entry.id,deleted:true,revision:uid(),updatedAt:Date.now()});});
}
export const remoteMeta=async id=>{const s=await getDoc(tripRef(id));return s.exists()?s.data():null;};
export const setNetwork=online=>online?enableNetwork(db):disableNetwork(db);
