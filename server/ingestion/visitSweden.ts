import { normalizeEventCandidate } from "./pipeline";
import type { EventCandidate, EventSourceDefinition } from "./types";

type VisitSwedenOptions = { source: EventSourceDefinition; fetchImpl?: typeof fetch; now?: Date; limit?: number; knownVenues?: Array<{ name: string; address?: string; neighborhood?: string; lat: number; lng: number }> };
const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const list = (value: unknown) => Array.isArray(value) ? value : value === undefined ? [] : [value];
const scalar = (value: unknown): string | undefined => typeof value === "string" ? value : record(value)?.["@value"] as string | undefined;
const linkedId = (value: unknown): string | undefined => typeof value === "string" ? value : record(value)?.["@id"] as string | undefined;
const scalars = (value: unknown) => list(value).map(scalar).filter((item): item is string => Boolean(item));
const optionalNumber = (value: unknown) => {
  const raw = scalar(value);
  if (raw === undefined || raw === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function buildVisitSwedenUrl(source: EventSourceDefinition, limit = 100, offset = 0) {
  const url = new URL(source.fetchUrl);
  url.searchParams.set("type", "solr");
  url.searchParams.set("query", "public:true AND rdfType:http\\://schema.org/Event AND all:Stockholm");
  url.searchParams.set("limit", String(Math.min(100, limit)));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("rdfFormat", "application/ld+json");
  return url.toString();
}

const addressText = (value: unknown) => {
  const address = record(value);
  if (!address) return scalar(value);
  return [scalar(address["schema:streetAddress"]), scalar(address["schema:postalCode"]), scalar(address["schema:addressLocality"])].filter(Boolean).join(", ");
};

export function parseVisitSwedenResponse(value: unknown, source: EventSourceDefinition): { candidates: EventCandidate[]; total: number } {
  const root = record(value);
  const resource = record(root?.resource);
  const children = list(resource?.children);
  const candidates = children.flatMap((child) => {
    const metadata = record(record(child)?.metadata);
    const graph = list(metadata?.["@graph"]).map(record).filter(Boolean) as Record<string, unknown>[];
    const event = graph.find((node) => String(node["@type"] ?? "").includes("Event"));
    if (!event) return [];
    const locationRef = linkedId(event["schema:location"]);
    const location = graph.find((node) => node["@id"] === locationRef) ?? record(event["schema:location"]);
    const addressRef = linkedId(location?.["schema:address"] ?? event["schema:address"]);
    const address = graph.find((node) => node["@id"] === addressRef) ?? record(location?.["schema:address"] ?? event["schema:address"]);
    const geoRef = linkedId(location?.["schema:geo"] ?? event["schema:geo"]);
    const geo = graph.find((node) => node["@id"] === geoRef) ?? record(location?.["schema:geo"] ?? event["schema:geo"]);
    const offers = record(list(event["schema:offers"])[0]);
    const organizerRef = linkedId(event["schema:organizer"]);
    const organizer = graph.find((node) => node["@id"] === organizerRef) ?? record(event["schema:organizer"]);
    const title = scalar(event["schema:name"]);
    const starts = scalars(event["schema:startDate"]);
    const ends = scalars(event["schema:endDate"]);
    const canonicalUrl = linkedId(event["schema:url"]) ?? linkedId(event["@id"]);
    if (!title || !starts.length || !canonicalUrl) return [];
    return starts.map((start, index) => ({
      providerId: String(record(child)?.entryId ?? canonicalUrl), cityId: source.cityId, title, description: scalar(event["dcterms:abstract"] ?? event["schema:description"]),
      venue: { name: scalar(location?.["schema:name"]) ?? "", address: addressText(address), neighborhood: scalar(address?.["schema:addressLocality"]), lat: optionalNumber(geo?.["schema:latitude"]), lng: optionalNumber(geo?.["schema:longitude"]) },
      start, end: ends[index] ?? ends[0], organizer: scalar(organizer?.["schema:name"] ?? organizer?.["schema:legalName"]), canonicalUrl,
      ticketUrl: linkedId(offers?.["schema:url"]), priceMin: optionalNumber(offers?.["schema:lowPrice"] ?? offers?.["schema:price"]), priceMax: optionalNumber(offers?.["schema:highPrice"]), currency: scalar(offers?.["schema:priceCurrency"]) as "SEK" | undefined, availability: "unknown",
    } satisfies EventCandidate));
  });
  return { candidates, total: Number(root?.results ?? candidates.length) };
}

export async function collectVisitSweden(options: VisitSwedenOptions) {
  const attemptedAt = (options.now ?? new Date()).toISOString();
  const response = await (options.fetchImpl ?? fetch)(buildVisitSwedenUrl(options.source, options.limit));
  if (!response.ok) throw new Error(`Visit Sweden returned HTTP ${response.status}`);
  const parsed = parseVisitSwedenResponse(await response.json(), options.source);
  const normalizedAddress = (value?: string) => value?.toLowerCase().replace(/[^a-z0-9åäö]+/g, " ").trim();
  const resolved = parsed.candidates.map((candidate) => {
    if (candidate.venue.name && candidate.venue.address && candidate.venue.lat !== undefined && candidate.venue.lng !== undefined) return candidate;
    const match = options.knownVenues?.find((venue) => {
      if (candidate.venue.address && venue.address && normalizedAddress(candidate.venue.address)?.includes(normalizedAddress(venue.address)?.split(" stockholm")[0] ?? "__never__")) return true;
      if (candidate.venue.lat === undefined || candidate.venue.lng === undefined) return false;
      const latKm = (candidate.venue.lat - venue.lat) * 111;
      const lngKm = (candidate.venue.lng - venue.lng) * 111 * Math.cos(candidate.venue.lat * Math.PI / 180);
      return Math.hypot(latKm, lngKm) <= 0.12;
    });
    return match ? { ...candidate, venue: { ...candidate.venue, ...match } } : candidate;
  });
  const normalized = resolved.map((candidate) => normalizeEventCandidate(candidate, options.source, attemptedAt, options.now));
  return { happenings: normalized.flatMap((item) => item.happening ? [item.happening] : []), rejected: normalized.flatMap((item) => item.reason ? [item.reason] : []), candidateCount: parsed.candidates.length, status: "fresh" as const, attemptedAt, measuredTotal: parsed.total };
}
