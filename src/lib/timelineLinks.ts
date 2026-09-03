import type { Happening, Place, PlanStop } from "../domain/types";

const safeExternalUrl = (value?: string) => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

export function timelineStopLink(stop: PlanStop, happenings: Happening[], places: Place[]) {
  if (stop.kind === "happening") {
    const happening = happenings.find((item) => item.id === stop.happeningId);
    if (!happening) return undefined;
    const bookingUrl = safeExternalUrl(happening.commerce.bookingUrl);
    if (bookingUrl) return { href: bookingUrl, label: "Buy tickets", accessibleLabel: `Buy tickets for ${happening.title}` };
    const sourceUrl = safeExternalUrl(happening.source.url);
    return sourceUrl ? { href: sourceUrl, label: "Event details", accessibleLabel: `View event details for ${happening.title}` } : undefined;
  }
  if (stop.kind === "place") {
    const place = places.find((item) => item.id === stop.placeId);
    if (!place) return undefined;
    const reservationUrl = safeExternalUrl(place.reservationUrl);
    if (reservationUrl) {
      const restaurant = place.kind === "restaurant";
      return { href: reservationUrl, label: restaurant ? "Reserve table" : "Reserve", accessibleLabel: `${restaurant ? "Reserve a table at" : "Reserve"} ${place.name}` };
    }
    const website = safeExternalUrl(place.officialWebsite);
    return website ? { href: website, label: "Venue website", accessibleLabel: `Visit the website for ${place.name}` } : undefined;
  }
  return undefined;
}
