import {speciesNotes,wildlifeRecordId} from './wildlife-tracking.js';

const browsing=new Map();
export const clearWildlifeBrowsing=()=>browsing.clear();
export const wildlifeHref=(guideId,kind='',speciesId='')=>`#/wildlife/${guideId}${kind?`/${kind}`:''}${speciesId?`/${speciesId}`:''}`;
export const wildlifeModes=()=>['guide'];
const labels={fauna:'Fauna',flora:'Flora'};
const preferredGroups=['Mammals','Birds','Reptiles','Amphibians','Fish','Butterflies','Dragonflies','Other insects','Other invertebrates','Trees','Palms','Shrubs','Climbers','Herbs','Ferns','Aquatic plants'];
const today=()=>{const value=new Date(),year=value.getFullYear(),month=String(value.getMonth()+1).padStart(2,'0'),day=String(value.getDate()).padStart(2,'0');return `${year}-${month}-${day}`;};

export function speciesMatches(species,query,areaId='') {
  const needle=query.trim().toLocaleLowerCase();
  return (!areaId || (species.areaIds || species.where.map(w=>w.areaId)).includes(areaId)) && (!needle || [species.name,species.scientificName,species.group,species.status,...species.aliases,...species.identification,...species.summary,...species.lookalikes.flatMap(a=>[a.name,a.distinction])].join(' ').toLocaleLowerCase().includes(needle));
}

export function renderWildlifeView(entry,trip,route,ui) {
  const {h,link,back,image,main,empty,guideParagraph,external,dateLabel,showPhotos,applyBackground,tracker}=ui;
  const wildlife=trip.wildlife,all=wildlife?.species || [],records=tracker.records,notes=tracker.notes;
  if(!wildlife || !all.length){main.replaceChildren(empty('No wildlife guide here yet.','Import an updated guidebook file in Settings to add plants and animals.'));return;}
  const root=wildlifeHref(entry.id);let kind=route.day;
  if(['seen','outings'].includes(kind)){history.replaceState(null,'',root);kind='';}
  const region=wildlife.browseByArea?wildlife.areas.find(a=>`region-${a.id}`===kind):null;
  const record=s=>records.get(wildlifeRecordId(entry.id,s.id)),isSeen=s=>record(s)?.seen===true,speciesPhoto=s=>record(s)?.photo||s?.photos?.[0];
  const card=(s,href)=>{const photo=speciesPhoto(s);return h('article',{class:'attraction-card wildlife-card'},link([image(photo?.thumbnailUrl||photo?.url,'',photo?'':'placeholder'),h('div',{class:'attraction-body'},h('h2',{},s.name),h('p',{},h('i',{},s.scientificName)),isSeen(s)?h('span',{class:'seen-badge'},'Seen'):null)],href,{class:'attraction-link'}));};

  const title=region?.name||labels[kind],groupOf=s=>region?(s.kind==='flora'?'Plants':s.group==='Birds'?'Birds':'Other animals'):s.group;
  if(!labels[kind]&&!region){
    const landing=wildlife.browseByArea?wildlife.areas.map(area=>{const entries=all.filter(s=>s.areaIds.includes(area.id)),sample=entries.find(s=>speciesPhoto(s)),photo=speciesPhoto(sample);return h('article',{class:'attraction-card wildlife-category'},link([image(photo?.url,'',photo?'':'placeholder'),h('div',{class:'attraction-body'},h('h2',{},area.name),h('p',{},area.description))],wildlifeHref(entry.id,`region-${area.id}`),{class:'attraction-link'}));}):['fauna','flora'].map(k=>{const species=all.filter(s=>s.kind===k),sample=species.find(s=>speciesPhoto(s)),photo=speciesPhoto(sample);return h('article',{class:'attraction-card wildlife-category'},link([image(photo?.url,'',photo?'':'placeholder'),h('div',{class:'attraction-body'},h('h2',{},labels[k]),h('p',{},k==='fauna'?'Animals to look for':'Plants to look for'))],wildlifeHref(entry.id,k),{class:'attraction-link'}));});
    if(landing.length===2)document.body.classList.add('wildlife-pair-view');
    main.replaceChildren(h('div',{class:`wildlife-landing attraction-grid${landing.length===2?' wildlife-landing-pair':''}`},...landing));return;
  }

  const sectionHref=wildlifeHref(entry.id,kind),species=all.filter(s=>region?s.areaIds.includes(region.id):s.kind===kind);
  if(route.attraction){
    const s=species.find(s=>s.id===route.attraction);if(!s){main.replaceChildren(back(title,sectionHref),empty('Species not found','Choose a plant or animal from this guide.'));return;}
    const personal=record(s),seen=isSeen(s),photos=[...(personal?.photo?[personal.photo]:[]),...s.photos.filter(p=>p.url!==personal?.photo?.url)],article=h('article',{class:'article wildlife-detail'},back(title,sectionHref),h('h1',{},s.name),h('p',{class:'article-location'},h('i',{},s.scientificName)));
    if(photos.length)article.append(h('div',{class:'photo-gallery wildlife-photo-gallery','aria-label':'Species photos'},...photos.map((p,index)=>h('button',{class:'photo-tile',type:'button','aria-label':`View photo ${index+1} of ${s.name}`,onclick:()=>showPhotos(photos,index,s.name)},image(p.url,s.name)))));
    const coverFile=h('input',{type:'file',accept:'image/*',class:'sr-only'});coverFile.addEventListener('change',()=>{if(coverFile.files?.[0])tracker.replacePhoto(s,coverFile.files[0]);coverFile.value='';});
    const journal=h('section',{class:'panel species-journal'});
    journal.append(h('div',{class:'species-journal-heading'},h('div',{},h('h2',{},'Seen'),h('p',{class:'muted'},seen?'Marked as seen':'Not seen yet')),h('button',{type:'button',class:'button primary',onclick:()=>tracker.toggleSeen(s)},seen?'Mark not seen':'Mark seen')),h('div',{class:'species-actions'},h('button',{type:'button',class:'button',onclick:()=>coverFile.click()},personal?.photo?'Replace my cover photo':'Add my cover photo'),coverFile));

    const noteList=speciesNotes(notes,entry.id,s.id),editorHost=h('div',{class:'wildlife-note-editor-host'}),timeline=h('div',{class:'wildlife-note-timeline'});
    const closeEditor=()=>editorHost.replaceChildren();
    const openEditor=(existing=null)=>{
      let selectedFile=null,previewUrl='',removePhoto=false,saving=false;
      const dateInput=h('input',{type:'date',required:true,value:existing?.date||today(),'aria-label':'Note date'}),noteInput=h('textarea',{rows:5,maxlength:5000,placeholder:'What did you notice?','aria-label':`Note about ${s.name}`}),fileInput=h('input',{type:'file',accept:'image/*',class:'sr-only'}),preview=h('div',{class:'wildlife-note-preview'}),error=h('p',{class:'error',role:'alert'}),save=h('button',{type:'button',class:'button primary'},'Save'),cancel=h('button',{type:'button',class:'button ghost'},'Cancel');
      noteInput.value=existing?.note||'';
      const clearPreviewUrl=()=>{if(previewUrl.startsWith('blob:'))URL.revokeObjectURL(previewUrl);previewUrl='';};
      const drawPreview=()=>{preview.replaceChildren();const photoUrl=selectedFile?previewUrl:(!removePhoto?existing?.photo?.url:'');if(!photoUrl)return;preview.append(h('button',{type:'button',class:'wildlife-note-preview-photo','aria-label':'View attached photo',onclick:()=>showPhotos([{url:photoUrl}],0,s.name)},image(photoUrl,s.name)),h('button',{type:'button',class:'text-action danger',onclick:()=>{selectedFile=null;removePhoto=true;fileInput.value='';clearPreviewUrl();drawPreview();}},'Remove photo'));};
      fileInput.addEventListener('change',()=>{const file=fileInput.files?.[0];if(!file)return;clearPreviewUrl();selectedFile=file;removePhoto=false;previewUrl=URL.createObjectURL(file);drawPreview();});
      cancel.onclick=()=>{clearPreviewUrl();closeEditor();};
      save.onclick=async()=>{if(saving)return;const note=noteInput.value.trim(),hasPhoto=selectedFile||(!removePhoto&&existing?.photo);error.textContent='';if(!dateInput.value){error.textContent='Choose a date.';return;}if(!note&&!hasPhoto){error.textContent='Add a note, a photo, or both.';return;}saving=true;save.disabled=cancel.disabled=true;save.textContent='Saving…';try{await tracker.saveNote(s,{existing,date:dateInput.value,note,file:selectedFile,removePhoto});clearPreviewUrl();}catch(reason){error.textContent=reason.message||'The note could not be saved.';saving=false;save.disabled=cancel.disabled=false;save.textContent='Save';}};
      const attach=h('button',{type:'button',class:'button',onclick:()=>fileInput.click()},existing?.photo?'Replace photo':'Attach photo');
      const form=h('section',{class:'wildlife-note-form'},h('label',{class:'field-label'},h('span',{},'Date'),dateInput),h('label',{class:'field-label'},h('span',{},'Note'),noteInput),h('div',{class:'species-actions'},attach,fileInput),preview,error,h('div',{class:'wildlife-note-form-actions'},cancel,save));drawPreview();editorHost.replaceChildren(form);dateInput.focus();
    };
    for(const item of noteList){const body=h('div',{class:'wildlife-note-body'},h('time',{datetime:item.date},dateLabel(item.date)),item.note?h('p',{},item.note):null,h('div',{class:'wildlife-note-actions'},h('button',{type:'button',class:'text-action',onclick:()=>openEditor(item)},'Edit'),h('button',{type:'button',class:'text-action danger',onclick:()=>tracker.deleteNote(s,item)},'Delete'))),note=h('article',{class:'wildlife-note'});if(item.photo)note.append(h('button',{type:'button',class:'wildlife-note-photo','aria-label':`View photo from ${dateLabel(item.date)}`,onclick:()=>showPhotos([item.photo],0,s.name)},image(item.photo.url,s.name)));note.append(body);timeline.append(note);}
    if(!noteList.length)timeline.append(h('div',{class:'wildlife-notes-empty'},h('p',{},'No notes yet.'),h('p',{class:'muted'},'Add a note whenever you see this species.')));
    journal.append(h('div',{class:'species-notes-heading'},h('h2',{},'My Notes'),h('button',{type:'button',class:'button',onclick:()=>openEditor()},'Add Note')),editorHost,timeline);
    article.append(journal,h('section',{class:'guide-text identification'},h('h2',{},'How to recognise'),h('ul',{},...s.identification.map(p=>h('li',{},p)))),h('section',{class:'guide-text'},h('h2',{},'At a glance'),...s.summary.map(p=>guideParagraph(trip,p))));
    const wikipedia=s.wikipediaUrl||s.sources.find(source=>/(^|\.)wikipedia\.org$/.test(new URL(source.url).hostname))?.url;if(wikipedia)article.append(h('div',{class:'sources'},external('Read on Wikipedia',wikipedia)));main.replaceChildren(article);applyBackground(article,photos[0]);return;
  }

  const stateKey=`${entry.id}/${kind}`,saved=browsing.get(stateKey)||{query:'',area:'',seen:'all'};browsing.set(stateKey,saved);const areas=wildlife.areas.filter(a=>species.some(s=>s.areaIds.includes(a.id)));if(!areas.some(a=>a.id===saved.area))saved.area='';const results=h('div',{class:'wildlife-results','aria-live':'polite'}),jump=h('nav',{class:'wildlife-group-jump','aria-label':'Jump to a group'}),search=h('input',{type:'search',id:'wildlifeSearch',placeholder:`Search ${title.toLowerCase()}`,value:saved.query,'aria-label':`Search ${title.toLowerCase()}`}),filters=h('div',{class:'wildlife-areas','aria-label':'Wildlife filters'});
  function update(){const matches=species.filter(s=>speciesMatches(s,saved.query,region?.id||saved.area)&&(saved.seen==='all'||(saved.seen==='seen')===isSeen(s))),groups=[...new Set(matches.map(groupOf))].sort((a,b)=>{const order=region?['Plants','Birds','Other animals']:preferredGroups,ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b);});jump.replaceChildren();results.replaceChildren();if(!matches.length){results.append(h('p',{class:'muted'},'No matching species. Try another filter.'));return;}for(const [index,group] of groups.entries()){const id=`wildlife-group-${index}`;if(groups.length>1)jump.append(h('button',{type:'button',class:'button ghost',onclick:()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})},group));results.append(h('section',{class:'wildlife-group',id},h('h2',{},group),h('div',{class:'attraction-grid'},...matches.filter(s=>groupOf(s)===group).sort((a,b)=>a.name.localeCompare(b.name)).map(s=>card(s,wildlifeHref(entry.id,kind,s.id))))));}}
  search.addEventListener('input',()=>{saved.query=search.value;update();});for(const [value,label] of [['all','All'],['unseen','Not seen'],['seen','Seen']])filters.append(h('button',{type:'button',class:`button ghost ${saved.seen===value?'active':''}`,onclick:()=>{saved.seen=value;renderWildlifeView(entry,trip,route,ui);}},label));if(!region&&areas.length>1)for(const area of [{id:'',name:'All areas'},...areas])filters.append(h('button',{type:'button',class:`button ghost ${saved.area===area.id?'active':''}`,onclick:()=>{saved.area=area.id;renderWildlifeView(entry,trip,route,ui);}},area.name));main.replaceChildren(back('Wildlife',root),h('h1',{},title),h('div',{class:'search-wrap wildlife-search'},search),filters,jump,results);update();
}
