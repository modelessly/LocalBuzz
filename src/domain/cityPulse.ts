import { getCityDefinition } from "../data/cities";
import type { CityEventSnapshotSource, CityId, Happening, HappeningCategory, HappeningKind, Place, SocialPulseMetadata } from "./types";

export type CityPulsePayload = {
  generatedAt: string;
  cityId: CityId;
  city: string;
  status?: "fresh" | "retained" | "unavailable";
  retainedAt?: string;
  signals: Array<{
    id: string; kind: HappeningKind; title: string; summary: string; category: string;
    location: { name: string; neighborhood: string };
    timing: { firstSeen: string | null; latestSeen: string; likelyActiveUntil: string | null };
    social: { evidenceCount: number; independentSourceCount: number; sourceAccounts: string[]; confidence: number; sourceUrls: string[] };
    tags: string[]; reasonActionable: string; freshnessMinutes: number; actionableNow: boolean; buzzScore: number;
    buzzLabel: "Quiet" | "Starting" | "Buzzing" | "Hot Now" | "Very Hot";
    buzzBreakdown: SocialPulseMetadata["buzzBreakdown"];
  }>;
};

const categoryMap: Record<string, HappeningCategory> = { music: "live_music", food_drink: "food_drink", culture: "culture", nightlife: "club", activity: "activity", market: "market", social: "activity", other: "other" };
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9åäöé]+/gi, " ").trim();
const socialMetadata = (signal: CityPulsePayload["signals"][number], mergedIntoScheduledEvent: boolean): SocialPulseMetadata => ({
  evidenceCount: signal.social.evidenceCount, independentSourceCount: signal.social.independentSourceCount,
  sourceAccounts: signal.social.sourceAccounts, confidence: signal.social.confidence,
  firstSeen: signal.timing.firstSeen ?? undefined, latestSeen: signal.timing.latestSeen,
  likelyActiveUntil: signal.timing.likelyActiveUntil ?? undefined, sourceUrls: signal.social.sourceUrls,
  freshnessMinutes: signal.freshnessMinutes, actionableNow: signal.actionableNow,
  buzzScore: signal.buzzScore, buzzLabel: signal.buzzLabel, reasonActionable: signal.reasonActionable,
  buzzBreakdown: signal.buzzBreakdown,
  mergedIntoScheduledEvent,
});

export function isCityPulsePayload(value: unknown, cityId: CityId): value is CityPulsePayload {
  return typeof value === "object" && value !== null && "cityId" in value && value.cityId === cityId
    && "generatedAt" in value && typeof value.generatedAt === "string" && "signals" in value && Array.isArray(value.signals);
}

export function mergePulseIntoHappenings(cityId: CityId, scheduled: Happening[], places: Place[], payload: CityPulsePayload, now = new Date()): { happenings: Happening[]; liveSignalCount: number; enrichedCount: number } {
  const city = getCityDefinition(cityId);
  const events = scheduled.map((item) => ({ ...item, kind: item.kind ?? "scheduled_event" as const }));
  const byVenue = new Map(events.map((item) => [normalized(item.venue.name), item]));
  const placeByName = new Map(places.map((place) => [normalized(place.name), place]));
  let enrichedCount = 0;
  const liveSignals: Happening[] = [];
  for (const signal of payload.signals) {
    const venueKey = normalized(signal.location.name);
    const scheduledMatch = byVenue.get(venueKey);
    if (scheduledMatch) {
      scheduledMatch.socialPulse = socialMetadata(signal, true);
      enrichedCount += 1;
      continue;
    }
    const place = placeByName.get(venueKey);
    const location = place?.location ?? getCityDefinition(cityId).places.find((item) => normalized(item.name) === venueKey)?.location;
    const geocoded = location ?? (() => {
      const directEvent = scheduled.find((item) => normalized(item.venue.name) === venueKey);
      return directEvent ? { ...directEvent.venue, address: directEvent.venue.address ?? "", neighborhood: directEvent.venue.neighborhood ?? signal.location.neighborhood } : undefined;
    })();
    const sourceUrl = signal.social.sourceUrls[0];
    const startMs = Date.parse(signal.timing.firstSeen ?? signal.timing.latestSeen);
    const reportedEndMs = signal.timing.likelyActiveUntil ? Date.parse(signal.timing.likelyActiveUntil) : Number.NaN;
    const endMs = Number.isFinite(reportedEndMs) ? reportedEndMs : Date.parse(signal.timing.latestSeen) + 90 * 60_000;
    if (!geocoded || !sourceUrl || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= now.getTime()) continue;
    liveSignals.push({
      id: signal.id, cityId, kind: signal.kind, title: signal.title, description: signal.summary,
      category: categoryMap[signal.category] ?? "other",
      venue: { name: signal.location.name, address: geocoded.address, neighborhood: geocoded.neighborhood || signal.location.neighborhood, lat: geocoded.lat, lng: geocoded.lng },
      timing: { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() },
      commerce: { currency: city.currency, bookingRequired: false },
      status: { availability: "unknown", statusUpdatedAt: payload.generatedAt, statusSource: "source" },
      source: { name: `X pulse · ${signal.social.independentSourceCount} source${signal.social.independentSourceCount === 1 ? "" : "s"}`, url: sourceUrl, fetchedAt: payload.generatedAt, lastVerifiedAt: signal.timing.latestSeen },
      enrichment: { moodTags: signal.tags, goodForDate: true, goodSolo: true, spontaneityScore: 0.95, confidence: signal.social.confidence, enrichmentMethod: "derived" },
      socialPulse: socialMetadata(signal, false),
    });
  }
  return { happenings: [...events, ...liveSignals], liveSignalCount: liveSignals.length, enrichedCount };
}

export function pulseSourceStatus(cityId: CityId, payload: CityPulsePayload | undefined, attemptedAt: string): CityEventSnapshotSource {
  const status = payload?.status ?? "unavailable";
  return {
    sourceId: `xai-${cityId}-social-pulse`, publisher: "xAI X Search social pulse",
    status: status === "fresh" ? "fresh" : status === "retained" ? "retained" : "unavailable",
    attemptedAt, lastSuccessfulRefresh: status === "fresh" ? payload?.generatedAt : payload?.retainedAt,
    eventCount: payload?.signals.length ?? 0, rejectedCount: 0,
    retainedCount: status === "retained" ? payload?.signals.length ?? 0 : 0, expiredCount: 0,
    emptySuccessful: status === "fresh" && payload?.signals.length === 0,
    message: status === "retained" ? `Live collection failed; retained pulse from ${payload?.generatedAt}.` : status === "unavailable" ? "Social pulse is unavailable; canonical events are unchanged." : undefined,
  };
}
