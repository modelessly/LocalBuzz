import { describe, expect, it } from "vitest";
import { refreshCityEvents } from "./refresh";
import type { CityEventSnapshot } from "./types";

describe("city refresh orchestration", () => {
  it("preserves a previous Stockholm snapshot when every enabled source is empty or unavailable", async () => {
    const previous: CityEventSnapshot = {
      cityId: "stockholm", generatedAt: "2026-09-01T10:00:00Z", retained: false, sources: [],
      happenings: [{
        id: "last-good",
        cityId: "stockholm",
        title: "Last Good Event",
        category: "culture",
        venue: { name: "Nalen", address: "Regeringsgatan 74, Stockholm", lat: 59.337, lng: 18.0665 },
        timing: { start: "2026-09-03T19:00:00Z", end: "2026-09-03T21:00:00Z" },
        commerce: { currency: "SEK" },
        status: { availability: "unknown" },
        source: { name: "Official", url: "https://official.example/event", fetchedAt: "2026-09-01T10:00:00Z", lastVerifiedAt: "2026-09-01T10:00:00Z" },
      }],
    };
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("visitsweden")) return new Response(JSON.stringify({ results: 0, resource: { children: [] } }), { status: 200 });
      if (url.includes("debaser")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response("not found", { status: 404 });
    };
    const result = await refreshCityEvents({ cityId: "stockholm", previous, fetchImpl, now: new Date("2026-09-01T12:00:00Z") });
    expect(result.retained).toBe(true);
    expect(result.happenings.map((item) => item.id)).toEqual(["last-good"]);
    expect(result.sources.find((source) => source.sourceId === "ticketmaster-stockholm")?.status).toBe("retained");
  });

  it("reports timed-out sources safely instead of blocking the city snapshot", async () => {
    const fetchImpl: typeof fetch = async () => new Promise<Response>(() => undefined);
    const result = await refreshCityEvents({ cityId: "stockholm", fetchImpl, sourceTimeoutMs: 5, now: new Date("2026-09-01T12:00:00Z") });
    expect(result.happenings).toEqual([]);
    expect(result.sources.filter((source) => source.status === "unavailable").some((source) => source.message === "Source request failed or timed out.")).toBe(true);
    expect(result.sources.every((source) => !source.message?.includes("http"))).toBe(true);
  });

  it("retains one provider's last-good events while publishing another provider's fresh events", async () => {
    const previous: CityEventSnapshot = {
      cityId: "stockholm", generatedAt: "2026-09-01T10:00:00Z", retained: false,
      sources: [{ sourceId: "billetto-stockholm", publisher: "Billetto", status: "fresh", attemptedAt: "2026-09-01T10:00:00Z", lastSuccessfulRefresh: "2026-09-01T10:00:00Z", eventCount: 1, rejectedCount: 0, retainedCount: 0, expiredCount: 0, emptySuccessful: false }],
      happenings: [{
        id: "billetto-last-good", cityId: "stockholm", title: "Retained Billetto", category: "culture",
        venue: { name: "The Hall", address: "1 Testgatan, Stockholm", lat: 59.33, lng: 18.06 },
        timing: { start: "2026-09-04T17:00:00Z", end: "2026-09-04T19:00:00Z" }, commerce: { currency: "SEK" }, status: { availability: "available" },
        source: { name: "Billetto", url: "https://billetto.se/e/retained", fetchedAt: "2026-09-01T10:00:00Z", lastVerifiedAt: "2026-09-01T10:00:00Z" },
      }, {
        id: "billetto-polluted-range", cityId: "stockholm", title: "Broad Billetto Range", category: "culture",
        venue: { name: "The Hall", address: "1 Testgatan, Stockholm", lat: 59.33, lng: 18.06 },
        timing: { start: "2026-09-04T17:00:00Z", end: "2026-10-04T17:00:00Z" }, commerce: { currency: "SEK" }, status: { availability: "available" },
        source: { name: "Billetto", url: "https://billetto.se/e/broad", fetchedAt: "2026-09-01T10:00:00Z", lastVerifiedAt: "2026-09-01T10:00:00Z" },
      }],
    };
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("visitsweden")) return new Response(JSON.stringify({ results: 0, resource: { children: [] } }), { status: 200 });
      if (url.includes("billetto.se")) return new Response("provider down", { status: 503 });
      if (url.includes("ticketmaster")) return new Response(JSON.stringify({ _embedded: { events: [{ id: "tm-new", name: "Fresh Ticketmaster", url: "https://ticketmaster.example/new", dates: { start: { dateTime: "2026-09-05T18:00:00Z" }, status: { code: "onsale" } }, _embedded: { venues: [{ name: "Fresh Hall", address: { line1: "2 Testgatan" }, city: { name: "Stockholm" }, location: { latitude: "59.34", longitude: "18.07" } }] } }] } }), { status: 200 });
      if (url.includes("debaser")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response("not found", { status: 404 });
    };
    const result = await refreshCityEvents({ cityId: "stockholm", previous, ticketmasterApiKey: "tm-key", billettoApiKey: "b-key", billettoApiSecret: "b-secret", fetchImpl, now: new Date("2026-09-02T12:00:00Z") });
    expect(result.retained).toBe(false);
    expect(result.happenings.map((item) => item.id)).toEqual(expect.arrayContaining(["billetto-last-good"]));
    expect(result.happenings.some((item) => item.id === "billetto-polluted-range")).toBe(false);
    expect(result.happenings.some((item) => item.source.name === "Ticketmaster Discovery API")).toBe(true);
    expect(result.sources.find((item) => item.sourceId === "billetto-stockholm")).toMatchObject({ status: "retained", retainedCount: 1 });
  });
});
