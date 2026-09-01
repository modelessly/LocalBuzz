import type { Happening, HappeningCategory, Place, PlaceKind } from "../domain/types";

const categories = new Set<HappeningCategory>([
  "live_music",
  "club",
  "comedy",
  "food_drink",
  "culture",
  "film",
  "talk",
  "market",
  "activity",
  "other",
]);

export const validateHappenings = (items: Happening[]) => {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) errors.push(`Duplicate id: ${item.id}`);
    ids.add(item.id);
    if (!categories.has(item.category)) errors.push(`Invalid category: ${item.id}`);
    if (!Number.isFinite(Date.parse(item.timing.start))) errors.push(`Invalid start: ${item.id}`);
    if (item.timing.end && Date.parse(item.timing.end) < Date.parse(item.timing.start)) {
      errors.push(`End precedes start: ${item.id}`);
    }
    if (item.venue.lat < -90 || item.venue.lat > 90) errors.push(`Invalid latitude: ${item.id}`);
    if (item.venue.lng < -180 || item.venue.lng > 180) errors.push(`Invalid longitude: ${item.id}`);
    if (!item.source.name || !item.source.url) errors.push(`Missing source: ${item.id}`);
    if ((item.commerce.priceMin ?? 0) < 0) errors.push(`Negative price: ${item.id}`);
  }
  return errors;
};

const placeKinds = new Set<PlaceKind>([
  "restaurant", "bar", "pub", "cocktail_lounge", "wine_bar", "music_bar", "club", "cafe",
]);
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const validatePlaces = (items: Place[]) => {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) errors.push(`Duplicate place id: ${item.id}`);
    ids.add(item.id);
    if (!placeKinds.has(item.kind)) errors.push(`Invalid place kind: ${item.id}`);
    if (!item.name.trim()) errors.push(`Missing place name: ${item.id}`);
    if (!item.officialWebsite?.startsWith("https://")) errors.push(`Missing official website: ${item.id}`);
    if (!item.location.address.trim() || !item.location.neighborhood.trim()) errors.push(`Missing place location: ${item.id}`);
    if (item.location.lat < -90 || item.location.lat > 90) errors.push(`Invalid place latitude: ${item.id}`);
    if (item.location.lng < -180 || item.location.lng > 180) errors.push(`Invalid place longitude: ${item.id}`);
    if (item.typicalVisitDurationMinutes <= 0) errors.push(`Invalid place duration: ${item.id}`);
    if (item.priceRange.min !== undefined && item.priceRange.min < 0) errors.push(`Negative place price: ${item.id}`);
    if (item.priceRange.max !== undefined && item.priceRange.min !== undefined && item.priceRange.max < item.priceRange.min) {
      errors.push(`Invalid place price range: ${item.id}`);
    }
    if (!item.priceRange.band || !item.priceRange.evidence) errors.push(`Missing place price band: ${item.id}`);
    if (!Number.isFinite(Date.parse(item.openingHoursEvidence.checkedAt))) errors.push(`Invalid hours evidence time: ${item.id}`);
    if (item.openingHoursEvidence.status === "verified" && !item.openingHoursEvidence.sourceUrl) errors.push(`Missing hours evidence source: ${item.id}`);
    for (const intervals of Object.values(item.weeklyHours)) {
      for (const interval of intervals ?? []) {
        if (!timePattern.test(interval.opensAt) || !timePattern.test(interval.closesAt)) errors.push(`Invalid place hours: ${item.id}`);
      }
    }
    for (const cutoff of Object.values(item.serviceTimes?.kitchenLastOrder ?? {})) {
      if (cutoff?.type === "at" && !timePattern.test(cutoff.localTime)) errors.push(`Invalid kitchen cutoff: ${item.id}`);
      if (cutoff?.type === "before_close" && cutoff.minutes <= 0) errors.push(`Invalid kitchen cutoff: ${item.id}`);
    }
    if (!item.whyInteresting.length || item.whyInteresting.some((entry) => !entry.claim || !entry.sourceUrl)) errors.push(`Missing place evidence: ${item.id}`);
    if (!item.provenance.length || item.provenance.some((entry) => !entry.name || !entry.url || !entry.fields.length)) errors.push(`Missing place provenance: ${item.id}`);
    if (item.verification.status === "verified" && !item.verification.verifiedAt) errors.push(`Missing place verification time: ${item.id}`);
  }
  return errors;
};
