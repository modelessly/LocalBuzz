import { describe, expect, it } from "vitest";
import { deduplicateHappenings, normalizeEventCandidate } from "./pipeline";
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

  it("deduplicates matching title/venue/start and ticket URL", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const happening = normalizeEventCandidate(candidate, source, now.toISOString(), now).happening!;
    expect(deduplicateHappenings([happening, { ...happening, id: "duplicate" }])).toHaveLength(1);
  });

  it("retains the last good snapshot when refresh is empty", () => {
    const now = "2026-09-01T12:00:00Z";
    const happening = normalizeEventCandidate(candidate, source, now, new Date(now)).happening!;
    const previous = { cityId: "stockholm" as const, generatedAt: now, retained: false, happenings: [happening], sources: [] };
    const failed = { cityId: "stockholm" as const, generatedAt: "2026-09-01T13:00:00Z", retained: false, happenings: [], sources: [] };
    const selected = selectLastGoodSnapshot(previous, failed, [{ sourceId: source.id, publisher: source.publisher, status: "unavailable", attemptedAt: failed.generatedAt, eventCount: 0, rejectedCount: 0 }]);
    expect(selected.retained).toBe(true);
    expect(selected.happenings[0].id).toBe(happening.id);
    expect(selected.sources[0].status).toBe("retained");
  });
});
