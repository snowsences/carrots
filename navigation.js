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

export function groupGuides(entries,metaFor=entry=>entry.meta,nameFor=entry=>metaFor(entry)?.name||'',dateFor=meta=>!['destination','wildlife'].includes(meta.guideType)&&/^\d{4}-\d{2}-\d{2}$/.test(meta.startDate||'')?meta.startDate:null){
 const buckets=new Map(),dates=new Map();
 for(const entry of entries){const meta=metaFor(entry)||{},date=dateFor(meta),label=date===null?'Guides':/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date.slice(0,4):'Unassigned year';dates.set(entry,date||'');if(!buckets.has(label))buckets.set(label,[]);buckets.get(label).push(entry);}
 const rank=label=>label==='Guides'?0:label==='Unassigned year'?2:1;
 return [...buckets].sort(([a],[b])=>rank(a)-rank(b)||a.localeCompare(b)).map(([label,items])=>({label,items:items.sort((a,b)=>dates.get(a).localeCompare(dates.get(b))||nameFor(a).localeCompare(nameFor(b))||String(a.id||'').localeCompare(String(b.id||'')))}));
}

// Manual Settings placement, matched to Lambus itinerary dates as of 2026-11-26.
// These dates are for grouping/sorting only; never change an imported trip's actual dates.
const guideIdentity=meta=>[meta?.id,meta?.name].filter(Boolean).join(' ').toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]+/g,' ').trim();
export function isSouthAfricaGuide(meta){return /\b(south africa|greater kruger|kruger wildlife)\b/.test(guideIdentity(meta));}
export function settingsGuideDate(meta){
 const identity=guideIdentity(meta);
 if(/\b(italy venice rome|venice rome|venice and rome|washington oregon|washington and oregon|pacific northwest)\b/.test(identity))return null;
 const planned=[
  [/\b(cambodia thailand|cambodia and thailand|siem reap)\b/,'2026-10-16'],
  [/\b(france spain|france and spain)\b/,'2026-04-11'],
  [/\b(peru|amazon (?:and )?the andes)\b/,'2027-05-01'],
  [/\b(yellowstone|glacier canada|canadian rockies)\b/,'2027-09-25'],
  [/\bjapan\b/,'2027-11-06'],
  [/\b(mexico city|costa rica|puerto vallarta)\b/,'2028-02-12'],
  [/\b(south africa|greater kruger|kruger wildlife)\b/,'2028-09-01'],
  [/\b(sichuan|yunnan)\b/,'2031-10-15'],
  [/\bchina\b/,'2028-10-14'],
  [/\buzbekistan\b/,'2029-03-31'],
  [/\b(italy egypt jordan|italy petra luxor|italy luxor petra|luxor|petra)\b/,'2029-10-28'],
  [/\b(gujarat|rajasthan)\b/,'2030-01-05'],
  [/\b(copenhagen|norway)\b/,'2030-06-15'],
  [/\b(java|bali)\b/,'2030-09-15'],
  [/\bhavasu falls\b/,'2031-03-15'],
  [/\bcalifornia\b/,'2031-10-15'],
  [/\b(kerala|tamil nadu)\b/,'2032-02-07'],
  [/\bpatagonia\b/,'2032-01-01']
 ];
 const actual=/^\d{4}-\d{2}-\d{2}$/.test(meta?.startDate||'')?meta.startDate:'';
 const date=planned.find(([pattern])=>pattern.test(identity))?.[1];
 if(date)return actual&&actual.slice(0,4)===date.slice(0,4)?actual:date;
 if(actual)return actual;
 if(/\biceland\b/.test(identity))return '2029-06-30';
 return ''; // An unmatched undated guide must not be assigned an invented year.
}
