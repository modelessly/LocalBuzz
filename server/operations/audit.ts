import { cityIds, getCityDefinition } from "../../src/data/cities";
import { validateHappenings, validatePlaces } from "../../src/data/validate";
import type { CityId, DiscoveryLead, Place } from "../../src/domain/types";

export type AuditFinding = { severity: "error" | "warning" | "info"; code: string; message: string };
export type DataQualityAudit = { generatedAt: string; passed: boolean; findings: AuditFinding[]; summary: { placesByCity: Record<CityId, number>; happeningsByCity: Record<CityId, number>; operationalCorridorsPassing: number; operationalCorridorsTotal: number } };

const corridors: Array<{ name: string; cityId: CityId; lat: number; lng: number }> = [
  { name: "Stockholm central", cityId: "stockholm", lat: 59.3326, lng: 18.0649 },
  { name: "Stockholm Södermalm", cityId: "stockholm", lat: 59.3158, lng: 18.0732 },
  { name: "Stockholm Vasastan", cityId: "stockholm", lat: 59.3407, lng: 18.0448 },
  { name: "San Francisco Mission", cityId: "san-francisco", lat: 37.7599, lng: -122.4194 },
  { name: "San Francisco SoMa", cityId: "san-francisco", lat: 37.7744, lng: -122.4124 },
  { name: "San Francisco Divisadero", cityId: "san-francisco", lat: 37.7750, lng: -122.4378 },
  { name: "San Francisco North Beach", cityId: "san-francisco", lat: 37.7980, lng: -122.4060 },
];
const excluded = /mcdonald|burger king|7-eleven|convenience store|supermarket|gas station|food court|delivery-only/i;
const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat); const dLng = radians(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};
const operational = (place: Place) => place.openingHoursEvidence.status === "verified" && place.priceRange.min !== undefined && place.priceRange.max !== undefined && Object.keys(place.weeklyHours).length > 0;

export function runDataQualityAudit(input: { discoveryLeads?: DiscoveryLead[]; now?: Date } = {}): DataQualityAudit {
  const findings: AuditFinding[] = [];
  const definitions = cityIds.map(getCityDefinition);
  const allPlaces = definitions.flatMap((city) => city.places);
  const allHappenings = definitions.flatMap((city) => city.happenings);
  for (const city of definitions) {
    if (city.places.length < 30 || city.places.length > 50) findings.push({ severity: "error", code: "PLACE_CATALOG_SIZE", message: `${city.name} has ${city.places.length} Places; expected 30–50.` });
    for (const error of validatePlaces(city.places)) findings.push({ severity: "error", code: "INVALID_PLACE", message: error });
    for (const error of validateHappenings(city.happenings)) findings.push({ severity: "error", code: "INVALID_HAPPENING", message: error });
  }
  const placeIds = new Set<string>(); const placeNames = new Set<string>();
  for (const place of allPlaces) {
    const nameKey = `${place.cityId}:${place.name.toLowerCase()}`;
    if (placeIds.has(place.id) || placeNames.has(nameKey)) findings.push({ severity: "error", code: "DUPLICATE_PLACE", message: `${place.name} has a duplicate stable identity.` });
    placeIds.add(place.id); placeNames.add(nameKey);
    if (excluded.test(`${place.name} ${place.kind} ${place.cuisine.join(" ")}`)) findings.push({ severity: "error", code: "EXCLUDED_PLACE", message: `${place.name} matches an excluded Place class.` });
    if (!place.provenance.length || !place.verification.verifiedAt) findings.push({ severity: "error", code: "PLACE_PROVENANCE", message: `${place.name} lacks visible provenance or verification date.` });
  }
  for (const event of allHappenings) if (!event.source.name || !event.source.url || !(event.source.lastVerifiedAt ?? event.source.fetchedAt)) findings.push({ severity: "error", code: "EVENT_PROVENANCE", message: `${event.title} lacks source freshness.` });
  const canonicalIds = new Set([...allPlaces.map((item) => item.id), ...allHappenings.map((item) => item.id)]);
  for (const lead of input.discoveryLeads ?? []) if (canonicalIds.has(lead.id)) findings.push({ severity: "error", code: "DISCOVERY_CANONICAL_COLLISION", message: `${lead.id} crosses the discovery/canonical boundary.` });

  let passing = 0;
  for (const corridor of corridors) {
    const count = allPlaces.filter((place) => place.cityId === corridor.cityId && operational(place) && distanceKm({ lat: corridor.lat, lng: corridor.lng }, place.location) <= 3.5).length;
    if (count >= 3) passing += 1;
    else findings.push({ severity: "error", code: "CORRIDOR_PLACE_GAP", message: `${corridor.name} has ${count} operational options inside the 3.5 km proxy; expected at least 3.` });
  }
  const needsReview = allPlaces.filter((place) => place.verification.status !== "verified").length;
  const nonStageable = allPlaces.filter((place) => !operational(place)).length;
  findings.push({ severity: "info", code: "OPERATIONAL_UNCERTAINTY", message: `${needsReview} canonical Places remain visibly needs-review; ${nonStageable} lack complete operational price/hours evidence and are non-stageable, while qualified needs-review records stage with warnings.` });
  findings.push({ severity: "info", code: "INVENTORY_BOUNDARIES", message: "Canonical inventory, DiscoveryLeads, benchmark snapshots, municipal radar and social pulse remain separate contracts." });
  return { generatedAt: (input.now ?? new Date()).toISOString(), passed: !findings.some((finding) => finding.severity === "error"), findings, summary: { placesByCity: { stockholm: getCityDefinition("stockholm").places.length, "san-francisco": getCityDefinition("san-francisco").places.length }, happeningsByCity: { stockholm: getCityDefinition("stockholm").happenings.length, "san-francisco": getCityDefinition("san-francisco").happenings.length }, operationalCorridorsPassing: passing, operationalCorridorsTotal: corridors.length } };
}

export function formatDataQualityAudit(audit: DataQualityAudit): string {
  return [`Local Buzz data-quality audit: ${audit.passed ? "PASS" : "FAIL"}`, `Places: Stockholm ${audit.summary.placesByCity.stockholm}, San Francisco ${audit.summary.placesByCity["san-francisco"]}`, `Event snapshots: Stockholm ${audit.summary.happeningsByCity.stockholm}, San Francisco ${audit.summary.happeningsByCity["san-francisco"]}`, `Operational Place corridors: ${audit.summary.operationalCorridorsPassing}/${audit.summary.operationalCorridorsTotal}`, ...audit.findings.map((finding) => `- ${finding.severity.toUpperCase()} ${finding.code}: ${finding.message}`)].join("\n");
}
