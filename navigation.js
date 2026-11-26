// Calendar dates use the device's local time, matching the traveler's day.
export function localDateKey(date=new Date()) {
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function rank(entry,today) {
 const m=entry.meta;
 return m.guideType==='destination'?2:m.guideType==='wildlife'?2:m.startDate<=today&&m.endDate>=today?0:m.startDate>today?1:3;
}
export function orderedTrips(entries,today=localDateKey()) {
 return [...entries].sort((a,b)=>Number(a.archived)-Number(b.archived)||rank(a,today)-rank(b,today)||
  (rank(a,today)===1?a.meta.startDate.localeCompare(b.meta.startDate):rank(a,today)===3?b.meta.startDate.localeCompare(a.meta.startDate):a.meta.name.localeCompare(b.meta.name))||a.meta.name.localeCompare(b.meta.name)||a.id.localeCompare(b.id));
}
export function defaultTripId(entries,today=localDateKey()) {return orderedTrips(entries,today)[0]?.id||null;}
export function todayDay(entry,today=localDateKey()) {return ['destination','wildlife'].includes(entry?.meta.guideType)?null:entry?.meta.days.find(d=>d.date===today)||null;}

export function dayNumber(trip,dayId) {return trip.days.findIndex(day=>day.id===dayId)+1;}
export function dayTitle(trip,day) {return trip.guideType==='destination'?day.title:`Day ${dayNumber(trip,day.id)}: ${day.title}`;}

export function groupGuides(entries,metaFor=entry=>entry.meta,nameFor=entry=>metaFor(entry)?.name||''){
 const buckets=new Map();
 for(const entry of entries){const meta=metaFor(entry)||{},dated=!['destination','wildlife'].includes(meta.guideType)&&/^\d{4}-\d{2}-\d{2}$/.test(meta.startDate||''),label=dated?meta.startDate.slice(0,4):'Guides';if(!buckets.has(label))buckets.set(label,[]);buckets.get(label).push(entry);}
 return [...buckets].sort(([a],[b])=>a==='Guides'?-1:b==='Guides'?1:a.localeCompare(b)).map(([label,items])=>({label,items:items.sort((a,b)=>(label==='Guides'?0:String(metaFor(a)?.startDate||'').localeCompare(String(metaFor(b)?.startDate||'')))||nameFor(a).localeCompare(nameFor(b))||String(a.id||'').localeCompare(String(b.id||'')))}));
}
