import {
  FRESH_EVENT_CATEGORIES,
  type FreshEvent,
  type FreshEventCategory,
  type FreshEventsValidationResult,
} from "./types";

const MAX_WINDOW_MS = 72 * 60 * 60 * 1000;
const MIN_CONFIDENCE = 0.65;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function safeUrl(value: unknown): value is string {
  if (!nonEmpty(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function stableId(event: Omit<FreshEvent, "id">): string {
  const source = `${event.title}|${event.venue.name}|${event.timing.start}`.toLowerCase();
  let hash = 2166136261;
  for (const character of source) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `sf-event-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeEvent(value: unknown, now: Date): { event?: FreshEvent; reason?: string } {
  if (!isRecord(value)) return { reason: "event is not an object" };
  const venue = value.venue;
  const timing = value.timing;
  const commerce = value.commerce;
  const source = value.source;
  if (!isRecord(venue) || !isRecord(timing) || !isRecord(commerce) || !isRecord(source)) return { reason: "nested fields are invalid" };
  if (!nonEmpty(value.title) || !nonEmpty(value.description)) return { reason: "required text is missing" };
  if (!FRESH_EVENT_CATEGORIES.includes(value.category as FreshEventCategory)) return { reason: "category is invalid" };
  if (!nonEmpty(venue.name) || !nonEmpty(venue.address) || !nonEmpty(venue.neighborhood)) return { reason: "venue text is missing" };
  if (typeof venue.lat !== "number" || typeof venue.lng !== "number" || venue.lat < 37.70 || venue.lat > 37.83 || venue.lng < -122.53 || venue.lng > -122.35) return { reason: "venue coordinates are outside San Francisco" };

  if (!nonEmpty(timing.start) || !nonEmpty(timing.end)) return { reason: "timing is missing" };
  const startMs = Date.parse(timing.start);
  const endMs = Date.parse(timing.end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return { reason: "timing is invalid" };
  if (endMs <= now.getTime() || startMs > now.getTime() + MAX_WINDOW_MS || endMs > now.getTime() + MAX_WINDOW_MS) return { reason: "event is outside the fresh window" };

  const priceMin = commerce.priceMin;
  if (priceMin !== null && (typeof priceMin !== "number" || priceMin < 0)) return { reason: "price is invalid" };
  if (typeof commerce.bookingRequired !== "boolean") return { reason: "booking flag is invalid" };
  if (commerce.bookingUrl !== null && !safeUrl(commerce.bookingUrl)) return { reason: "booking URL is invalid" };
  if (!nonEmpty(source.name) || !safeUrl(source.url)) return { reason: "source is invalid" };
  if (!Array.isArray(value.tags) || !value.tags.every(nonEmpty)) return { reason: "tags are invalid" };
  if (typeof value.confidence !== "number" || value.confidence < MIN_CONFIDENCE || value.confidence > 1) return { reason: "confidence is too low" };

  const withoutId: Omit<FreshEvent, "id"> = {
    title: value.title.trim(),
    description: value.description.trim(),
    category: value.category as FreshEventCategory,
    venue: {
      name: venue.name.trim(),
      address: venue.address.trim(),
      neighborhood: venue.neighborhood.trim(),
      lat: venue.lat,
      lng: venue.lng,
    },
    timing: { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() },
    commerce: {
      priceMin,
      bookingRequired: commerce.bookingRequired,
      bookingUrl: commerce.bookingUrl,
    },
    source: { name: source.name.trim(), url: source.url },
    tags: [...new Set(value.tags.map((tag) => tag.trim().toLowerCase()))].slice(0, 6),
    confidence: value.confidence,
  };
  return { event: { id: stableId(withoutId), ...withoutId } };
}

export function validateFreshEventsResponse(value: unknown, now = new Date()): FreshEventsValidationResult {
  const rejected: string[] = [];
  if (!isRecord(value) || !Array.isArray(value.events)) {
    return { payload: { generatedAt: now.toISOString(), city: "San Francisco", events: [] }, rejected: ["response shape is invalid"] };
  }
  const events: FreshEvent[] = [];
  for (const [index, candidate] of value.events.slice(0, 30).entries()) {
    const result = normalizeEvent(candidate, now);
    if (result.event) events.push(result.event);
    else rejected.push(`event ${index}: ${result.reason ?? "invalid"}`);
  }
  if (value.events.length > 30) rejected.push(`${value.events.length - 30} events exceeded the maximum`);
  return {
    payload: {
      generatedAt: now.toISOString(),
      city: "San Francisco",
      events: events.sort((a, b) => Date.parse(a.timing.start) - Date.parse(b.timing.start)),
    },
    rejected,
  };
}
