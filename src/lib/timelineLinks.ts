import type { DiscoveryLead, Happening, Place, PlanStop } from "../domain/types";

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

export function discoveryLeadLink(lead: DiscoveryLead) {
  const name = lead.leadType === "event" ? lead.fields.title : lead.fields.name;
  if (lead.leadType === "event") {
    const bookingUrl = safeExternalUrl(lead.fields.commerce?.bookingUrl);
    if (bookingUrl) return { href: bookingUrl, label: "Buy tickets", accessibleLabel: `Buy tickets for ${name ?? "this event"}` };
    const sourceUrl = safeExternalUrl(lead.originalSourceUrl);
    if (!sourceUrl) return undefined;
    const official = ["official_page", "venue_calendar", "ticket_page"].includes(lead.sourceType);
    return { href: sourceUrl, label: official ? "Event details" : "View source", accessibleLabel: `${official ? "View event details" : "View source information"} for ${name ?? "this event"}` };
  }
  const reservationUrl = safeExternalUrl(lead.fields.reservationUrl);
  if (reservationUrl) {
    const restaurant = lead.fields.kind === "restaurant";
    return { href: reservationUrl, label: restaurant ? "Reserve table" : "Reserve", accessibleLabel: `${restaurant ? "Reserve a table at" : "Reserve"} ${name ?? "this place"}` };
  }
  const officialWebsite = safeExternalUrl(lead.fields.officialWebsite);
  if (officialWebsite) return { href: officialWebsite, label: "Venue website", accessibleLabel: `Visit the website for ${name ?? "this place"}` };
  const sourceUrl = safeExternalUrl(lead.originalSourceUrl);
  if (!sourceUrl) return undefined;
  const official = ["official_page", "venue_calendar"].includes(lead.sourceType);
  return { href: sourceUrl, label: official ? "Venue website" : "View source", accessibleLabel: `${official ? "Visit the website" : "View source information"} for ${name ?? "this place"}` };
}
