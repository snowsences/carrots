const sessions=new Map(),selectedModes=new Map(),difficulties=new Map(),learning=new Map(),failedPhotos=new Set();
const DAY=86400000,storagePrefix='carrots-learning-v1:';let owner='',storageWarning=false;
export function setGameUser(uid){if(owner===uid)return;clearGameSessions();owner=uid||'';if(!owner)return;try{const raw=JSON.parse(localStorage.getItem(storagePrefix+owner)||'null');if(raw?.version===1){for(const [key,value] of raw.sessions||[])if(value&&typeof value.seed==='string'&&Array.isArray(value.queue)&&Number.isFinite(value.round))sessions.set(key,value);for(const [key,value] of raw.learning||[])if(value&&Number.isFinite(value.attempts))learning.set(key,value);for(const [key,value] of raw.modes||[])if(['mixed','animals','plants'].includes(value))selectedModes.set(key,value);for(const [key,value] of raw.difficulties||[])if(['adaptive','beginner','intermediate','advanced','expert'].includes(value))difficulties.set(key,value);}}catch{storageWarning=true;}}
function persistGames(){if(!owner)return;try{localStorage.setItem(storagePrefix+owner,JSON.stringify({version:1,sessions:[...sessions],learning:[...learning],modes:[...selectedModes],difficulties:[...difficulties]}));storageWarning=false}catch{storageWarning=true}}
export function taxonKey(species){return species.kind+':'+normalizedName(species.scientificName||species.name||species.id)}
const profileFor=species=>learning.get(taxonKey(species))||{};
export function recordReview(previous={},correct,now=Date.now(),{retry=false,photo='',confusedWith=''}={}){
 const p={attempts:0,correct:0,stage:0,due:0,lapses:0,photos:{},confusions:{},...previous,photos:{...previous.photos},confusions:{...previous.confusions}};
 p.attempts++;p.correct+=Number(correct);p.lastAt=now;if(photo)p.photos[photo]=(p.photos[photo]||0)+1;
 if(!correct){p.lapses++;p.stage=Math.max(0,p.stage-1);p.due=now;if(confusedWith)p.confusions[confusedWith]=(p.confusions[confusedWith]||0)+1;}
 else if(!retry||!p.lastSuccess){p.stage=Math.min(5,p.stage+1);p.due=now+[0,1,3,7,14,28][p.stage]*DAY;p.lastSuccess=now;}
 else {p.due=Math.max(p.due||0,now+DAY);p.lastSuccess=now;}
 return p;
}
export function adaptiveLevel(p={}){return (p.stage||0)>=4?'advanced':(p.stage||0)>=2?'intermediate':'beginner'}
export function scheduleRetry(queue,id,delay=3){const next=queue.filter(x=>x!==id);next.splice(Math.min(delay,next.length),0,id);return next}
export function reviewPriority(p={},now=Date.now()){return !p.attempts?80:p.due<=now?100+Math.min(50,(now-p.due)/DAY)+Math.min(20,(p.lapses||0)*2):Math.max(0,30-(p.due-now)/DAY)}
export function chooseReviewQueue(species,profiles,seed,now=Date.now(),previousId=''){const rows=species.slice().sort((a,b)=>reviewPriority(profiles.get(taxonKey(b)),now)-reviewPriority(profiles.get(taxonKey(a)),now)||hash(seed+':'+a.id)-hash(seed+':'+b.id));if(rows.length>1&&rows[0].id===previousId)rows.push(rows.shift());return rows.map(x=>x.id)}

const STOP_WORDS=new Set(['about','after','also','and','are','around','back','black','brown','can','common','dark','from','green','have','into','light','look','more','most','often','other','small','than','that','the','their','this','through','under','very','when','white','with','yellow']);

const hash=value=>{let result=2166136261;for(const character of value){result^=character.charCodeAt(0);result=Math.imul(result,16777619);}return result>>>0;};
const words=value=>new Set(String(value||'').toLocaleLowerCase().match(/[a-z]{4,}/g)?.filter(word=>!STOP_WORDS.has(word))||[]);
const overlap=(left=[],right=[])=>{const values=new Set(left);return right.reduce((count,value)=>count+Number(values.has(value)),0);};
const vocabulary=new WeakMap(),visualWords=new WeakMap();
const speciesWords=species=>{if(!species)return new Set();if(!vocabulary.has(species))vocabulary.set(species,words([species.name,species.scientificName,species.group,...(species.aliases||[]),...(species.identification||[]),...(species.summary||[])].join(' ')));return vocabulary.get(species)};
const traits=species=>{if(!visualWords.has(species))visualWords.set(species,new Set(String((species.identification||[]).join(' ')).toLowerCase().match(/[a-z]{3,}/g)||[]));return visualWords.get(species)};
const sameName=(a,b)=>speciesNames(a).some(n=>speciesNames(b).includes(n));


export function distractorScore(correct,candidate){
 if(!correct||!candidate||correct.id===candidate.id||correct.kind!==candidate.kind||sameName(correct,candidate))return -Infinity;
 let score=0;
 if(lookalikeFor(correct,candidate)||lookalikeFor(candidate,correct))score+=240;
 if(correct.family&&correct.family===candidate.family)score+=45;
 if(correct.group&&candidate.group===correct.group)score+=100;
 const correctGenus=correct.scientificName?.trim().split(/\s+/)[0]?.toLocaleLowerCase(),candidateGenus=candidate.scientificName?.trim().split(/\s+/)[0]?.toLocaleLowerCase();
 if(correctGenus&&candidateGenus===correctGenus)score+=70;
 score+=Math.min(2,overlap(correct.areaIds||[],candidate.areaIds||[]))*22;
 const tokens=speciesWords(correct),shared=[...speciesWords(candidate)].filter(word=>tokens.has(word)).length,visual=traits(correct);
 score+=Math.min(12,shared)*2+Math.min(15,[...traits(candidate)].filter(word=>visual.has(word)).length)*4;
 return score;
}

const CHOICE_ALGORITHM_VERSION=2;
const sameGroup=(a,b)=>Boolean(a.group&&b.group&&normalizedName(a.group)===normalizedName(b.group));
export function smartChoices(correct,pool,count=4,round=0,options={}){
 const {level='intermediate',confusions={}}=options;
 // Taxonomic group is a hard priority, not a bonus that randomization or difficulty can erase.
 // Fall back to other groups only when there are too few distinct same-group candidates.
 const candidates=pool.map(c=>{
  const base=distractorScore(correct,c);if(!Number.isFinite(base))return null;
  const explicit=Boolean(lookalikeFor(correct,c)||lookalikeFor(c,correct)),personal=Math.min(200,(confusions[taxonKey(c)]||0)*32),noise=hash(correct.id+':'+round+':'+c.id)/4294967296;
  const tier=sameGroup(correct,c)?0:explicit?1:2;
  const score=level==='beginner'?base*.65+personal*.3+noise*65:base+personal+noise*(level==='advanced'?18:45);
  return {candidate:c,tier,score};
 }).filter(Boolean).sort((a,b)=>a.tier-b.tier||b.score-a.score||a.candidate.id.localeCompare(b.candidate.id));
 const result=[correct];for(const {candidate:c} of candidates){if(result.length>=count)break;if(!result.some(x=>x.id===c.id||sameName(x,c)))result.push(c)}
 return result.sort((a,b)=>hash(correct.id+':'+round+':'+a.id)-hash(correct.id+':'+round+':'+b.id));
}

const normalizedName=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const speciesNames=species=>[species?.name,species?.scientificName,...(species?.aliases||[])].map(normalizedName).filter(Boolean);
const lookalikeFor=(correct,selected)=>{const names=speciesNames(selected);return (correct?.lookalikes||[]).find(item=>{const name=normalizedName(item?.name);return name&&names.some(candidate=>name===candidate||(' '+name+' ').includes(' '+candidate+' '));});};
const featureTerms=/\b(bill|beak|wing|tail|plumage|stripe|barred|spotted|leaf|leaves|needle|flower|petal|bark|cone|fruit|stem|shape|size|color|colour|eyes|ears|legs|feet|pattern|crest|fur|scale)\b/gi;
const bestRecognition=(species,other)=>{const options=(species?.identification?.length?species.identification:species?.summary||[]).filter(Boolean),otherTerms=speciesWords(other);return [...options].sort((left,right)=>{const score=value=>(String(value).match(featureTerms)||[]).length*45+[...words(value)].filter(word=>!otherTerms.has(word)).length*5-Math.abs(String(value).length-130)*.1;return score(right)-score(left);})[0]||'';};

export function wrongAnswerExplanation(correct,selected){
 const correctClue=bestRecognition(correct,selected);
 if(!selected)return {correctClue,selectedName:'',difference:'',explicit:false};
 const explicit=lookalikeFor(correct,selected)||lookalikeFor(selected,correct),difference=explicit?.distinction||bestRecognition(selected,correct);
 return {correctClue,selectedName:selected.name||'',difference,explicit:Boolean(explicit?.distinction)};
}

const photoOf=species=>species?.photos?.find(photo=>photo?.url&&!failedPhotos.has(photo.url));
const randomSeed=()=>globalThis.crypto?.randomUUID?.()||Date.now()+':'+Math.random();
export function eligibleSpecies(trip,mode,failed=new Set()){
 const all=(trip.wildlife?.species||[]).filter(s=>s.photos?.some(p=>p.url&&!failed.has(p.url))&&(mode==='mixed'||mode==='animals'&&s.kind==='fauna'||mode==='plants'&&s.kind==='flora'));
 const unique=all.filter((s,i)=>all.findIndex(x=>taxonKey(x)===taxonKey(s)||sameName(x,s))===i);return unique.filter(s=>unique.some(other=>other.id!==s.id&&other.kind===s.kind&&!sameName(s,other)));
}
export function selectQuizPhoto(species,p={},seed='',failed=new Set(),previous=''){
 const photos=(species.photos||[]).filter((v,i,a)=>v.url&&!failed.has(v.url)&&a.findIndex(x=>x.url===v.url)===i);
 const available=photos.length>1?photos.filter(v=>v.url!==previous):photos;
 return available.sort((a,b)=>(p.photos?.[a.url]||0)-(p.photos?.[b.url]||0)||hash(seed+':'+a.url)-hash(seed+':'+b.url))[0];
}
function gameSession(guideId,mode,species,revision,setting){
 const key=guideId+':'+mode+':'+setting,signature=species.map(item=>item.id+':'+taxonKey(item)).sort().join('|');let session=sessions.get(key);
 if(!session){session={signature,revision,seed:randomSeed(),cycle:0,queue:[],currentId:null,answered:0,correct:0,streak:0,round:0,result:null,retries:[],photoUrl:'',previousPhotos:{},choiceIds:[]};sessions.set(key,session);}
 if(session.signature!==signature||session.revision!==revision){session.signature=signature;session.revision=revision;session.queue=session.queue.filter(id=>species.some(s=>s.id===id));if(!species.some(s=>s.id===session.currentId)||!session.result){session.currentId=null;session.result=null;session.choiceIds=[];}session.retries=(session.retries||[]).filter(id=>species.some(s=>s.id===id));}
 return session;
}
function nextSpecies(session,species,setting){
 const previous=session.currentId;if(!session.queue.length)session.queue=chooseReviewQueue(species,learning,session.seed+':'+session.cycle++,Date.now(),previous);
 if(session.queue[0]===previous&&session.queue.length>1){session.queue.push(session.queue.shift())}
 const id=session.queue.shift(),current=species.find(item=>item.id===id)||species[0];session.currentId=current.id;session.round++;session.result=null;session.choiceIds=[];session.isRetry=(session.retries||[]).includes(current.id);session.retries=(session.retries||[]).filter(x=>x!==current.id);
 session.level=setting==='adaptive'?adaptiveLevel(profileFor(current)):setting;
 session.previousPhotos||={};const p=selectQuizPhoto(current,profileFor(current),session.seed+':'+session.round,failedPhotos,session.previousPhotos[current.id]);session.photoUrl=p?.url||'';session.previousPhotos[current.id]=session.photoUrl;persistGames();return current;
}
export const clearGameSessions=()=>{sessions.clear();selectedModes.clear();difficulties.clear();learning.clear();failedPhotos.clear();owner='';storageWarning=false;};
export function matchesSpeciesAnswer(species,value){const name=normalizedName(value);return !!name&&speciesNames(species).includes(name)}
export function renderGamesView(entry,trip,ui){
 const {h,image,main,empty,ask}=ui,wildlife=trip.wildlife;
 if(!wildlife?.species?.length){main.replaceChildren(empty('No wildlife quiz yet.','This guidebook does not contain flora or fauna to learn.'));return;}
 const mode=selectedModes.get(entry.id)||'mixed',setting=difficulties.get(entry.id)||'adaptive',species=eligibleSpecies(trip,mode,failedPhotos);
 const shell=h('section',{class:'games-view'}),modes=h('div',{class:'segmented games-modes','aria-label':'Quiz category'},...[["mixed","Mixed"],["animals","Animals"],["plants","Plants"]].map(([value,label])=>h('button',{type:'button',class:value===mode?'active':'','aria-pressed':value===mode,onclick:()=>{selectedModes.set(entry.id,value);persistGames();renderGamesView(entry,trip,ui);}},label))),startOver=h('button',{type:'button',class:'text-action game-reset',onclick:async()=>{if(!await ask('Start this quiz over?','Your score, streak, current question, and retry queue will be reset.','Start over'))return;sessions.delete(`${entry.id}:${mode}:${setting}`);persistGames();renderGamesView(entry,trip,ui);}},'Start over');
 const controls=h('div',{class:'game-controls'},modes,startOver),host=h('div',{class:'game-host'});const difficulty=h('select',{'aria-label':'Quiz difficulty',class:'game-difficulty',onchange:event=>{difficulties.set(entry.id,event.target.value);persistGames();renderGamesView(entry,trip,ui);}},...['adaptive','beginner','intermediate','advanced','expert'].map(value=>h('option',{value},value[0].toUpperCase()+value.slice(1))));difficulty.value=setting;shell.append(controls,h('div',{class:'game-difficulty-row'},h('label',{},'Difficulty',difficulty)),host);if(storageWarning)shell.append(h('p',{class:'muted'},'Learning history could not be saved on this device.'));main.replaceChildren(shell);
 if(species.length<2){host.replaceChildren(empty('Not enough photos for this quiz.','Add at least two distinct photographed species in the same flora or fauna category.'));if(failedPhotos.size)host.append(h('button',{class:'button',type:'button',onclick:()=>{failedPhotos.clear();renderGamesView(entry,trip,ui)}},'Retry unavailable photographs'));return;}
 const session=gameSession(entry.id,mode,species,entry.revision,setting);if(!species.some(item=>item.id===session.currentId))nextSpecies(session,species,setting);
 function draw(){
  const current=species.find(item=>item.id===session.currentId),profile=profileFor(current),level=session.level||'intermediate',answered=Boolean(session.result);let photo=current.photos.find(p=>p.url===session.photoUrl&&!failedPhotos.has(p.url))||selectQuizPhoto(current,profile,session.seed+':'+session.round,failedPhotos);if(!photo){renderGamesView(entry,trip,ui);return;}session.photoUrl=photo.url;
  let choices=session.choiceIds?.map(id=>species.find(s=>s.id===id)).filter(Boolean)||[];if(choices.length<2||!choices.some(s=>s.id===current.id)||(!answered&&session.choiceAlgorithmVersion!==CHOICE_ALGORITHM_VERSION)){choices=smartChoices(current,species,4,session.seed+':'+session.round,{level,confusions:profile.confusions});session.choiceIds=choices.map(s=>s.id);session.choiceAlgorithmVersion=CHOICE_ALGORITHM_VERSION;persistGames();}
  const stats=h('div',{class:'game-stats'},h('span',{},h('strong',{},session.correct),h('small',{},'Correct')),h('span',{},h('strong',{},session.answered),h('small',{},'Answered')),h('span',{},h('strong',{},session.streak),h('small',{},'Streak')));
  const picture=image(photo.thumbnailUrl||photo.url,'Wildlife quiz photograph','',photo.url),photoFrame=h('div',{class:'game-photo'},picture);
  if(picture.tagName==='IMG')picture.addEventListener('error',()=>{if(picture.src!==photo.url&&picture.getAttribute('src')!==photo.url)return;setTimeout(()=>{if(!host.isConnected||!photoFrame.isConnected||session.currentId!==current.id)return;failedPhotos.add(photo.url);if(session.result)return;const remaining=selectQuizPhoto(current,profile,session.seed,failedPhotos);if(remaining){session.photoUrl=remaining.url;persistGames();draw()}else{photoFrame.replaceChildren(h('div',{class:'game-photo-unavailable'},h('p',{},'No available photograph for this question.'),h('button',{class:'button',type:'button',onclick:()=>{failedPhotos.delete(photo.url);draw()}},'Retry'),h('button',{class:'button',type:'button',onclick:()=>{session.currentId=null;persistGames();renderGamesView(entry,trip,ui)}},'Skip without scoring')));choiceList.querySelectorAll('button').forEach(b=>b.disabled=true);photoUnavailable=true;session.photoUnavailable=true;}},0);});
  session.photoUnavailable=false;let photoUnavailable=false;
  const choiceList=h('div',{class:'game-choices'});
  for(const choice of choices){const correct=choice.id===current.id,selected=session.result?.choiceId===choice.id,classes=['game-choice'];if(answered&&correct)classes.push('correct');else if(answered&&selected)classes.push('incorrect');choiceList.append(h('button',{type:'button',class:classes.join(' '),disabled:answered,'aria-label':choice.name,onclick:()=>answer(choice.id)},h('span',{},choice.name)));}
  const content=h('div',{class:'game-content'},h('p',{class:'game-question'},current.kind==='flora'?'Which plant is this?':'Which animal is this?'));
  if(!answered){if(level==='expert'){const input=h('input',{type:'text',placeholder:'Common or scientific name',autocomplete:'off','aria-label':'Species name'}),form=h('form',{class:'game-free-answer',onsubmit:event=>{event.preventDefault();if(input.value.trim())answer(matchesSpeciesAnswer(current,input.value)?current.id:choices.find(s=>matchesSpeciesAnswer(s,input.value))?.id||null);}},input,h('button',{type:'submit',class:'button primary'},'Check'));content.append(form);}else content.append(choiceList);content.append(h('button',{type:'button',class:'text-action game-unsure',onclick:()=>answer(null)},'I’m not sure'),stats);}
  else{const animate=session.revealResult===true;session.revealResult=false;const correct=session.result.correct,selected=species.find(item=>item.id===session.result.choiceId),explanation=!correct?wrongAnswerExplanation(current,selected):null,wildlifeKind=wildlife.browseByArea&&current.areaIds?.[0]?`region-${current.areaIds[0]}`:current.kind,wildlifeHref=`#/wildlife/${entry.id}/${wildlifeKind}/${current.id}`,details=correct?(current.identification?.[0]?h('p',{},current.identification[0]):null):explanation&&(explanation.correctClue||explanation.difference)?h('div',{class:'game-explanation'},explanation.correctClue?h('section',{},h('h3',{},`Identification clues for ${current.name}`),h('p',{},explanation.correctClue)):null,explanation.difference?h('section',{},h('h3',{},explanation.explicit?'How they differ':`Recognition clues for ${explanation.selectedName}`),h('p',{},explanation.difference)):null):null,feedback=h('div',{class:`game-feedback ${correct?'correct':'incorrect'}`,role:'status','aria-live':'polite',tabindex:'-1'},h('h2',{},correct?'Correct':`This is ${current.name}`),current.scientificName?h('p',{class:'game-scientific'},h('i',{},current.scientificName)):null,details,h('div',{class:'game-feedback-actions'},h('a',{class:'button',href:wildlifeHref},'View in Wildlife'),h('button',{type:'button',class:'button primary',onclick:advanceQuestion},'Next question'))),reveal=h('div',{class:`game-feedback-reveal${animate?' animate':''}`},h('div',{class:'game-feedback-clip'},feedback));content.append(reveal,choiceList,stats);queueMicrotask(()=>feedback.focus({preventScroll:true}));}
  host.replaceChildren(h('article',{class:'panel game-card'},photoFrame,content));
 }
 let transitioning=false;
 async function advanceQuestion(){
  if(transitioning)return;transitioning=true;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,oldCard=host.firstElementChild;
  if(!reduced&&oldCard?.animate){oldCard.style.pointerEvents='none';try{await oldCard.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-12px)'}],{duration:150,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'}).finished;}catch{}}
  if(!host.isConnected){transitioning=false;return;}nextSpecies(session,species,setting);draw();
  const newCard=host.firstElementChild;
  if(!reduced&&newCard?.animate){try{await newCard.animate([{opacity:0,transform:'translateX(12px)'},{opacity:1,transform:'translateX(0)'}],{duration:210,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'}).finished;}catch{}}
  transitioning=false;
 }
 function answer(choiceId){if(session.result||session.photoUnavailable||!host.isConnected||!host.querySelector('.game-photo img')?.naturalWidth||!photoOf(species.find(s=>s.id===session.currentId)))return;const current=species.find(s=>s.id===session.currentId),correct=choiceId===current.id,chosen=species.find(s=>s.id===choiceId);session.answered++;if(correct){session.correct++;session.streak++;}else{session.streak=0;session.queue=scheduleRetry(session.queue,current.id);session.retries=[...new Set([...(session.retries||[]),current.id])];}learning.set(taxonKey(current),recordReview(profileFor(current),correct,Date.now(),{retry:session.isRetry||profileFor(current).lastSuccess>0&&profileFor(current).due>Date.now(),photo:session.photoUrl,confusedWith:chosen&&!correct?taxonKey(chosen):''}));session.result={choiceId,correct};session.revealResult=true;persistGames();draw();}
 draw();
}
