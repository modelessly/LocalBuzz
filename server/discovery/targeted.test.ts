import { describe, expect, it, vi } from "vitest";
import { runTargetedDiscovery, validateTargetedResults } from "./targeted";
import type { CoverageSearchTarget, TargetedDiscoverySnapshot } from "./types";
import { createInitialState, LocalBuzzActions } from "../../src/domain/store";

const target: CoverageSearchTarget = { id: "gap-san-francisco--mission--comedy--late-night--free--same-day", cell: { cityId: "san-francisco", neighborhood: "Mission", category: "comedy", timeWindow: "late_night", priceBand: "free", leadTime: "same_day" }, query: "free comedy in Mission, San Francisco after 10pm today", maxResults: 10 };
const raw = { results: [{ title: "Mission Late Laughs", description: "Free late comedy.", category: "comedy", venue: { name: "Mission Hall", address: "1 Mission St, San Francisco", neighborhood: "Mission", lat: 37.76, lng: -122.42 }, timing: { start: "2026-09-05T22:30:00-07:00", end: "2026-09-05T23:30:00-07:00" }, commerce: { priceMin: 0, priceMax: 0, currency: "USD", bookingUrl: "https://venue.example/late-laughs" }, sourceUrl: "https://venue.example/late-laughs", sourceType: "official_page", availability: "unknown", evidence: [{ field: "date_location", sourceUrl: "https://venue.example/late-laughs", note: "Official event page" }] }] };

describe("targeted discovery", () => {
  it("turns validated search results into collector-authored DiscoveryLeads", () => {
    const result = validateTargetedResults(raw, target, [], new Date("2026-09-01T00:00:00Z"));
    expect(result.rejected).toEqual([]);
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]).toMatchObject({ leadType: "event", cityId: "san-francisco", submittedBy: { kind: "targeted_collector", coverageCellId: target.id } });
    expect(result.leads[0].reviewOutcome).toBeUndefined();
    let state = createInitialState("san-francisco", new Date("2026-09-01T00:00:00Z"));
    const actions = new LocalBuzzActions(() => state, (next) => { state = next; });
    expect(actions.stageDiscoveryLeads(result.leads)).toMatchObject({ ok: true, count: 1 });
    expect(state.discoveryLeads[0].id).toBe(result.leads[0].id);
    expect(state.happenings.some((item) => item.title === "Mission Late Laughs")).toBe(false);
  });

  it("rejects duplicate search results before they enter the review frontier", () => {
    const existing = [{ id: "existing", cityId: "san-francisco" as const, title: "Mission Late Laughs", category: "comedy" as const, venue: { name: "Mission Hall", address: "1 Mission St", neighborhood: "Mission", lat: 37.76, lng: -122.42 }, timing: { start: "2026-09-05T22:30:00-07:00", end: "2026-09-05T23:30:00-07:00" }, commerce: { currency: "USD" as const }, status: { availability: "unknown" as const }, source: { name: "Official", url: "https://venue.example/late-laughs" } }];
    const result = validateTargetedResults(raw, target, existing, new Date("2026-09-01T00:00:00Z"));
    expect(result.leads).toEqual([]);
    expect(result.rejected[0]).toContain("DUPLICATE");
  });

  it("uses a fresh target cache without another paid call and preserves last-good on failures", async () => {
    const lead = validateTargetedResults(raw, target, [], new Date("2026-09-01T00:00:00Z")).leads[0];
    const previous: TargetedDiscoverySnapshot = { cityId: "san-francisco", generatedAt: "2026-09-01T00:00:00Z", retained: false, target, leads: [lead], status: "fresh" };
    const fetchImpl = vi.fn(async () => { throw new Error("must not run"); });
    const cached = await runTargetedDiscovery({ apiKey: "secret", target, happenings: [], previous, now: new Date("2026-09-01T01:00:00Z"), fetchImpl: fetchImpl as typeof fetch });
    expect(cached.status).toBe("cached");
    expect(fetchImpl).not.toHaveBeenCalled();
    const retained = await runTargetedDiscovery({ apiKey: "secret", target, happenings: [], previous, now: new Date("2026-09-02T00:00:00Z"), fetchImpl: fetchImpl as typeof fetch });
    expect(retained).toMatchObject({ status: "retained", retained: true, leads: [lead] });
  });

  it("reports missing credentials without erasing a matching last-good snapshot", async () => {
    const lead = validateTargetedResults(raw, target, [], new Date("2026-09-01T00:00:00Z")).leads[0];
    const previous: TargetedDiscoverySnapshot = { cityId: "san-francisco", generatedAt: "2026-08-31T00:00:00Z", retained: false, target, leads: [lead], status: "fresh" };
    const result = await runTargetedDiscovery({ target, happenings: [], previous, now: new Date("2026-09-02T00:00:00Z") });
    expect(result).toMatchObject({ status: "retained", retained: true, leads: [lead] });
  });

  it("labels a valid zero-result search as empty and does not invent leads", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ results: [] }) }] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    const result = await runTargetedDiscovery({ apiKey: "secret", target, happenings: [], now: new Date("2026-09-01T00:00:00Z"), fetchImpl: fetchImpl as typeof fetch });
    expect(result).toMatchObject({ status: "empty", retained: false, leads: [], message: "Search completed with no candidate results." });
  });
});
