import type { FreshEvent, FreshEventsPayload } from "./types";

const VERIFIED_AT = "2026-08-31T17:35:00.000Z";
const SFPL = "San Francisco Public Library";

const events: FreshEvent[] = [
  {
    id: "sf-event-mission-bay-ebook-help-2026-08-31",
    title: "Drop-In eBook Help",
    description: "Bring a device and get in-person help using the library's digital book collection.",
    category: "activity",
    venue: { name: "Mission Bay Branch Library", address: "960 4th St, San Francisco, CA 94158", neighborhood: "Mission Bay", lat: 37.7752, lng: -122.3933 },
    timing: { start: "2026-08-31T14:00:00-07:00", end: "2026-08-31T15:00:00-07:00" },
    commerce: { priceMin: 0, bookingRequired: false, bookingUrl: null },
    source: { name: SFPL, url: "https://sfpl.org/locations/mission-bay" },
    tags: ["drop-in", "learning", "free"],
    confidence: 0.94,
  },
  {
    id: "sf-event-park-storytime-2026-08-31",
    title: "Toddler Storytime at Park Branch",
    description: "A short neighborhood storytime for toddlers and their caregivers.",
    category: "activity",
    venue: { name: "Park Branch Library", address: "1833 Page St, San Francisco, CA 94117", neighborhood: "Haight-Ashbury", lat: 37.7702, lng: -122.4515 },
    timing: { start: "2026-08-31T15:30:00-07:00", end: "2026-08-31T16:00:00-07:00" },
    commerce: { priceMin: 0, bookingRequired: false, bookingUrl: null },
    source: { name: SFPL, url: "https://sfpl.org/locations/park" },
    tags: ["families", "storytime", "free"],
    confidence: 0.95,
  },
  {
    id: "sf-event-summermobile-jfk-2026-08-31",
    title: "SummerMobile at JFK Promenade",
    description: "The library bookmobile brings browsing and activities to Golden Gate Park's car-free promenade.",
    category: "activity",
    venue: { name: "JFK Promenade", address: "JFK Promenade, Golden Gate Park, San Francisco, CA 94121", neighborhood: "Golden Gate Park", lat: 37.7694, lng: -122.4862 },
    timing: { start: "2026-08-31T16:00:00-07:00", end: "2026-08-31T19:00:00-07:00" },
    commerce: { priceMin: 0, bookingRequired: false, bookingUrl: null },
    source: { name: SFPL, url: "https://sfpl.org/locations/bookmobiles-mobile-outreach" },
    tags: ["outdoors", "all-ages", "free"],
    confidence: 0.96,
  },
  {
    id: "sf-event-silent-book-club-2026-08-31",
    title: "Read in Nature Silent Book Club",
    description: "Bring your own book for an outdoor silent-reading hour with other readers.",
    category: "culture",
    venue: { name: "JFK Promenade", address: "JFK Promenade, Golden Gate Park, San Francisco, CA 94121", neighborhood: "Golden Gate Park", lat: 37.7694, lng: -122.4862 },
    timing: { start: "2026-08-31T17:30:00-07:00", end: "2026-08-31T18:30:00-07:00" },
    commerce: { priceMin: 0, bookingRequired: false, bookingUrl: null },
    source: { name: SFPL, url: "https://sfpl.org/books-and-media/read/book-clubs-sfpl" },
    tags: ["outdoors", "quiet", "community"],
    confidence: 0.96,
  },
  {
    id: "sf-event-swing-into-stories-2026-09-01",
    title: "Swing Into Stories",
    description: "A mobile-library early-learning session with stories and playful activities.",
    category: "activity",
    venue: { name: "JFK Promenade", address: "JFK Promenade, Golden Gate Park, San Francisco, CA 94121", neighborhood: "Golden Gate Park", lat: 37.7694, lng: -122.4862 },
    timing: { start: "2026-09-01T09:30:00-07:00", end: "2026-09-01T12:00:00-07:00" },
    commerce: { priceMin: 0, bookingRequired: false, bookingUrl: null },
    source: { name: SFPL, url: "https://sfpl.org/locations/bookmobiles-mobile-outreach" },
    tags: ["early-learning", "outdoors", "free"],
    confidence: 0.9,
  },
  {
    id: "sf-event-mission-bay-toddler-storytime-2026-09-01",
    title: "Toddler Storytime at Mission Bay",
    description: "Stories, songs and movement for toddlers at the Mission Bay branch.",
    category: "activity",
    venue: { name: "Mission Bay Branch Library", address: "960 4th St, San Francisco, CA 94158", neighborhood: "Mission Bay", lat: 37.7752, lng: -122.3933 },
    timing: { start: "2026-09-01T10:30:00-07:00", end: "2026-09-01T11:00:00-07:00" },
    commerce: { priceMin: 0, bookingRequired: false, bookingUrl: null },
    source: { name: SFPL, url: "https://sfpl.org/locations/mission-bay" },
    tags: ["families", "storytime", "free"],
    confidence: 0.94,
  },
  {
    id: "sf-event-mission-bay-preschool-storytime-2026-09-01",
    title: "Preschool Storytime at Mission Bay",
    description: "An in-person storytime designed for preschool-age children and caregivers.",
    category: "activity",
    venue: { name: "Mission Bay Branch Library", address: "960 4th St, San Francisco, CA 94158", neighborhood: "Mission Bay", lat: 37.7752, lng: -122.3933 },
    timing: { start: "2026-09-01T11:15:00-07:00", end: "2026-09-01T11:45:00-07:00" },
    commerce: { priceMin: 0, bookingRequired: false, bookingUrl: null },
    source: { name: SFPL, url: "https://sfpl.org/locations/mission-bay" },
    tags: ["families", "storytime", "free"],
    confidence: 0.94,
  },
];

export function verifiedSanFranciscoFallback(now = new Date()): FreshEventsPayload {
  return {
    generatedAt: VERIFIED_AT,
    city: "San Francisco",
    events: events.filter((event) => Date.parse(event.timing.end) > now.getTime()),
  };
}

export function withVerifiedFallback(payload: FreshEventsPayload, now = new Date()): FreshEventsPayload {
  if (payload.events.length > 0) return payload;
  return verifiedSanFranciscoFallback(now);
}
