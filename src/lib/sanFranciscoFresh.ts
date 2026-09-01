import type { Happening, HappeningCategory } from "../domain/types";

type FreshEventPayload = {
  generatedAt: string;
  city: "San Francisco";
  events: Array<{
    id: string;
    title: string;
    description: string;
    category: HappeningCategory;
    venue: { name: string; address: string; neighborhood: string; lat: number; lng: number };
    timing: { start: string; end: string };
    commerce: { priceMin: number | null; bookingRequired: boolean; bookingUrl: string | null };
    source: { name: string; url: string };
    tags: string[];
    confidence: number;
  }>;
  status?: "unavailable";
};

type PulsePayload = {
  generatedAt: string;
  city: "San Francisco";
  signals: Array<{
    id: string;
    title: string;
    summary: string;
    category: string;
    location: { name: string; neighborhood: string };
    timing: { firstSeen: string | null; latestSeen: string; likelyActiveUntil: string | null };
    social: { independentSourceCount: number; confidence: number; sourceUrls: string[] };
    tags: string[];
  }>;
  status?: "unavailable";
};

export type SanFranciscoFreshResult = {
  happenings: Happening[];
  scheduledCount: number;
  liveSignalCount: number;
  generatedAt?: string;
  scheduledAvailable: boolean;
  pulseAvailable: boolean;
};

const pulseCategory: Record<string, HappeningCategory> = {
  music: "live_music",
  food_drink: "food_drink",
  culture: "culture",
  nightlife: "club",
  activity: "activity",
  market: "market",
  social: "activity",
  other: "other",
};

const normalizedPlace = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function isFreshEventPayload(value: unknown): value is FreshEventPayload {
  return typeof value === "object" && value !== null
    && "city" in value && value.city === "San Francisco"
    && "events" in value && Array.isArray(value.events)
    && "generatedAt" in value && typeof value.generatedAt === "string";
}

function isPulsePayload(value: unknown): value is PulsePayload {
  return typeof value === "object" && value !== null
    && "city" in value && value.city === "San Francisco"
    && "signals" in value && Array.isArray(value.signals)
    && "generatedAt" in value && typeof value.generatedAt === "string";
}

export function freshEventsToHappenings(payload: FreshEventPayload): Happening[] {
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
    status: {
      availability: "unknown",
      statusUpdatedAt: payload.generatedAt,
      statusSource: "source",
    },
    source: {
      name: event.source.name,
      url: event.source.url,
      fetchedAt: payload.generatedAt,
      lastVerifiedAt: payload.generatedAt,
    },
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

export function pulseSignalsToHappenings(
  payload: PulsePayload,
  knownPlaces: Happening[],
  now = new Date(),
): Happening[] {
  return payload.signals.flatMap((signal) => {
    const place = normalizedPlace(signal.location.name);
    const known = knownPlaces.find((item) => normalizedPlace(item.venue.name) === place);
    const sourceUrl = signal.social.sourceUrls[0];
    const startMs = Date.parse(signal.timing.firstSeen ?? signal.timing.latestSeen);
    const evidenceMs = Date.parse(signal.timing.latestSeen);
    const reportedEndMs = signal.timing.likelyActiveUntil ? Date.parse(signal.timing.likelyActiveUntil) : Number.NaN;
    const endMs = Number.isFinite(reportedEndMs) ? reportedEndMs : evidenceMs + 90 * 60_000;
    if (!known || !sourceUrl || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= now.getTime()) return [];
    return [{
      id: signal.id,
      cityId: "san-francisco" as const,
      title: signal.title,
      description: signal.summary,
      category: pulseCategory[signal.category] ?? "other",
      venue: { ...known.venue },
      timing: { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() },
      commerce: { currency: "USD" as const, bookingRequired: false },
      status: { availability: "unknown" as const, statusUpdatedAt: payload.generatedAt, statusSource: "source" as const },
      source: {
        name: "X social pulse · " + signal.social.independentSourceCount + " source" + (signal.social.independentSourceCount === 1 ? "" : "s"),
        url: sourceUrl,
        fetchedAt: payload.generatedAt,
        lastVerifiedAt: payload.generatedAt,
      },
      enrichment: {
        moodTags: signal.tags,
        goodForDate: true,
        goodSolo: true,
        spontaneityScore: 0.95,
        confidence: signal.social.confidence,
        enrichmentMethod: "derived" as const,
      },
    }];
  });
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(url + " returned HTTP " + response.status);
  return response.json() as Promise<unknown>;
}

export async function loadSanFranciscoFreshData(
  knownPlaces: Happening[],
  signal?: AbortSignal,
): Promise<SanFranciscoFreshResult> {
  const [eventsResult, pulseResult] = await Promise.allSettled([
    fetchJson("/api/events/san-francisco", signal),
    fetchJson("/api/pulse/san-francisco", signal),
  ]);
  const eventsPayload = eventsResult.status === "fulfilled" && isFreshEventPayload(eventsResult.value)
    ? eventsResult.value
    : undefined;
  const pulsePayload = pulseResult.status === "fulfilled" && isPulsePayload(pulseResult.value)
    ? pulseResult.value
    : undefined;
  if (!eventsPayload && !pulsePayload) throw new Error("Fresh San Francisco sources are unavailable.");

  const scheduled = eventsPayload ? freshEventsToHappenings(eventsPayload) : [];
  const liveSignals = pulsePayload
    ? pulseSignalsToHappenings(pulsePayload, [...scheduled, ...knownPlaces])
    : [];
  const byId = new Map([...scheduled, ...liveSignals].map((item) => [item.id, item]));
  const generatedTimes = [eventsPayload?.generatedAt, pulsePayload?.generatedAt]
    .filter((value): value is string => Boolean(value))
    .map(Date.parse)
    .filter(Number.isFinite);
  return {
    happenings: [...byId.values()],
    scheduledCount: scheduled.length,
    liveSignalCount: liveSignals.length,
    generatedAt: generatedTimes.length ? new Date(Math.max(...generatedTimes)).toISOString() : undefined,
    scheduledAvailable: Boolean(eventsPayload && eventsPayload.status !== "unavailable"),
    pulseAvailable: Boolean(pulsePayload && pulsePayload.status !== "unavailable"),
  };
}
