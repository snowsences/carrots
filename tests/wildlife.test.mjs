import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrip,normalizeMeta,parseImport,tripMeta,hydrateTrip,photoUrls} from '../model.js';
import {photoPlan} from '../offline.js';
import {speciesMatches} from '../wildlife.js';
const species=()=>({id:'macaque',kind:'fauna',name:'Long-tailed macaque',scientificName:'Macaca fascicularis',group:'Mammals',aliases:['Crab-eating macaque'],identification:['A long tail.'],summary:['A social primate.'],where:[{areaId:'forest',likelihood:'Reported here.',note:'Look along the edge.',attractionIds:['temple']}],sources:[{title:'Research',url:'https://example.org/research'}],researchedAt:'2026-10-01',photos:[{url:'https://upload.wikimedia.org/full.jpg',thumbnailUrl:'https://upload.wikimedia.org/thumb.jpg'}]});
const fixture=()=>({id:'trip',name:'Trip',year:2026,startDate:'2026-10-19',endDate:'2026-10-19',days:[{id:'day',date:'2026-10-19',title:'Temples',attractions:[{id:'temple',name:'Temple',summary:['A temple.']}]}],wildlife:{areas:[{id:'forest',name:'Forest'}],species:[species()]}});
test('wildlife and existing itinerary survive import, metadata validation and remote hydration',()=>{
 const trip=parseImport(JSON.stringify({format:'glauco-trip-file',version:3,trips:[fixture()]}))[0];
 const meta=normalizeMeta({...tripMeta(trip),revision:'rev',archiveRevision:'archive',archived:false});
 assert.equal(meta.wildlife.speciesIds[0],'macaque');assert.equal(meta.wildlife.species,undefined);
 assert.deepEqual(hydrateTrip(meta,trip.days[0].attractions,trip.wildlife.species),trip);
 assert.throws(()=>hydrateTrip(meta,trip.days[0].attractions),/wildlife is incomplete/);
});
test('invalid areas, links, IDs, taxonomy kinds and incomplete species fail before import',()=>{
 const change=fn=>{const t=fixture();fn(t);return ()=>normalizeTrip(t);};
 assert.throws(change(t=>t.wildlife.species[0].where[0].areaId='missing'),/Unknown wildlife area/);
 assert.throws(change(t=>t.wildlife.species[0].where[0].attractionIds=['missing']),/Unknown linked attraction/);
 assert.throws(change(t=>t.wildlife.species.push(species())),/Species IDs must be unique/);
 assert.throws(change(t=>t.wildlife.species[0].kind='other'),/flora or fauna/);
 assert.throws(change(t=>t.wildlife.species[0].sources=[{title:'Missing URL'}]),/sources/);
 assert.throws(change(t=>t.wildlife.species[0].identification=[]),/identification/);
 assert.throws(change(t=>t.wildlife.species[0].wikipediaUrl='https://example.org'),/Wikipedia links/);
});
test('wildlife photos join deduplicated resumable download plans',()=>{
 const t=normalizeTrip(fixture());const urls=photoUrls(t);const plan=photoPlan(t);
 assert.deepEqual(new Set(plan.map(p=>p.url)),new Set(urls));
 assert.equal(plan[0].url,t.wildlife.species[0].photos[0].thumbnailUrl);
 t.coverUrl=t.wildlife.species[0].photos[0].url;assert.equal(photoPlan(t).filter(p=>p.url===t.coverUrl).length,1);
});
test('species search supports common names, scientific names, aliases, clues and area filters',()=>{
 const s=normalizeTrip(fixture()).wildlife.species[0];
 for(const q of ['MACACA','Crab-eating','long tail','social primate'])assert.equal(speciesMatches(s,q,'forest'),true);
 assert.equal(speciesMatches(s,'','missing'),false);assert.equal(speciesMatches(s,'unknown'),false);
});
test('older trip files need no wildlife fields',()=>{
 const t=fixture();delete t.wildlife;
 for(const version of [1,2]){const trip=parseImport(JSON.stringify({format:'glauco-trip-file',version,trips:[t]}))[0];assert.equal(trip.wildlife,undefined);assert.deepEqual(hydrateTrip(tripMeta(trip),trip.days[0].attractions),trip);}
});

test('minimal regional wildlife survives cloud hydration and searches without itinerary context',()=>{
 const t=fixture();t.wildlife.browseByArea=true;
 const s=t.wildlife.species[0];s.areaIds=['forest'];s.wikipediaUrl='https://en.wikipedia.org/wiki/Macaca_fascicularis';
 delete s.where;delete s.sources;delete s.researchedAt;
 const trip=parseImport(JSON.stringify({format:'glauco-trip-file',version:4,trips:[t]}))[0];
 const meta=normalizeMeta({...tripMeta(trip),revision:'rev',archiveRevision:'archive',archived:false});
 assert.equal(meta.wildlife.browseByArea,true);assert.deepEqual(hydrateTrip(meta,trip.days[0].attractions,trip.wildlife.species),trip);
 assert.equal(speciesMatches(trip.wildlife.species[0],'macaque','forest'),true);
 assert.deepEqual(trip.wildlife.species[0].where,[]);assert.deepEqual(trip.wildlife.species[0].sources,[]);
 s.areaIds=['missing'];assert.throws(()=>normalizeTrip(t),/Unknown wildlife area/);
 s.areaIds=[];assert.throws(()=>normalizeTrip(t),/at least one area/);
 t.wildlife.browseByArea='yes';assert.throws(()=>normalizeTrip(t),/true or false/);
});
