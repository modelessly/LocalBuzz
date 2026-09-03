import type { CityId, Happening } from "../../src/domain/types";
import { deduplicateHappenings } from "./pipeline";
import { eventSourcesForCity } from "./registry";
import { selectLastGoodSnapshot } from "./snapshot";
import { collectTicketmaster } from "./ticketmaster";
import { collectBilletto } from "./billetto";
import type { CityEventSnapshot, SourceRefreshResult } from "./types";
import { collectVisitSweden } from "./visitSweden";
import { getCityDefinition } from "../../src/data/cities";
import { collectDirectSource } from "./direct";
import { policyForSource, sourceRunDecision } from "../operations/policy";
import { collectSanFranciscoEvents } from "../events/collector";
import { xaiEventsToHappenings } from "./xaiEvents";
import { isNightlyHappening, occurrenceEndMs } from "../../src/domain/happeningTiming";

type RefreshOptions = { cityId: CityId; ticketmasterApiKey?: string; billettoApiKey?: string; billettoApiSecret?: string; xaiApiKey?: string; xaiModel?: string; previous?: CityEventSnapshot; fetchImpl?: typeof fetch; now?: Date; sourceTimeoutMs?: number };
type CollectionResult = { happenings: Happening[]; rejected: string[]; candidateCount?: number; rejectionReasons?: Record<string, number>; status: "fresh" | "unavailable"; attemptedAt: string; message?: string };

const emptyCounts = { retainedCount: 0, expiredCount: 0, emptySuccessful: false } as const;
const safeRefreshFailure = (error: unknown) => error instanceof Error && /invalid|malformed|parse|json/i.test(error.message)
  ? "Source returned invalid or malformed data."
  : "Source request failed or timed out.";
const withSourceTimeout = async <T>(promise: Promise<T>, timeoutMs = 12_000): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Source refresh timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const sourceEventsFrom = (snapshot: CityEventSnapshot | undefined, publisher: string, now: Date) => (snapshot?.happenings ?? [])
  .filter((item) => item.source.name === publisher && isNightlyHappening(item) && occurrenceEndMs(item) > now.getTime());
const rejectionCounts = (reasons: string[]) => reasons.reduce<Record<string, number>>((counts, reason) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }), {});

const sourceMetrics = (happenings: Happening[], now: Date, timeZone: string) => {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" });
  const today = date.format(now);
  return {
    uniqueVenueCount: new Set(happenings.map((item) => `${item.venue.name}|${item.venue.address}`)).size,
    todayCount: happenings.filter((item) => date.format(new Date(item.timing.start)) === today).length,
    tonightCount: happenings.filter((item) => date.format(new Date(item.timing.start)) === today && Number(hour.format(new Date(item.timing.start))) >= 17).length,
    next24HoursCount: happenings.filter((item) => {
      const start = Date.parse(item.timing.start);
      return start >= now.getTime() && start < now.getTime() + 86_400_000;
    }).length,
  };
};

export async function refreshCityEvents(options: RefreshOptions): Promise<CityEventSnapshot> {
  const now = options.now ?? new Date();
  const generatedAt = now.toISOString();
  const sources = eventSourcesForCity(options.cityId);
  const city = getCityDefinition(options.cityId);
  const knownVenues = [
    ...city.places.map((place) => ({ name: place.name, address: place.location.address, neighborhood: place.location.neighborhood, lat: place.location.lat, lng: place.location.lng })),
    ...city.happenings.map((happening) => ({ name: happening.venue.name, address: happening.venue.address, neighborhood: happening.venue.neighborhood, lat: happening.venue.lat, lng: happening.venue.lng })),
  ];
  const outcomes = await Promise.all(sources.map(async (source): Promise<{ happenings: Happening[]; status: SourceRefreshResult }> => {
    if (!source.enabled || source.termsReview !== "approved") {
      return { happenings: [], status: { sourceId: source.id, publisher: source.publisher, status: "disabled", attemptedAt: generatedAt, eventCount: 0, rejectedCount: 0, ...emptyCounts, message: source.termsReview === "review_required" ? "Permission or terms review is required before collection." : "Source is disabled." } };
    }
    const previousStatus = options.previous?.sources.find((status) => status.sourceId === source.id);
    const policy = policyForSource(source.id);
    const hasCredential = source.parser === "ticketmaster-discovery"
      ? Boolean(options.ticketmasterApiKey?.trim())
      : source.parser === "billetto-public-events"
        ? Boolean(options.billettoApiKey?.trim() && options.billettoApiSecret?.trim())
      : source.parser === "xai-web-events"
        ? Boolean(options.xaiApiKey?.trim())
        : true;
    const decision = policy ? sourceRunDecision(policy, previousStatus ? { lastAttemptAt: previousStatus.lastSuccessfulRefresh, requestsToday: 0 } : undefined, now, hasCredential) : { allowed: true, reason: "due" as const };
    if (!decision.allowed && decision.reason === "refresh_interval") {
      const retained = sourceEventsFrom(options.previous, source.publisher, now);
      return { happenings: retained, status: { sourceId: source.id, publisher: source.publisher, status: "retained", attemptedAt: generatedAt, lastSuccessfulRefresh: previousStatus?.lastSuccessfulRefresh, eventCount: retained.length, rejectedCount: 0, retainedCount: retained.length, expiredCount: 0, emptySuccessful: false, message: `Refresh interval has not elapsed; retained last-good source data until ${decision.retryAt}.` } };
    }
    try {
      const collection: Promise<CollectionResult> = source.parser === "xai-web-events"
        ? options.xaiApiKey?.trim()
          ? collectSanFranciscoEvents({ apiKey: options.xaiApiKey, model: options.xaiModel, fetchImpl: options.fetchImpl, now }).then((result) => ({
              happenings: xaiEventsToHappenings(result.payload),
              rejected: result.rejected,
              status: "fresh" as const,
              attemptedAt: generatedAt,
            }))
          : Promise.resolve<CollectionResult>({ happenings: [], rejected: [], status: "unavailable", attemptedAt: generatedAt, message: "XAI_API_KEY is not configured." })
        : source.parser === "ticketmaster-discovery"
        ? collectTicketmaster({ source, apiKey: options.ticketmasterApiKey, startDateTime: generatedAt, endDateTime: new Date(now.getTime() + 90 * 24 * 60 * 60_000).toISOString(), fetchImpl: options.fetchImpl, now })
        : source.parser === "billetto-public-events"
          ? collectBilletto({ source, apiKey: options.billettoApiKey, apiSecret: options.billettoApiSecret, fetchImpl: options.fetchImpl, now })
        : source.parser === "visit-sweden-linked-data"
          ? collectVisitSweden({ source, fetchImpl: options.fetchImpl, now, knownVenues })
          : collectDirectSource({ source, fetchImpl: options.fetchImpl, now });
      const collected = await withSourceTimeout(collection, options.sourceTimeoutMs);
      const ineligibleCount = collected.happenings.filter((item) => !isNightlyHappening(item)).length;
      const nightlyRejections = Array.from({ length: ineligibleCount }, () => "event duration exceeds nightly limit");
      const result: CollectionResult = {
        ...collected,
        happenings: collected.happenings.filter(isNightlyHappening),
        rejected: [...collected.rejected, ...nightlyRejections],
        rejectionReasons: rejectionCounts([...collected.rejected, ...nightlyRejections]),
      };
      const retained = sourceEventsFrom(options.previous, source.publisher, now);
      if ((result.status === "unavailable" || result.happenings.length === 0) && retained.length) {
        return { happenings: retained, status: { sourceId: source.id, publisher: source.publisher, status: "retained", attemptedAt: result.attemptedAt, lastSuccessfulRefresh: previousStatus?.lastSuccessfulRefresh ?? options.previous?.generatedAt, eventCount: retained.length, rejectedCount: result.rejected.length, retainedCount: retained.length, expiredCount: 0, emptySuccessful: result.status === "fresh", candidateCount: result.candidateCount, rejectionReasons: result.rejectionReasons ?? rejectionCounts(result.rejected), ...sourceMetrics(retained, now, city.timeZone), message: result.status === "unavailable" ? (result.message ?? "Source unavailable; retained last-good source data.") : "Source returned no publishable events; retained last-good source data." } };
      }
      return { happenings: result.happenings, status: { sourceId: source.id, publisher: source.publisher, status: result.status, attemptedAt: result.attemptedAt, lastSuccessfulRefresh: result.happenings.length ? result.attemptedAt : previousStatus?.lastSuccessfulRefresh, eventCount: result.happenings.length, rejectedCount: result.rejected.length, ...emptyCounts, candidateCount: result.candidateCount, rejectionReasons: result.rejectionReasons ?? rejectionCounts(result.rejected), ...sourceMetrics(result.happenings, now, city.timeZone), emptySuccessful: result.status === "fresh" && result.happenings.length === 0, message: result.status === "unavailable" ? result.message : result.happenings.length ? undefined : "Source responded successfully but returned no publishable events." } };
    } catch (error) {
      const retained = sourceEventsFrom(options.previous, source.publisher, now);
      return retained.length
        ? { happenings: retained, status: { sourceId: source.id, publisher: source.publisher, status: "retained", attemptedAt: generatedAt, lastSuccessfulRefresh: previousStatus?.lastSuccessfulRefresh ?? options.previous?.generatedAt, eventCount: retained.length, rejectedCount: 0, retainedCount: retained.length, expiredCount: 0, emptySuccessful: false, ...sourceMetrics(retained, now, city.timeZone), message: `${safeRefreshFailure(error)} Retained last-good source data.` } }
        : { happenings: [], status: { sourceId: source.id, publisher: source.publisher, status: "unavailable", attemptedAt: generatedAt, eventCount: 0, rejectedCount: 0, ...emptyCounts, message: safeRefreshFailure(error) } };
    }
  }));
  const happenings = outcomes.flatMap((outcome) => outcome.happenings).filter(isNightlyHappening);
  const deduplicated = deduplicateHappenings(happenings);
  const statuses = outcomes.map((outcome) => ({
    ...outcome.status,
    marginalUniqueCount: deduplicated.filter((item) => item.source.name === outcome.status.publisher).length,
  }));
  const candidate: CityEventSnapshot = { cityId: options.cityId, generatedAt, retained: false, happenings: deduplicated, sources: statuses };
  return selectLastGoodSnapshot(options.previous, candidate, statuses);
}
