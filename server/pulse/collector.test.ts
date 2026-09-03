import { describe, expect, it } from "vitest";
import { collectCityPulse, mergePulseSignals } from "./collector";
import { validatePulseResponse } from "./validate";

const now = new Date("2026-09-03T18:00:00.000Z");
const raw = (account: string, latestSeen: string) => ({
  id: "ignored", kind: "live_signal", title: "Jazz underway", summary: "A live set is underway.", category: "music",
  location: { name: "Fasching", neighborhood: "Norrmalm", address: null },
  timing: { firstSeen: null, latestSeen, likelyActiveUntil: "2026-09-03T20:00:00.000Z" },
  social: { evidenceCount: 1, independentSourceCount: 1, sourceAccounts: [account], confidence: 0.8, source: "x", sourceUrls: [`https://x.com/${account}/status/${account === "one" ? "1" : "2"}`] },
  tags: ["official-source"], reasonActionable: "The venue says the live set is underway.",
});

describe("pulse pass merge", () => {
  it("merges duplicate broad and trusted signals while deduplicating accounts", () => {
    const first = validatePulseResponse({ city: "Stockholm", signals: [raw("one", "2026-09-03T17:30:00.000Z")] }, "stockholm", now).payload.signals[0];
    const second = validatePulseResponse({ city: "Stockholm", signals: [raw("two", "2026-09-03T17:45:00.000Z")] }, "stockholm", now).payload.signals[0];
    const merged = mergePulseSignals([first, second, second], now);
    expect(merged).toHaveLength(1);
    expect(merged[0].social).toMatchObject({ evidenceCount: 2, independentSourceCount: 2, sourceAccounts: ["one", "two"] });
    expect(merged[0].timing.latestSeen).toBe("2026-09-03T17:45:00.000Z");
  });

  it("publishes a valid pass when the other pass fails", async () => {
    let request = 0;
    const fetchImpl: typeof fetch = async () => {
      request += 1;
      if (request === 1) return new Response("failed", { status: 503 });
      return new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ city: "Stockholm", signals: [] }) }] }] }), { status: 200 });
    };
    const result = await collectCityPulse({ cityId: "stockholm", apiKey: "test-key", fetchImpl, now });
    expect(result.payload).toMatchObject({ cityId: "stockholm", status: "fresh", signals: [] });
    expect(result.passes).toEqual([
      { mode: "broad", latencyMs: 0, rejectedCount: 1, signalCount: 0 },
      expect.objectContaining({ mode: "curated", rejectedCount: 0, signalCount: 0 }),
    ]);
  });

  it("fails clearly when both passes fail", async () => {
    const fetchImpl: typeof fetch = async () => new Response("failed", { status: 503 });
    await expect(collectCityPulse({ cityId: "san-francisco", apiKey: "test-key", fetchImpl, now })).rejects.toThrow("Both city pulse passes failed");
  });
});
