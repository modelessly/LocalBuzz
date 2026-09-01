import { describe, expect, it } from "vitest";
import { validateFreshEventsResponse } from "./validate";

const NOW = new Date("2026-08-31T15:00:00.000Z");

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "model-id-is-replaced",
    title: "Live music at the library",
    description: "A public performance in San Francisco.",
    category: "live_music",
    venue: {
      name: "Main Library",
      address: "100 Larkin St, San Francisco, CA 94102",
      neighborhood: "Civic Center",
      lat: 37.7793,
      lng: -122.4159,
    },
    timing: { start: "2026-08-31T17:00:00-07:00", end: "2026-08-31T19:00:00-07:00" },
    commerce: { priceMin: 0, bookingRequired: false, bookingUrl: null },
    source: { name: "San Francisco Public Library", url: "https://sfpl.org/events/example" },
    tags: ["Free", "Music"],
    confidence: 0.9,
    ...overrides,
  };
}

describe("validateFreshEventsResponse", () => {
  it("normalizes a current source-backed San Francisco event", () => {
    const result = validateFreshEventsResponse({ events: [event()] }, NOW);
    expect(result.rejected).toEqual([]);
    expect(result.payload.events[0]).toMatchObject({
      id: expect.stringMatching(/^sf-event-/),
      tags: ["free", "music"],
    });
  });

  it("rejects expired events and coordinates outside San Francisco", () => {
    const expired = event({ timing: { start: "2026-08-30T17:00:00-07:00", end: "2026-08-30T19:00:00-07:00" } });
    const outside = event({ venue: { ...event().venue, lat: 37.8715, lng: -122.273 } });
    const result = validateFreshEventsResponse({ events: [expired, outside] }, NOW);
    expect(result.payload.events).toEqual([]);
    expect(result.rejected.join(" ")).toContain("fresh window");
    expect(result.rejected.join(" ")).toContain("outside San Francisco");
  });

  it("rejects records without safe source provenance", () => {
    const result = validateFreshEventsResponse({ events: [event({ source: { name: "Unknown", url: "http://example.com" } })] }, NOW);
    expect(result.payload.events).toEqual([]);
    expect(result.rejected[0]).toContain("source");
  });
});
