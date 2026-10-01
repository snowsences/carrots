import test from 'node:test';
import assert from 'node:assert/strict';
import {glossaryParts,historyTimeline} from '../guide.js';
import {parseImport,normalizeTrip,tripMeta,normalizeMeta,hydrateTrip} from '../model.js';

const glossary=[{term:'Naga',definition:'A serpent.',aliases:['nagas']},{term:'Mount Meru / temple mountain',definition:'A sacred mountain.',aliases:['Mount Meru','temple mountain','temple mountains']}];
const event=(year,label='Approximate period')=>({year,label,title:'Built',text:'A sourced milestone.'});
const site=(id,year)=>({id,name:id,summary:['A short guide.'],history:[event(year)]});
function fixture(){return {id:'trip',name:'Trip',year:2026,startDate:'2026-10-19',endDate:'2026-10-19',glossary:structuredClone(glossary),days:[{id:'day',date:'2026-10-19',title:'Day',attractions:[site('earlier',967),{...site('current',900),comparisons:[{attractionId:'earlier',paragraphs:['A concrete comparison.']}]},site('future',800)]}]};}

test('glossary matches whole terms, aliases, case, and punctuation without changing prose',()=>{
 const value='NAGAS, Mount Meru and temple mountains. Nagasaki and nāga are other words.';
 const parts=glossaryParts(value,glossary);
 assert.equal(parts.map(p=>p.text).join(''),value);
 assert.deepEqual(parts.filter(p=>p.term).map(p=>p.text),['NAGAS','Mount Meru','temple mountains']);
 assert.deepEqual(glossaryParts('plain prose',[]),[{text:'plain prose'}]);
});
test('glossary escapes regex punctuation and leaves HTML as literal text',()=>{
 const value='<img onerror=evil()> a+b; a+bc.';
 const parts=glossaryParts(value,[{term:'a+b',definition:'Literal.',aliases:[]}]);
 assert.equal(parts.map(p=>p.text).join(''),value);
 assert.deepEqual(parts.filter(p=>p.term).map(p=>p.text),['a+b']);
});
test('timeline includes current milestones and only earlier comparison targets',()=>{
 const f=fixture();f.days[0].attractions[1].history.push(event(2011,'2011 CE'));
 f.days[0].attractions[1].comparisons.push({attractionId:'future',paragraphs:['Invalid reference ignored by timeline.']});
 const entries=historyTimeline(f,'current');
 assert.deepEqual(entries.map(e=>[e.attraction.id,e.year]),[['current',900],['earlier',967],['current',2011]]);
 assert.equal(entries[0].label,'Approximate period');
 assert.deepEqual(historyTimeline(f,'missing'),[]);
 f.days[0].attractions[1].history=[];assert.deepEqual(historyTimeline(f,'current'),[]);
});
test('optional historical content and glossary aliases survive cloud reconstruction',()=>{
 const f=fixture();f.days[0].attractions[1].originality=['Replacement bricks are marked.'];
 const trip=normalizeTrip(f),meta={...tripMeta(trip),revision:'rev',archiveRevision:'archive',archived:false};
 assert.deepEqual(hydrateTrip(meta,trip.days.flatMap(d=>d.attractions)),trip);
 assert.deepEqual(normalizeMeta(meta).glossary,trip.glossary);
 assert.deepEqual(normalizeTrip({...f,days:[{...f.days[0],attractions:[{id:'older',name:'Old guide',summary:['Old version.']}]}]}).days[0].attractions[0].history,[]);
});
test('invalid, misleadingly unordered, or oversized historical data is rejected',()=>{
 for(const history of [[event(900.5)],[event(2300)],[event(1200),event(900)],[event(900,'')],Array.from({length:9},()=>event(900))]){
  const f=fixture();f.days[0].attractions[1].history=history;assert.throws(()=>normalizeTrip(f));
 }
 const f=fixture();f.days[0].attractions[1].originality=['x'.repeat(1801)];assert.throws(()=>normalizeTrip(f));
 f.days[0].attractions[1].originality=[];f.glossary.push({term:'NAGAS',definition:'Ambiguous.'});assert.throws(()=>normalizeTrip(f),/unique/);
});

test('versions 1, 2 and 3 are accepted',()=>{
 for(const version of [1,2,3])assert.equal(parseImport(JSON.stringify({format:'glauco-trip-file',version,trips:[fixture()]}))[0].days[0].attractions[0].history.length,1);
 assert.throws(()=>parseImport(JSON.stringify({format:'glauco-trip-file',version:4,trips:[fixture()]})),/version 1, 2 or 3/);
});
