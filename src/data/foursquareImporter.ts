import type { CityId } from "../domain/types";

export type FoursquarePlaceRow = {
  fsq_place_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  locality?: string;
  neighborhood?: string;
  website?: string;
  categories?: Array<{ id?: number | string; name?: string }>;
  fsq_category_ids?: Array<number | string>;
  closed_bucket?: string;
  date_closed?: string;
  chain_name?: string;
  price?: number;
};

export type FoursquareImportConfig = {
  cityId: CityId;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  allowedCategoryIds: string[];
  allowedCategoryTerms: string[];
  deniedCategoryIds: string[];
  deniedCategoryTerms: string[];
  deniedNameTerms: string[];
  deniedChains: string[];
  minimumNameLength?: number;
};

export type PlaceImportCandidate = {
  provider: "foursquare_os_places";
  providerId: string;
  cityId: CityId;
  name: string;
  location: { lat: number; lng: number; address: string; neighborhood?: string };
  categoryIds: string[];
  categories: string[];
  officialWebsite?: string;
  providerPriceLevel?: number;
  verification: { status: "needs_review"; reason: string };
  provenance: { name: "Foursquare Open Source Places"; providerId: string };
};

export type FoursquareImportResult = {
  candidates: PlaceImportCandidate[];
  rejected: Record<"out_of_bounds" | "closed" | "category" | "quality" | "excluded_name" | "chain" | "duplicate", number>;
};

const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const includesTerm = (value: string, terms: string[]) => terms.some((term) => value.includes(normalize(term)));
const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.lat - a.lat); const dLng = radians(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(radians(a.lat)) * Math.cos(radians(b.lat));
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

export function importFoursquarePlaces(rows: FoursquarePlaceRow[], config: FoursquareImportConfig): FoursquareImportResult {
  const rejected: FoursquareImportResult["rejected"] = { out_of_bounds: 0, closed: 0, category: 0, quality: 0, excluded_name: 0, chain: 0, duplicate: 0 };
  const candidates: PlaceImportCandidate[] = [];
  const providerIds = new Set<string>();
  for (const row of rows) {
    const id = row.fsq_place_id?.trim(); const name = row.name?.trim();
    if (!id || !name || name.length < (config.minimumNameLength ?? 2) || !row.address?.trim() || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) { rejected.quality += 1; continue; }
    const location = { lat: row.latitude as number, lng: row.longitude as number };
    if (location.lat < config.bounds.minLat || location.lat > config.bounds.maxLat || location.lng < config.bounds.minLng || location.lng > config.bounds.maxLng) { rejected.out_of_bounds += 1; continue; }
    if (row.date_closed || ["very_likely_closed", "likely_closed", "closed"].includes(row.closed_bucket?.toLowerCase() ?? "")) { rejected.closed += 1; continue; }
    const categoryIds = [...(row.fsq_category_ids ?? []), ...(row.categories ?? []).flatMap((category) => category.id === undefined ? [] : [category.id])].map(String);
    const categoryNames = (row.categories ?? []).flatMap((category) => category.name ? [category.name] : []);
    const categoryText = normalize(categoryNames.join(" "));
    const deniedCategory = categoryIds.some((category) => config.deniedCategoryIds.includes(category)) || includesTerm(categoryText, config.deniedCategoryTerms);
    const allowedCategory = categoryIds.some((category) => config.allowedCategoryIds.includes(category)) || includesTerm(categoryText, config.allowedCategoryTerms);
    if (deniedCategory || !allowedCategory) { rejected.category += 1; continue; }
    if (includesTerm(normalize(name), config.deniedNameTerms)) { rejected.excluded_name += 1; continue; }
    if (row.chain_name && includesTerm(normalize(row.chain_name), config.deniedChains)) { rejected.chain += 1; continue; }
    const duplicate = providerIds.has(id) || candidates.some((candidate) => normalize(candidate.name) === normalize(name) && distanceMeters(candidate.location, location) <= 120);
    if (duplicate) { rejected.duplicate += 1; continue; }
    providerIds.add(id);
    candidates.push({
      provider: "foursquare_os_places", providerId: id, cityId: config.cityId, name,
      location: { ...location, address: row.address.trim(), neighborhood: row.neighborhood ?? row.locality },
      categoryIds, categories: categoryNames, officialWebsite: row.website?.startsWith("http") ? row.website : undefined,
      providerPriceLevel: row.price,
      verification: { status: "needs_review", reason: "Provider-qualified candidate; official hours, price, reservation mode and operating status require verification before publication." },
      provenance: { name: "Foursquare Open Source Places", providerId: id },
    });
  }
  return { candidates: candidates.sort((a, b) => a.providerId.localeCompare(b.providerId)), rejected };
}

export const eveningPlaceImportDefaults = {
  allowedCategoryIds: [],
  allowedCategoryTerms: ["restaurant", "bar", "pub", "cocktail", "wine bar", "nightclub", "music venue", "cafe"],
  deniedCategoryIds: [],
  deniedCategoryTerms: ["fast food", "food court", "convenience store", "supermarket", "gas station", "delivery"],
  deniedNameTerms: ["mcdonald", "burger king", "subway", "7 eleven", "circle k"],
  deniedChains: ["mcdonald", "burger king", "subway", "starbucks", "7 eleven", "circle k"],
} satisfies Omit<FoursquareImportConfig, "cityId" | "bounds">;
