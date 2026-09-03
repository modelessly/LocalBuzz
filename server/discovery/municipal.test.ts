import { describe, expect, it } from "vitest";
import { corroborateMunicipalRecord, normalizeClosureRows, normalizePermitRows, refreshMunicipalRadar } from "./municipal";
import type { MunicipalRadarRecord, MunicipalRadarSnapshot } from "./types";

const permit: MunicipalRadarRecord = {
  id: "municipal-permitsf-special-event-intake-EVNT-26-500", cityId: "san-francisco", sourceId: "permitsf-special-event-intake", officialIdentifier: "EVNT-26-500", relevantDates: { submittedAt: "2026-09-01T10:00:00.000" }, permitStatus: "Active - Not Issued", officialSourceUrl: "https://sanfranciscoca.portal.opengov.com/records/500", suggestedSearchQuery: "permit \"EVNT-26-500\" in San Francisco official public event page; verify title, exact event date/time, physical venue, organizer and direct source independently of municipal status Active - Not Issued", fetchedAt: "2026-09-01T12:00:00Z", corroborationStatus: "required",
};

describe("municipal radar", () => {
  it("normalizes and deduplicates special-event closure segments", () => {
    const rows = [{ case_num: "123", case_name: "Night Market", type: "Special Event", status: "Permitted", loc_desc: "A ST", start_utc: "2026-09-05T01:00:00.000", end_utc: "2026-09-05T08:00:00.000", shape: { type: "LineString", coordinates: [[-122.42, 37.76], [-122.41, 37.77]] } }, { case_num: "123", case_name: "Night Market", type: "Special Event", status: "Permitted", loc_desc: "B ST", start_utc: "2026-09-05T01:00:00.000", end_utc: "2026-09-05T08:00:00.000" }];
    const records = normalizeClosureRows(rows, "2026-09-01T12:00:00Z");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ officialIdentifier: "123", eventHint: "Night Market", permitStatus: "Permitted", corroborationStatus: "required", location: { description: "A ST; B ST" } });
  });

  it("retains PermitSF identifiers and uncertainty without inventing event fields", () => {
    const records = normalizePermitRows([{ recordid: "500", recordno: "EVNT-26-500", recordtype: "Special event intake form", status_detail: "Active - Not Issued", submitted_date: "2026-09-01T10:00:00.000", url: { url: "https://sanfranciscoca.portal.opengov.com/records/500" } }], "2026-09-01T12:00:00Z");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject(permit);
    expect(records[0].location).toBeUndefined();
    expect(records[0].relevantDates.startsAt).toBeUndefined();
    expect(records[0].suggestedSearchQuery).toContain("official public event page");
  });

  it("never turns permit-only evidence into an event lead and requires independent corroboration", () => {
    expect(corroborateMunicipalRecord(permit, undefined, [])).toMatchObject({ ok: false, code: "CORROBORATION_REQUIRED" });
    const result = corroborateMunicipalRecord(permit, {
      cityId: "san-francisco", sourceUrl: "https://venue.example/night-market", sourceType: "official_page",
      fields: { title: "Night Market", category: "market", venue: { name: "Market Hall", address: "1 Mission St", neighborhood: "Mission", lat: 37.76, lng: -122.42 }, timing: { start: "2026-09-05T19:00:00-07:00", end: "2026-09-05T22:00:00-07:00" }, commerce: { priceMin: 0, currency: "USD" }, availability: "unknown" },
      evidence: [{ field: "permit_match", sourceUrl: "https://venue.example/night-market", note: "Official page references EVNT-26-500" }],
    }, [], new Date("2026-09-01T12:00:00Z"));
    expect(result).toMatchObject({ ok: true, lead: { submittedBy: { kind: "municipal_corroboration", officialIdentifier: "EVNT-26-500" } } });
  });

  it("preserves last-good radar records when both DataSF refreshes fail", async () => {
    const previous: MunicipalRadarSnapshot = { cityId: "san-francisco", generatedAt: "2026-09-01T00:00:00Z", retained: false, records: [permit], sources: [] };
    const fetchImpl = async () => new Response("failure", { status: 503 });
    const result = await refreshMunicipalRadar({ cityId: "san-francisco", previous, fetchImpl: fetchImpl as typeof fetch, now: new Date("2026-09-02T00:00:00Z") });
    expect(result.retained).toBe(true);
    expect(result.records).toEqual([permit]);
    expect(result.sources.map((source) => source.status)).toEqual(["unavailable", "retained"]);
  });

  it("keeps the Stockholm official municipal source disabled with an exact reason", async () => {
    const result = await refreshMunicipalRadar({ cityId: "stockholm", now: new Date("2026-09-01T00:00:00Z") });
    expect(result.sources[0]).toMatchObject({ sourceId: "stockholm-land-permit-events", status: "disabled" });
    expect(result.sources[0].message).toContain("requires an issued API key");
  });
});
