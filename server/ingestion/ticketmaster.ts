import type { CityId, HappeningCategory } from "../../src/domain/types";
import { normalizeEventCandidate } from "./pipeline";
import type { EventCandidate, EventSourceDefinition } from "./types";

type TicketmasterOptions = {
  source: EventSourceDefinition;
  apiKey?: string;
  startDateTime: string;
  endDateTime: string;
  classifications?: string[];
  fetchImpl?: typeof fetch;
  now?: Date;
};

const cityConfig: Record<CityId, { lat: number; lng: number; radius: number; unit: "km" | "miles"; countryCode: string }> = {
  stockholm: { lat: 59.3293, lng: 18.0686, radius: 35, unit: "km", countryCode: "SE" },
  "san-francisco": { lat: 37.7749, lng: -122.4194, radius: 18, unit: "miles", countryCode: "US" },
};

const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const string = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const number = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; };
const list = (value: unknown) => Array.isArray(value) ? value : [];

const category = (segment?: string): HappeningCategory => {
  const value = segment?.toLowerCase() ?? "";
  if (value.includes("music")) return "live_music";
  if (value.includes("arts") || value.includes("theatre")) return "culture";
  if (value.includes("film")) return "film";
  if (value.includes("miscellaneous")) return "other";
  return "activity";
};

export function buildTicketmasterUrl(options: TicketmasterOptions): string {
  if (!options.apiKey) throw new Error("TICKETMASTER_API_KEY is not configured");
  const city = cityConfig[options.source.cityId];
  const url = new URL(options.source.fetchUrl);
  url.searchParams.set("apikey", options.apiKey);
  // Discovery v2 accepts latitude/longitude through `latlong`. `geoPoint`
  // expects a geohash; passing coordinates there produces an HTTP 400.
  url.searchParams.set("latlong", `${city.lat},${city.lng}`);
  url.searchParams.set("radius", String(city.radius));
  url.searchParams.set("unit", city.unit);
  url.searchParams.set("countryCode", city.countryCode);
  // Discovery rejects otherwise-valid ISO strings when fractional seconds are
  // present, so serialize its documented second-precision format explicitly.
  url.searchParams.set("startDateTime", new Date(options.startDateTime).toISOString().replace(/\.\d{3}Z$/, "Z"));
  url.searchParams.set("endDateTime", new Date(options.endDateTime).toISOString().replace(/\.\d{3}Z$/, "Z"));
  url.searchParams.set("size", "100");
  url.searchParams.set("sort", "date,asc");
  if (options.classifications?.length) url.searchParams.set("classificationName", options.classifications.join(","));
  return url.toString();
}

export function parseTicketmasterResponse(value: unknown, source: EventSourceDefinition): EventCandidate[] {
  const root = record(value);
  const embedded = record(root?._embedded);
  return list(embedded?.events).flatMap((raw) => {
    const event = record(raw);
    const dates = record(event?.dates);
    const start = record(dates?.start);
    const status = record(dates?.status);
    const eventEmbedded = record(event?._embedded);
    const venue = record(list(eventEmbedded?.venues)[0]);
    const location = record(venue?.location);
    const address = record(venue?.address);
    const city = record(venue?.city);
    const classifications = record(list(event?.classifications)[0]);
    const segment = record(classifications?.segment);
    const attraction = record(list(eventEmbedded?.attractions)[0]);
    const price = record(list(event?.priceRanges)[0]);
    const title = string(event?.name);
    const startIso = string(start?.dateTime);
    const url = string(event?.url);
    if (!title || !startIso || !url) return [];
    const statusCode = string(status?.code)?.toLowerCase();
    return [{
      providerId: string(event?.id), cityId: source.cityId, title, description: string(event?.info ?? event?.pleaseNote), category: category(string(segment?.name)),
      venue: { name: string(venue?.name) ?? "", address: [string(address?.line1), string(city?.name)].filter(Boolean).join(", "), lat: number(location?.latitude), lng: number(location?.longitude) },
      start: startIso, end: string(record(dates?.end)?.dateTime), performer: string(attraction?.name), organizer: string(record(event?.promoter)?.name), canonicalUrl: url, ticketUrl: url,
      priceMin: number(price?.min), priceMax: number(price?.max), currency: string(price?.currency) as "SEK" | "USD" | undefined,
      availability: statusCode === "cancelled" ? "cancelled" : statusCode === "offsale" ? "sold_out" : statusCode === "onsale" ? "available" : "unknown",
    } satisfies EventCandidate];
  });
}

export async function collectTicketmaster(options: TicketmasterOptions) {
  const attemptedAt = (options.now ?? new Date()).toISOString();
  if (!options.apiKey) return { happenings: [], rejected: [], status: "unavailable" as const, attemptedAt, message: "TICKETMASTER_API_KEY is not configured" };
  const response = await (options.fetchImpl ?? fetch)(buildTicketmasterUrl(options));
  if (!response.ok) throw new Error(`Ticketmaster returned HTTP ${response.status}`);
  const payload = await response.json();
  const candidates = parseTicketmasterResponse(payload, options.source);
  const rawCount = list(record(record(payload)?._embedded)?.events).length;
  const normalized = candidates.map((candidate) => normalizeEventCandidate(candidate, options.source, attemptedAt, options.now));
  const rejected = [
    ...normalized.flatMap((item) => item.reason ? [item.reason] : []),
    ...Array(Math.max(0, rawCount - candidates.length)).fill("missing required provider fields"),
  ];
  return {
    happenings: normalized.flatMap((item) => item.happening ? [item.happening] : []),
    rejected,
    candidateCount: rawCount,
    status: "fresh" as const,
    attemptedAt,
  };
}
