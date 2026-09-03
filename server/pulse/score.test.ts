import { describe, expect, it } from "vitest";
import { buzzLabel, scorePulseSignal } from "./score";

const now = new Date("2026-09-03T18:00:00.000Z");
const signal = (latestSeen: string, confidence = 0.8) => ({
  kind: "live_signal" as const, category: "music" as const,
  location: { name: "Fasching", neighborhood: "Norrmalm", address: null },
  timing: { firstSeen: null, latestSeen, likelyActiveUntil: "2026-09-03T20:00:00.000Z" },
  social: { evidenceCount: 3, independentSourceCount: 2, sourceAccounts: ["one", "two"], confidence, source: "x" as const, sourceUrls: ["https://x.com/one/status/1", "https://x.com/two/status/2"] },
  reasonActionable: "The set is reported to be underway now.",
});

describe("pulse scoring", () => {
  it("keeps confidence separate and bounds the deterministic score", () => {
    const high = scorePulseSignal(signal("2026-09-03T17:50:00.000Z", 0.56), now);
    const sameInputs = scorePulseSignal(signal("2026-09-03T17:50:00.000Z", 0.99), now);
    expect(high.buzzScore).toBe(sameInputs.buzzScore);
    expect(high.buzzScore).toBeGreaterThanOrEqual(0);
    expect(high.buzzScore).toBeLessThanOrEqual(100);
  });

  it("decays freshness and maps stable labels", () => {
    expect(scorePulseSignal(signal("2026-09-03T17:50:00.000Z"), now).buzzScore)
      .toBeGreaterThan(scorePulseSignal(signal("2026-09-03T15:30:00.000Z"), now).buzzScore);
    expect([0, 20, 40, 60, 80].map(buzzLabel)).toEqual(["Quiet", "Starting", "Buzzing", "Hot Now", "Very Hot"]);
  });
});
