// Run: node --experimental-vm-modules tests/firebase-check.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const records=new Map(),context=vm.createContext({crypto:webcrypto,TextEncoder,URL,Date,console});let afterBatch;
const path=(base,...parts)=>({path:[base?.path,...parts].filter(Boolean).join('/')});
const snap=reference=>({exists:()=>records.has(reference.path),data:()=>structuredClone(records.get(reference.path))});
const firestore={getFirestore:()=>({}),collection:path,doc:path,getDoc:async reference=>snap(reference),getDocs:async()=>({docs:[]}),onSnapshot:()=>()=>{},disableNetwork:async()=>{},enableNetwork:async()=>{},writeBatch:()=>{const writes=[];return {set:(ref,value)=>writes.push([ref,value]),commit:async()=>{for(const [ref,value] of writes)records.set(ref.path,structuredClone(value));afterBatch?.();afterBatch=null;}};},runTransaction:async(db,fn)=>{const writes=[];const tx={get:async ref=>snap(ref),set:(ref,value)=>writes.push([ref,value]),update:(ref,value)=>writes.push([ref,{...records.get(ref.path),...value}])};await fn(tx);for(const [ref,value] of writes)records.set(ref.path,structuredClone(value));}};
const modules=new Map();
async function load(file){if(modules.has(file))return modules.get(file);let mod;if(file.includes('/vendor/firebase/')){const values=file.endsWith('firebase-firestore.js')?firestore:file.endsWith('firebase-app.js')?{initializeApp:()=>({})}:{initializeAuth:()=>({}),indexedDBLocalPersistence:{},browserLocalPersistence:{},browserPopupRedirectResolver:{},GoogleAuthProvider:class{},onAuthStateChanged:()=>{},signInWithPopup:async()=>{},signOut:async()=>{}};mod=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context,identifier:file});modules.set(file,mod);return mod;}mod=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});modules.set(file,mod);await mod.link((specifier,reference)=>load(new URL(specifier,'file://'+reference.identifier).pathname));return mod;}
const module=await load(new URL('../firebase.js',import.meta.url).pathname);await module.evaluate();const cloud=module.namespace;
const trip={id:'trip',name:'Trip',year:2026,startDate:'2026-10-19',endDate:'2026-10-19',days:[{id:'day',date:'2026-10-19',title:'Day',attractions:[{id:'site',name:'Site',summary:['Guide.']}]}]},entry={id:'trip',trip,meta:trip,revision:'old',archiveRevision:'archive',archived:true},key='glauco/shared/trips/trip';
records.set(key,{...trip,revision:'old',archiveRevision:'archive',archived:false});await assert.rejects(cloud.deleteArchived(entry),/CONFLICT/);assert.equal(records.get(key).archived,false);
records.set(key,{...trip,revision:'old',archiveRevision:'newer',archived:true});await assert.rejects(cloud.deleteArchived(entry),/CONFLICT/);
records.set(key,{...trip,revision:'old',archiveRevision:'archive',archived:true});await assert.rejects(cloud.deleteArchived(entry,()=>true),/CANCELLED/);assert.equal(records.get(key).deleted,undefined);
await cloud.deleteArchived(entry);assert.equal(records.get(key).deleted,true);assert.notEqual(records.get(key).revision,'old');
await assert.rejects(cloud.saveImport(entry,'old'),/CONFLICT/);await assert.rejects(cloud.saveArchive(entry,'old','archive'),/CONFLICT/);
await cloud.saveImport({...entry,revision:'reimported',archived:false},null);assert.equal(records.get(key).deleted,undefined);assert.equal(records.get(key).revision,'reimported');
afterBatch=()=>records.set(key,{id:'trip',deleted:true,revision:'deleted-during-import'});await assert.rejects(cloud.saveImport({...entry,revision:'late-import'},'reimported'),/CONFLICT/);assert.equal(records.get(key).revision,'deleted-during-import');
console.log('PASS actual Firebase adapter: active-trip deletion blocked, revision and archive conflicts checked, cancellation respected, archived deletion marker saved, stale imports/restores cannot resurrect deletion, deliberate re-import allowed, transaction guards concurrent deletion.');
