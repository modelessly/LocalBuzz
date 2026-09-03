import { getCityDefinition } from "../data/cities";
import { validateHappenings, validatePlaces } from "../data/validate";
import type { CityId, DiscoveryLead, DiscoveryLeadEvidence, DiscoveryLeadIssueCode, DomainResult, EventDiscoveryFields, Happening, Place, PlaceDiscoveryFields } from "./types";

export type ProposeEventLeadInput = { cityId: CityId; sourceUrl: string; sourceType: DiscoveryLead["sourceType"]; fields: EventDiscoveryFields; evidence: DiscoveryLeadEvidence[]; submittedBy?: DiscoveryLead["submittedBy"] };
export type ProposePlaceLeadInput = { cityId: CityId; sourceUrl: string; sourceType: DiscoveryLead["sourceType"]; fields: PlaceDiscoveryFields; evidence: DiscoveryLeadEvidence[]; submittedBy?: DiscoveryLead["submittedBy"] };

const failure = <T>(code: Extract<DomainResult<T>, { ok: false }>["code"], message: string): DomainResult<T> => ({ ok: false, code, message });
const normalized = (value?: string) => value?.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim() ?? "";

const privateIpv4 = (host: string) => {
  const parts = host.split(".").map(Number);
  return parts.length === 4 && parts.every(Number.isInteger) && (
    parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
};

export function validatePublicSourceUrl(value: string): DomainResult<{ url: string }> {
  if (value.length > 2_048 || [...value].some((character) => character.charCodeAt(0) <= 31)) return failure("UNSAFE_INPUT", "The source URL contains unsafe or excessive input.");
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password) return failure("INVALID_URL", "Source URLs must use HTTPS without embedded credentials.");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:") || privateIpv4(host)) return failure("UNSAFE_INPUT", "Private, local and link-local source addresses are not allowed.");
    return { ok: true, url: url.toString() };
  } catch {
    return failure("INVALID_URL", "The source URL is invalid.");
  }
}

const evidenceValid = (evidence: DiscoveryLeadEvidence[], sourceUrl: string) => {
  void sourceUrl;
  return evidence.length > 0 && evidence.every((item) => item.field.trim().length > 0 && item.field.length <= 80 && (item.note === undefined || (item.note.length > 0 && item.note.length <= 500))) && evidence.every((item) => {
    const checked = validatePublicSourceUrl(item.sourceUrl);
    return checked.ok;
  });
};

const stableLeadId = (type: string, sourceUrl: string, name: string) => {
  let hash = 2166136261;
  for (const character of `${type}|${sourceUrl}|${name}`) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `lead-${type}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const cityContains = (cityId: CityId, lat?: number, lng?: number) => {
  if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const center = getCityDefinition(cityId).mapCenter;
  return Math.abs(lat - center[1]) < (cityId === "stockholm" ? 0.35 : 0.15) && Math.abs(lng - center[0]) < (cityId === "stockholm" ? 0.5 : 0.18);
};

export function buildEventLead(input: ProposeEventLeadInput, activeCityId: CityId, happenings: Happening[], now = new Date()): DomainResult<{ lead: Extract<DiscoveryLead, { leadType: "event" }> }> {
  if (JSON.stringify(input.fields).length > 50_000 || input.evidence.length > 30 || (input.fields.title?.length ?? 0) > 300 || (input.fields.description?.length ?? 0) > 5_000) return failure("UNSAFE_INPUT", "The submitted event facts exceed safe review limits.");
  if (input.cityId !== activeCityId) return failure("WRONG_CITY", `The proposal is for ${input.cityId}, but ${activeCityId} is active.`);
  const checkedUrl = validatePublicSourceUrl(input.sourceUrl);
  if (!checkedUrl.ok) return checkedUrl;
  if (input.fields.commerce?.bookingUrl) {
    const bookingUrl = validatePublicSourceUrl(input.fields.commerce.bookingUrl);
    if (!bookingUrl.ok) return failure("UNSAFE_INPUT", "The submitted booking URL is not a safe public HTTPS URL.");
  }
  const missing = [!input.fields.title?.trim() ? "title" : undefined, !input.fields.timing?.start ? "timing.start" : undefined, !input.fields.venue?.name ? "venue.name" : undefined, !input.fields.venue?.address ? "venue.address" : undefined, !cityContains(input.cityId, input.fields.venue?.lat, input.fields.venue?.lng) ? "venue.coordinates" : undefined].filter((item): item is string => Boolean(item));
  const duplicates = happenings.filter((item) => (normalized(item.title) === normalized(input.fields.title) && item.timing.start === input.fields.timing?.start) || item.source.url === checkedUrl.url).map((item) => ({ id: item.id, name: item.title, reason: "Matching title/time or canonical URL" }));
  const issues = new Set<DiscoveryLeadIssueCode>();
  if (!input.fields.timing?.start) issues.add("MISSING_DATE");
  else if (!Number.isFinite(Date.parse(input.fields.timing.start)) || !/T/.test(input.fields.timing.start) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(input.fields.timing.start) || Date.parse(input.fields.timing.end ?? input.fields.timing.start) <= now.getTime()) issues.add("EXPIRED_EVENT");
  if (!input.fields.venue?.name || !input.fields.venue.address || !cityContains(input.cityId, input.fields.venue.lat, input.fields.venue.lng)) issues.add("MISSING_LOCATION");
  if (duplicates.length) issues.add("DUPLICATE");
  if (!evidenceValid(input.evidence, checkedUrl.url) || input.sourceType === "editorial_page" || input.sourceType === "other_public_page") issues.add("INSUFFICIENT_PROVENANCE");
  const expectedCurrency = getCityDefinition(input.cityId).currency;
  if ((input.fields.commerce?.priceMin ?? 0) < 0 || (input.fields.commerce?.priceMax !== undefined && input.fields.commerce.priceMin !== undefined && input.fields.commerce.priceMax < input.fields.commerce.priceMin) || (input.fields.commerce?.currency && input.fields.commerce.currency !== expectedCurrency)) issues.add("INVALID_PRICE_CURRENCY");
  return { ok: true, lead: { id: stableLeadId("event", checkedUrl.url, input.fields.title ?? "unknown"), leadType: "event", cityId: input.cityId, originalSourceUrl: checkedUrl.url, sourceType: input.sourceType, submittedBy: input.submittedBy ?? { kind: "webmcp_agent", toolName: "propose_event_from_url" }, fields: input.fields, missingRequiredFields: missing, possibleDuplicateMatches: duplicates, verificationStatus: issues.size || missing.length ? "needs_review" : "provisional", evidence: input.evidence, issues: [...issues], createdAt: now.toISOString() } };
}

export function buildPlaceLead(input: ProposePlaceLeadInput, activeCityId: CityId, places: Place[], now = new Date()): DomainResult<{ lead: Extract<DiscoveryLead, { leadType: "place" }> }> {
  if (JSON.stringify(input.fields).length > 50_000 || input.evidence.length > 30 || (input.fields.name?.length ?? 0) > 300) return failure("UNSAFE_INPUT", "The submitted Place facts exceed safe review limits.");
  if (input.cityId !== activeCityId) return failure("WRONG_CITY", `The proposal is for ${input.cityId}, but ${activeCityId} is active.`);
  const checkedUrl = validatePublicSourceUrl(input.sourceUrl);
  if (!checkedUrl.ok) return checkedUrl;
  const placeUrls = [input.fields.officialWebsite, input.fields.reservationUrl, input.fields.priceRange?.evidenceUrl, input.fields.openingHoursEvidence?.sourceUrl, ...(input.fields.whyInteresting ?? []).map((item) => item.sourceUrl)].filter((item): item is string => Boolean(item));
  if (placeUrls.some((url) => !validatePublicSourceUrl(url).ok)) return failure("UNSAFE_INPUT", "One or more submitted Place evidence URLs are not safe public HTTPS URLs.");
  const supported = new Set(["restaurant", "bar", "pub", "cocktail_lounge", "wine_bar", "music_bar", "club", "cafe"]);
  const missing = [!input.fields.name?.trim() ? "name" : undefined, !input.fields.kind ? "kind" : undefined, !input.fields.location?.address ? "location.address" : undefined, !input.fields.location?.neighborhood ? "location.neighborhood" : undefined, !cityContains(input.cityId, input.fields.location?.lat, input.fields.location?.lng) ? "location.coordinates" : undefined, !input.fields.priceRange ? "priceRange" : undefined, !input.fields.typicalVisitDurationMinutes ? "typicalVisitDurationMinutes" : undefined, !input.fields.weeklyHours || !Object.keys(input.fields.weeklyHours).length ? "weeklyHours" : undefined].filter((item): item is string => Boolean(item));
  const duplicates = places.filter((item) => normalized(item.name) === normalized(input.fields.name) || item.officialWebsite === checkedUrl.url).map((item) => ({ id: item.id, name: item.name, reason: "Matching name or official URL" }));
  const issues = new Set<DiscoveryLeadIssueCode>();
  if (!input.fields.kind || !supported.has(input.fields.kind)) issues.add("UNSUPPORTED_PLACE");
  if (!input.fields.location?.address || !cityContains(input.cityId, input.fields.location.lat, input.fields.location.lng)) issues.add("MISSING_LOCATION");
  if (duplicates.length) issues.add("DUPLICATE");
  if (!evidenceValid(input.evidence, checkedUrl.url) || input.sourceType === "editorial_page" || input.sourceType === "other_public_page") issues.add("INSUFFICIENT_PROVENANCE");
  const expectedCurrency = getCityDefinition(input.cityId).currency;
  if (!input.fields.priceRange || input.fields.priceRange.currency !== expectedCurrency || (input.fields.priceRange.min ?? 0) < 0 || (input.fields.priceRange.max !== undefined && input.fields.priceRange.min !== undefined && input.fields.priceRange.max < input.fields.priceRange.min)) issues.add("INVALID_PRICE_CURRENCY");
  return { ok: true, lead: { id: stableLeadId("place", checkedUrl.url, input.fields.name ?? "unknown"), leadType: "place", cityId: input.cityId, originalSourceUrl: checkedUrl.url, sourceType: input.sourceType, submittedBy: input.submittedBy ?? { kind: "webmcp_agent", toolName: "propose_place_from_url" }, fields: input.fields, missingRequiredFields: missing, possibleDuplicateMatches: duplicates, verificationStatus: issues.size || missing.length ? "needs_review" : "provisional", evidence: input.evidence, issues: [...issues], createdAt: now.toISOString() } };
}

export function canonicalEventFromLead(lead: Extract<DiscoveryLead, { leadType: "event" }>, now = new Date()): DomainResult<{ happening: Happening }> {
  if (lead.missingRequiredFields.length) return failure(lead.issues[0] ?? "INVALID_INPUT", "The event is missing required canonical fields.");
  if (lead.issues.length) return failure(lead.issues[0], "The event lead still has unresolved validation issues.");
  const fields = lead.fields;
  const start = fields.timing!.start!;
  const end = fields.timing?.end;
  if (Date.parse(end ?? start) <= now.getTime()) return failure("EXPIRED_EVENT", "Expired events cannot become canonical.");
  const happening: Happening = { id: `reviewed-${lead.id}`, cityId: lead.cityId, title: fields.title!, description: fields.description, category: fields.category ?? "other", venue: { name: fields.venue!.name!, address: fields.venue!.address!, neighborhood: fields.venue!.neighborhood, lat: fields.venue!.lat!, lng: fields.venue!.lng! }, timing: { start, end, estimatedDurationMinutes: end ? Math.round((Date.parse(end) - Date.parse(start)) / 60_000) : 90 }, commerce: { priceMin: fields.commerce?.priceMin, priceMax: fields.commerce?.priceMax, currency: fields.commerce?.currency ?? getCityDefinition(lead.cityId).currency, bookingRequired: Boolean(fields.commerce?.bookingUrl), bookingUrl: fields.commerce?.bookingUrl }, status: { availability: fields.availability ?? "unknown", statusUpdatedAt: lead.createdAt, statusSource: "source" }, source: { name: new URL(lead.originalSourceUrl).hostname, url: lead.originalSourceUrl, fetchedAt: lead.createdAt, lastVerifiedAt: lead.createdAt }, enrichment: { confidence: 0.8, enrichmentMethod: "derived" } };
  const errors = validateHappenings([happening]);
  return errors.length ? failure("INVALID_INPUT", errors.join("; ")) : { ok: true, happening };
}

export function canonicalPlaceFromLead(lead: Extract<DiscoveryLead, { leadType: "place" }>): DomainResult<{ place: Place }> {
  if (lead.missingRequiredFields.length) return failure(lead.issues[0] ?? "INVALID_INPUT", "The place is missing required canonical fields.");
  if (lead.issues.length) return failure(lead.issues[0], "The place lead still has unresolved validation issues.");
  const fields = lead.fields;
  const place: Place = { id: `reviewed-${lead.id}`, cityId: lead.cityId, name: fields.name!, officialWebsite: fields.officialWebsite ?? lead.originalSourceUrl, reservationUrl: fields.reservationUrl, kind: fields.kind!, location: { lat: fields.location!.lat!, lng: fields.location!.lng!, address: fields.location!.address!, neighborhood: fields.location!.neighborhood! }, cuisine: fields.cuisine ?? [], drinkFocus: fields.drinkFocus ?? [], moodTags: fields.moodTags ?? [], whyInteresting: fields.whyInteresting ?? lead.evidence.map((item) => ({ claim: item.note ?? `Evidence for ${item.field}`, sourceUrl: item.sourceUrl })), bestFor: fields.bestFor ?? [], typicalVisitDurationMinutes: fields.typicalVisitDurationMinutes!, priceRange: fields.priceRange!, weeklyHours: fields.weeklyHours!, openingHoursEvidence: fields.openingHoursEvidence ?? { status: "unknown", checkedAt: lead.createdAt }, exceptionalHours: fields.exceptionalHours ?? { status: "unknown" }, reservationMode: fields.reservationMode ?? "unknown", provenance: [{ name: new URL(lead.originalSourceUrl).hostname, url: lead.originalSourceUrl, fields: lead.evidence.map((item) => item.field), fetchedAt: lead.createdAt }], verification: { status: "verified", verifiedAt: lead.createdAt, note: "Accepted through human discovery-lead review." } };
  const errors = validatePlaces([place]);
  return errors.length ? failure("INVALID_INPUT", errors.join("; ")) : { ok: true, place };
}
