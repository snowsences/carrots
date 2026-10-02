import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrip,parseImport,tripMeta,hydrateTrip} from '../model.js';
const fixture=()=>({id:'guide',name:'Italy',guideType:'destination',places:[{id:'venice',title:'Venice',attractions:['attraction','dining','neighborhood'].map((category,i)=>({id:`entry-${i}`,name:category,category,summary:['A guide entry.']}))}]});
test('Place categories survive import, cloud hydration and offline serialization',()=>{
 const trip=parseImport(JSON.stringify({format:'glauco-trip-file',version:5,trips:[fixture()]}))[0];
 const remote=hydrateTrip({...tripMeta(trip),revision:'revision',archiveRevision:'archive',archived:false},trip.days.flatMap(d=>d.attractions));
 assert.deepEqual(remote,trip);
 assert.deepEqual(JSON.parse(JSON.stringify(remote)).days[0].attractions.map(a=>a.category),['attraction','dining','neighborhood']);
});
test('Existing guide entries default to Attraction without JSON changes',()=>{
 const source=fixture();delete source.places[0].attractions[0].category;
 assert.equal(normalizeTrip(source).days[0].attractions[0].category,'attraction');
});
test('Unknown category names are rejected before import',()=>{
 for(const category of ['restaurant','',null,5]){const source=fixture();source.places[0].attractions[0].category=category;assert.throws(()=>normalizeTrip(source),/category/);}
});
