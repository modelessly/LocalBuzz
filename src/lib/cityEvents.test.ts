import { describe, expect, it, vi } from "vitest";
import { describeCityEventSnapshot, loadCityEventSnapshot } from "./cityEvents";

describe("city event snapshot client", () => {
  it("describes retained age and unavailable sources honestly", () => {
    const description = describeCityEventSnapshot({ cityId: "stockholm", generatedAt: "2026-09-01T10:00:00Z", retained: true, happenings: [], sources: [{ sourceId: "tm", publisher: "Ticketmaster", status: "unavailable", attemptedAt: "2026-09-01T12:00:00Z", eventCount: 0, rejectedCount: 0, retainedCount: 0, expiredCount: 0, emptySuccessful: false }] });
    expect(description).toContain("Retained last-good snapshot");
    expect(description).toContain("1 source is unavailable");
  });

  it("rejects a malformed route response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ cityId: "stockholm", happenings: [] }), { status: 200 })));
    await expect(loadCityEventSnapshot("stockholm")).rejects.toThrow("invalid payload");
    vi.unstubAllGlobals();
  });
});
