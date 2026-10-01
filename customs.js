// Original, concise country guides bundled with the offline app shell.
export const guides=[{
 id:'cambodia',name:'Cambodia',language:'Khmer',lang:'km',
 matches:/\b(cambodia|khmer|siem reap|angkor|phnom penh|koh ker)\b/i,
 intro:'A little local context for temple days, tuk-tuk rides, and meals in Siem Reap.',
 sections:[
  {heading:'Getting around',paragraphs:[
   'In Siem Reap, use Grab to book a tuk-tuk. Select GrabTukTuk or GrabRemorque if available, check the pickup pin, and see the fare before confirming. Remorque is the traditional motorcycle with a passenger trailer. Grab also offers cars.',
   'For your sunrise start or a long temple circuit, our practical suggestion is to arrange a driver ahead of time. Agree on the route, waiting time, and return journey. For distant stops such as Koh Ker or Kbal Spean, plan the ride back before leaving town rather than relying on finding a vehicle there.'
  ]},
  {heading:'Meals and tipping',paragraphs:[
   'Restaurant tips are appreciated but not compulsory. For good service at a sit-down restaurant, leaving a small cash tip is a friendly gesture. There is no need to apply an automatic US-style percentage to every purchase. Check whether the bill already includes a service charge.',
   'For a guide or driver spending the day with you, ask your operator about its tipping expectations. Agree on the actual fare separately, then decide on a gratuity based on the service.'
  ]},
  {heading:'Temples and everyday courtesy',paragraphs:[
   'Dress with shoulders and knees covered for Angkor and other sacred places. Remove shoes when entering worship spaces where requested, and take off your hat. Treat temple stonework as heritage: avoid touching carvings or climbing structures unless the visitor route permits it.',
   'A sampeah is a greeting with palms together and a slight bow. A smile and a polite hello go a long way. Avoid touching anyone’s head or pointing your feet toward people or religious images. Ask before photographing someone, especially monks, and keep voices low in places of worship.'
  ]},
  {heading:'Small tips for your temple days',paragraphs:[
   'Our suggestion: save your hotel’s name and map pin on your phone, carry small notes for short rides and snacks, and keep your driver’s contact details. A screenshot of the agreed route makes pickup points easier to explain.',
   'Build in a pause between temples. Your short attraction summaries are ideal for the ride; save the longer sections for a shaded break. Follow signs and staff guidance at each site, as access can change.'
  ]}
 ],
 phraseNote:'These spellings are approximate aids, not exact pronunciation. You can show the Khmer text to a local person.',
 phrases:[['Hello','សួស្ដី','Sousdey'],['Thank you','អរគុណ','Arkoun'],['How much?','ថ្លៃប៉ុន្មាន?','Thlai ponman?'],['No sugar','អត់ស្ករ','Ot skor'],['Delicious','ឆ្ងាញ់','Chhnganh']],
 sources:[
  ['Grab Cambodia: tuk-tuks','https://www.grab.com/kh/en/transport/tuktuk/'],
  ['Grab Cambodia: transport options','https://www.grab.com/kh/en/transport/'],
  ['Anywhere: restaurant tipping','https://www.anywhere.com/cambodia/questions/food-service-etiquette/how-much-do-i-tip-after-a-meal'],
  ['Tourism Cambodia: etiquette','https://www.tourismcambodia.com/tripplanner/essential-information/do-s-and-don-ts-in-the-kingdom-of-wonder.htm'],
  ['Angkor visitor code of conduct','https://www.siemreap.net/guides/angkor/angkor-visitor-code-of-conduct/'],
  ['The Map Cambodia: useful Khmer words','https://themapcambodia.com/en/journal/useful-khmer-words-cambodia']
 ]
},{
 id:'thailand',name:'Thailand',language:'Thai',lang:'th',
 matches:/\b(thailand|thai|bangkok|chiang mai|phuket|ayutthaya)\b/i,
 intro:'Useful context for Bangkok, its temples, and everyday conversations.',
 sections:[
  {heading:'Getting around Bangkok',paragraphs:[
   'The BTS Skytrain and MRT subway are useful starting points for journeys across Bangkok. For the historic riverside, look at the Chao Phraya boats as well. The Grand Palace’s official visitor information lists rail and river approaches.',
   'For a tuk-tuk, settle the total price before boarding. It can cost more than a taxi, especially for a short ride around the palace. Our practical suggestion: compare your route with public transport first, keep your destination’s map pin handy, and leave extra time for road traffic.'
  ]},
  {heading:'Meals and tipping',paragraphs:[
   'Small tips for good service are welcome, but a large automatic percentage is not the usual starting point. At a casual restaurant, rounding up or leaving a modest tip is enough. Street-food stalls and market purchases generally do not need a tip.',
   'At an upscale or hotel restaurant, check the receipt for a service charge. If one is included, an extra tip is optional. Keep small cash notes if you want to thank a guide, hotel worker, or driver.'
  ]},
  {heading:'Temples and everyday courtesy',paragraphs:[
   'Dress respectfully and remove shoes before entering temple interiors or a home when asked. Do not point with your feet, touch someone’s head, or make physical contact with monks. Stay off raised thresholds and Buddha statues, and keep your voice calm.',
   'The Grand Palace has a stricter dress code than an ordinary street outing. Wear a sleeved top and loose, full-length trousers or a suitable long skirt. Shorts, sleeveless tops, torn trousers, and tight leggings are not accepted. Check the official information before visiting.'
  ]},
  {heading:'Useful local habits',paragraphs:[
   'If others stand for the national or royal anthem, follow their lead. A smile and a quiet, courteous response usually help more than raising your voice.',
   'Our suggestion for your palace and temple day: confirm entry information with the venue itself, carry your hotel’s address, and plan your next stop before leaving the shade. The river can be a pleasant alternative to another road journey when the route fits.'
  ]}
 ],
 phraseNote:'Thai is tonal, so these spellings are only approximate. A common polite ending is khrap for male speakers or kha for female speakers. Add it to greetings and thanks. Show the Thai text when pronunciation is difficult.',
 phrases:[['Hello','สวัสดี','Sa-wat-dee'],['Thank you','ขอบคุณ','Khop khun'],['Excuse me / sorry','ขอโทษ','Khor thot'],['How much?','ราคาเท่าไหร่','Raa-khaa thao rai?'],['I don’t understand','ไม่เข้าใจ','Mai khao jai'],['Delicious','อร่อย','Aroi']],
 sources:[
  ['Thailand Department of Tourism: etiquette and phrases','https://tfo.dot.go.th/about-thailand/tips/'],
  ['Thailand Department of Tourism: transport','https://tfo.dot.go.th/about-thailand/transportations/'],
  ['Grand Palace: travel and dress code','https://www.royalgrandpalace.th/en/visit/practical-information'],
  ['ThaiPod101: tipping customs','https://www.thaipod101.com/blog/2026/04/16/how-tipping-works-in-thailand/']
 ]
}];
export function guidesForTrip(trip) {
 // Detect destinations from the title and locations, not narrative mentions of other countries.
 const locations=[trip.name,...trip.days.flatMap(d=>d.attractions.map(a=>a.location))].join('\n');
 return guides.filter(g=>g.matches.test(locations));
}
export const researchedAt='2026-10-01';
