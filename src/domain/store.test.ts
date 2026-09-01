import { beforeEach, describe, expect, it } from "vitest";
import { getSearchWindow } from "../lib/timeSearch";
import { createInitialState, LocalBuzzActions } from "./store";
import type { LocalBuzzState } from "./types";

const initialStops = [
  { happeningId: "ukraine-festival", plannedStart: "2026-08-30T18:00:00+02:00" },
  { happeningId: "weeping-willows", plannedStart: "2026-08-30T19:30:00+02:00" },
  { happeningId: "montelius-night-walk", plannedStart: "2026-08-30T22:00:00+02:00" },
];

describe("Local Buzz shared domain actions", () => {
  let state: LocalBuzzState;
  let actions: LocalBuzzActions;

  beforeEach(() => {
    state = createInitialState("stockholm");
    actions = new LocalBuzzActions(
      () => state,
      (next) => {
        state = next;
      },
    );
  });

  it("opens in San Francisco by default", () => {
    const defaultState = createInitialState(undefined, new Date("2026-08-31T12:00:00.000Z"));

    expect(defaultState.activeCityId).toBe("san-francisco");
    expect(defaultState.happenings).toHaveLength(12);
    expect(defaultState.happenings.every((item) => item.cityId === "san-francisco")).toBe(true);
    expect(defaultState.places).toHaveLength(33);
  });

  it("searches and surfaces canonical places with verification metadata", () => {
    const result = actions.searchPlaces({ query: "Tjoget", purposes: ["drinks"], openAt: "2026-08-30T20:00:00+02:00", maxResults: 12 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.places.some((place) => place.id === "sthlm-tjoget")).toBe(true);
    expect(result.places.every((place) => place.provenance.length > 0)).toBe(true);
    expect(actions.showPlaceCandidates(["sthlm-tjoget"], "After-event drinks")).toEqual({ ok: true, visibleCount: 1 });
    expect(state.candidatePlaceIds).toEqual(["sthlm-tjoget"]);
  });

  it("filters places by purpose, kind, mood, neighborhood, price and open arrival", () => {
    const result = actions.searchPlaces({ purposes: ["drinks"], kinds: ["pub"], moods: ["relaxed"], neighborhoods: ["Södermalm"], maxPrice: 200, openAt: "2026-08-30T20:00:00+02:00", maxResults: 20 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.places.map((place) => place.id)).toContain("sthlm-stigbergets-fot");
  });

  it("stages and accepts a mixed dinner, event and drinks night with party-size pricing", () => {
    expect(actions.stageHappeningStop({ happeningId: "ukraine-festival", plannedStart: "2026-08-30T18:00:00+02:00" }).ok).toBe(true);
    expect(actions.stagePlaceStop({ placeId: "sthlm-pelikan", purpose: "dinner", plannedStart: "2026-08-30T15:30:00+02:00" }).ok).toBe(true);
    const drinks = actions.stagePlaceStop({ placeId: "sthlm-tjoget", purpose: "drinks", plannedStart: "2026-08-30T20:00:00+02:00" });

    expect(drinks.ok).toBe(true);
    expect(state.stagedPlan?.stops.map((stop) => stop.kind)).toEqual(["place", "happening", "place"]);
    expect(state.stagedPlan?.totalEstimatedCost).toBe((195 + 0 + 165) * 2);
    expect(actions.acceptStagedChanges().ok).toBe(true);
    expect(state.currentPlan?.stops.every((stop) => stop.status === "accepted")).toBe(true);
  });

  it("rejects closed or incomplete canonical place visits", () => {
    expect(actions.stagePlaceStop({ placeId: "sthlm-tjoget", purpose: "drinks", plannedStart: "2026-08-30T10:00:00+02:00" })).toMatchObject({ ok: false, code: "PLACE_CLOSED" });
    expect(actions.stagePlaceStop({ placeId: "sthlm-akkurat", purpose: "drinks", plannedStart: "2026-08-30T20:00:00+02:00" })).toMatchObject({ ok: false, code: "PLACE_DATA_INCOMPLETE" });
  });

  it("warns on qualified incomplete verification and rejects reservation-required spontaneous stops", () => {
    const warning = actions.stagePlaceStop({ placeId: "sthlm-pelikan", purpose: "dinner", plannedStart: "2026-08-30T18:00:00+02:00" });
    expect(warning.ok).toBe(true);
    if (warning.ok) expect(warning.warnings.join(" ")).toContain("needs review");
    actions.rejectStagedChanges();
    expect(actions.stagePlaceStop({ placeId: "sthlm-lilla-ego", purpose: "dinner", plannedStart: "2026-08-30T18:00:00+02:00" })).toMatchObject({ ok: false, code: "RESERVATION_CONFLICT" });
  });

  it("warns when otherwise usable Place verification is stale", () => {
    state = {
      ...state,
      places: state.places.map((place) => place.id === "sthlm-tjoget"
        ? { ...place, verification: { ...place.verification, verifiedAt: "2025-01-01T00:00:00Z" } }
        : place),
    };

    const result = actions.stagePlaceStop({ placeId: "sthlm-tjoget", purpose: "drinks", plannedStart: "2026-08-30T20:00:00+02:00" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(" ")).toContain("older than 90 days");
  });

  it("keeps custom places visibly unverified and enforces stated availability", () => {
    const input = {
      name: "Friend's neighborhood bar", purpose: "drinks" as const, plannedStart: "2026-08-30T20:00:00+02:00",
      location: { lat: 59.319, lng: 18.072, address: "Human supplied", neighborhood: "Slussen" },
      typicalVisitDurationMinutes: 60, pricePerPerson: 100, currency: "SEK" as const,
      availableFrom: "2026-08-30T17:00:00+02:00", availableUntil: "2026-08-30T23:00:00+02:00",
    };
    expect(actions.stageCustomPlace(input).ok).toBe(true);
    expect(state.stagedPlan?.stops[0]).toMatchObject({ kind: "custom_place", customPlace: { verification: { status: "unverified" } } });

    actions.rejectStagedChanges();
    expect(actions.stageCustomPlace({ ...input, plannedStart: "2026-08-30T22:30:00+02:00" })).toMatchObject({ ok: false, code: "PLACE_CLOSED" });
  });

  it("repairs a disrupted event without changing mixed place stops or their locks", () => {
    actions.stageHappeningStop({ happeningId: "ukraine-festival", plannedStart: "2026-08-30T18:00:00+02:00" });
    actions.stagePlaceStop({ placeId: "sthlm-tjoget", purpose: "drinks", plannedStart: "2026-08-30T20:00:00+02:00" });
    actions.lockPlanStop("stop-2");
    actions.acceptStagedChanges();
    const placeBefore = structuredClone(state.currentPlan?.stops.find((stop) => stop.kind === "place"));
    actions.applyLiveUpdate({ id: "mixed-update", happeningId: "ukraine-festival", availability: "sold_out", label: "simulation", source: "demo_simulation", appliedAt: "2026-08-30T18:05:00+02:00" });

    const result = actions.repairPlan({ reason: "Event unavailable", preserveLockedStops: true, replacementHappeningIds: ["forro-dance"] });
    expect(result.ok).toBe(true);
    expect(state.stagedPlan?.stops.find((stop) => stop.kind === "place")).toEqual(placeBefore);
  });

  it("searches deterministically using time, price, and distance constraints", () => {
    const result = actions.searchHappenings({
      query: "unexpected music",
      startAfter: "2026-08-30T17:30:00+02:00",
      endBefore: "2026-08-31T00:00:00+02:00",
      maxPrice: 300,
      near: { lat: 59.319, lng: 18.072 },
      maxDistanceKm: 5,
      maxResults: 6,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.count).toBeGreaterThan(0);
      expect(result.happenings.length).toBeLessThanOrEqual(6);
    }
  });

  it("restores a full listing without clearing staged plan state", () => {
    const originalIds = state.visibleHappeningIds;
    actions.stagePlan([
      { happeningId: "moderna-collection-2026-08-31", plannedStart: "2026-08-31T17:00:00+02:00" },
    ]);
    actions.showCandidates(["ron-sexsmith"], "A filtered search");

    const result = actions.showListings(originalIds, "Full listing restored.");

    expect(result).toEqual({ ok: true, visibleCount: originalIds.length });
    expect(state.visibleHappeningIds).toEqual(originalIds);
    expect(state.candidateHappeningIds).toEqual([]);
    expect(state.candidateReason).toBeUndefined();
    expect(state.selectedHappeningId).toBeUndefined();
    expect(state.stagedPlan?.stops).toHaveLength(1);
  });

  it("replaces the active city inventory while preserving happenings used by a staged plan", () => {
    actions.stagePlan([
      { happeningId: "moderna-collection-2026-08-31", plannedStart: "2026-08-31T17:00:00+02:00" },
    ]);
    const fresh = structuredClone(state.happenings.find((item) => item.id === "ron-sexsmith")!);
    fresh.id = "fresh-stockholm-event";

    const result = actions.replaceCityHappenings(
      "stockholm",
      [fresh],
      "Fresh inventory loaded.",
      new Date("2026-08-31T14:00:00.000Z"),
    );

    expect(result).toMatchObject({ ok: true, applied: true });
    expect(state.happenings[0].id).toBe("fresh-stockholm-event");
    expect(state.happenings.some((item) => item.id === "moderna-collection-2026-08-31")).toBe(true);
    expect(state.stagedPlan?.stops[0]).toMatchObject({ kind: "happening", happeningId: "moderna-collection-2026-08-31" });
  });

  it("stages without overwriting canonical state", () => {
    const result = actions.stagePlan(initialStops, "A compact unexpected night");
    expect(result.ok).toBe(true);
    expect(state.currentPlan).toBeNull();
    expect(state.stagedPlan?.stops).toHaveLength(3);
    expect(state.stagedPlan?.totalEstimatedCost).toBe(450);
  });

  it("derives plan identity, midnight constraint, and copy from the actual staged date", () => {
    const result = actions.stagePlan([
      { happeningId: "moderna-collection-2026-08-31", plannedStart: "2026-08-31T17:00:00+02:00" },
      { happeningId: "ron-sexsmith", plannedStart: "2026-08-31T18:30:00+02:00" },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.id).toBe("evening-stockholm-2026-08-31");
      expect(result.plan.constraints.latestEndTime).toBe("2026-08-31T22:00:00.000Z");
      expect(Date.parse(result.plan.endTime)).toBeLessThanOrEqual(
        Date.parse(result.plan.constraints.latestEndTime),
      );
    }
    expect(state.activityMessage).toBe("A 2-stop night is staged for review—not committed.");
  });

  it("rejects a plan that ends after its explicit latest-end constraint", () => {
    const result = actions.stagePlan(
      [{ happeningId: "ron-sexsmith", plannedStart: "2026-08-31T18:30:00+02:00" }],
      undefined,
      {
        budget: 900,
        currency: "SEK",
        latestEndTime: "2026-08-31T20:00:00+02:00",
        partySize: 2,
        startLocation: { lat: 59.319, lng: 18.072, label: "Slussen" },
      },
    );

    expect(result).toMatchObject({ ok: false, code: "TIME_CONFLICT" });
    expect(state.stagedPlan).toBeNull();
  });

  it("preserves a human lock and unaffected state during minimal repair", () => {
    actions.stagePlan(initialStops);
    actions.lockPlanStop("stop-2");
    actions.acceptStagedChanges();
    const acceptedBefore = structuredClone(state.currentPlan);

    actions.applyLiveUpdate({
      id: "demo-update-1",
      happeningId: "ukraine-festival",
      availability: "sold_out",
      label: "Demo live-status simulation",
      source: "demo_simulation",
      appliedAt: "2026-08-30T18:05:00+02:00",
    });
    const repair = actions.repairPlan({
      reason: "The first stop is unavailable",
      preserveLockedStops: true,
      replacementHappeningIds: ["forro-dance"],
    });

    expect(repair.ok).toBe(true);
    if (repair.ok) {
      expect(repair.changedStopIds).toEqual(["stop-1"]);
      expect(repair.preservedLockedStopIds).toEqual(["stop-2"]);
    }
    expect(state.currentPlan?.stops[1]).toEqual(acceptedBefore?.stops[1]);
    expect(state.stagedPlan?.stops[1]).toEqual(acceptedBefore?.stops[1]);
    expect(state.stagedPlan?.stops[2]).toEqual(acceptedBefore?.stops[2]);
    expect(state.stagedPlan?.stops[0]).toMatchObject({ kind: "happening", happeningId: "forro-dance" });
  });

  it("never silently replaces a disrupted locked stop", () => {
    actions.stagePlan(initialStops);
    actions.lockPlanStop("stop-1");
    actions.applyLiveUpdate({
      id: "demo-update-1",
      happeningId: "ukraine-festival",
      availability: "sold_out",
      label: "Demo live-status simulation",
      source: "demo_simulation",
      appliedAt: "2026-08-30T18:05:00+02:00",
    });
    const repair = actions.repairPlan({
      reason: "Unavailable",
      replacementHappeningIds: ["forro-dance"],
    });
    expect(repair).toMatchObject({ ok: false, code: "LOCKED_STOP_CONFLICT" });
  });

  it("rejects an August 30 repair candidate for an August 31 disrupted stop", () => {
    actions.stagePlan([
      { happeningId: "moderna-collection-2026-08-31", plannedStart: "2026-08-31T17:00:00+02:00" },
      { happeningId: "ron-sexsmith", plannedStart: "2026-08-31T18:30:00+02:00" },
    ]);
    actions.lockPlanStop("stop-1");
    actions.acceptStagedChanges();
    const acceptedBefore = structuredClone(state.currentPlan);
    actions.applyLiveUpdate({
      id: "demo-update-august-31",
      happeningId: "ron-sexsmith",
      availability: "sold_out",
      label: "Demo live-status simulation",
      source: "demo_simulation",
      appliedAt: "2026-08-31T16:35:00.000Z",
    });

    const repair = actions.repairPlan({
      reason: "Ron Sexsmith became unavailable",
      preserveLockedStops: true,
      replacementHappeningIds: ["forro-dance"],
    });

    expect(repair).toMatchObject({ ok: false, code: "NO_REPAIR_FOUND" });
    expect(state.stagedPlan).toBeNull();
    expect(state.currentPlan?.stops[0]).toEqual(acceptedBefore?.stops[0]);
    expect(state.currentPlan?.stops[1]).toMatchObject({ kind: "happening", happeningId: "ron-sexsmith" });
    expect(Date.parse(state.currentPlan?.stops[1].plannedEnd ?? "")).toBeGreaterThan(
      Date.parse(state.currentPlan?.stops[1].plannedStart ?? ""),
    );
  });

  it("accepts or rejects staged state explicitly", () => {
    actions.stagePlan(initialStops);
    const rejection = actions.rejectStagedChanges();
    expect(rejection.ok).toBe(true);
    expect(state.currentPlan).toBeNull();
    expect(state.stagedPlan).toBeNull();

    actions.stagePlan(initialStops);
    actions.acceptStagedChanges();
    expect(state.currentPlan?.status).toBe("accepted");
    expect(state.stagedPlan).toBeNull();
  });

  it("switches cities without carrying plan state or inventory across", () => {
    actions.stagePlan(initialStops);
    actions.switchCity("san-francisco");

    expect(state.activeCityId).toBe("san-francisco");
    expect(state.happenings).toHaveLength(12);
    expect(state.happenings.every((item) => item.cityId === "san-francisco")).toBe(true);
    expect(state.currentPlan).toBeNull();
    expect(state.stagedPlan).toBeNull();
    expect(actions.readCurrentPlan()).toMatchObject({
      ok: true,
      city: { id: "san-francisco", currency: "USD" },
    });

    const sanFranciscoPlan = actions.stagePlan([
      { happeningId: "sf-crucial-reggae", plannedStart: "2026-08-30T16:30:00-07:00" },
      { happeningId: "sf-haight-laughsbury", plannedStart: "2026-08-30T19:15:00-07:00" },
      { happeningId: "sf-sindustry", plannedStart: "2026-08-30T21:15:00-07:00" },
    ]);
    expect(sanFranciscoPlan.ok).toBe(true);
    expect(state.stagedPlan?.constraints.currency).toBe("USD");
  });

  it("does not initialize San Francisco with expired August 30 cards on August 31", () => {
    const sanFranciscoState = createInitialState(
      "san-francisco",
      new Date("2026-08-31T12:00:00.000Z"),
    );

    expect(sanFranciscoState.visibleHappeningIds).toEqual([]);
  });

  it("keeps an empty Stockholm Later result separate from populated Tomorrow records", () => {
    state = createInitialState("stockholm", new Date("2026-09-01T05:30:00.000Z"));
    actions = new LocalBuzzActions(
      () => state,
      (next) => { state = next; },
    );
    const laterWindow = getSearchWindow(
      "later",
      "2026-09-01",
      "Europe/Stockholm",
      new Date("2026-09-01T05:30:00.000Z"),
    );
    const tomorrowWindow = getSearchWindow(
      "tomorrow",
      "2026-09-01",
      "Europe/Stockholm",
      new Date("2026-09-01T05:30:00.000Z"),
    );

    const later = actions.searchHappenings({ ...laterWindow, maxResults: state.happenings.length });
    const tomorrow = actions.searchHappenings({ ...tomorrowWindow, maxResults: state.happenings.length });

    expect(later).toMatchObject({ ok: true, count: 0 });
    expect(tomorrow).toMatchObject({ ok: true, count: 1 });
  });
});
