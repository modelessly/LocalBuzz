import { describe, expect, it, vi } from "vitest";
import { getCityDefinition } from "../../src/data/cities";
import { buildBandsintownUrl, collectBandsintown, parseBandsintownResponse } from "./bandsintown";
import { compareBenchmark } from "./compare";
import { buildPredictHqUrl, parsePredictHqResponse } from "./predicthq";
import { runBenchmark } from "./runner";

describe("coverage benchmark providers", () => {
  it("builds and parses a bounded PredictHQ city query", () => {
    const url = new URL(buildPredictHqUrl({ cityId: "stockholm", start: "2026-09-01T00:00:00Z", end: "2026-10-01T00:00:00Z" }));
    expect(url.origin).toBe("https://api.predicthq.com");
    expect(url.searchParams.get("within")).toContain("59.3293,18.0686");
    const parsed = parsePredictHqResponse({ results: [{ id: "phq-1", title: "New Show", start: "2026-09-05T19:00:00Z", category: "concerts", location: [18.07, 59.33], entities: [{ type: "venue", name: "Venue" }] }] }, "stockholm", "2026-09-01T00:00:00Z");
    expect(parsed.records[0]).toMatchObject({ provider: "predicthq", providerId: "phq-1", category: "live_music", venue: { name: "Venue" } });
  });

  it("queries only supplied trusted performers and filters Bandsintown by city", async () => {
    const performer = { name: "Known Artist", stableId: "123", sourceHappeningId: "trusted-1" };
    expect(buildBandsintownUrl(performer, "app")).toContain("artists/id_123/events");
    const parsed = parseBandsintownResponse([{ id: "bit-1", title: "Known Artist", datetime: "2026-09-05T20:00:00-07:00", venue: { name: "SF Venue", latitude: "37.77", longitude: "-122.42" }, url: "https://www.bandsintown.com/e/1" }, { id: "bit-2", datetime: "2026-09-05T20:00:00Z", venue: { name: "Elsewhere", latitude: "40", longitude: "-73" } }], performer, "san-francisco", "2026-09-01T00:00:00Z");
    expect(parsed.records).toHaveLength(1); expect(parsed.rejected).toHaveLength(1);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    await collectBandsintown({ appId: "app", termsApproved: true, performers: [performer], cityId: "san-francisco", fetchImpl: fetchImpl as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("measures overlap and keeps provider-only records benchmark-only", () => {
    const canonical = getCityDefinition("stockholm").happenings.slice(0, 1);
    const records = [{ provider: "predicthq" as const, providerId: "same", cityId: "stockholm" as const, title: canonical[0].title, start: canonical[0].timing.start, venue: { name: canonical[0].venue.name }, fetchedAt: "2026-09-01T00:00:00Z" }, { provider: "predicthq" as const, providerId: "new", cityId: "stockholm" as const, title: "New", start: "2026-09-05T20:00:00Z", venue: { name: "Venue" }, category: "culture" as const, fetchedAt: "2026-09-01T00:00:00Z" }];
    expect(compareBenchmark(records, canonical, 0, 1)).toMatchObject({ overlapCount: 1, credibleMissingCount: 1, commercialAssessment: "incremental_value_requires_cost_review" });
  });

  it("degrades honestly for missing approval, missing credentials and failures while retaining last-good", async () => {
    const city = getCityDefinition("san-francisco");
    const disabled = await runBenchmark({ provider: "bandsintown", cityId: city.id, happenings: city.happenings });
    expect(disabled).toMatchObject({ status: "disabled", termsStatus: "approval_required", benchmarkOnly: true });
    const unavailable = await runBenchmark({ provider: "predicthq", cityId: city.id, happenings: city.happenings });
    expect(unavailable.status).toBe("unavailable");
    const previous = { ...unavailable, generatedAt: "2026-09-01T00:00:00Z", status: "fresh" as const, records: [{ provider: "predicthq" as const, providerId: "last", cityId: city.id, title: "Last", start: "2026-09-10T20:00:00Z", fetchedAt: "2026-09-01T00:00:00Z" }] };
    const retained = await runBenchmark({ provider: "predicthq", cityId: city.id, happenings: city.happenings, previous, now: new Date("2026-09-02T01:00:00Z"), predictHqApiKey: "secret", fetchImpl: (async () => new Response("no", { status: 500 })) as typeof fetch });
    expect(retained).toMatchObject({ status: "retained", retained: true, records: previous.records });
  });

  it("caches benchmark attempts for 24 hours and preserves last-good after a valid empty response", async () => {
    const city = getCityDefinition("stockholm");
    const previous = { provider: "predicthq" as const, cityId: city.id, generatedAt: "2026-09-01T00:00:00Z", retained: false, status: "fresh" as const, records: [{ provider: "predicthq" as const, providerId: "last", cityId: city.id, title: "Last", start: "2026-09-10T20:00:00Z", fetchedAt: "2026-09-01T00:00:00Z" }], metrics: compareBenchmark([], city.happenings, 0, 0), termsStatus: "approved" as const, benchmarkOnly: true as const };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const cached = await runBenchmark({ provider: "predicthq", cityId: city.id, happenings: city.happenings, previous, now: new Date("2026-09-01T12:00:00Z"), predictHqApiKey: "secret", fetchImpl: fetchImpl as typeof fetch });
    expect(cached.status).toBe("cached"); expect(fetchImpl).not.toHaveBeenCalled();
    const retained = await runBenchmark({ provider: "predicthq", cityId: city.id, happenings: city.happenings, previous, now: new Date("2026-09-02T01:00:00Z"), predictHqApiKey: "secret", fetchImpl: fetchImpl as typeof fetch });
    expect(retained).toMatchObject({ status: "retained", retained: true, records: previous.records });
  });
});
