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
});
