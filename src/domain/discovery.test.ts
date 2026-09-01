import { describe, expect, it } from "vitest";
import { getCityDefinition } from "../data/cities";
import { buildEventLead, validatePublicSourceUrl } from "./discovery";
import { createInitialState, LocalBuzzActions } from "./store";
import type { LocalBuzzState, PlaceDiscoveryFields } from "./types";

const evidence = [{ field: "title", sourceUrl: "https://venue.example/events/new", note: "Official event page" }];
const eventInput = {
  cityId: "stockholm" as const,
  sourceUrl: "https://venue.example/events/new",
  sourceType: "official_page" as const,
  evidence,
  fields: {
    title: "New Stockholm Show", category: "live_music" as const,
    venue: { name: "Nalen", address: "Regeringsgatan 74, Stockholm", neighborhood: "Norrmalm", lat: 59.337, lng: 18.0665 },
    timing: { start: "2026-09-05T19:00:00+02:00", end: "2026-09-05T21:00:00+02:00" },
    commerce: { priceMin: 250, priceMax: 300, currency: "SEK" as const, bookingUrl: "https://venue.example/tickets/new" },
    availability: "unknown" as const,
  },
};

const setup = () => {
  let state: LocalBuzzState = createInitialState("stockholm", new Date("2026-09-01T12:00:00Z"));
  const actions = new LocalBuzzActions(() => state, (next) => { state = next; });
  return { actions, read: () => state };
};

describe("discovery lead validation", () => {
  it("rejects malformed, credentialed, local and private source URLs", () => {
    expect(validatePublicSourceUrl("not a url")).toMatchObject({ ok: false, code: "INVALID_URL" });
    expect(validatePublicSourceUrl("http://example.com/event")).toMatchObject({ ok: false, code: "INVALID_URL" });
    expect(validatePublicSourceUrl("https://user:pass@example.com/event")).toMatchObject({ ok: false, code: "INVALID_URL" });
    expect(validatePublicSourceUrl("https://localhost/event")).toMatchObject({ ok: false, code: "UNSAFE_INPUT" });
    expect(validatePublicSourceUrl("https://192.168.1.8/event")).toMatchObject({ ok: false, code: "UNSAFE_INPUT" });
    expect(validatePublicSourceUrl("https://[::1]/event")).toMatchObject({ ok: false, code: "UNSAFE_INPUT" });
    expect(buildEventLead({ ...eventInput, fields: { ...eventInput.fields, commerce: { ...eventInput.fields.commerce, bookingUrl: "https://10.0.0.2/tickets" } } }, "stockholm", [], new Date("2026-09-01T12:00:00Z"))).toMatchObject({ ok: false, code: "UNSAFE_INPUT" });
  });

  it("stages missing and duplicate warnings without publishing canonically", () => {
    const existing = getCityDefinition("stockholm").happenings;
    const missing = buildEventLead({ ...eventInput, fields: { title: "Incomplete" } }, "stockholm", existing, new Date("2026-09-01T12:00:00Z"));
    expect(missing).toMatchObject({ ok: true, lead: { verificationStatus: "needs_review", issues: expect.arrayContaining(["MISSING_DATE", "MISSING_LOCATION"]) } });
    const known = existing[0];
    const duplicate = buildEventLead({ ...eventInput, sourceUrl: known.source.url, evidence: [{ ...evidence[0], sourceUrl: known.source.url }], fields: { ...eventInput.fields, title: known.title, timing: { start: known.timing.start, end: known.timing.end } } }, "stockholm", existing, new Date("2026-08-01T12:00:00Z"));
    expect(duplicate).toMatchObject({ ok: true, lead: { issues: expect.arrayContaining(["DUPLICATE"]), possibleDuplicateMatches: [{ id: known.id }] } });
  });

  it("rejects wrong-city, expired and oversized submissions with structured status", () => {
    expect(buildEventLead({ ...eventInput, cityId: "san-francisco" }, "stockholm", [], new Date("2026-09-01T12:00:00Z"))).toMatchObject({ ok: false, code: "WRONG_CITY" });
    const expired = buildEventLead({ ...eventInput, fields: { ...eventInput.fields, timing: { start: "2026-08-01T19:00:00+02:00", end: "2026-08-01T21:00:00+02:00" } } }, "stockholm", [], new Date("2026-09-01T12:00:00Z"));
    expect(expired).toMatchObject({ ok: true, lead: { issues: expect.arrayContaining(["EXPIRED_EVENT"]) } });
    expect(buildEventLead({ ...eventInput, fields: { ...eventInput.fields, description: "x".repeat(5001) } }, "stockholm", [], new Date("2026-09-01T12:00:00Z"))).toMatchObject({ ok: false, code: "UNSAFE_INPUT" });
  });

  it("keeps proposals staged, accepts valid records, rejects leads, and retains an insufficient Place as custom", () => {
    const { actions, read } = setup();
    const proposed = actions.proposeEventLead(eventInput);
    expect(proposed.ok).toBe(true);
    expect(read().happenings.some((item) => item.title === eventInput.fields.title)).toBe(false);
    if (!proposed.ok) throw new Error("expected proposal");
    const acceptedEvent = actions.acceptDiscoveryLead(proposed.lead.id);
    expect(acceptedEvent.ok, JSON.stringify(acceptedEvent)).toBe(true);
    expect(read().happenings.some((item) => item.title === eventInput.fields.title)).toBe(true);

    const template = getCityDefinition("stockholm").places.find((place) => place.id === "sthlm-tjoget")!;
    const placeFields: PlaceDiscoveryFields = { name: "Agent Bar", officialWebsite: "https://agentbar.example/", kind: "bar", location: { ...template.location, address: "Agentgatan 1, Stockholm" }, cuisine: [], drinkFocus: ["cocktails"], moodTags: ["calm"], bestFor: ["drinks"], typicalVisitDurationMinutes: 60, priceRange: { ...template.priceRange, min: 150, max: 250 }, weeklyHours: template.weeklyHours, openingHoursEvidence: { ...template.openingHoursEvidence, sourceUrl: "https://agentbar.example/hours" }, exceptionalHours: template.exceptionalHours, reservationMode: "walk_in" };
    const canonicalPlace = actions.proposePlaceLead({ cityId: "stockholm", sourceUrl: "https://agentbar.example/", sourceType: "official_page", fields: placeFields, evidence: [{ field: "name", sourceUrl: "https://agentbar.example/", note: "Official business page" }, { field: "hours", sourceUrl: "https://agentbar.example/hours", note: "Weekly hours" }] });
    expect(canonicalPlace).toMatchObject({ ok: true, lead: { issues: [] } });
    if (!canonicalPlace.ok) throw new Error("expected canonical place proposal");
    expect(actions.acceptDiscoveryLead(canonicalPlace.lead.id)).toMatchObject({ ok: true });
    expect(read().places.some((item) => item.name === "Agent Bar")).toBe(true);

    const place = actions.proposePlaceLead({ cityId: "stockholm", sourceUrl: "https://guide.example/agent-bar-two", sourceType: "editorial_page", fields: { ...placeFields, name: "Agent Bar Two", officialWebsite: "https://agentbartwo.example/" }, evidence: [{ field: "name", sourceUrl: "https://guide.example/agent-bar-two", note: "Named on guide page" }] });
    expect(place).toMatchObject({ ok: true, lead: { issues: expect.arrayContaining(["INSUFFICIENT_PROVENANCE"]) } });
    if (!place.ok) throw new Error("expected place proposal");
    expect(actions.acceptDiscoveryLead(place.lead.id)).toMatchObject({ ok: false, code: "INSUFFICIENT_PROVENANCE" });
    expect(actions.keepDiscoveryLeadAsCustom(place.lead.id, { purpose: "drinks", plannedStart: "2026-09-05T20:00:00+02:00", availableFrom: "2026-09-05T17:00:00+02:00", availableUntil: "2026-09-05T23:59:00+02:00" })).toMatchObject({ ok: true });
    expect(read().stagedPlan?.stops.at(-1)).toMatchObject({ kind: "custom_place", customPlace: { verification: { status: "unverified" } } });

    const rejected = actions.proposeEventLead({ ...eventInput, sourceUrl: "https://venue.example/reject-me", fields: { ...eventInput.fields, title: "Reject me" }, evidence: [{ field: "title", sourceUrl: "https://venue.example/reject-me" }] });
    if (!rejected.ok) throw new Error("expected rejected lead proposal");
    expect(actions.rejectDiscoveryLead(rejected.lead.id)).toMatchObject({ ok: true, lead: { reviewOutcome: "rejected" } });
  });
});
