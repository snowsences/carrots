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
