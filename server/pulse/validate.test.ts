import { describe, expect, it } from "vitest";
import { validatePulseResponse } from "./validate";

const NOW = new Date("2026-08-31T18:00:00.000Z");

function signal(overrides: Record<string, unknown> = {}) {
  return {
    id: "model-generated-id-is-replaced",
    kind: "live_signal",
    title: "Live music starting now",
    summary: "Two public posts report the set is beginning.",
    category: "music",
    location: { name: "A San Francisco venue", neighborhood: "SoMa", address: null },
    timing: {
      firstSeen: "2026-08-31T17:15:00.000Z",
      latestSeen: "2026-08-31T17:45:00.000Z",
      likelyActiveUntil: "2026-08-31T20:00:00.000Z",
    },
    social: {
      evidenceCount: 2,
      independentSourceCount: 2,
      sourceAccounts: ["example", "example2"],
      confidence: 0.82,
      source: "x",
      sourceUrls: [
        "https://x.com/example/status/1000000000000000001",
        "https://x.com/example2/status/1000000000000000002",
      ],
    },
    tags: ["Live", "Music"],
    reasonActionable: "The set is reported to be starting now.",
    ...overrides,
  };
}

describe("validatePulseResponse", () => {
  it("normalizes a current, independently supported signal", () => {
    const result = validatePulseResponse({ city: "San Francisco", signals: [signal()] }, NOW);
    expect(result.rejected).toEqual([]);
    expect(result.payload.signals).toHaveLength(1);
    expect(result.payload.signals[0]).toMatchObject({
      id: expect.stringMatching(/^san-francisco-pulse-/),
      tags: ["live", "music"],
    });
  });

  it("normalizes Stockholm independently and rejects the wrong city", () => {
    const stockholm = signal({ location: { name: "Fasching", neighborhood: "Norrmalm", address: null } });
    expect(validatePulseResponse({ city: "Stockholm", signals: [stockholm] }, "stockholm", NOW).payload.signals).toHaveLength(1);
    expect(validatePulseResponse({ city: "San Francisco", signals: [stockholm] }, "stockholm", NOW).rejected).toContain("response shape or city is invalid");
  });

  it("rejects stale evidence", () => {
    const result = validatePulseResponse({ signals: [signal({
      timing: { firstSeen: null, latestSeen: "2026-08-31T14:59:00.000Z", likelyActiveUntil: null },
    })] }, NOW);
    expect(result.payload.signals).toEqual([]);
    expect(result.rejected[0]).toContain("stale");
  });

  it("rejects suspicious source URLs", () => {
    const candidate = signal();
    candidate.social.sourceUrls = ["https://example.com/not-x"];
    const result = validatePulseResponse({ signals: [candidate] }, NOW);
    expect(result.payload.signals).toEqual([]);
    expect(result.rejected[0]).toContain("suspicious");
  });

  it("requires two independent sources unless the signal is explicitly official", () => {
    const candidate = signal();
    candidate.social.evidenceCount = 1;
    candidate.social.independentSourceCount = 1;
    candidate.social.sourceAccounts = ["example"];
    const rejected = validatePulseResponse({ signals: [candidate] }, NOW);
    expect(rejected.payload.signals).toEqual([]);

    candidate.tags.push("official-source");
    const accepted = validatePulseResponse({ signals: [candidate] }, NOW);
    expect(accepted.payload.signals).toHaveLength(1);
  });
});
