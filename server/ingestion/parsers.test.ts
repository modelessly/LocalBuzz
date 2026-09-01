import { describe, expect, it } from "vitest";
import { parseEventSitemap, parseIcsEvents, parseRssAtomEvents, parseSchemaOrgEventJsonLd, parseVenueJsonEvents } from "./parsers";
import type { EventSourceDefinition, ParseContext } from "./types";

const source: EventSourceDefinition = { id: "fixture", cityId: "san-francisco", publisher: "Fixture Venue", venue: "Fixture Venue", canonicalUrl: "https://venue.example/events", fetchUrl: "https://venue.example/feed", format: "schema_org_jsonld", parser: "schema-org-event", refreshCadenceMinutes: 60, trustTier: "first_party", termsReview: "approved", enabled: true, defaultVenue: { name: "Fixture Venue", address: "1 Market St, San Francisco", neighborhood: "SoMa", lat: 37.78, lng: -122.4 } };
const context: ParseContext = { source, fetchedAt: "2026-09-01T12:00:00Z" };

describe("event source parsers", () => {
  it("parses schema.org Event JSON-LD with physical location and offer", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "MusicEvent", name: "Fixture Quartet", startDate: "2026-09-02T20:00:00-07:00", endDate: "2026-09-02T22:00:00-07:00", url: "https://venue.example/quartet", location: { "@type": "Place", name: "Fixture Venue", address: { streetAddress: "1 Market St", addressLocality: "San Francisco" }, geo: { latitude: 37.78, longitude: -122.4 } }, offers: { url: "https://tickets.example/quartet", price: "25", priceCurrency: "USD", availability: "https://schema.org/InStock" } })}</script>`;
    expect(parseSchemaOrgEventJsonLd(html, context)[0]).toMatchObject({ title: "Fixture Quartet", category: "live_music", priceMin: 25, availability: "available" });
  });

  it("parses unfolded ICS, RSS/Atom, and official venue JSON", () => {
    const ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:fixture-1\r\nSUMMARY:Late Jazz\r\nDTSTART:20260903T030000Z\r\nDTEND:20260903T050000Z\r\nLOCATION:Fixture Venue, 1 Market St\r\nURL:https://venue.example/jazz\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(parseIcsEvents(ics, { ...context, source: { ...source, format: "ics", parser: "ics-event" } })[0].providerId).toBe("fixture-1");
    const feed = `<feed><entry><title>Gallery Night</title><link href="https://venue.example/gallery"/><event:start>2026-09-03T19:00:00-07:00</event:start><event:end>2026-09-03T21:00:00-07:00</event:end><category>culture</category></entry></feed>`;
    expect(parseRssAtomEvents(feed, context)[0]).toMatchObject({ title: "Gallery Night", category: "culture" });
    expect(parseVenueJsonEvents({ events: [{ id: "v1", name: "Venue Event", startDate: "2026-09-03T19:00:00-07:00", endDate: "2026-09-03T21:00:00-07:00", url: "https://venue.example/v1" }] }, context)[0].providerId).toBe("v1");
    const debaser = parseVenueJsonEvents([{ title: "First-party Show", date: "2026-09-03", open_time: "Dörrar 18.30", category: "CONCERT", ticket_url: "https://tickets.example/show" }], { ...context, source: { ...source, cityId: "stockholm", defaultVenue: { name: "Debaser Strand", address: "Hornstulls strand 4, Stockholm", lat: 59.3151, lng: 18.0321 } } });
    expect(debaser[0]).toMatchObject({ start: "2026-09-03T18:30:00+02:00", ticketUrl: "https://tickets.example/show", category: "live_music" });
  });

  it("extracts only HTTPS event-page sitemap URLs", () => {
    const sitemap = `<urlset><url><loc>https://venue.example/events/one</loc></url><url><loc>http://venue.example/events/two</loc></url></urlset>`;
    expect(parseEventSitemap(sitemap)).toEqual(["https://venue.example/events/one"]);
  });
});
