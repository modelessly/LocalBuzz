import { afterEach, describe, expect, it, vi } from "vitest";
import { freshEventsToHappenings, loadSanFranciscoFreshData, pulseSignalsToHappenings } from "./sanFranciscoFresh";
import type { Happening } from "../domain/types";

const generatedAt = "2026-08-31T15:00:00.000Z";
const eventPayload = {
  generatedAt,
  city: "San Francisco" as const,
  events: [{
    id: "sf-event-1",
    title: "Fresh event",
    description: "Verified current event.",
    category: "culture" as const,
    venue: { name: "Main Library", address: "100 Larkin St", neighborhood: "Civic Center", lat: 37.7793, lng: -122.4159 },
    timing: { start: "2026-08-31T17:00:00-07:00", end: "2026-08-31T19:00:00-07:00" },
    commerce: { priceMin: 0, bookingRequired: false, bookingUrl: null },
    source: { name: "SFPL", url: "https://sfpl.org/events/example" },
    tags: ["free"],
    confidence: 0.9,
  }],
};

afterEach(() => vi.unstubAllGlobals());

describe("San Francisco fresh-data adapter", () => {
  it("preserves server provenance when converting scheduled events", () => {
    expect(freshEventsToHappenings(eventPayload)[0]).toMatchObject({
      cityId: "san-francisco",
      source: { name: "SFPL", lastVerifiedAt: generatedAt },
      status: { availability: "unknown" },
    });
  });

  it("only maps live signals whose venue resolves to a known place", () => {
    const known = freshEventsToHappenings(eventPayload);
    const pulse = {
      generatedAt,
      city: "San Francisco" as const,
      signals: [
        {
          id: "pulse-known",
          title: "Crowd gathering",
          summary: "Fresh reports at the library.",
          category: "social",
          location: { name: "Main Library", neighborhood: "Civic Center" },
          timing: { firstSeen: null, latestSeen: "2026-08-31T15:00:00.000Z", likelyActiveUntil: "2026-08-31T17:00:00.000Z" },
          social: { independentSourceCount: 2, confidence: 0.8, sourceUrls: ["https://x.com/a/status/1"] },
          tags: ["live"],
        },
        {
          id: "pulse-unknown",
          title: "Unresolved place",
          summary: "No safe map location.",
          category: "other",
          location: { name: "Somewhere", neighborhood: "Unknown" },
          timing: { firstSeen: null, latestSeen: "2026-08-31T15:00:00.000Z", likelyActiveUntil: "2026-08-31T17:00:00.000Z" },
          social: { independentSourceCount: 2, confidence: 0.8, sourceUrls: ["https://x.com/b/status/2"] },
          tags: [],
        },
      ],
    };
    expect(pulseSignalsToHappenings(pulse, known, new Date("2026-08-31T15:30:00.000Z"))).toHaveLength(1);
  });

  it("merges successful scheduled data when the pulse feed is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/events/")) return new Response(JSON.stringify(eventPayload), { status: 200 });
      return new Response("unavailable", { status: 503 });
    }));
    const result = await loadSanFranciscoFreshData([] as Happening[]);
    expect(result.happenings).toHaveLength(1);
    expect(result.scheduledCount).toBe(1);
    expect(result.pulseAvailable).toBe(false);
  });
});
