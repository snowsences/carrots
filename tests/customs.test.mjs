import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrip,tripMeta,normalizeMeta,hydrateTrip,parseImport,bytes} from '../model.js';
import {guidesForTrip} from '../customs.js';
const guide=()=>({id:'italy',name:'Italy',intro:'Local context.',sections:[{heading:'Courtesy',paragraphs:['A researched paragraph.']}],language:'Italian',lang:'it',phraseNote:'Approximate pronunciation.',phrases:[{meaning:'Thank you',native:'Grazie',pronunciation:'GRAH-tsyeh'}],sources:[{title:'Source',url:'https://example.org/italy'}],researchedAt:'2026-10-02'});
const fixture=()=>({id:'italy-guide',name:'Italy',guideType:'destination',places:[{id:'rome',title:'Rome',attractions:[{id:'site',name:'Site',location:'Rome',summary:['A guide.']}]}],customs:{guides:[guide()]}});
test('imported customs survive metadata normalization, remote hydration and saved offline JSON',()=>{
 const trip=parseImport(JSON.stringify({format:'glauco-trip-file',version:5,trips:[fixture()]}))[0];
 const meta=normalizeMeta({...tripMeta(trip),revision:'revision',archiveRevision:'archive',archived:false});
 const remote=hydrateTrip(meta,trip.days.flatMap(d=>d.attractions));
 assert.deepEqual(remote,trip);assert.deepEqual(remote.customs,trip.customs);
 const saved=JSON.parse(JSON.stringify({trip:remote,bytes:bytes(remote)}));
 assert.deepEqual(guidesForTrip(saved.trip),trip.customs.guides);
});
test('imported country/region list takes precedence over bundled matches for any guide type',()=>{
 const source=fixture();source.name='Cambodia and Thailand';source.customs.guides.push({...guide(),id:'region',name:'Northern region'});
 const trip=normalizeTrip(source);assert.deepEqual(guidesForTrip(trip).map(g=>g.id),['italy','region']);
 const dated={...source,guideType:undefined,year:2026,startDate:'2026-10-02',endDate:'2026-10-02',days:source.places.map(p=>({...p,date:'2026-10-02'}))};
 assert.equal(guidesForTrip(normalizeTrip(dated))[0].name,'Italy');
});
test('older files and empty custom lists retain bundled country guides and dates',()=>{
 const source=fixture();source.name='Cambodia and Thailand';delete source.customs;
 const trip=normalizeTrip(source);assert.equal(Object.hasOwn(trip,'customs'),false);assert.equal(Object.hasOwn(tripMeta(trip),'customs'),false);
 const built=guidesForTrip(trip);assert.deepEqual(built.map(g=>g.id),['cambodia','thailand']);
 assert.equal(built[0].phrases[0].meaning,'Hello');assert.equal(built[0].researchedAt,'2026-10-01');assert.ok(built[0].sources[0].url.startsWith('https://'));
 source.customs={guides:[]};assert.deepEqual(guidesForTrip(normalizeTrip(source)),built);
});
test('text-only customs guides and phrase-only guides work without empty sections',()=>{
 const source=fixture(),g=source.customs.guides[0];delete g.phrases;delete g.language;delete g.lang;
 assert.equal(normalizeTrip(source).customs.guides[0].phrases.length,0);
 g.sections=[];g.language='Italian';g.lang='it';g.phrases=[{meaning:'Hello',native:'Ciao'}];
 assert.equal(normalizeTrip(source).customs.guides[0].phrases[0].pronunciation,'');
});
test('invalid customs structure, dates, IDs, source links, and language metadata fail import',()=>{
 const cases=[
  [s=>s.customs=[],/Customs must be an object/],
  [s=>s.customs.guides={},/Customs guides must be a list/],
  [s=>s.customs.guides.push(guide()),/IDs must be unique/],
  [s=>s.customs.guides[0].id='bad id',/only letters/],
  [s=>delete s.customs.guides[0].researchedAt,/Customs research date/],
  [s=>s.customs.guides[0].researchedAt='2026-02-30',/valid YYYY-MM-DD/],
  [s=>s.customs.guides[0].sources[0].url='javascript:alert(1)',/HTTPS/],
  [s=>s.customs.guides[0].sources[0].url='',/sources need HTTPS/],
  [s=>s.customs.guides[0].sections[0].paragraphs=[],/at least one paragraph/],
  [s=>{s.customs.guides[0].sections=[];s.customs.guides[0].phrases=[];},/sections or useful phrases/],
  [s=>s.customs.guides[0].phrases[0]=['Thanks','Grazie','Sound'],/Phrase must be an object/],
  [s=>s.customs.guides[0].phrases[0].native='',/Local phrase/],
  [s=>delete s.customs.guides[0].language,/language name and language tag/],
  [s=>s.customs.guides[0].lang='it" onclick="test',/valid language tag/]
 ];
 for(const [mutate,message] of cases){const source=fixture();mutate(source);assert.throws(()=>normalizeTrip(source),message);}
});
test('customs metadata is bounded before syncing to Firestore',()=>{
 const source=fixture();source.customs.guides[0].sections=Array.from({length:15},()=>({heading:'Section',paragraphs:Array(12).fill('a'.repeat(3000))}));
 assert.throws(()=>normalizeTrip(source),/at most 50 KB/);
 const g={...guide(),sections:Array.from({length:3},()=>({heading:'Section',paragraphs:Array(4).fill('a'.repeat(3000))}))};
 source.customs.guides=Array.from({length:3},(_,i)=>({...g,id:`guide-${i}`}));assert.throws(()=>normalizeTrip(source),/at most 100 KB/);
});
