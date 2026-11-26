import test from 'node:test';import assert from 'node:assert/strict';import {eligibleSpecies,recordReview,scheduleRetry,selectQuizPhoto,smartChoices,matchesSpeciesAnswer,adaptiveLevel} from '../games.js';
const a={id:'a',kind:'fauna',name:'Owl',scientificName:'Strix a',group:'Birds',photos:[{url:'a'},{url:'b'}]},b={...a,id:'b',name:'Gull',scientificName:'Larus b'},plant={...a,id:'p',kind:'flora',name:'Tree',scientificName:'Pinus p'};
test('mixed pools never yield a single answer',()=>{assert.equal(eligibleSpecies({wildlife:{species:[a,plant]}},'mixed').length,0);assert.equal(eligibleSpecies({wildlife:{species:[a,b,plant]}},'mixed').length,2);assert.equal(smartChoices(a,[a,b,plant]).length,2)});
test('retry reposition and spaced review',()=>{assert.deepEqual(scheduleRetry(['a','b','c','d','e'],'a'),['b','c','d','a','e']);const p=recordReview({},true,100);assert.equal(p.due,86400100);assert.equal(recordReview(p,true,200,{retry:true}).stage,1);assert.equal(adaptiveLevel({stage:4}),'advanced')});
test('rotate photos and accept scientific names',()=>{assert.equal(selectQuizPhoto(a,{photos:{a:2,b:0}}).url,'b');assert.ok(matchesSpeciesAnswer(a,'STRIX A'))});

test('same-group distractors always take priority at every difficulty',()=>{
 const monkey={...a,id:'monkey',name:'Vervet Monkey',group:'Mammals',scientificName:'Chlorocebus pygerythrus',identification:['Gray fur, long tail, black face'],areaIds:['park']};
 const mammals=[{id:'baboon',name:'Baboon',scientificName:'Papio ursinus'},{id:'samango',name:'Samango Monkey',scientificName:'Cercopithecus albogularis'},{id:'squirrel',name:'Bush Squirrel',scientificName:'Paraxerus cepapi'}].map(s=>({...monkey,...s}));
 const other=Array.from({length:20},(_,i)=>({...a,id:'bird'+i,name:'Bird '+i,scientificName:'Birdus '+i,group:'Birds',identification:monkey.identification,areaIds:['park']}));
 for(const level of ['beginner','intermediate','advanced','expert'])for(let round=0;round<100;round++){
  const choices=smartChoices(monkey,[monkey,...mammals,...other],4,round,{level,confusions:{'fauna:birdus 0':100}});
  assert.equal(choices.length,4);assert.ok(choices.every(s=>s.group==='Mammals'),level+' round '+round);
 }
 const sparse=smartChoices(monkey,[monkey,mammals[0],...other],4,0,{level:'beginner'});assert.ok(sparse.some(s=>s.id==='baboon'));assert.equal(sparse.length,4);
});
