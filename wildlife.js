// Wildlife is prepared in guidebook files. Browsing never queries a live taxonomy API.
const browsing=new Map();
export const clearWildlifeBrowsing=()=>browsing.clear();
export const wildlifeHref=(tripId,kind='',speciesId='')=>`#/wildlife/${tripId}${kind?`/${kind}`:''}${speciesId?`/${speciesId}`:''}`;
const labels={fauna:'Fauna',flora:'Flora'};
const preferredGroups=['Mammals','Birds','Reptiles','Amphibians','Fish','Butterflies','Dragonflies','Other insects','Other invertebrates','Trees','Palms','Shrubs','Climbers','Herbs','Ferns','Aquatic plants'];
export function speciesMatches(species,query,areaId='') {
  const needle=query.trim().toLocaleLowerCase();
  return (!areaId || (species.areaIds || species.where.map(w=>w.areaId)).includes(areaId)) && (!needle || [species.name,species.scientificName,species.group,species.status,...species.aliases,...species.identification,...species.summary,...species.lookalikes.flatMap(a=>[a.name,a.distinction])].join(' ').toLocaleLowerCase().includes(needle));
}
export function renderWildlifeView(entry,trip,route,ui) {
  const {h,link,back,image,main,empty,guideParagraph,external,showPhotos,applyBackground}=ui;
  const wildlife=trip.wildlife,all=wildlife?.species || [];
  if(!wildlife || !all.length){main.replaceChildren(empty('No wildlife guide here yet.','Import an updated guidebook file in Settings to add plants and animals.'));return;}
  const root=wildlifeHref(entry.id),kind=route.day,region=wildlife.browseByArea?wildlife.areas.find(a=>`region-${a.id}`===kind):null;
  const title=region?.name || labels[kind],groupOf=s=>region?(s.kind==='flora'?'Plants':s.group==='Birds'?'Birds':'Other animals'):s.group;
  const card=(s,href)=>h('article',{class:'attraction-card wildlife-card'},link([image(s.photos[0]?.thumbnailUrl || s.photos[0]?.url,'',s.photos.length?'':'placeholder'),h('div',{class:'attraction-body'},h('h2',{},s.name),h('p',{},h('i',{},s.scientificName)))],href,{class:'attraction-link'}));
  if(!labels[kind] && !region){
    if(wildlife.browseByArea){
      main.replaceChildren(h('div',{class:'wildlife-landing attraction-grid'},...wildlife.areas.map(area=>{
        const entries=all.filter(s=>s.areaIds.includes(area.id)),sample=entries.find(s=>s.photos.length);
        return h('article',{class:'attraction-card wildlife-category'},link([image(sample?.photos[0]?.url,'',sample?'':'placeholder'),h('div',{class:'attraction-body'},h('h2',{},area.name),h('p',{},area.description))],wildlifeHref(entry.id,`region-${area.id}`),{class:'attraction-link'}));
      })));return;
    }
    main.replaceChildren(h('div',{class:'wildlife-landing attraction-grid'},...['fauna','flora'].map(k=>{
      const species=all.filter(s=>s.kind===k),sample=species.find(s=>s.photos.length);
      return h('article',{class:'attraction-card wildlife-category'},link([image(sample?.photos[0]?.url,'',sample?'':'placeholder'),h('div',{class:'attraction-body'},h('h2',{},labels[k]),h('p',{},k==='fauna'?'Animals to look for':'Plants to look for'))],wildlifeHref(entry.id,k),{class:'attraction-link'}));
    })));
    return;
  }
  const sectionHref=wildlifeHref(entry.id,kind),species=all.filter(s=>region?s.areaIds.includes(region.id):s.kind===kind);
  if(route.attraction){
    const s=species.find(s=>s.id===route.attraction);
    if(!s){main.replaceChildren(back(title,sectionHref),empty('Species not found','Choose a plant or animal from this guide.'));return;}
    const article=h('article',{class:'article wildlife-detail'},back(title,sectionHref),h('h1',{},s.name),h('p',{class:'article-location'},h('i',{},s.scientificName)));
    if(s.photos.length)article.append(h('div',{class:'photo-gallery','aria-label':'Species photos'},...s.photos.map((p,index)=>h('button',{class:'photo-tile',type:'button','aria-label':`View photo ${index+1} of ${s.name}`,onclick:()=>showPhotos(s.photos,index,s.name)},image(p.url,s.name)))));
    article.append(h('section',{class:'guide-text identification'},h('h2',{},'How to recognise'),h('ul',{},...s.identification.map(p=>h('li',{},p)))));
    article.append(h('section',{class:'guide-text'},h('h2',{},'At a glance'),...s.summary.map(p=>guideParagraph(trip,p))));
    const wikipedia=s.wikipediaUrl || s.sources.find(source=>/(^|\.)wikipedia\.org$/.test(new URL(source.url).hostname))?.url;
    if(wikipedia)article.append(h('div',{class:'sources'},external('Read on Wikipedia',wikipedia)));
    main.replaceChildren(article);applyBackground(article,s.photos[0]);return;
  }
  const stateKey=`${entry.id}/${kind}`,saved=browsing.get(stateKey)||{query:'',area:''};browsing.set(stateKey,saved);
  const areas=wildlife.areas.filter(a=>species.some(s=>s.areaIds.includes(a.id)));
  if(!areas.some(a=>a.id===saved.area))saved.area='';
  const results=h('div',{class:'wildlife-results','aria-live':'polite'}),jump=h('nav',{class:'wildlife-group-jump','aria-label':'Jump to a group'});
  const search=h('input',{type:'search',id:'wildlifeSearch',placeholder:`Search ${title.toLowerCase()}`,value:saved.query,'aria-label':`Search ${title.toLowerCase()}`,oninput:()=>{saved.query=search.value;clear.classList.toggle('hidden',!saved.query);update();}});
  const clear=h('button',{type:'button',class:`clear-search ${saved.query?'':'hidden'}`,'aria-label':'Clear wildlife search',onclick:()=>{saved.query='';search.value='';clear.classList.add('hidden');update();search.focus();}},'×');
  const filters=h('div',{class:'wildlife-areas','aria-label':'Habitat or area filter'});
  function update(){
    for(const chip of filters.children){const selected=chip.dataset.area===saved.area;chip.classList.toggle('active',selected);chip.setAttribute('aria-pressed',String(selected));}
    const matches=species.filter(s=>speciesMatches(s,saved.query,region?.id || saved.area)),groups=[...new Set(matches.map(groupOf))].sort((a,b)=>{
      const order=region?['Plants','Birds','Other animals']:preferredGroups,ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b);
    });
    jump.replaceChildren();results.replaceChildren();
    const area=areas.find(a=>a.id===saved.area);if(area?.description)results.append(h('p',{class:'muted'},area.description));
    if(!matches.length){results.append(h('p',{class:'muted'},species.length?'No matching species. Try a different search or area.':'This section has no entries in this guidebook yet.'));return;}
    for(const [index,group] of groups.entries()){
      const id=`wildlife-group-${index}`;
      if(groups.length>1)jump.append(h('button',{type:'button',class:'button ghost',onclick:()=>document.getElementById(id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})},group));
      results.append(h('section',{class:'wildlife-group',id},h('h2',{},group),h('div',{class:'attraction-grid'},...matches.filter(s=>groupOf(s)===group).sort((a,b)=>a.name.localeCompare(b.name)).map(s=>card(s,wildlifeHref(entry.id,kind,s.id))))));
    }
  }
  if(!region && areas.length>1)for(const area of [{id:'',name:'All'},...areas])filters.append(h('button',{type:'button',class:'button ghost','data-area':area.id,'aria-pressed':false,onclick:()=>{saved.area=area.id;update();}},area.name));
  main.replaceChildren(back('Wildlife',root),h('h1',{},title),h('div',{class:'search-wrap wildlife-search'},search,clear),...(!region && areas.length>1?[filters]:[]),jump,results);update();
}
