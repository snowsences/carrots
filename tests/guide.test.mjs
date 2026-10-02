import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrip,tripMeta,normalizeMeta,hydrateTrip,parseImport} from '../model.js';
import {defaultTripId,orderedTrips,todayDay,localDateKey,dayNumber,dayTitle} from '../navigation.js';
import {guidesForTrip} from '../customs.js';
const attraction=id=>({id,name:id,location:'Cambodia',summary:['A brief guide.']});
function fixture(){return {id:'trip',name:'Cambodia and Thailand',year:2026,startDate:'2026-10-19',endDate:'2026-10-20',days:[{id:'one',date:'2026-10-19',title:'First day',attractions:[attraction('first'),attraction('second')]},{id:'two',date:'2026-10-20',title:'Second day',attractions:[attraction('third')]}]};}
test('older version 1 guides remain compatible',()=>{const t=normalizeTrip(fixture());assert.deepEqual(t.glossary,[]);assert.deepEqual(t.days[0].attractions[0].notice,[]);assert.deepEqual(t.days[0].attractions[0].comparisons,[]);});
test('glossary, notice, and comparisons survive cloud reconstruction',()=>{const f=fixture();f.glossary=[{term:'Naga',definition:'A mythological serpent.'}];f.days[0].attractions[0].notice=['A carving','An arch','A viewpoint'];f.days[1].attractions[0].comparisons=[{attractionId:'first',paragraphs:['Compare with the earlier carving.']}];const t=normalizeTrip(f),meta={...tripMeta(t),revision:'rev',archiveRevision:'archive',archived:false};assert.deepEqual(hydrateTrip(meta,t.days.flatMap(d=>d.attractions)),t);assert.deepEqual(normalizeMeta(meta).glossary,t.glossary);});
test('comparisons can reference an earlier stop on the same day',()=>{const f=fixture();f.days[0].attractions[1].comparisons=[{attractionId:'first',paragraphs:['An earlier stop.']}];assert.doesNotThrow(()=>normalizeTrip(f));});
test('future, current, missing, and duplicate comparison references are rejected',()=>{for(const id of ['second','third','missing']){const f=fixture();f.days[0].attractions[1].comparisons=[{attractionId:id,paragraphs:['A comparison.']}];assert.throws(()=>normalizeTrip(f),/earlier attractions/);}const f=fixture();f.days[1].attractions[0].comparisons=[{attractionId:'first',paragraphs:['One.']},{attractionId:'first',paragraphs:['Two.']}];assert.throws(()=>normalizeTrip(f),/Duplicate comparison/);});
test('checklists contain exactly three items when provided',()=>{for(const notice of [[],['A','B','C']]){const f=fixture();f.days[0].attractions[0].notice=notice;assert.doesNotThrow(()=>normalizeTrip(f));}for(const notice of [['A'],['A','B'],['A','B','C','D']]){const f=fixture();f.days[0].attractions[0].notice=notice;assert.throws(()=>normalizeTrip(f));}});
const entry=(id,startDate,endDate,archived=false)=>({id,archived,meta:{name:id,startDate,endDate,days:[{id:'day',date:startDate}]}});
test('default trip favors active/current, upcoming soonest, and recent past',()=>{const entries=[entry('far','2026-11-01','2026-11-03'),entry('past','2026-09-01','2026-09-03'),entry('soon','2026-10-22','2026-10-23'),entry('archive','2026-10-19','2026-10-20',true),entry('current','2026-10-18','2026-10-20')];assert.equal(defaultTripId(entries,'2026-10-19'),'current');assert.equal(defaultTripId(entries.filter(e=>e.id!=='current'),'2026-10-19'),'soon');assert.equal(defaultTripId(entries,'2026-12-01'),'far');assert.equal(orderedTrips(entries,'2026-10-19').at(-1).id,'archive');assert.equal(defaultTripId(entries.filter(e=>e.archived),'2026-10-19'),'archive');assert.equal(defaultTripId([]),null);});
test('today matches an actual itinerary day, using local calendar fields',()=>{assert.equal(localDateKey(new Date(2026,9,19,23,59)),'2026-10-19');assert.equal(todayDay(entry('a','2026-10-19','2026-10-23'),'2026-10-19').id,'day');assert.equal(todayDay(entry('a','2026-10-19','2026-10-23'),'2026-10-20'),null);});
test('country guides match destinations and avoid unrelated narrative mentions',()=>{const f=fixture();assert.deepEqual(guidesForTrip(f).map(g=>g.id),['cambodia','thailand']);const other={name:'Japan',days:[{attractions:[{location:'Kyoto',summary:['Unlike Angkor Wat in Cambodia.']}]}]};assert.deepEqual(guidesForTrip(other),[]);});

test('day numbering follows the guide order without changing source titles',()=>{const trip=fixture(),titles=trip.days.map(d=>d.title);assert.equal(dayNumber(trip,'one'),1);assert.equal(dayNumber(trip,'two'),2);assert.equal(dayTitle(trip,trip.days[1]),'Day 2: Second day');assert.deepEqual(trip.days.map(d=>d.title),titles);});

test('destination guides use places without dates or comparisons and survive cloud hydration',()=>{
 const source={id:'italy-guide',name:'Italy',guideType:'destination',coverUrl:'',places:[{id:'venice',title:'Venice',attractions:[{id:'basilica',name:'St Mark’s Basilica',location:'Venice',neighborhood:'San Marco',summary:['A landmark church.'],notice:['The mosaics','The domes','The marble floor'],facts:[{label:'Founded',value:'11th century'}],history:[{year:1094,label:'1094 CE',title:'Consecrated',text:'The rebuilt church was consecrated.'}],sections:[{heading:'Look closer',paragraphs:['A detailed guide.']}]}]}]};
 const trip=parseImport(JSON.stringify({format:'glauco-trip-file',version:5,trips:[source]}))[0],meta={...tripMeta(trip),revision:'rev',archiveRevision:'archive',archived:false};
 assert.equal(trip.guideType,'destination');assert.equal(trip.year,undefined);assert.equal(trip.days[0].date,'');assert.equal(trip.days[0].attractions[0].neighborhood,'San Marco');assert.equal(dayTitle(trip,trip.days[0]),'Venice');assert.equal(todayDay({meta},'2026-10-02'),null);assert.deepEqual(hydrateTrip(meta,trip.days[0].attractions),trip);assert.deepEqual(normalizeMeta(meta).guideType,'destination');
 source.places[0].attractions[0].comparisons=[{attractionId:'anything',paragraphs:['No itinerary assumptions.']}];assert.throws(()=>normalizeTrip(source),/cannot contain attraction comparisons/);
 assert.throws(()=>parseImport(JSON.stringify({format:'glauco-trip-file',version:4,trips:[source]})),/version 5/);
});

test('Peru customs match trip names and destinations, not narrative references',()=>{
 assert.deepEqual(guidesForTrip({name:'Peru 2027',days:[]}).map(g=>g.id),['peru']);
 for(const location of ['Cusco','Sacred Valley','Puerto Maldonado','Tambopata']){
  assert.deepEqual(guidesForTrip({name:'Holiday',days:[{attractions:[{location}]}]}).map(g=>g.id),['peru']);
 }
 assert.deepEqual(guidesForTrip({name:'Italy',days:[{attractions:[{location:'Rome',summary:['Compare this to Cusco in Peru.']}]}]}),[]);
});
