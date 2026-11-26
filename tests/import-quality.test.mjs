import test from 'node:test';
import assert from 'node:assert/strict';
import {importQualityReport} from '../reliability.js';
test('quality report counts distinct images, duplicate taxa, missing content and quiz eligibility without modifying the guide',()=>{
const species=(id,name,scientificName,photos=[])=>({id,name,scientificName,kind:'flora',photos:photos.map(url=>({url})),lookalikes:[],sources:[]});
const a=species('a','Plant A','Genus species',['a','a']),b=species('b','Plant B','genus species',['b']),c=species('c','Plant C','Genus other',['a']),d=species('d','Plant D','Genus missing');
const trip={days:[{title:'City',attractions:[{name:'Museum',photos:[],sources:[]}]}],wildlife:{species:[a,b,c,d]},glossary:[{photo:{url:'g',thumbnailUrl:'gt'}}]};
const report=importQualityReport(trip),count=id=>report.issues.find(x=>x.id===id)?.items.length||0;
assert.equal(report.species,4);assert.equal(report.attractions,1);assert.equal(report.photoUrls,4);assert.equal(count('species-no-photos'),1);assert.equal(count('species-one-photo'),3);assert.equal(count('duplicate-taxa'),1);assert.equal(count('species-no-lookalikes'),4);assert.equal(count('repeated-photos'),1);assert.equal(count('shared-species-photos'),1);assert.equal(count('attractions-no-photos'),1);assert.equal(count('small-quiz-pools'),0);assert.equal(importQualityReport({days:[],wildlife:{species:[a]}}).issues.some(x=>x.id==='small-quiz-pools'),true);assert.equal(importQualityReport({days:[]}).issues.length,0);const before=JSON.stringify(trip);importQualityReport(trip);assert.equal(JSON.stringify(trip),before);
});
