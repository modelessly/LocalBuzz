import { describe, expect, it } from "vitest";
import { getCityDefinition } from "../data/cities";
import type { Happening } from "../domain/types";
import { mergePulseIntoHappenings, pulseSourceStatus, type CityPulsePayload } from "./cityPulse";

const payload = (cityId: "stockholm" | "san-francisco", location: string): CityPulsePayload => ({
  generatedAt: "2026-09-03T18:00:00.000Z", cityId, city: cityId === "stockholm" ? "Stockholm" : "San Francisco", status: "fresh",
  signals: [{ id: `${cityId}-pulse-one`, kind: "live_signal", title: "Live activity", summary: "Activity is underway.", category: "music",
    location: { name: location, neighborhood: "Central" }, timing: { firstSeen: "2026-09-03T17:30:00.000Z", latestSeen: "2026-09-03T17:50:00.000Z", likelyActiveUntil: "2026-09-03T20:00:00.000Z" },
    social: { evidenceCount: 2, independentSourceCount: 2, sourceAccounts: ["one", "two"], confidence: 0.8, sourceUrls: ["https://x.com/one/status/1", "https://x.com/two/status/2"] },
    tags: ["live"], reasonActionable: "Two sources say it is underway.", freshnessMinutes: 10, actionableNow: true, buzzScore: 81, buzzLabel: "Very Hot" }],
});

describe("city pulse adapter", () => {
  it("merges support into a scheduled event instead of duplicating it", () => {
    const scheduled: Happening = { ...getCityDefinition("stockholm").happenings[0], venue: { ...getCityDefinition("stockholm").happenings[0].venue, name: "Fasching" } };
    const result = mergePulseIntoHappenings("stockholm", [scheduled], getCityDefinition("stockholm").places, payload("stockholm", "Fasching"), new Date("2026-09-03T18:00:00.000Z"));
    expect(result).toMatchObject({ liveSignalCount: 0, enrichedCount: 1 });
    expect(result.happenings[0]).toMatchObject({ kind: "scheduled_event", socialPulse: { buzzScore: 81, mergedIntoScheduledEvent: true } });
  });

  it("maps a standalone signal only when its canonical Place resolves", () => {
    const city = getCityDefinition("san-francisco");
    const place = city.places[0];
    const result = mergePulseIntoHappenings("san-francisco", [], city.places, payload("san-francisco", place.name), new Date("2026-09-03T18:00:00.000Z"));
    expect(result.happenings[0]).toMatchObject({ kind: "live_signal", venue: { lat: place.location.lat, lng: place.location.lng }, socialPulse: { actionableNow: true } });
    expect(mergePulseIntoHappenings("san-francisco", [], city.places, payload("san-francisco", "Unknown private location"), new Date("2026-09-03T18:00:00.000Z")).happenings).toEqual([]);
  });

  it("reports retained and unavailable pulse state honestly", () => {
    expect(pulseSourceStatus("stockholm", { ...payload("stockholm", "Fasching"), status: "retained" }, "2026-09-03T18:10:00.000Z")).toMatchObject({ status: "retained", retainedCount: 1 });
    expect(pulseSourceStatus("stockholm", undefined, "2026-09-03T18:10:00.000Z")).toMatchObject({ status: "unavailable", eventCount: 0 });
  });
});
