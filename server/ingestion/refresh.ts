import type { CityId, Happening } from "../../src/domain/types";
import { deduplicateHappenings } from "./pipeline";
import { eventSourcesForCity } from "./registry";
import { selectLastGoodSnapshot } from "./snapshot";
import { collectTicketmaster } from "./ticketmaster";
import type { CityEventSnapshot, SourceRefreshResult } from "./types";
import { collectVisitSweden } from "./visitSweden";
import { getCityDefinition } from "../../src/data/cities";
import { collectDirectSource } from "./direct";

type RefreshOptions = { cityId: CityId; ticketmasterApiKey?: string; previous?: CityEventSnapshot; fetchImpl?: typeof fetch; now?: Date };

export async function refreshCityEvents(options: RefreshOptions): Promise<CityEventSnapshot> {
  const now = options.now ?? new Date();
  const generatedAt = now.toISOString();
  const sources = eventSourcesForCity(options.cityId);
  const city = getCityDefinition(options.cityId);
  const knownVenues = [
    ...city.places.map((place) => ({ name: place.name, address: place.location.address, neighborhood: place.location.neighborhood, lat: place.location.lat, lng: place.location.lng })),
    ...city.happenings.map((happening) => ({ name: happening.venue.name, address: happening.venue.address, neighborhood: happening.venue.neighborhood, lat: happening.venue.lat, lng: happening.venue.lng })),
  ];
  const happenings: Happening[] = [];
  const statuses: SourceRefreshResult[] = [];
  for (const source of sources) {
    if (!source.enabled || source.termsReview !== "approved") {
      statuses.push({ sourceId: source.id, publisher: source.publisher, status: "disabled", attemptedAt: generatedAt, eventCount: 0, rejectedCount: 0, message: source.termsReview === "review_required" ? "Permission or terms review is required before collection." : "Source is disabled." });
      continue;
    }
    try {
      const result = source.parser === "ticketmaster-discovery"
        ? await collectTicketmaster({ source, apiKey: options.ticketmasterApiKey, startDateTime: generatedAt, endDateTime: new Date(now.getTime() + 90 * 24 * 60 * 60_000).toISOString(), fetchImpl: options.fetchImpl, now })
        : source.parser === "visit-sweden-linked-data"
          ? await collectVisitSweden({ source, fetchImpl: options.fetchImpl, now, knownVenues })
          : await collectDirectSource({ source, fetchImpl: options.fetchImpl, now });
      happenings.push(...result.happenings);
      statuses.push({ sourceId: source.id, publisher: source.publisher, status: result.status, attemptedAt: result.attemptedAt, lastSuccessfulRefresh: result.happenings.length ? result.attemptedAt : undefined, eventCount: result.happenings.length, rejectedCount: result.rejected.length, message: result.status === "unavailable" ? result.message : result.happenings.length ? undefined : "Source returned no publishable events." });
    } catch (error) {
      statuses.push({ sourceId: source.id, publisher: source.publisher, status: "unavailable", attemptedAt: generatedAt, eventCount: 0, rejectedCount: 0, message: error instanceof Error ? error.message : "Source refresh failed." });
    }
  }
  const candidate: CityEventSnapshot = { cityId: options.cityId, generatedAt, retained: false, happenings: deduplicateHappenings(happenings), sources: statuses };
  return selectLastGoodSnapshot(options.previous, candidate, statuses);
}
