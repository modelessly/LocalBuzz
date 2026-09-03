import { describe, expect, it } from "vitest";
import { getCityDefinition } from "../data/cities";
import { createInitialState, LocalBuzzActions } from "./store";
import type { CityId, LocalBuzzState } from "./types";

const now = new Date("2026-09-02T12:00:00.000Z");

const setup = (cityId: CityId) => {
  let state: LocalBuzzState = createInitialState(cityId, now);
  const actions = new LocalBuzzActions(() => state, (next) => { state = next; }, () => now);
  return { actions, read: () => state };
};

describe.each(["stockholm", "san-francisco"] as const)("%s Place fallback", (cityId) => {
  it("opens with at least twelve canonical Places when no event is current", () => {
    const state = createInitialState(cityId, new Date("2026-10-02T12:00:00.000Z"));
    expect(state).toMatchObject({ discoveryMode: "places", eventInventory: { currentCount: 0 } });
    expect(state.visiblePlaceIds.length).toBeGreaterThanOrEqual(12);
  });

  it("adds the default two-stop fallback within hours, time and party budget", () => {
    const { actions, read } = setup(cityId);
    const city = getCityDefinition(cityId);
    for (const stop of city.placeFallbackPlan) {
      const offset = cityId === "stockholm" ? "+02:00" : "-07:00";
      const result = actions.addPlaceStop({
        placeId: stop.placeId,
        purpose: stop.purpose,
        plannedStart: `2026-09-02T${stop.localTime.slice(0, 5)}:00${offset}`,
      });
      expect(result.ok).toBe(true);
    }
    const plan = read().currentPlan;
    expect(plan?.stops).toHaveLength(2);
    expect(plan?.constraints).toMatchObject({ partySize: 2, currency: city.currency, budget: city.constraints.budget });
    expect(plan?.totalEstimatedCost).toBeLessThanOrEqual(city.constraints.budget);
    expect(new Date(plan?.endTime ?? 0).getTime()).toBeLessThanOrEqual(new Date(plan?.constraints.latestEndTime ?? 0).getTime());
    expect(plan?.stops[0].plannedEnd).not.toBe(plan?.stops[1].plannedStart);
    expect(Date.parse(plan?.stops[0].plannedEnd ?? "")).toBeLessThan(Date.parse(plan?.stops[1].plannedStart ?? ""));
  });

  it("offers at least two operational alternatives for the drinks stop", () => {
    const { actions } = setup(cityId);
    const city = getCityDefinition(cityId);
    const openAt = cityId === "stockholm" ? "2026-09-02T20:00:00+02:00" : "2026-09-02T20:00:00-07:00";
    const result = actions.searchPlaces({
      purposes: ["drinks"],
      openAt,
      maxPrice: city.constraints.budget / city.constraints.partySize,
      near: city.constraints.startLocation,
      maxDistanceKm: city.searchDefaults.maxDistanceKm,
      maxResults: 33,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const operational = result.places.filter((place) => place.priceRange.min !== undefined && Object.keys(place.weeklyHours).length > 0);
      expect(operational.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("Place catalog subset and shared inventory", () => {
  it("restores all Places after candidate surfacing without changing the current plan", () => {
    const { actions, read } = setup("san-francisco");
    actions.addPlaceStop({ placeId: "sf-horsefeather", purpose: "dinner", plannedStart: "2026-09-02T18:00:00-07:00" });
    const before = structuredClone(read().currentPlan);
    actions.showPlaceCandidates(["sf-trick-dog", "sf-benders"], "Two agent choices");
    expect(read()).toMatchObject({ visiblePlaceIds: ["sf-trick-dog", "sf-benders"], candidatePlaceIds: ["sf-trick-dog", "sf-benders"] });
    actions.showPlaceListings(read().places.map((place) => place.id), "Full catalog restored.");
    expect(read().visiblePlaceIds).toHaveLength(33);
    expect(read().candidatePlaceIds).toEqual([]);
    expect(read().currentPlan).toEqual(before);
  });

});
