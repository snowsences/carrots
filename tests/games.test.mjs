import test from 'node:test';
import assert from 'node:assert/strict';
import {distractorScore,smartChoices,wrongAnswerExplanation} from '../games.js';

const species=(id,kind,group,areaIds,scientificName,identification)=>({id,name:id,kind,group,areaIds,scientificName,identification:[identification],summary:[],aliases:[],photos:[{url:`https://example.com/${id}.jpg`}]});
const owl=species('barred-owl','fauna','Birds',['forest'],'Strix varia','Large brown owl with dark eyes and barred breast.');
const spotted=species('spotted-owl','fauna','Birds',['forest'],'Strix occidentalis','Large brown owl with dark eyes and spotted breast.');
const gull=species('western-gull','fauna','Birds',['coast'],'Larus occidentalis','Large gray and white coastal gull.');
const deer=species('black-tail-deer','fauna','Mammals',['forest'],'Odocoileus hemionus','Brown deer with a dark tail.');
const trillium=species('trillium','flora','Wildflowers',['forest'],'Trillium ovatum','White three-petaled woodland flower.');

test('same genus, group, region, and traits produce a stronger distractor',()=>{
 assert.ok(distractorScore(owl,spotted)>distractorScore(owl,gull));
 assert.ok(distractorScore(owl,gull)>distractorScore(owl,deer));
});

test('smart choices stay within flora or fauna and favor useful lookalikes',()=>{
 const choices=smartChoices(owl,[owl,spotted,gull,deer,trillium],4,2);
 assert.equal(choices.length,4);
 assert.ok(choices.some(item=>item.id===owl.id));
 assert.ok(choices.some(item=>item.id===spotted.id));
 assert.ok(choices.every(item=>item.kind==='fauna'));
 assert.deepEqual(choices,smartChoices(owl,[owl,spotted,gull,deer,trillium],4,2));
});

test('wrong-answer explanation prefers an explicit lookalike distinction',()=>{
 const correct={...owl,lookalikes:[{name:spotted.name,distinction:'Spotted Owls show pale spots rather than strong vertical barring.'}]};
 const explanation=wrongAnswerExplanation(correct,spotted);
 assert.equal(explanation.explicit,true);
 assert.equal(explanation.selectedName,spotted.name);
 assert.match(explanation.difference,/pale spots/);
});

test('wrong-answer explanation falls back to useful recognition clues',()=>{
 const explanation=wrongAnswerExplanation(owl,gull);
 assert.equal(explanation.explicit,false);
 assert.match(explanation.correctClue,/dark eyes/);
 assert.match(explanation.difference,/coastal gull/);
});
