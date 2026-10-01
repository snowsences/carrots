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
  if (image && !config.imageHosts.includes(u.hostname)) fail(`${label}: unsupported image host ${u.hostname}. Use Wikimedia image URLs.`);
  return u.href;
}
function rejectUnsafeKeys(v, depth = 0) {
  if (depth > 15) fail('The file is nested too deeply.');
  if (v && typeof v === 'object') for (const k of Object.keys(v)) {
    if (['__proto__', 'prototype', 'constructor'].includes(k)) fail('The file contains a forbidden property.');
    rejectUnsafeKeys(v[k], depth + 1);
  }
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
    photos: list(a.photos || [], 12, 'Photos').map(p => ({url: url(object(p, 'Photo').url, 'Photo URL', true), thumbnailUrl: url(p.thumbnailUrl || p.url, 'Thumbnail URL', true), caption: text(p.caption, 500, 'Photo caption'), creator: text(p.creator, 180, 'Photo creator'), license: text(p.license, 150, 'Photo license'), licenseUrl: url(p.licenseUrl, 'License link'), sourceUrl: url(p.sourceUrl, 'Photo source link')})),
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
  if (bytes(result) > 5 * 1024 * 1024) fail('A trip can contain at most 5 MB of guide text and metadata.');
  return result;
}
export function parseImport(raw) {
  if (new TextEncoder().encode(raw).length > MAX_FILE) fail('Import files can be at most 12 MB.');
  let payload; try { payload = JSON.parse(raw); } catch { fail('This is not valid JSON. Import a Glauco trip file prepared from the template.'); }
  rejectUnsafeKeys(payload); object(payload, 'Import file');
  if (payload.format !== FORMAT || ![1,2].includes(payload.version)) fail('Use a Glauco trip file with format "glauco-trip-file" and version 1 or 2. Lambus PDFs need to be processed first.');
  const trips = list(payload.trips, 30, 'Trips').map(normalizeTrip);
  if (!trips.length || new Set(trips.map(t=>t.id)).size !== trips.length) fail('The file needs trips with unique IDs.');
  return trips;
}
export const attractions = trip => trip.days.flatMap(day => day.attractions.map(attraction => ({day, attraction})));
export function photoUrls(trip) { return [...new Set([trip.coverUrl, ...attractions(trip).flatMap(({attraction:a})=>a.photos.flatMap(p=>[p.url,p.thumbnailUrl]))].filter(Boolean))]; }
export function tripMeta(trip) {
  return {id:trip.id, name:trip.name, year:trip.year, startDate:trip.startDate, endDate:trip.endDate, coverUrl:trip.coverUrl, glossary:trip.glossary || [], days:trip.days.map(d=>({id:d.id,date:d.date,title:d.title,attractionIds:d.attractions.map(a=>a.id)}))};
}
export function hydrateTrip(meta, records) {
  const byId = new Map(records.map(a=>[a.id,a]));
  return normalizeTrip({...meta, days:meta.days.map(d=>({...d, attractions:d.attractionIds.map(a=>byId.get(a) || fail('A synced trip is incomplete. Try again when online.'))}))});
}
export function dateLabel(value, options = {month:'short',day:'numeric',year:'numeric'}) {
  return value ? new Intl.DateTimeFormat('en-US', options).format(new Date(`${value}T12:00:00`)) : '';
}
export function sizeLabel(n) { if (n < 1024) return `${n} B`; return n < 1048576 ? `${(n/1024).toFixed(1)} KB` : `${(n/1048576).toFixed(1)} MB`; }
export function normalizeMeta(value) {
  const m=object(value,'Trip metadata');
  const trip=normalizeTrip({...m,days:list(m.days,120,'Days').map(d=>({...d,attractions:list(d.attractionIds,100,'Attraction IDs').map(a=>({id:a,name:'Metadata',summary:['Metadata']}))}))});
  if(typeof m.archived!=='boolean')fail('Invalid archive state.');
  return {...tripMeta(trip),revision:id(m.revision,'Revision'),archiveRevision:id(m.archiveRevision,'Archive revision'),archived:m.archived,updatedAt:Number.isFinite(m.updatedAt)?m.updatedAt:0};
}
