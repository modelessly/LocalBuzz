import { describe, expect, it } from "vitest";
import { deduplicateHappenings, normalizeEventCandidate, sourceTextToPlainText } from "./pipeline";
import { selectLastGoodSnapshot } from "./snapshot";
import type { EventCandidate, EventSourceDefinition } from "./types";

const source: EventSourceDefinition = { id: "official", cityId: "stockholm", publisher: "Official Venue", canonicalUrl: "https://official.example/events", fetchUrl: "https://official.example/feed", format: "venue_json", parser: "venue-json-event", refreshCadenceMinutes: 60, trustTier: "first_party", termsReview: "approved", enabled: true };
const candidate: EventCandidate = { cityId: "stockholm", title: "A Great Show", venue: { name: "Nalen", address: "Regeringsgatan 74, Stockholm", lat: 59.337, lng: 18.0665 }, start: "2026-09-03T19:00:00+02:00", end: "2026-09-03T21:00:00+02:00", canonicalUrl: "https://official.example/show", ticketUrl: "https://tickets.example/show", priceMin: 250, currency: "SEK", availability: "available" };

describe("canonical ingestion pipeline", () => {
  it("normalizes a physical future event and rejects expired or out-of-city records", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const valid = normalizeEventCandidate(candidate, source, now.toISOString(), now);
    expect(valid.happening).toMatchObject({ cityId: "stockholm", title: "A Great Show", source: { name: "Official Venue" } });
    expect(normalizeEventCandidate({ ...candidate, start: "2026-08-01T19:00:00+02:00", end: "2026-08-01T21:00:00+02:00" }, source, now.toISOString(), now).reason).toBe("event is expired");
    expect(normalizeEventCandidate({ ...candidate, venue: { ...candidate.venue, lat: 40 } }, source, now.toISOString(), now).reason).toContain("outside");
    expect(normalizeEventCandidate({ ...candidate, start: "2026-09-03T19:00:00", end: "2026-09-03T21:00:00" }, source, now.toISOString(), now).reason).toContain("time zone");
  });

  it("accepts bounded nightly events and rejects multi-day ranges without truncating them", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const normalize = (start: string, end?: string) => normalizeEventCandidate(
      { ...candidate, start, end },
      source,
      now.toISOString(),
      now,
    );

    expect(normalize("2026-09-03T18:00:00+02:00", "2026-09-03T22:00:00+02:00").happening?.timing.estimatedDurationMinutes).toBe(240);
    expect(normalize("2026-09-03T22:00:00+02:00", "2026-09-04T02:00:00+02:00").happening).toBeDefined();
    expect(normalize("2026-09-03T14:00:00+02:00", "2026-09-04T02:00:00+02:00").happening?.timing.estimatedDurationMinutes).toBe(720);
    expect(normalize("2026-09-03T14:00:00+02:00", "2026-09-04T02:00:01+02:00")).toEqual({ reason: "event duration exceeds nightly limit" });
    expect(normalize("2026-09-03T14:00:00+02:00", "2026-09-10T14:00:00+02:00")).toEqual({ reason: "event duration exceeds nightly limit" });
    expect(normalize("2026-09-03T14:00:00+02:00", "2026-10-03T14:00:00+02:00")).toEqual({ reason: "event duration exceeds nightly limit" });
    expect(normalize("2026-09-03")).toEqual({ reason: "start date lacks an explicit time zone" });

    const withoutEnd = normalize("2026-09-03T19:00:00+02:00").happening;
    expect(withoutEnd?.timing).toMatchObject({ end: undefined, estimatedDurationMinutes: 90 });
  });

  it("applies the nightly limit consistently regardless of provider parser", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const longRange = { ...candidate, start: "2026-09-03T19:00:00+02:00", end: "2026-09-04T08:00:00+02:00" };
    const providers: EventSourceDefinition[] = [
      source,
      { ...source, id: "ticketmaster", publisher: "Ticketmaster", parser: "ticketmaster-discovery" },
      { ...source, id: "billetto", publisher: "Billetto", parser: "billetto-public-events" },
    ];
    expect(providers.map((provider) => normalizeEventCandidate(longRange, provider, now.toISOString(), now).reason))
      .toEqual(providers.map(() => "event duration exceeds nightly limit"));
  });

  it("deduplicates matching title/venue/start and ticket URL", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const happening = normalizeEventCandidate(candidate, source, now.toISOString(), now).happening!;
    expect(deduplicateHappenings([happening, { ...happening, id: "duplicate" }])).toHaveLength(1);
  });

  it("assigns distinct stable IDs to separate feed events sharing a start time", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const first = normalizeEventCandidate({ ...candidate, providerId: undefined, canonicalUrl: source.fetchUrl, title: "First club night" }, source, now.toISOString(), now).happening!;
    const second = normalizeEventCandidate({ ...candidate, providerId: undefined, canonicalUrl: source.fetchUrl, title: "Second club night" }, source, now.toISOString(), now).happening!;
    expect(first.id).not.toBe(second.id);
  });

  it("keeps only the freshest conflicting occurrence of the same event title", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const older = normalizeEventCandidate(candidate, source, "2026-09-01T10:00:00Z", now).happening!;
    const fresher = {
      ...older,
      id: "fresh-conflict",
      venue: { ...older.venue, name: "Another Venue", address: "Sveavägen 1, Stockholm" },
      timing: { start: "2026-09-03T19:30:00+02:00", end: "2026-09-03T21:30:00+02:00" },
      source: { ...older.source, url: "https://official.example/show-updated", lastVerifiedAt: "2026-09-01T11:00:00Z" },
    };

    expect(deduplicateHappenings([older, fresher])).toEqual([fresher]);
  });

  it("turns source markup and entities into readable plain text", () => {
    expect(sourceTextToPlainText("<p>Doors at 19:00&nbsp;&amp; music at 20:00.</p><p>All ages.</p>"))
      .toBe("Doors at 19:00 & music at 20:00. All ages.");
  });

  it("retains the last good snapshot when refresh is empty", () => {
    const now = "2026-09-01T12:00:00Z";
    const happening = normalizeEventCandidate(candidate, source, now, new Date(now)).happening!;
    const previous = { cityId: "stockholm" as const, generatedAt: now, retained: false, happenings: [happening], sources: [] };
    const failed = { cityId: "stockholm" as const, generatedAt: "2026-09-01T13:00:00Z", retained: false, happenings: [], sources: [] };
    const selected = selectLastGoodSnapshot(previous, failed, [{ sourceId: source.id, publisher: source.publisher, status: "unavailable", attemptedAt: failed.generatedAt, eventCount: 0, rejectedCount: 0, retainedCount: 0, expiredCount: 0, emptySuccessful: false }]);
    expect(selected.retained).toBe(true);
    expect(selected.happenings[0].id).toBe(happening.id);
    expect(selected.sources[0].status).toBe("retained");
  });

  it("does not retain an ineligible long-range record from an older snapshot", () => {
    const now = "2026-09-01T12:00:00Z";
    const happening = normalizeEventCandidate(candidate, source, now, new Date(now)).happening!;
    const longRange = { ...happening, id: "polluted-range", timing: { start: "2026-09-01T00:00:00Z", end: "2026-10-01T00:00:00Z", estimatedDurationMinutes: 43_200 } };
    const previous = { cityId: "stockholm" as const, generatedAt: now, retained: false, happenings: [happening, longRange], sources: [] };
    const failed = { cityId: "stockholm" as const, generatedAt: "2026-09-01T13:00:00Z", retained: false, happenings: [], sources: [] };
    const selected = selectLastGoodSnapshot(previous, failed, [{ sourceId: source.id, publisher: source.publisher, status: "unavailable", attemptedAt: failed.generatedAt, eventCount: 0, rejectedCount: 0, retainedCount: 0, expiredCount: 0, emptySuccessful: false }]);
    expect(selected.happenings.map((item) => item.id)).toEqual([happening.id]);
  });
});
