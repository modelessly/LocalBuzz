import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { EveningPlan, Happening, Place } from "../domain/types";
import { timelineStopLink } from "../lib/timelineLinks";
import { DiscoveryReview } from "./DiscoveryReview";
import { EveningTimeline } from "./EveningTimeline";

const happening: Happening = {
  id: "terese-quintet", cityId: "stockholm", title: "Terese Lien Evenstad Quintet", category: "live_music",
  venue: { name: "Fasching", address: "Kungsgatan 63", neighborhood: "Norrmalm", lat: 59.334, lng: 18.058 },
  timing: { start: "2026-09-03T20:00:00+02:00", end: "2026-09-03T21:30:00+02:00" },
  commerce: { priceMin: 59, currency: "SEK", bookingUrl: "https://tickets.example/terese" },
  status: { availability: "available" }, source: { name: "Fasching", url: "https://fasching.se/terese" },
};

const place: Place = {
  id: "surfers", cityId: "stockholm", name: "Surfers Stockholm", kind: "restaurant",
  officialWebsite: "https://surfersstockholm.se/", reservationUrl: "https://booking.example/surfers",
  location: { address: "Norrlandsgatan 24", neighborhood: "Norrmalm", lat: 59.3348, lng: 18.0727 },
  cuisine: ["Sichuan"], drinkFocus: ["cocktails"], moodTags: ["lively"],
  whyInteresting: [{ claim: "Sichuan sharing plates", sourceUrl: "https://surfersstockholm.se/" }], bestFor: ["dinner"],
  typicalVisitDurationMinutes: 90,
  priceRange: { min: 295, max: 525, currency: "SEK", basis: "per_person", band: "moderate", evidence: "official_menu" },
  weeklyHours: {}, openingHoursEvidence: { status: "unknown", checkedAt: "2026-09-03T12:00:00Z" }, exceptionalHours: { status: "unknown" },
  reservationMode: "recommended", provenance: [{ name: "Surfers", url: "https://surfersstockholm.se/", fields: ["identity"], fetchedAt: "2026-09-03T12:00:00Z" }], verification: { status: "verified", verifiedAt: "2026-09-03T12:00:00Z" },
};

const stockholmPlan: EveningPlan = {
  id: "night", totalEstimatedCost: 708, startTime: "2026-09-03T18:00:00+02:00", endTime: "2026-09-03T21:30:00+02:00",
  constraints: { budget: 900, currency: "SEK", latestEndTime: "2026-09-04T00:00:00+02:00", partySize: 2, startLocation: { lat: 59.33, lng: 18.07, label: "Central" } },
  stops: [
    { id: "stop-1", kind: "place", placeId: "surfers", purpose: "dinner", plannedStart: "2026-09-03T18:00:00+02:00", plannedEnd: "2026-09-03T19:30:00+02:00", locked: true, status: "active" },
    { id: "stop-2", kind: "happening", happeningId: "terese-quintet", plannedStart: happening.timing.start, plannedEnd: happening.timing.end!, locked: false, status: "active" },
  ],
};

const renderTimeline = (plan = stockholmPlan, events = [happening], places = [place], timeZone = "Europe/Stockholm") => renderToStaticMarkup(
  <EveningTimeline currentPlan={plan} happenings={events} places={places} onCopyAgentPrompt={vi.fn()} webMcpStatus="available" onLock={vi.fn()} onUnlock={vi.fn()} onRemove={vi.fn()} timeZone={timeZone} agentActivity={null} />,
);

describe("Your Night presentation", () => {
  it("renders state labels, action-oriented accessible names, prominent removal and the requested summary", () => {
    const markup = renderTimeline();
    expect(markup).toContain("Locked");
    expect(markup).toContain('aria-label="Locked — unlock Surfers Stockholm"');
    expect(markup).toContain('title="Locked — click to unlock"');
    expect(markup).toContain("Unlocked");
    expect(markup).toContain('aria-label="Unlocked — lock Terese Lien Evenstad Quintet"');
    expect(markup).toContain('aria-label="Remove Terese Lien Evenstad Quintet from Your Night"');
    expect(markup).toContain("18:00–21:30");
    expect(markup).toContain("Estimated price");
    expect(markup).toContain("708 SEK");
    expect(markup).not.toContain("900 SEK");
    expect(markup).not.toContain("By 00:00");
  });

  it("renders truthful booking and reservation actions with safe external attributes", () => {
    const markup = renderTimeline();
    expect(markup).toContain('href="https://booking.example/surfers"');
    expect(markup).toContain("Reserve table");
    expect(markup).toContain('href="https://tickets.example/terese"');
    expect(markup).toContain("Buy tickets");
    expect(markup.match(/target="_blank"/g)).toHaveLength(2);
    expect(markup.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
  });

  it("uses honest fallbacks and omits CTAs without a valid destination", () => {
    const eventDetails = timelineStopLink(stockholmPlan.stops[1], [{ ...happening, commerce: { ...happening.commerce, bookingUrl: undefined } }], [place]);
    expect(eventDetails).toMatchObject({ label: "Event details", href: "https://fasching.se/terese" });
    const venueWebsite = timelineStopLink(stockholmPlan.stops[0], [happening], [{ ...place, reservationUrl: undefined }]);
    expect(venueWebsite).toMatchObject({ label: "Venue website", href: "https://surfersstockholm.se/" });
    expect(timelineStopLink(stockholmPlan.stops[0], [happening], [{ ...place, reservationUrl: undefined, officialWebsite: undefined }])).toBeUndefined();
  });

  it("uses San Francisco clock and currency formatting", () => {
    const plan: EveningPlan = { ...stockholmPlan, totalEstimatedCost: 56, startTime: "2026-09-03T18:00:00-07:00", endTime: "2026-09-03T21:30:00-07:00", constraints: { ...stockholmPlan.constraints, currency: "USD" }, stops: stockholmPlan.stops.map((stop, index) => ({ ...stop, plannedStart: index === 0 ? "2026-09-03T18:00:00-07:00" : "2026-09-03T20:00:00-07:00", plannedEnd: index === 0 ? "2026-09-03T19:30:00-07:00" : "2026-09-03T21:30:00-07:00" })) };
    const markup = renderTimeline(plan, [happening], [place], "America/Los_Angeles");
    expect(markup).toContain("6:00–9:30 PM");
    expect(markup).toContain("$56");
  });

  it("identifies a derived ending through tooltip and accessible text", () => {
    const plan: EveningPlan = { ...stockholmPlan, endTime: stockholmPlan.stops[0].plannedEnd, stops: [stockholmPlan.stops[0]] };
    const markup = renderTimeline(plan);
    expect(markup).toContain("The ending time is estimated from the final stop&#x27;s typical duration.");
    expect(markup).toContain("Ending time estimated.");
  });
});

describe("Options presentation", () => {
  it("uses consumer language and localized visible dates", () => {
    const markup = renderToStaticMarkup(<DiscoveryReview timeZone="Europe/Stockholm" leads={[{
      id: "lead", leadType: "event", cityId: "stockholm", originalSourceUrl: "https://venue.example/show", sourceType: "official_page",
      submittedBy: { kind: "webmcp_agent", toolName: "propose_event_from_url" }, fields: { title: "New show", category: "live_music", timing: { start: "2026-09-03T20:00:00+02:00", end: "2026-09-03T21:30:00+02:00" }, venue: { name: "Venue", address: "Street 1" } },
      missingRequiredFields: [], possibleDuplicateMatches: [], verificationStatus: "provisional", evidence: [{ field: "title", sourceUrl: "https://venue.example/show" }], issues: [], createdAt: "2026-09-03T12:00:00Z",
    }]} onAccept={vi.fn()} onReject={vi.fn()} onKeepCustom={vi.fn()} />);
    expect(markup).toContain("Options");
    expect(markup).toContain("3 SEP · 20:00–21:30");
    expect(markup).toContain('dateTime="2026-09-03T20:00:00+02:00"');
    expect(markup).not.toMatch(/Agent acquisition|Discovery review|awaiting review|accepted canonical|Provisional|discovery only|Canonical fields|Evidence references|Validation:/i);
  });
});
