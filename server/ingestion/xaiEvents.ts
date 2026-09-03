import type { Happening } from "../../src/domain/types";
import type { FreshEventsPayload } from "../events/types";

export function xaiEventsToHappenings(payload: FreshEventsPayload): Happening[] {
  return payload.events.map((event) => ({
    id: event.id,
    cityId: "san-francisco",
    title: event.title,
    description: event.description,
    category: event.category,
    venue: event.venue,
    timing: event.timing,
    commerce: {
      priceMin: event.commerce.priceMin ?? undefined,
      priceMax: event.commerce.priceMin ?? undefined,
      currency: "USD",
      bookingRequired: event.commerce.bookingRequired,
      bookingUrl: event.commerce.bookingUrl ?? undefined,
    },
    status: { availability: "unknown", statusUpdatedAt: payload.generatedAt, statusSource: "source" },
    source: { name: event.source.name, url: event.source.url, fetchedAt: payload.generatedAt, lastVerifiedAt: payload.generatedAt },
    enrichment: {
      moodTags: event.tags,
      goodForDate: true,
      goodSolo: true,
      spontaneityScore: event.commerce.bookingRequired ? 0.55 : 0.8,
      confidence: event.confidence,
      enrichmentMethod: "derived",
    },
  }));
}
