import { describe, expect, it } from "vitest";
import type { Happening } from "../domain/types";
import { eventSignalState } from "./eventSignal";

const base: Happening = {
  id: "signal-test",
  cityId: "san-francisco",
  title: "Signal test",
  category: "live_music",
  venue: { name: "Test venue", lat: 37.76, lng: -122.42 },
  timing: { start: "2026-08-31T20:00:00-07:00", end: "2026-08-31T22:00:00-07:00" },
  commerce: { currency: "USD" },
  status: { availability: "available" },
  source: { name: "Test", url: "https://example.com", lastVerifiedAt: "2026-08-31T18:00:00-07:00" },
};

describe("eventSignalState", () => {
  it("reports live only while an available event is in progress", () => {
    expect(eventSignalState(base, Date.parse("2026-08-31T21:00:00-07:00"))).toBe("live");
  });

  it("reports starting soon inside the two-hour window", () => {
    expect(eventSignalState(base, Date.parse("2026-08-31T18:30:00-07:00"))).toBe("starting-soon");
  });

  it("reports stale evidence without implying live activity", () => {
    const stale = { ...base, timing: { start: "2026-09-05T20:00:00-07:00" }, source: { ...base.source, lastVerifiedAt: "2026-08-28T12:00:00-07:00" } };
    expect(eventSignalState(stale, Date.parse("2026-08-31T19:00:00-07:00"))).toBe("stale");
  });

  it("keeps unavailable events quiet", () => {
    const unavailable = { ...base, status: { availability: "cancelled" as const } };
    expect(eventSignalState(unavailable, Date.parse("2026-08-31T21:00:00-07:00"))).toBe("quiet");
  });
});
