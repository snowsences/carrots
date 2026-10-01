import test from 'node:test';
import assert from 'node:assert/strict';
import {tripTimeline,centuryLabel,yearLabel} from '../guide.js';
import {photoPlan} from '../offline.js';

const ev=(year,title='Built')=>({year,label:`${year} CE`,title,text:'A sourced milestone.'});
const photo=n=>({url:`https://upload.wikimedia.org/${n}.jpg`,thumbnailUrl:`https://thumb.wikimedia.org/${n}.jpg`});
const attraction=(id,years,photos=[])=>({id,name:id,history:years.map(y=>ev(y)),photos:photos.map(photo)});
const trip=()=>({id:'t',coverUrl:'https://upload.wikimedia.org/cover.jpg',days:[
 {id:'d1',date:'2026-10-19',attractions:[attraction('a',[967],['a1']),attraction('b',[1113,1150],['b1'])]},
 {id:'d2',date:'2026-10-20',attractions:[attraction('c',[-300],['c1']),attraction('d',[])]},
 {id:'d3',date:'2026-10-21',attractions:[attraction('e',[1200],['e1','e2'])]}]});

test('timeline sorts milestones across days, groups centuries and marks visits by date',()=>{
 const t=tripTimeline(trip(),'2026-10-20');
 assert.deepEqual(t.events.map(e=>[e.attraction.id,e.year,e.status]),[['c',-300,'today'],['a',967,'seen'],['b',1113,'seen'],['b',1150,'seen'],['e',1200,'ahead']]);
 assert.deepEqual(t.bands.map(b=>[b.label,b.events.length]),[['3rd century BCE',1],['10th century CE',1],['12th century CE',3]]);
 assert.equal(t.min,-300);assert.equal(t.max,1200);
 assert.deepEqual(t.events.map(e=>e.index),[0,1,2,3,4]);
 assert.deepEqual(tripTimeline({days:[{id:'x',date:'2026-10-19',attractions:[attraction('z',[])]}]},'2026-10-19').events,[]);
});
test('century and year labels',()=>{
 assert.equal(centuryLabel(100),'1st century CE');assert.equal(centuryLabel(101),'2nd century CE');assert.equal(centuryLabel(1113),'12th century CE');
 assert.equal(centuryLabel(1211),'13th century CE');assert.equal(centuryLabel(-50),'1st century BCE');assert.equal(yearLabel(-300),'300 BCE');assert.equal(yearLabel(967),'967 CE');
});
test('photo plan puts the cover first, then upcoming days, then past days, thumbnails before full size',()=>{
 const plan=photoPlan(trip(),'2026-10-20');
 assert.deepEqual(plan.map(p=>p.day),[0,2,2,3,3,3,3,1,1,1,1]);
 assert.ok(plan[1].url.includes('thumb.wikimedia.org')&&plan[2].url.includes('upload.wikimedia.org'));
 assert.equal(new Set(plan.map(p=>p.url)).size,plan.length);
 assert.deepEqual(photoPlan(trip(),'2026-01-01').map(p=>p.day),[0,1,1,1,1,2,2,3,3,3,3]);
 assert.deepEqual(photoPlan(trip(),'2027-01-01').map(p=>p.day),[0,1,1,1,1,2,2,3,3,3,3]);
});
