export function buildFreshEventsPrompt(now: Date): string {
  return `Collect a high-confidence San Francisco event inventory for Local Buzz using public web sources.

Current instant: ${now.toISOString()}
City: San Francisco, California only.
Coverage: events still attendable today plus events tomorrow. Return at most 30. You must use Web Search before answering.

Search the current calendars on sfpl.org, sfmoma.org, sf.gov, goldengatepark.com, and sftravel.com first. Include public music, comedy, culture, film, talks, markets, food and drink events, nightlife, and activities. Every record needs a direct public source URL supporting its date, time, and place.

Reject expired events, generic recommendations, online-only events, private events, undated listings, events outside San Francisco, and records whose exact start/end or physical venue cannot be supported. Do not claim ticket availability. Use null for an unknown price or booking URL. Use established public coordinates for the named venue; coordinates must remain within San Francisco.

Descriptions and tags must be concise factual summaries. Confidence must be at least 0.65.

After searching, output JSON only with this exact top-level shape: {"generatedAt":"ISO datetime","city":"San Francisco","events":[]}. Each event must contain id, title, description, category, venue{name,address,neighborhood,lat,lng}, timing{start,end}, commerce{priceMin,bookingRequired,bookingUrl}, source{name,url}, tags, and confidence. Do not output markdown.`;
}
