const sessions=new Map(),selectedModes=new Map();
const STOP_WORDS=new Set(['about','after','also','and','are','around','back','black','brown','can','common','dark','from','green','have','into','light','look','more','most','often','other','small','than','that','the','their','this','through','under','very','when','white','with','yellow']);

const hash=value=>{let result=2166136261;for(const character of value){result^=character.charCodeAt(0);result=Math.imul(result,16777619);}return result>>>0;};
const words=value=>new Set(String(value||'').toLocaleLowerCase().match(/[a-z]{4,}/g)?.filter(word=>!STOP_WORDS.has(word))||[]);
const overlap=(left=[],right=[])=>{const values=new Set(left);return right.reduce((count,value)=>count+Number(values.has(value)),0);};
const speciesWords=species=>words([species.name,species.scientificName,species.group,...(species.aliases||[]),...(species.identification||[]),...(species.summary||[])].join(' '));

export function distractorScore(correct,candidate){
 if(!correct||!candidate||correct.id===candidate.id||correct.kind!==candidate.kind)return -Infinity;
 let score=0;
 if(correct.group&&candidate.group===correct.group)score+=100;
 const correctGenus=correct.scientificName?.trim().split(/\s+/)[0]?.toLocaleLowerCase(),candidateGenus=candidate.scientificName?.trim().split(/\s+/)[0]?.toLocaleLowerCase();
 if(correctGenus&&candidateGenus===correctGenus)score+=70;
 score+=Math.min(2,overlap(correct.areaIds||[],candidate.areaIds||[]))*22;
 const traits=speciesWords(correct),shared=[...speciesWords(candidate)].filter(word=>traits.has(word)).length;
 score+=Math.min(12,shared)*3;
 return score;
}

export function smartChoices(correct,pool,count=4,round=0){
 const distractors=pool.filter(candidate=>candidate.id!==correct.id&&candidate.kind===correct.kind).sort((a,b)=>distractorScore(correct,b)-distractorScore(correct,a)||hash(`${correct.id}:${a.id}`)-hash(`${correct.id}:${b.id}`)).slice(0,Math.max(1,count-1));
 return [correct,...distractors].sort((a,b)=>hash(`${correct.id}:${round}:${a.id}`)-hash(`${correct.id}:${round}:${b.id}`));
}

const photoOf=species=>species?.photos?.find(photo=>photo?.url);
const randomSeed=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}:${Math.random()}`;
const shuffle=(values,seed)=>values.slice().sort((a,b)=>hash(`${seed}:${a.id}`)-hash(`${seed}:${b.id}`));
const eligible=(trip,mode)=>trip.wildlife?.species?.filter(species=>photoOf(species)&&(mode==='mixed'||(mode==='animals'&&species.kind==='fauna')||(mode==='plants'&&species.kind==='flora')))||[];

function gameSession(guideId,mode,species){
 const key=`${guideId}:${mode}`,signature=species.map(item=>item.id).sort().join('|');let session=sessions.get(key);
 if(!session||session.signature!==signature){session={signature,seed:randomSeed(),cycle:0,queue:[],current:null,answered:0,correct:0,streak:0,round:0,result:null};sessions.set(key,session);}
 return session;
}
function nextSpecies(session,species){
 if(!session.queue.length)session.queue=shuffle(species,`${session.seed}:${session.cycle++}`).map(item=>item.id);
 const id=session.queue.shift();session.current=species.find(item=>item.id===id)||species[0];session.round+=1;session.result=null;return session.current;
}
function repeatLater(session,id){if(session.queue.includes(id))return;session.queue.splice(Math.min(3,session.queue.length),0,id);}
export const clearGameSessions=()=>{sessions.clear();selectedModes.clear();};

export function renderGamesView(entry,trip,ui){
 const {h,image,main,empty,ask}=ui,wildlife=trip.wildlife;
 if(!wildlife?.species?.length){main.replaceChildren(empty('No wildlife quiz yet.','This guidebook does not contain flora or fauna to learn.'));return;}
 const mode=selectedModes.get(entry.id)||'mixed',species=eligible(trip,mode);
 const shell=h('section',{class:'games-view'}),modes=h('div',{class:'segmented games-modes','aria-label':'Quiz category'},...[["mixed","Mixed"],["animals","Animals"],["plants","Plants"]].map(([value,label])=>h('button',{type:'button',class:value===mode?'active':'','aria-pressed':value===mode,onclick:()=>{selectedModes.set(entry.id,value);renderGamesView(entry,trip,ui);}},label))),startOver=h('button',{type:'button',class:'text-action game-reset',onclick:async()=>{if(!await ask('Start this quiz over?','Your score, streak, current question, and retry queue will be reset.','Start over'))return;sessions.delete(`${entry.id}:${mode}`);renderGamesView(entry,trip,ui);}},'Start over');
 const controls=h('div',{class:'game-controls'},modes,startOver),host=h('div',{class:'game-host'});shell.append(controls,host);main.replaceChildren(shell);
 if(species.length<2){host.replaceChildren(empty('Not enough photos for this quiz.','Add at least two photographed species in this category.'));return;}
 const session=gameSession(entry.id,mode,species);if(!session.current||!species.some(item=>item.id===session.current.id))nextSpecies(session,species);
 function draw(){
  const current=session.current,photo=photoOf(current),choices=smartChoices(current,species,4,`${session.seed}:${session.round}`),answered=Boolean(session.result);
  const stats=h('div',{class:'game-stats'},h('span',{},h('strong',{},session.correct),h('small',{},'Correct')),h('span',{},h('strong',{},session.answered),h('small',{},'Answered')),h('span',{},h('strong',{},session.streak),h('small',{},'Streak')));
  const photoFrame=h('div',{class:'game-photo'},image(photo.url,'Wildlife quiz photograph'));
  const choiceList=h('div',{class:'game-choices'});
  for(const choice of choices){const correct=choice.id===current.id,selected=session.result?.choiceId===choice.id,classes=['game-choice'];if(answered&&correct)classes.push('correct');else if(answered&&selected)classes.push('incorrect');choiceList.append(h('button',{type:'button',class:classes.join(' '),disabled:answered,'aria-label':choice.name,onclick:()=>answer(choice.id)},h('span',{},choice.name)));}
  const content=h('div',{class:'game-content'},h('p',{class:'game-question'},current.kind==='flora'?'Which plant is this?':'Which animal is this?'),choiceList);
  if(!answered)content.append(h('button',{type:'button',class:'text-action game-unsure',onclick:()=>answer(null)},'I’m not sure'),stats);
  else{const correct=session.result.correct,wildlifeKind=wildlife.browseByArea&&current.areaIds?.[0]?`region-${current.areaIds[0]}`:current.kind,wildlifeHref=`#/wildlife/${entry.id}/${wildlifeKind}/${current.id}`,feedback=h('div',{class:`game-feedback ${correct?'correct':'incorrect'}`,role:'status','aria-live':'polite'},h('h2',{},correct?'Correct':`This is ${current.name}`),current.scientificName?h('p',{class:'game-scientific'},h('i',{},current.scientificName)):null,current.identification?.[0]?h('p',{},current.identification[0]):null,h('div',{class:'game-feedback-actions'},h('a',{class:'button',href:wildlifeHref},'View in Wildlife'),h('button',{type:'button',class:'button primary',onclick:()=>{nextSpecies(session,species);draw();}},'Next question')));content.append(feedback,stats);queueMicrotask(()=>feedback.querySelector('button')?.focus());}
  host.replaceChildren(h('article',{class:'panel game-card'},photoFrame,content));
 }
 function answer(choiceId){if(session.result)return;const correct=choiceId===session.current.id;session.answered+=1;if(correct){session.correct+=1;session.streak+=1;}else{session.streak=0;repeatLater(session,session.current.id);}session.result={choiceId,correct};draw();}
 draw();
}
