import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState, LocalBuzzActions } from "./store";
import type { LocalBuzzState } from "./types";

const initialStops = [
  { happeningId: "fringe-closing", plannedStart: "2026-08-30T17:30:00+02:00" },
  { happeningId: "weeping-willows", plannedStart: "2026-08-30T19:30:00+02:00" },
  { happeningId: "montelius-night-walk", plannedStart: "2026-08-30T22:30:00+02:00" },
];

describe("Local Buzz shared domain actions", () => {
  let state: LocalBuzzState;
  let actions: LocalBuzzActions;

  beforeEach(() => {
    state = createInitialState("stockholm");
    actions = new LocalBuzzActions(() => state, (next) => { state = next; }, () => new Date("2026-08-30T12:00:00Z"));
  });

  it("opens in San Francisco by default", () => {
    const initial = createInitialState(undefined, new Date("2026-08-31T12:00:00Z"));
    expect(initial).toMatchObject({ activeCityId: "san-francisco", currentPlan: null });
    expect(initial.happenings.every((item) => item.cityId === "san-francisco")).toBe(true);
    expect(initial.places).toHaveLength(33);
  });

  it("adds a mixed dinner, event and drinks night directly with party-size pricing", () => {
    expect(actions.addHappeningStop({ happeningId: "fringe-closing", plannedStart: "2026-08-30T17:30:00+02:00" }).ok).toBe(true);
    expect(actions.addPlaceStop({ placeId: "sthlm-stigbergets-fot", purpose: "dinner", plannedStart: "2026-08-30T15:30:00+02:00" }).ok).toBe(true);
    expect(actions.addPlaceStop({ placeId: "sthlm-tjoget", purpose: "drinks", plannedStart: "2026-08-30T19:30:00+02:00" }).ok).toBe(true);
    expect(state.currentPlan?.stops.map((stop) => stop.kind)).toEqual(["place", "happening", "place"]);
    expect(state.currentPlan?.stops.every((stop) => stop.status === "active" && !stop.locked)).toBe(true);
    expect(state.currentPlan?.totalEstimatedCost).toBe((119 + 120 + 165) * 2);
  });

  it("builds an event-only plan directly and derives its date and midnight boundary", () => {
    const result = actions.buildEveningPlan([{ happeningId: "ron-sexsmith", plannedStart: "2026-08-31T18:30:00+02:00" }]);
    expect(result).toMatchObject({ ok: true, plan: { id: "evening-stockholm-2026-08-31" } });
    expect(state.currentPlan?.constraints.latestEndTime).toBe("2026-08-31T22:00:00.000Z");
    expect(state.activityMessage).toBe("1-stop night built and ready to edit.");
  });

  it("rejects invalid additions atomically", () => {
    actions.addHappeningStop({ happeningId: "fringe-closing", plannedStart: "2026-08-30T17:30:00+02:00" });
    const before = structuredClone(state.currentPlan);
    expect(actions.addPlaceStop({ placeId: "sthlm-tjoget", purpose: "drinks", plannedStart: "2026-08-30T10:00:00+02:00" })).toMatchObject({ ok: false, code: "PLACE_CLOSED" });
    expect(state.currentPlan).toEqual(before);
  });

  it("rejects incomplete Places and reservation-required spontaneous visits", () => {
    expect(actions.addPlaceStop({ placeId: "sthlm-akkurat", purpose: "drinks", plannedStart: "2026-08-30T20:00:00+02:00" })).toMatchObject({ ok: false, code: "PLACE_DATA_INCOMPLETE" });
    expect(actions.addPlaceStop({ placeId: "sthlm-lilla-ego", purpose: "dinner", plannedStart: "2026-08-30T18:00:00+02:00" })).toMatchObject({ ok: false, code: "RESERVATION_CONFLICT" });
    expect(state.currentPlan).toBeNull();
  });

  it("returns stale operational warnings on the direct mutation", () => {
    state = { ...state, places: state.places.map((place) => place.id === "sthlm-tjoget" ? { ...place, verification: { ...place.verification, verifiedAt: "2025-01-01T00:00:00Z" } } : place) };
    const result = actions.addPlaceStop({ placeId: "sthlm-tjoget", purpose: "drinks", plannedStart: "2026-08-30T20:00:00+02:00" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(" ")).toContain("older than 90 days");
  });

  it("keeps custom Places embedded, unverified and outside the catalog", () => {
    const result = actions.addCustomPlaceStop({
      name: "Friend's neighborhood bar", purpose: "drinks", plannedStart: "2026-08-30T20:00:00+02:00",
      location: { lat: 59.319, lng: 18.072, address: "Human supplied", neighborhood: "Slussen" },
      typicalVisitDurationMinutes: 60, pricePerPerson: 100, currency: "SEK",
      availableFrom: "2026-08-30T17:00:00+02:00", availableUntil: "2026-08-30T23:00:00+02:00",
    });
    expect(result).toMatchObject({ ok: true });
    expect(state.currentPlan?.stops[0]).toMatchObject({ kind: "custom_place", status: "active", customPlace: { verification: { status: "unverified" } } });
    expect(state.places.some((place) => place.name === "Friend's neighborhood bar")).toBe(false);
  });

  it("does not mutate the plan when searches or candidate views change", () => {
    actions.buildEveningPlan(initialStops);
    const before = structuredClone(state.currentPlan);
    actions.searchHappenings({ query: "music", maxResults: 4 });
    actions.showCandidates(["forro-dance"], "Discovery only");
    actions.searchPlaces({ purposes: ["drinks"], maxResults: 4 });
    actions.showPlaceCandidates(["sthlm-tjoget"], "Discovery only");
    expect(state.currentPlan).toEqual(before);
  });

  it("keeps candidate highlights separate from human result restrictions", () => {
    state = { ...state, visibleHappeningIds: state.happenings.slice(0, 5).map((item) => item.id) };
    const fullWindowIds = [...state.visibleHappeningIds];

    const promotedId = state.happenings[5].id;
    actions.showCandidates([promotedId], "Agent recommendation");
    expect(state.visibleHappeningIds).toEqual([...fullWindowIds, promotedId]);
    expect(state.candidateHappeningIds).toEqual([promotedId]);

    actions.showListings(fullWindowIds.slice(0, 2), "Human search");
    expect(state.visibleHappeningIds).toEqual(fullWindowIds.slice(0, 2));
    expect(state.candidateHappeningIds).toEqual([promotedId]);

    actions.buildEveningPlan(initialStops);
    actions.lockPlanStop("stop-2");
    const plan = structuredClone(state.currentPlan);
    actions.showListings(fullWindowIds, "Search cleared");
    expect(state.visibleHappeningIds).toEqual(fullWindowIds);
    expect(state.candidateHappeningIds).toEqual([promotedId]);
    expect(state.currentPlan).toEqual(plan);
  });

  it("keeps place candidate highlights separate from the visible place catalog", () => {
    const visibleIds = state.places.slice(0, 5).map((item) => item.id);
    state = { ...state, visiblePlaceIds: visibleIds };
    const promotedId = state.places[5].id;
    actions.showPlaceCandidates([promotedId], "Agent recommendation");
    expect(state.visiblePlaceIds).toEqual([...visibleIds, promotedId]);
    expect(state.candidatePlaceIds).toEqual([promotedId]);
    actions.showPlaceListings(visibleIds.slice(0, 2), "Human filters");
    expect(state.visiblePlaceIds).toEqual(visibleIds.slice(0, 2));
    expect(state.candidatePlaceIds).toEqual([promotedId]);
    actions.showPlaceListings(visibleIds, "Filters cleared");
    expect(state.visiblePlaceIds).toEqual(visibleIds);
    expect(state.candidatePlaceIds).toEqual([promotedId]);
  });

  it("locks and unlocks a stop in the canonical plan", () => {
    actions.buildEveningPlan(initialStops);
    expect(actions.lockPlanStop("stop-2")).toEqual({ ok: true, stopId: "stop-2", locked: true });
    expect(actions.unlockPlanStop("stop-2")).toEqual({ ok: true, stopId: "stop-2", locked: false });
    expect(state.currentPlan?.stops[1].locked).toBe(false);
  });

  it("protects a locked stop from agents but permits explicit human removal", () => {
    actions.buildEveningPlan(initialStops);
    actions.lockPlanStop("stop-2");
    expect(actions.removePlanStop("stop-2", "agent")).toMatchObject({ ok: false, code: "LOCKED_STOP_CONFLICT" });
    expect(actions.removePlanStop("stop-2", "human")).toMatchObject({ ok: true, stopId: "stop-2" });
    expect(state.currentPlan?.stops.map((stop) => stop.id)).toEqual(["stop-1", "stop-3"]);
  });

  it("removes the last stop and returns to an empty night", () => {
    actions.addHappeningStop({ happeningId: "fringe-closing", plannedStart: "2026-08-30T17:30:00+02:00" });
    expect(actions.removePlanStop("stop-1", "human")).toMatchObject({ ok: true, plan: null });
    expect(state.currentPlan).toBeNull();
  });

  it("applies surgical repair directly while preserving locked and unaffected stops", () => {
    actions.buildEveningPlan(initialStops);
    actions.lockPlanStop("stop-2");
    const lockedBefore = structuredClone(state.currentPlan?.stops[1]);
    const unaffectedBefore = structuredClone(state.currentPlan?.stops[2]);
    actions.applyLiveUpdate({ id: "update", happeningId: "fringe-closing", availability: "sold_out", label: "Simulation", source: "demo_simulation", appliedAt: "2026-08-30T18:05:00+02:00" });
    const repair = actions.repairPlan({ reason: "Unavailable", preserveLockedStops: true, replacementHappeningIds: ["horse-opera"] });
    expect(repair).toMatchObject({ ok: true, changedStopIds: ["stop-1"], preservedLockedStopIds: ["stop-2"] });
    expect(state.currentPlan?.stops[1]).toEqual(lockedBefore);
    expect(state.currentPlan?.stops[2]).toEqual(unaffectedBefore);
    expect(state.currentPlan?.stops[0]).toMatchObject({ kind: "happening", happeningId: "horse-opera", status: "active" });
  });

  it("never replaces a disrupted locked stop", () => {
    actions.buildEveningPlan(initialStops);
    actions.lockPlanStop("stop-1");
    actions.applyLiveUpdate({ id: "update", happeningId: "fringe-closing", availability: "sold_out", label: "Simulation", source: "demo_simulation", appliedAt: "2026-08-30T18:05:00+02:00" });
    expect(actions.repairPlan({ reason: "Unavailable", replacementHappeningIds: ["horse-opera"] })).toMatchObject({ ok: false, code: "LOCKED_STOP_CONFLICT" });
  });

  it("rejects a cross-day repair candidate and retains the disrupted stop", () => {
    actions.buildEveningPlan([{ happeningId: "ron-sexsmith", plannedStart: "2026-08-31T18:30:00+02:00" }]);
    actions.applyLiveUpdate({ id: "update", happeningId: "ron-sexsmith", availability: "sold_out", label: "Simulation", source: "demo_simulation", appliedAt: "2026-08-31T16:35:00Z" });
    expect(actions.repairPlan({ reason: "Unavailable", replacementHappeningIds: ["forro-dance"] })).toMatchObject({ ok: false, code: "NO_REPAIR_FOUND" });
    expect(state.currentPlan?.stops[0]).toMatchObject({ happeningId: "ron-sexsmith", status: "unavailable" });
  });

  it("does not treat an unknown replacement price as zero", () => {
    const replacement = structuredClone(state.happenings.find((item) => item.id === "horse-opera")!);
    replacement.id = "unknown-price";
    replacement.commerce.priceMin = undefined;
    state = { ...state, happenings: [...state.happenings, replacement] };
    actions.buildEveningPlan(initialStops);
    actions.applyLiveUpdate({ id: "update", happeningId: "fringe-closing", availability: "sold_out", label: "Simulation", source: "demo_simulation", appliedAt: "2026-08-30T18:05:00+02:00" });
    const before = structuredClone(state.currentPlan);
    expect(actions.repairPlan({ reason: "Unavailable", replacementHappeningIds: [replacement.id] })).toMatchObject({ ok: false, code: "BUDGET_CONFLICT", message: expect.stringContaining("unknown price") });
    expect(state.currentPlan).toEqual(before);
  });

  it("prevents rebuilding over locked user intent", () => {
    actions.buildEveningPlan(initialStops);
    actions.lockPlanStop("stop-2");
    const before = structuredClone(state.currentPlan);
    expect(actions.buildEveningPlan([{ happeningId: "horse-opera", plannedStart: "2026-08-30T17:00:00+02:00" }])).toMatchObject({ ok: false, code: "LOCKED_STOP_CONFLICT" });
    expect(state.currentPlan).toEqual(before);
  });

  it("clears the canonical plan on city switch and uses the new currency", () => {
    actions.showCandidates([state.happenings[0].id], "Agent recommendation");
    actions.showPlaceCandidates([state.places[0].id], "Agent recommendation");
    actions.buildEveningPlan(initialStops);
    actions.switchCity("san-francisco");
    expect(state.currentPlan).toBeNull();
    expect(state.candidateHappeningIds).toEqual([]);
    expect(state.candidatePlaceIds).toEqual([]);
    const result = actions.buildEveningPlan([{ happeningId: "sf-crucial-reggae", plannedStart: "2026-08-30T16:30:00-07:00" }]);
    expect(result).toMatchObject({ ok: true });
    expect(state.currentPlan?.constraints.currency).toBe("USD");
  });
});
