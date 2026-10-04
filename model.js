import { config } from './config.js';
export const FORMAT = 'glauco-trip-file';
export const MAX_FILE = 12 * 1024 * 1024;
export const uid = () => crypto.randomUUID();
export const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
const fail = message => { throw new Error(message); };
const object = (v, label) => (!v || typeof v !== 'object' || Array.isArray(v)) ? fail(`${label} must be an object.`) : v;
const list = (v, max, label) => !Array.isArray(v) || v.length > max ? fail(`${label} must be a list with at most ${max} items.`) : v;
export function text(v, max, label, required = false) {
  if (v == null && !required) return '';
  if (typeof v !== 'string') fail(`${label} must be text.`);
  const s = v.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim();
  if (s.length > max || (required && !s)) fail(`${label} is empty or longer than ${max} characters.`);
  return s;
}
export function id(v, label = 'Identifier') {
  const s = text(v, 100, label, true);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(s)) fail(`${label} may contain only letters, numbers, hyphens and underscores.`);
  return s;
}
export function date(v, label, required = false) {
  const s = text(v, 10, label, required);
  if (!s && !required) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) !== s) fail(`${label} must be a valid YYYY-MM-DD date.`);
  return s;
}
export function url(v, label, image = false) {
  const s = text(v, 2000, label);
  if (!s) return '';
  let u; try { u = new URL(s); } catch { fail(`${label} is not a valid URL.`); }
  if (u.protocol !== 'https:' || u.username || u.password) fail(`${label} must be an HTTPS URL without credentials.`);
  if (image && !config.imageHosts.includes(u.hostname)) fail(`${label}: unsupported image host ${u.hostname}. Use a supported Wikimedia or iNaturalist open-data image URL.`);
  return u.href;
}
function rejectUnsafeKeys(v, depth = 0) {
  if (depth > 15) fail('The file is nested too deeply.');
  if (v && typeof v === 'object') for (const k of Object.keys(v)) {
    if (['__proto__', 'prototype', 'constructor'].includes(k)) fail('The file contains a forbidden property.');
    rejectUnsafeKeys(v[k], depth + 1);
  }
}
function normalizePhotos(value) {
  const photos = list(value || [], 12, 'Photos').map(p => ({url: url(object(p, 'Photo').url, 'Photo URL', true), thumbnailUrl: url(p.thumbnailUrl || p.url, 'Thumbnail URL', true), caption: text(p.caption, 500, 'Photo caption'), creator: text(p.creator, 180, 'Photo creator'), license: text(p.license, 150, 'Photo license'), licenseUrl: url(p.licenseUrl, 'License link'), sourceUrl: url(p.sourceUrl, 'Photo source link')}));
  if (photos.some(p => !p.url)) fail('Photos must have a URL.');
  return photos;
}
function normalizeGlossaryPhoto(value, term) {
  const p=object(value,`Glossary image for ${term}`),result={url:url(p.url,`Glossary image URL for ${term}`,true),thumbnailUrl:url(p.thumbnailUrl || p.url,`Glossary thumbnail URL for ${term}`,true),alt:text(p.alt,250,`Glossary image description for ${term}`)};
  if(!result.url)fail('Glossary images must have a URL.');
  return result;
}
function normalizeAreas(value) {
  const areas=list(value || [],20,'Wildlife areas').map(a=>({id:id(object(a,'Wildlife area').id,'Area ID'),name:text(a.name,120,'Area name',true),description:text(a.description,600,'Area description')}));
  if(new Set(areas.map(a=>a.id)).size!==areas.length)fail('Wildlife area IDs must be unique.');
  return areas;
}
export function normalizeSpecies(value) {
  const s=object(value,'Species');
  if(!['flora','fauna'].includes(s.kind))fail('Species kind must be flora or fauna.');
  const result={id:id(s.id,'Species ID'),kind:s.kind,name:text(s.name,180,'Species name',true),scientificName:text(s.scientificName,180,'Scientific name',true),group:text(s.group,80,'Species group',true),aliases:list(s.aliases || [],12,'Species aliases').map(a=>text(a,180,'Species alias',true)),status:text(s.status,250,'Regional status'),
    identification:list(s.identification,8,'Identification clues').map(p=>text(p,700,'Identification clue',true)),
    lookalikes:list(s.lookalikes || [],6,'Lookalikes').map(a=>({name:text(object(a,'Lookalike').name,180,'Lookalike name',true),distinction:text(a.distinction,1200,'Lookalike distinction',true)})),
    summary:list(s.summary,6,'Species summary').map(p=>text(p,2500,'Species paragraph',true)),
    facts:list(s.facts || [],12,'Species facts').map(f=>({label:text(object(f,'Fact').label,80,'Fact label',true),value:text(f.value,350,'Fact value',true)})),
    sections:list(s.sections || [],10,'Species sections').map(a=>({heading:text(object(a,'Section').heading,120,'Section heading',true),paragraphs:list(a.paragraphs,10,'Species paragraphs').map(p=>text(p,3000,'Species paragraph',true))})),
    areaIds:list(s.areaIds || (s.where || []).map(a=>a.areaId),20,'Species areas').map(a=>id(a,'Area ID')),
    where:list(s.where || [],20,'Where to look').map(a=>({areaId:id(object(a,'Where to look').areaId,'Area ID'),likelihood:text(a.likelihood,180,'Local likelihood',true),note:text(a.note,1500,'Location note',true),attractionIds:list(a.attractionIds || [],30,'Linked attractions').map(v=>id(v,'Linked attraction ID'))})),
    wikipediaUrl:url(s.wikipediaUrl,'Species Wikipedia link'),
    photos:normalizePhotos(s.photos),sources:list(s.sources || [],15,'Species sources').map(a=>({title:text(object(a,'Source').title,180,'Source title',true),url:url(a.url,'Source URL')})),researchedAt:date(s.researchedAt,'Species research date'),taxonIds:{}};
  for(const key of ['inaturalist','gbif','ebird']){const v=s.taxonIds?.[key];if(v!=null)result.taxonIds[key]=id(String(v),`${key} taxon ID`);}
  if(!result.identification.length || !result.summary.length || result.sources.some(a=>!a.url))fail('Every species needs identification and a summary; supplied sources need URLs.');
  if(result.wikipediaUrl && !/(^|\.)wikipedia\.org$/.test(new URL(result.wikipediaUrl).hostname))fail('Species Wikipedia links must point to wikipedia.org.');
  if(new Set(result.areaIds).size!==result.areaIds.length)fail('Species areas must be unique.');
  if(new Set(result.where.map(a=>a.areaId)).size!==result.where.length)fail('A species may have only one entry per area.');
  if(bytes(result)>50000)fail('A species guide can contain at most 50 KB.');
  return result;
}
function normalizeWildlife(value,attractionIds) {
  const w=object(value,'Wildlife'),areas=normalizeAreas(w.areas),areaIds=new Set(areas.map(a=>a.id));
  const species=list(w.species || [],600,'Species').map(normalizeSpecies);
  if(new Set(species.map(a=>a.id)).size!==species.length)fail('Species IDs must be unique within a trip.');
  if(w.browseByArea!=null && typeof w.browseByArea!=='boolean')fail('Regional browsing must be true or false.');
  for(const s of species){if(s.areaIds.some(a=>!areaIds.has(a)))fail(`Unknown wildlife area for ${s.name}.`);if(w.browseByArea && !s.areaIds.length)fail('Regional species need at least one area.');}
  for(const s of species)for(const location of s.where){if(!areaIds.has(location.areaId))fail(`Unknown wildlife area for ${s.name}.`);if(location.attractionIds.some(a=>!attractionIds.has(a)))fail(`Unknown linked attraction for ${s.name}.`);if(new Set(location.attractionIds).size!==location.attractionIds.length)fail('Linked attraction IDs must be unique.');}
  return {areas,species,browseByArea:w.browseByArea===true};
}

export function normalizeAttraction(value) {
  const a = object(value, 'Attraction');
  if(a.category !== undefined && !['attraction','dining','neighborhood'].includes(a.category)) fail('Attraction category must be attraction, dining or neighborhood.');
  const result = {
    id: id(a.id, 'Attraction ID'), name: text(a.name, 180, 'Attraction name', true),
    category: a.category || 'attraction',
    location: text(a.location, 250, 'Location'), neighborhood: text(a.neighborhood, 180, 'Neighborhood'), visitTime: text(a.visitTime, 40, 'Visit time'),
    notice: list(a.notice || [], 3, 'Things to notice').map(p => text(p, 300, 'Thing to notice', true)),
    comparisons: list(a.comparisons || [], 12, 'Comparisons').map(c => ({attractionId:id(object(c, 'Comparison').attractionId, 'Comparison attraction ID'), paragraphs:list(c.paragraphs, 4, 'Comparison paragraphs').map(p => text(p, 1800, 'Comparison paragraph', true))})),
    history: list(a.history || [], 8, 'History timeline').map(event => {object(event, 'History event');if(!Number.isInteger(event.year) || event.year < -10000 || event.year > 2200)fail('History year must be an integer between -10000 and 2200.');return {year:event.year,label:text(event.label,80,'History date label',true),title:text(event.title,180,'History event title',true),text:text(event.text,1200,'History event text')};}),
    originality: list(a.originality || [], 4, 'Originality notes').map(p => text(p,1800,'Originality paragraph',true)),
    summary: list(a.summary, 8, 'Summary paragraphs').map(p => text(p, 4000, 'Summary paragraph', true)),
    facts: list(a.facts || [], 15, 'Facts').map(f => ({label: text(object(f, 'Fact').label, 80, 'Fact label', true), value: text(f.value, 350, 'Fact value', true)})),
    sections: list(a.sections || [], 15, 'Sections').map(s => ({heading: text(object(s, 'Section').heading, 120, 'Section heading', true), paragraphs: list(s.paragraphs, 20, 'Paragraphs').map(p => text(p, 6000, 'Paragraph', true))})),
    wikipediaUrl: url(a.wikipediaUrl, 'Wikipedia link'),
    sources: list(a.sources || [], 15, 'Sources').map(s => ({title: text(object(s, 'Source').title, 180, 'Source title', true), url: url(s.url, 'Source link')})),
    researchedAt: date(a.researchedAt, 'Research date'),
    photos: normalizePhotos(a.photos),
  };
  if (result.notice.length && result.notice.length !== 3) fail('Provide exactly three things to notice, or omit the checklist.');
  if (result.comparisons.some(c => !c.paragraphs.length)) fail('A comparison needs at least one paragraph.');
  if(result.history.some((event,index) => index && event.year < result.history[index-1].year))fail('History events must be in chronological order.');
  if (!result.summary.length) fail('Every attraction needs a short summary.');
  if (result.photos.some(p => !p.url)) fail('Photos must have a URL.');
  if (result.sources.some(s => !s.url)) fail('Sources must have a URL.');
  if (result.wikipediaUrl && !/(^|\.)wikipedia\.org$/.test(new URL(result.wikipediaUrl).hostname)) fail('Wikipedia links must point to wikipedia.org.');
  if (bytes(result) > 65000) fail(`The guide for ${result.name} is too large (maximum 65 KB).`);
  return result;
}
function normalizeCustoms(value) {
  const customs=object(value,'Customs');
  const guides=list(customs.guides,12,'Customs guides').map(value=>{
    const g=object(value,'Customs guide');
    const result={id:id(g.id,'Customs guide ID'),name:text(g.name,120,'Customs guide name',true),intro:text(g.intro,1200,'Customs introduction'),
      sections:list(g.sections || [],15,'Customs sections').map(s=>({heading:text(object(s,'Customs section').heading,120,'Customs heading',true),paragraphs:list(s.paragraphs,12,'Customs paragraphs').map(p=>text(p,3000,'Customs paragraph',true))})),
      language:text(g.language,80,'Language'),lang:text(g.lang,35,'Language tag'),phraseNote:text(g.phraseNote,1200,'Phrase note'),
      phrases:list(g.phrases || [],40,'Useful phrases').map(p=>({meaning:text(object(p,'Phrase').meaning,180,'Phrase meaning',true),native:text(p.native,250,'Local phrase',true),pronunciation:text(p.pronunciation,250,'Phrase pronunciation')})),
      sources:list(g.sources || [],15,'Customs sources').map(s=>({title:text(object(s,'Customs source').title,180,'Customs source title',true),url:url(s.url,'Customs source URL')})),researchedAt:date(g.researchedAt,'Customs research date',true)};
    if(result.lang&&!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(result.lang))fail('Use a valid language tag such as es, it or pt-BR.');
    if(result.phrases.length&&(!result.language||!result.lang))fail('Customs phrases need a language name and language tag.');
    if(result.sections.some(s=>!s.paragraphs.length))fail('Customs sections need at least one paragraph.');
    if(!result.sections.length&&!result.phrases.length)fail('A customs guide needs sections or useful phrases.');
    if(result.sources.some(s=>!s.url))fail('Customs sources need HTTPS URLs.');
    if(bytes(result)>50*1024)fail('A customs guide can contain at most 50 KB.');
    return result;
  });
  if(new Set(guides.map(g=>g.id)).size!==guides.length)fail('Customs guide IDs must be unique.');
  const result={guides};if(bytes(result)>100*1024)fail('Customs content can contain at most 100 KB per guidebook.');
  return result;
}
export function normalizeTrip(value) {
  const t = object(value, 'Trip');
  if (t.guideType != null && !['trip','destination','wildlife'].includes(t.guideType)) fail('Guide type must be trip, destination or wildlife.');
  const destination=t.guideType==='destination';
  const wildlifeGuide=t.guideType==='wildlife';
  if (!destination && !wildlifeGuide && (!Number.isInteger(t.year) || t.year < 1900 || t.year > 2200)) fail('Trip year must be between 1900 and 2200.');
  const headerUrl=url(t.headerUrl, 'Header image', true);
  const result = {id: id(t.id, 'Trip ID'), name: text(t.name, 180, destination||wildlifeGuide?'Guide name':'Trip name', true), ...(destination?{guideType:'destination'}:wildlifeGuide?{guideType:'wildlife',...(headerUrl?{headerUrl}:{})}:{year:t.year,startDate:date(t.startDate, 'Start date', true),endDate:date(t.endDate, 'End date', true),...(headerUrl?{headerUrl}:{})}), coverUrl: url(t.coverUrl, 'Cover image', true), glossary:list(t.glossary || [], 60, 'Glossary').map(value => {const g=object(value, 'Glossary term'),term=text(g.term, 80, 'Glossary term', true);return {term,definition:text(g.definition, 800, 'Glossary definition', true),aliases:list(g.aliases || [],8,'Glossary aliases').map(alias => text(alias,80,'Glossary alias',true)),...(g.photo?{photo:normalizeGlossaryPhoto(g.photo,term)}:{})};}), days: []};
  const glossaryNames=new Set();for(const g of result.glossary)for(const name of [g.term,...g.aliases]){const key=name.toLocaleLowerCase('en');if(glossaryNames.has(key))fail('Glossary terms and aliases must be unique.');glossaryNames.add(key);}
  if (!destination && !wildlifeGuide && (result.endDate < result.startDate || Number(result.startDate.slice(0,4)) !== t.year)) fail('Trip dates must be in order, and the year must match the start date.');
  const dayIds = new Set(), attrIds = new Set(); let previous = '';
  const groups=wildlifeGuide?[]:destination?(t.places ?? t.days):t.days;
  for (const d of list(groups, 120, destination?'Places':'Days')) {
    object(d, destination?'Place':'Day'); const day = {id:id(d.id, destination?'Place ID':'Day ID'), date:destination?'':date(d.date, 'Day date', true), title:text(d.title, 180, destination?'Place name':'Day title', true), attractions:[]};
    if (dayIds.has(day.id) || (!destination && (day.date < previous || day.date < result.startDate || day.date > result.endDate))) fail(destination?'Places must have unique IDs.':'Days must have unique IDs and chronological dates within the trip.');
    previous = day.date; dayIds.add(day.id);
    for (const a of list(d.attractions, 100, destination?'Place attractions':'Day attractions')) {
      const attraction = normalizeAttraction(a);
      if (attrIds.has(attraction.id)) fail('Attraction IDs must be unique within a guidebook.');
      attrIds.add(attraction.id); day.attractions.push(attraction);
    }
    if (!day.attractions.length) fail(destination?'Omit places with no attractions.':'Omit days with no attractions.');
    result.days.push(day);
  }
  if(destination&&result.days.some(day=>day.attractions.some(a=>a.comparisons.length)))fail('Destination guides cannot contain attraction comparisons.');
  if(destination&&result.days.some(day=>day.attractions.some(a=>a.visitTime)))fail('Destination guides use neighborhoods instead of visit times.');
  const visited = new Set();
  for (const day of result.days) for (const a of day.attractions) {
    const compared = new Set();
    for (const c of a.comparisons) {
      if (!visited.has(c.attractionId)) fail(`Comparisons for ${a.name} may reference only earlier attractions in this trip. Future sites, the current site, and unknown IDs are not allowed.`);
      if (compared.has(c.attractionId)) fail(`Duplicate comparison for ${a.name}.`);
      compared.add(c.attractionId);
    }
    visited.add(a.id);
  }
  if (!wildlifeGuide && (!result.days.length || attrIds.size > 400)) fail(`${destination?'A destination guide':'A trip'} needs between 1 and 400 attractions.`);
  if (t.wildlife != null) result.wildlife=normalizeWildlife(t.wildlife,attrIds);
  if(wildlifeGuide&&t.wildlife!=null&&!result.wildlife.species.length)fail('A wildlife guide needs at least one species.');
  if (!result.coverUrl) result.coverUrl = result.days[0]?.attractions[0]?.photos[0]?.url || (wildlifeGuide?result.wildlife?.species.find(s=>s.photos.length)?.photos[0].url:'') || '';
  if (t.customs != null) result.customs=normalizeCustoms(t.customs);
  if (bytes(result) > 5 * 1024 * 1024) fail('A guidebook can contain at most 5 MB of guide text and metadata.');
  return result;
}
export function parseImport(raw) {
  if (new TextEncoder().encode(raw).length > MAX_FILE) fail('Import files can be at most 12 MB.');
  let payload; try { payload = JSON.parse(raw); } catch { fail('This is not valid JSON. Import a Glauco guidebook file prepared from the template.'); }
  rejectUnsafeKeys(payload); object(payload, 'Import file');
  if (payload.format !== FORMAT || ![1,2,3,4,5,6].includes(payload.version)) fail('Use a Glauco guidebook file with format "glauco-trip-file" and version 1 through 6. Lambus PDFs need to be processed first.');
  const rawTrips=list(payload.trips, 30, 'Trips');
  if(payload.version<5&&rawTrips.some(t=>t?.guideType==='destination'))fail('Destination guides require file version 5.');
  if(payload.version<6&&rawTrips.some(t=>t?.guideType==='wildlife'))fail('Wildlife field guides require file version 6.');
  if(rawTrips.some(t=>t?.guideType==='destination'&&!Array.isArray(t.places)))fail('Destination guides must contain places.');
  const trips = rawTrips.map(normalizeTrip);
  if(trips.some((trip,index)=>trip.guideType==='wildlife'&&!rawTrips[index].wildlife))fail('Wildlife field guides need wildlife content.');
  if (!trips.length || new Set(trips.map(t=>t.id)).size !== trips.length) fail('The file needs guidebooks with unique IDs.');
  return trips;
}
export const attractions = trip => trip.days.flatMap(day => day.attractions.map(attraction => ({day, attraction})));
export function photoUrls(trip) { return [...new Set([trip.headerUrl,trip.coverUrl,...(trip.glossary || []).flatMap(g=>g.photo?[g.photo.url,g.photo.thumbnailUrl]:[]), ...[...attractions(trip).map(({attraction:a})=>a),...(trip.wildlife?.species || [])].flatMap(a=>a.photos.flatMap(p=>[p.url,p.thumbnailUrl]))].filter(Boolean))]; }
export function tripMeta(trip) {
  return {id:trip.id, name:trip.name, ...(trip.guideType==='destination'?{guideType:'destination'}:trip.guideType==='wildlife'?{guideType:'wildlife',...(trip.headerUrl?{headerUrl:trip.headerUrl}:{})}:{year:trip.year,startDate:trip.startDate,endDate:trip.endDate,...(trip.headerUrl?{headerUrl:trip.headerUrl}:{})}), coverUrl:trip.coverUrl, glossary:trip.glossary || [], ...(trip.customs?{customs:trip.customs}:{}), ...(trip.wildlife?{wildlife:{browseByArea:trip.wildlife.browseByArea,areas:trip.wildlife.areas,speciesIds:trip.wildlife.species.map(s=>s.id)}}:{}), days:trip.days.map(d=>({id:d.id,date:d.date,title:d.title,attractionIds:d.attractions.map(a=>a.id)}))};
}
export function hydrateTrip(meta, records, speciesRecords = []) {
  const byId = new Map(records.map(a=>[a.id,a]));
  const speciesById=new Map(speciesRecords.map(a=>[a.id,a]));
  return normalizeTrip({...meta, ...(meta.wildlife?{wildlife:{browseByArea:meta.wildlife.browseByArea,areas:meta.wildlife.areas,species:meta.wildlife.speciesIds.map(a=>speciesById.get(a)||fail('Synced wildlife is incomplete. Try again when online.'))}}:{}), days:meta.days.map(d=>({...d, attractions:d.attractionIds.map(a=>byId.get(a) || fail('A synced guidebook is incomplete. Try again when online.'))}))});
}
export function dateLabel(value, options = {month:'short',day:'numeric',year:'numeric'}) {
  return value ? new Intl.DateTimeFormat('en-US', options).format(new Date(`${value}T12:00:00`)) : '';
}
export function sizeLabel(n) { if (n < 1024) return `${n} B`; return n < 1048576 ? `${(n/1024).toFixed(1)} KB` : `${(n/1048576).toFixed(1)} MB`; }
export function normalizeMeta(value) {
  const m=object(value,'Trip metadata');
  const trip=normalizeTrip({...m,wildlife:undefined,days:list(m.days,120,'Days').map(d=>({...d,attractions:list(d.attractionIds,100,'Attraction IDs').map(a=>({id:a,name:'Metadata',summary:['Metadata']}))}))});
  let wildlife;if(m.wildlife!=null){const w=object(m.wildlife,'Wildlife metadata'),speciesIds=list(w.speciesIds,600,'Species IDs').map(a=>id(a,'Species ID'));if(new Set(speciesIds).size!==speciesIds.length)fail('Species IDs must be unique.');if(w.browseByArea!=null && typeof w.browseByArea!=='boolean')fail('Regional browsing must be true or false.');wildlife={browseByArea:w.browseByArea===true,areas:normalizeAreas(w.areas),speciesIds};}
  if(typeof m.archived!=='boolean')fail('Invalid archive state.');
  return {...tripMeta(trip),...(wildlife?{wildlife}:{}),revision:id(m.revision,'Revision'),archiveRevision:id(m.archiveRevision,'Archive revision'),archived:m.archived,updatedAt:Number.isFinite(m.updatedAt)?m.updatedAt:0};
}
