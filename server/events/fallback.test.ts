import { describe, expect, it } from "vitest";
import { verifiedSanFranciscoFallback, withVerifiedFallback } from "./fallback";

describe("verified San Francisco event fallback", () => {
  it("provides only unexpired source-backed records", () => {
    const payload = verifiedSanFranciscoFallback(new Date("2026-08-31T18:00:00.000Z"));
    expect(payload.events.length).toBeGreaterThan(0);
    expect(payload.events.every((event) => Date.parse(event.timing.end) > Date.parse("2026-08-31T18:00:00.000Z"))).toBe(true);
    expect(payload.events.every((event) => event.source.url.startsWith("https://sfpl.org/"))).toBe(true);
  });

  it("does not replace a non-empty live collection", () => {
    const fallback = verifiedSanFranciscoFallback(new Date("2026-08-31T18:00:00.000Z"));
    const payload = { ...fallback, events: [fallback.events[0]] };
    expect(withVerifiedFallback(payload)).toBe(payload);
  });
});
