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
