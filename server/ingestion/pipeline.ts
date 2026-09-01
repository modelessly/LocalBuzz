import type { CityId, Happening, HappeningCategory } from "../../src/domain/types";
export { deduplicateHappenings } from "../../src/domain/happeningDedup";
import type { EventCandidate, EventSourceDefinition } from "./types";

const CITY_BOUNDS: Record<CityId, { minLat: number; maxLat: number; minLng: number; maxLng: number; currency: "SEK" | "USD" }> = {
  stockholm: { minLat: 59.15, maxLat: 59.5, minLng: 17.7, maxLng: 18.35, currency: "SEK" },
  "san-francisco": { minLat: 37.7, maxLat: 37.84, minLng: -122.54, maxLng: -122.34, currency: "USD" },
};

const safeUrl = (value: string | undefined) => {
  if (!value) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

const stableId = (sourceId: string, candidate: EventCandidate) => {
  const input = `${sourceId}|${candidate.providerId ?? candidate.canonicalUrl}|${candidate.start}`;
  let hash = 2166136261;
  for (const character of input) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `ingested-${candidate.cityId}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export function normalizeEventCandidate(candidate: EventCandidate, source: EventSourceDefinition, fetchedAt: string, now = new Date()): { happening?: Happening; reason?: string } {
  const bounds = CITY_BOUNDS[source.cityId];
  if (candidate.cityId !== source.cityId) return { reason: "city mismatch" };
  if (!candidate.title.trim()) return { reason: "title is missing" };
  if (!candidate.venue.name.trim() || !candidate.venue.address?.trim()) return { reason: "physical venue is unresolved" };
  if (candidate.venue.lat === undefined || candidate.venue.lng === undefined || !Number.isFinite(candidate.venue.lat) || !Number.isFinite(candidate.venue.lng) || candidate.venue.lat < bounds.minLat || candidate.venue.lat > bounds.maxLat || candidate.venue.lng < bounds.minLng || candidate.venue.lng > bounds.maxLng) return { reason: "coordinates are missing or outside the city" };
  const start = Date.parse(candidate.start);
  const end = candidate.end ? Date.parse(candidate.end) : undefined;
  if (!/T/.test(candidate.start) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(candidate.start)) return { reason: "start date lacks an explicit time zone" };
  if (candidate.end && (!/T/.test(candidate.end) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(candidate.end))) return { reason: "end date lacks an explicit time zone" };
  if (!Number.isFinite(start) || (end !== undefined && (!Number.isFinite(end) || end <= start))) return { reason: "dates or timezone are invalid" };
  if ((end ?? start + 90 * 60_000) <= now.getTime()) return { reason: "event is expired" };
  if (!safeUrl(candidate.canonicalUrl) || (candidate.ticketUrl && !safeUrl(candidate.ticketUrl))) return { reason: "canonical or ticket URL is invalid" };
  if (candidate.currency && candidate.currency !== bounds.currency) return { reason: "currency does not match city" };
  if (candidate.priceMin !== undefined && candidate.priceMin < 0) return { reason: "price is invalid" };
  const availability = candidate.availability ?? "unknown";
  const category: HappeningCategory = candidate.category ?? "other";
  return { happening: {
    id: stableId(source.id, candidate), cityId: source.cityId, title: candidate.title.trim(), description: candidate.description?.trim(), category,
    venue: { name: candidate.venue.name.trim(), address: candidate.venue.address.trim(), neighborhood: candidate.venue.neighborhood, lat: candidate.venue.lat, lng: candidate.venue.lng },
    timing: { start: new Date(start).toISOString(), end: end === undefined ? undefined : new Date(end).toISOString(), estimatedDurationMinutes: end === undefined ? 90 : Math.round((end - start) / 60_000) },
    commerce: { priceMin: candidate.priceMin, priceMax: candidate.priceMax, currency: candidate.currency ?? bounds.currency, bookingRequired: Boolean(candidate.ticketUrl), bookingUrl: candidate.ticketUrl },
    status: { availability, statusUpdatedAt: fetchedAt, statusSource: "source" },
    source: { name: source.publisher, url: candidate.canonicalUrl, fetchedAt, lastVerifiedAt: fetchedAt },
    enrichment: { moodTags: [], confidence: source.trustTier === "first_party" ? 0.95 : 0.85, enrichmentMethod: "derived" },
  } };
}
