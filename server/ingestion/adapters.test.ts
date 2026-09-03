import { describe, expect, it } from "vitest";
import { eventSourcesForCity } from "./registry";
import { buildTicketmasterUrl, collectTicketmaster, parseTicketmasterResponse } from "./ticketmaster";
import { buildVisitSwedenUrl, parseVisitSwedenResponse } from "./visitSweden";

describe("sanctioned API adapters", () => {
  const tmSource = eventSourcesForCity("san-francisco").find((source) => source.parser === "ticketmaster-discovery")!;
  const vsSource = eventSourcesForCity("stockholm").find((source) => source.parser === "visit-sweden-linked-data")!;

  it("builds server-side Ticketmaster filters and degrades without a credential", async () => {
    const url = new URL(buildTicketmasterUrl({ source: tmSource, apiKey: "secret", startDateTime: "2026-09-01T00:00:00.000Z", endDateTime: "2026-09-05T00:00:00.000Z", classifications: ["music"] }));
    expect(url.searchParams.get("apikey")).toBe("secret");
    expect(url.searchParams.get("latlong")).toBe("37.7749,-122.4194");
    expect(url.searchParams.has("geoPoint")).toBe(false);
    expect(url.searchParams.get("classificationName")).toBe("music");
    expect(url.searchParams.get("startDateTime")).toBe("2026-09-01T00:00:00Z");
    const missing = await collectTicketmaster({ source: tmSource, startDateTime: "2026-09-01T00:00:00Z", endDateTime: "2026-09-05T00:00:00Z" });
    expect(missing).toMatchObject({ status: "unavailable", happenings: [] });
  });

  it("maps Ticketmaster status, source and physical venue fields", () => {
    const candidates = parseTicketmasterResponse({ _embedded: { events: [{ id: "tm1", name: "SF Concert", url: "https://ticketmaster.example/tm1", dates: { start: { dateTime: "2026-09-04T03:00:00Z" }, status: { code: "onsale" } }, classifications: [{ segment: { name: "Music" } }], priceRanges: [{ min: 30, max: 50, currency: "USD" }], _embedded: { venues: [{ name: "The Hall", address: { line1: "1 Market St" }, city: { name: "San Francisco" }, location: { latitude: "37.78", longitude: "-122.4" } }], attractions: [{ name: "The Band" }] } }] } }, tmSource);
    expect(candidates[0]).toMatchObject({ providerId: "tm1", category: "live_music", availability: "available", performer: "The Band", priceMin: 30 });
  });

  it("builds and parses the Visit Sweden linked-data response shape", () => {
    expect(decodeURIComponent(buildVisitSwedenUrl(vsSource))).toContain("rdfType:http\\://schema.org/Event");
    const parsed = parseVisitSwedenResponse({ results: 1, resource: { children: [{ entryId: "42", metadata: { "@graph": [{ "@type": "schema:Event", "@id": "https://official.example/event", "schema:name": { "@value": "Stockholm Event" }, "schema:startDate": { "@value": "2026-09-04T19:00:00+02:00" }, "schema:endDate": { "@value": "2026-09-04T21:00:00+02:00" }, "schema:url": { "@id": "https://official.example/event" }, "schema:location": { "@id": "venue" } }, { "@id": "venue", "schema:name": { "@value": "Nalen" }, "schema:address": { "schema:streetAddress": { "@value": "Regeringsgatan 74" }, "schema:addressLocality": { "@value": "Stockholm" } }, "schema:geo": { "schema:latitude": { "@value": "59.337" }, "schema:longitude": { "@value": "18.0665" } } }] } }] } }, vsSource);
    expect(parsed).toMatchObject({ total: 1, candidates: [{ title: "Stockholm Event", venue: { name: "Nalen", lat: 59.337 } }] });
  });
});
