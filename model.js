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
    where:list(s.where,20,'Where to look').map(a=>({areaId:id(object(a,'Where to look').areaId,'Area ID'),likelihood:text(a.likelihood,180,'Local likelihood',true),note:text(a.note,1500,'Location note',true),attractionIds:list(a.attractionIds || [],30,'Linked attractions').map(v=>id(v,'Linked attraction ID'))})),
    photos:normalizePhotos(s.photos),sources:list(s.sources,15,'Species sources').map(a=>({title:text(object(a,'Source').title,180,'Source title',true),url:url(a.url,'Source URL')})),researchedAt:date(s.researchedAt,'Species research date',true),taxonIds:{}};
  for(const key of ['inaturalist','gbif','ebird']){const v=s.taxonIds?.[key];if(v!=null)result.taxonIds[key]=id(String(v),`${key} taxon ID`);}
  if(!result.identification.length || !result.summary.length || !result.where.length || !result.sources.length || result.sources.some(a=>!a.url))fail('Every species needs identification, a summary, local context, and sources.');
  if(new Set(result.where.map(a=>a.areaId)).size!==result.where.length)fail('A species may have only one entry per area.');
  if(bytes(result)>50000)fail('A species guide can contain at most 50 KB.');
  return result;
}
function normalizeWildlife(value,attractionIds) {
  const w=object(value,'Wildlife'),areas=normalizeAreas(w.areas),areaIds=new Set(areas.map(a=>a.id));
  const species=list(w.species || [],600,'Species').map(normalizeSpecies);
  if(new Set(species.map(a=>a.id)).size!==species.length)fail('Species IDs must be unique within a trip.');
  for(const s of species)for(const location of s.where){if(!areaIds.has(location.areaId))fail(`Unknown wildlife area for ${s.name}.`);if(location.attractionIds.some(a=>!attractionIds.has(a)))fail(`Unknown linked attraction for ${s.name}.`);if(new Set(location.attractionIds).size!==location.attractionIds.length)fail('Linked attraction IDs must be unique.');}
  return {areas,species};
}

export function normalizeAttraction(value) {
  const a = object(value, 'Attraction');
  const result = {
    id: id(a.id, 'Attraction ID'), name: text(a.name, 180, 'Attraction name', true),
    location: text(a.location, 250, 'Location'), visitTime: text(a.visitTime, 40, 'Visit time'),
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
export function normalizeTrip(value) {
  const t = object(value, 'Trip');
  if (!Number.isInteger(t.year) || t.year < 1900 || t.year > 2200) fail('Trip year must be between 1900 and 2200.');
  const result = {id: id(t.id, 'Trip ID'), name: text(t.name, 180, 'Trip name', true), year: t.year, startDate: date(t.startDate, 'Start date', true), endDate: date(t.endDate, 'End date', true), coverUrl: url(t.coverUrl, 'Cover image', true), glossary:list(t.glossary || [], 60, 'Glossary').map(g => ({term:text(object(g, 'Glossary term').term, 80, 'Glossary term', true), definition:text(g.definition, 800, 'Glossary definition', true), aliases:list(g.aliases || [],8,'Glossary aliases').map(alias => text(alias,80,'Glossary alias',true))})), days: []};
  const glossaryNames=new Set();for(const g of result.glossary)for(const name of [g.term,...g.aliases]){const key=name.toLocaleLowerCase('en');if(glossaryNames.has(key))fail('Glossary terms and aliases must be unique.');glossaryNames.add(key);}
  if (result.endDate < result.startDate || Number(result.startDate.slice(0,4)) !== t.year) fail('Trip dates must be in order, and the year must match the start date.');
  const dayIds = new Set(), attrIds = new Set(); let previous = '';
  for (const d of list(t.days, 120, 'Days')) {
    object(d, 'Day'); const day = {id:id(d.id, 'Day ID'), date:date(d.date, 'Day date', true), title:text(d.title, 180, 'Day title', true), attractions:[]};
    if (dayIds.has(day.id) || day.date < previous || day.date < result.startDate || day.date > result.endDate) fail('Days must have unique IDs and chronological dates within the trip.');
    previous = day.date; dayIds.add(day.id);
    for (const a of list(d.attractions, 100, 'Day attractions')) {
      const attraction = normalizeAttraction(a);
      if (attrIds.has(attraction.id)) fail('Attraction IDs must be unique within a trip.');
      attrIds.add(attraction.id); day.attractions.push(attraction);
    }
    if (!day.attractions.length) fail('Omit days with no attractions.');
    result.days.push(day);
  }
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
  if (!result.days.length || attrIds.size > 400) fail('A trip needs between 1 and 400 attractions.');
  if (!result.coverUrl) result.coverUrl = result.days[0].attractions[0].photos[0]?.url || '';
  if (t.wildlife != null) result.wildlife=normalizeWildlife(t.wildlife,attrIds);
  if (bytes(result) > 5 * 1024 * 1024) fail('A trip can contain at most 5 MB of guide text and metadata.');
  return result;
}
export function parseImport(raw) {
  if (new TextEncoder().encode(raw).length > MAX_FILE) fail('Import files can be at most 12 MB.');
  let payload; try { payload = JSON.parse(raw); } catch { fail('This is not valid JSON. Import a Glauco trip file prepared from the template.'); }
  rejectUnsafeKeys(payload); object(payload, 'Import file');
  if (payload.format !== FORMAT || ![1,2,3].includes(payload.version)) fail('Use a Glauco trip file with format "glauco-trip-file" and version 1, 2 or 3. Lambus PDFs need to be processed first.');
  const trips = list(payload.trips, 30, 'Trips').map(normalizeTrip);
  if (!trips.length || new Set(trips.map(t=>t.id)).size !== trips.length) fail('The file needs trips with unique IDs.');
  return trips;
}
export const attractions = trip => trip.days.flatMap(day => day.attractions.map(attraction => ({day, attraction})));
export function photoUrls(trip) { return [...new Set([trip.coverUrl, ...[...attractions(trip).map(({attraction:a})=>a),...(trip.wildlife?.species || [])].flatMap(a=>a.photos.flatMap(p=>[p.url,p.thumbnailUrl]))].filter(Boolean))]; }
export function tripMeta(trip) {
  return {id:trip.id, name:trip.name, year:trip.year, startDate:trip.startDate, endDate:trip.endDate, coverUrl:trip.coverUrl, glossary:trip.glossary || [], ...(trip.wildlife?{wildlife:{areas:trip.wildlife.areas,speciesIds:trip.wildlife.species.map(s=>s.id)}}:{}), days:trip.days.map(d=>({id:d.id,date:d.date,title:d.title,attractionIds:d.attractions.map(a=>a.id)}))};
}
export function hydrateTrip(meta, records, speciesRecords = []) {
  const byId = new Map(records.map(a=>[a.id,a]));
  const speciesById=new Map(speciesRecords.map(a=>[a.id,a]));
  return normalizeTrip({...meta, ...(meta.wildlife?{wildlife:{areas:meta.wildlife.areas,species:meta.wildlife.speciesIds.map(a=>speciesById.get(a)||fail('Synced wildlife is incomplete. Try again when online.'))}}:{}), days:meta.days.map(d=>({...d, attractions:d.attractionIds.map(a=>byId.get(a) || fail('A synced trip is incomplete. Try again when online.'))}))});
}
export function dateLabel(value, options = {month:'short',day:'numeric',year:'numeric'}) {
  return value ? new Intl.DateTimeFormat('en-US', options).format(new Date(`${value}T12:00:00`)) : '';
}
export function sizeLabel(n) { if (n < 1024) return `${n} B`; return n < 1048576 ? `${(n/1024).toFixed(1)} KB` : `${(n/1048576).toFixed(1)} MB`; }
export function normalizeMeta(value) {
  const m=object(value,'Trip metadata');
  const trip=normalizeTrip({...m,wildlife:undefined,days:list(m.days,120,'Days').map(d=>({...d,attractions:list(d.attractionIds,100,'Attraction IDs').map(a=>({id:a,name:'Metadata',summary:['Metadata']}))}))});
  let wildlife;if(m.wildlife!=null){const w=object(m.wildlife,'Wildlife metadata'),speciesIds=list(w.speciesIds,600,'Species IDs').map(a=>id(a,'Species ID'));if(new Set(speciesIds).size!==speciesIds.length)fail('Species IDs must be unique.');wildlife={areas:normalizeAreas(w.areas),speciesIds};}
  if(typeof m.archived!=='boolean')fail('Invalid archive state.');
  return {...tripMeta(trip),...(wildlife?{wildlife}:{}),revision:id(m.revision,'Revision'),archiveRevision:id(m.archiveRevision,'Archive revision'),archived:m.archived,updatedAt:Number.isFinite(m.updatedAt)?m.updatedAt:0};
}
