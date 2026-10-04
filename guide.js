const wordCharacter = /[\p{L}\p{M}\p{N}_]/u;
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function glossaryParts(value, glossary = []) {
  const names = new Map();
  for (const entry of glossary) for (const name of [entry.term, ...(entry.aliases || [])]) {
    if (name) names.set(name.toLocaleLowerCase('en'), entry);
  }
  if (!names.size) return [{text: value}];
  const pattern = new RegExp([...names.keys()].sort((a,b) => b.length-a.length).map(escapePattern).join('|'), 'giu');
  const parts = []; let position = 0;
  for (const match of value.matchAll(pattern)) {
    const start = match.index, end = start + match[0].length;
    const before = [...value.slice(0,start)].at(-1), after = [...value.slice(end)][0];
    if (before && wordCharacter.test(before) || after && wordCharacter.test(after)) continue;
    if (start > position) parts.push({text: value.slice(position,start)});
    parts.push({text: match[0], term: names.get(match[0].toLocaleLowerCase('en'))});
    position = end;
  }
  if (position < value.length) parts.push({text: value.slice(position)});
  return parts.length ? parts : [{text:value}];
}

// Only the current site and sites already discussed in its comparisons appear.
export function historyTimeline(trip, attractionId) {
  const sites = trip.days.flatMap(day => day.attractions.map(attraction => ({day,attraction})));
  const index = sites.findIndex(site => site.attraction.id === attractionId);
  if (index < 0 || !sites[index].attraction.history?.length) return [];
  const current = sites[index], referenced = new Set((current.attraction.comparisons || []).map(c => c.attractionId));
  const events = current.attraction.history.map(event => ({...event,...current,current:true}));
  for (const site of sites.slice(0,index)) if (referenced.has(site.attraction.id) && site.attraction.history?.length) {
    events.push({...site.attraction.history[0],...site,current:false});
  }
  return events.sort((a,b) => a.year-b.year || Number(b.current)-Number(a.current));
}

// A compact cross-site view: one representative milestone for the current site
// and each earlier site that its comparisons already introduce.
export function historyContext(trip, attractionId) {
  const bySite = new Map();
  for (const event of historyTimeline(trip, attractionId)) {
    if (!bySite.has(event.attraction.id)) bySite.set(event.attraction.id, event);
  }
  return [...bySite.values()].sort((a,b) => a.year-b.year || Number(b.current)-Number(a.current));
}

const ordinal = n => `${n}${[11,12,13].includes(n % 100) ? 'th' : ({1:'st',2:'nd',3:'rd'}[n % 10] || 'th')}`;
export const yearLabel = year => year < 0 ? `${-year} BCE` : `${year} CE`;
export const centuryLabel = year => year > 0 ? `${ordinal(Math.ceil(year/100))} century CE` : `${ordinal(Math.max(1,Math.ceil(-year/100)))} century BCE`;

// Every milestone in the trip in chronological order, grouped by century. Visited state follows the trip's own dates.
export function tripTimeline(trip, today) {
  const events = [];
  for (const day of trip.days) for (const attraction of day.attractions) for (const event of attraction.history || []) {
    events.push({...event, attraction, day, status: day.date < today ? 'seen' : day.date === today ? 'today' : 'ahead'});
  }
  events.sort((a,b) => a.year - b.year || a.day.date.localeCompare(b.day.date));
  events.forEach((event, index) => { event.index = index; });
  const bands = [];
  for (const event of events) {
    const label = centuryLabel(event.year), last = bands.at(-1);
    if (last?.label === label) last.events.push(event); else bands.push({label, events: [event]});
  }
  const min = events[0]?.year ?? 0, max = events.at(-1)?.year ?? 0;
  return {events, bands, min, max};
}
