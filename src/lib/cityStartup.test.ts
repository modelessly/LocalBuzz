import { describe, expect, it } from "vitest";
import { eventSourceDescriptorsForCity } from "../data/eventSources";
import { createInitialState, LocalBuzzActions } from "../domain/store";
import type { CityId, Happening, LocalBuzzState } from "../domain/types";
import type { CityEventSnapshotPayload, CityEventSourceStatus } from "./cityEvents";
import { refreshCityData, refreshCityPulseData } from "./cityStartup";
import type { CityPulsePayload } from "./cityPulse";

const now = new Date("2026-09-02T12:00:00.000Z");

const event = (cityId: CityId, id: string, start = "2026-09-03T19:00:00.000Z"): Happening => ({
  id,
  cityId,
  title: `Event ${id}`,
  category: "live_music",
  venue: cityId === "stockholm"
    ? { name: "Nalen", address: "Regeringsgatan 74", neighborhood: "Norrmalm", lat: 59.337, lng: 18.0665 }
    : { name: "The Chapel", address: "777 Valencia Street", neighborhood: "Mission", lat: 37.7605, lng: -122.4213 },
  timing: { start, end: new Date(Date.parse(start) + 90 * 60_000).toISOString() },
  commerce: { priceMin: cityId === "stockholm" ? 200 : 20, currency: cityId === "stockholm" ? "SEK" : "USD" },
  status: { availability: "available" },
  source: { name: "Test official source", url: `https://example.com/${id}`, fetchedAt: now.toISOString(), lastVerifiedAt: now.toISOString() },
});

const source = (overrides: Partial<CityEventSourceStatus> = {}): CityEventSourceStatus => ({
  sourceId: "test-source",
  publisher: "Test official source",
  status: "fresh",
  attemptedAt: now.toISOString(),
  lastSuccessfulRefresh: now.toISOString(),
  eventCount: 1,
  rejectedCount: 0,
  retainedCount: 0,
  expiredCount: 0,
  emptySuccessful: false,
  ...overrides,
});

const snapshot = (cityId: CityId, happenings: Happening[], sources = [source({ eventCount: happenings.length })]): CityEventSnapshotPayload => ({
  cityId,
  generatedAt: now.toISOString(),
  retained: false,
  happenings,
  sources,
});

const setup = (cityId: CityId = "san-francisco") => {
  let state: LocalBuzzState = createInitialState(cityId, now);
  const actions = new LocalBuzzActions(() => state, (next) => { state = next; }, () => now);
  return { actions, read: () => state };
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe("unified city startup", () => {
  const pulse = (cityId: CityId, placeName: string): CityPulsePayload => ({
    generatedAt: now.toISOString(), cityId, city: cityId === "stockholm" ? "Stockholm" : "San Francisco", status: "fresh",
    signals: [{ id: `${cityId}-pulse`, kind: "live_signal", title: "Fresh nearby activity", summary: "Reported now.", category: "social", location: { name: placeName, neighborhood: "Central" }, timing: { firstSeen: "2026-09-02T11:30:00.000Z", latestSeen: "2026-09-02T11:50:00.000Z", likelyActiveUntil: "2026-09-02T14:00:00.000Z" }, social: { evidenceCount: 2, independentSourceCount: 2, sourceAccounts: ["one", "two"], confidence: 0.8, sourceUrls: ["https://x.com/one/status/1", "https://x.com/two/status/2"] }, tags: [], reasonActionable: "Two current reports support it.", freshnessMinutes: 10, actionableNow: true, buzzScore: 80, buzzLabel: "Very Hot" }],
  });

  it("applies an available cold-start snapshot while keeping the Place catalog immediate", async () => {
    const { actions, read } = setup();
    expect(read().places).toHaveLength(33);
    const descriptors = eventSourceDescriptorsForCity("san-francisco");
    const permitted = descriptors.filter((item) => item.enabled);
    const events = permitted.map((item, index) => ({ ...event("san-francisco", `fresh-${index}`), source: { name: item.publisher, url: `https://example.com/fresh-${index}`, fetchedAt: now.toISOString(), lastVerifiedAt: now.toISOString() } }));
    const sources = descriptors.map((item) => source({ sourceId: item.sourceId, publisher: item.publisher, status: item.enabled ? "fresh" : "disabled", eventCount: item.enabled ? 1 : 0, message: item.enabled ? undefined : item.disabledReason }));
    const result = await refreshCityData({ cityId: "san-francisco", refreshId: "available", actions, loader: async () => snapshot("san-francisco", events, sources), now: () => now });
    expect(result).toMatchObject({ ok: true, applied: true, currentCount: permitted.length, placeCount: 33 });
    expect(read().eventInventory.sources.filter((item) => item.status === "fresh")).toHaveLength(permitted.length);
  });

  it("keeps useful Places visible when every provider is unavailable", async () => {
    const { actions, read } = setup();
    const unavailable = eventSourceDescriptorsForCity("san-francisco").map((item) => source({ sourceId: item.sourceId, publisher: item.publisher, status: item.enabled ? "unavailable" : "disabled", eventCount: 0, message: "Provider unavailable." }));
    await refreshCityData({ cityId: "san-francisco", refreshId: "unavailable", actions, loader: async () => snapshot("san-francisco", [], unavailable), now: () => now });
    expect(read()).toMatchObject({ discoveryMode: "places", visiblePlaceIds: { length: 33 }, eventInventory: { currentCount: 0, refreshing: false } });
    expect(read().eventInventory.sources.some((item) => item.status === "unavailable")).toBe(true);
  });

  it("updates the already-open shared state after a delayed collector succeeds", async () => {
    const { actions, read } = setup();
    const pending = deferred<CityEventSnapshotPayload>();
    const running = refreshCityData({ cityId: "san-francisco", refreshId: "delayed", actions, loader: async () => pending.promise, now: () => now });
    expect(read()).toMatchObject({ discoveryMode: "places", eventInventory: { refreshing: true, currentCount: 0 } });
    pending.resolve(snapshot("san-francisco", [event("san-francisco", "delayed-event")]));
    await expect(running).resolves.toMatchObject({ ok: true, applied: true, currentCount: 1 });
    expect(actions.searchHappenings({ query: "delayed-event" })).toMatchObject({ ok: true, count: 1 });
  });

  it("surfaces a timeout and preserves the baseline instead of hanging", async () => {
    const { actions, read } = setup();
    const loader = async (_cityId: CityId, signal?: AbortSignal) => new Promise<CityEventSnapshotPayload>((_resolve, reject) => signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    await refreshCityData({ cityId: "san-francisco", refreshId: "timeout", actions, loader, timeoutMs: 5, now: () => now });
    expect(read().eventInventory.refreshing).toBe(false);
    expect(read().eventInventory.sources.filter((item) => item.status === "unavailable").every((item) => item.message?.includes("timed out"))).toBe(true);
    expect(read().places).toHaveLength(33);
  });

  it("distinguishes an empty successful refresh", async () => {
    const { actions, read } = setup();
    await refreshCityData({ cityId: "san-francisco", refreshId: "empty", actions, loader: async () => snapshot("san-francisco", [], [source({ eventCount: 0, emptySuccessful: true })]), now: () => now });
    expect(read().eventInventory.sources.find((item) => item.sourceId === "test-source")).toMatchObject({ status: "fresh", emptySuccessful: true, acceptedCount: 0 });
  });

  it("marks malformed collector responses invalid without exposing the raw response", async () => {
    const { actions, read } = setup();
    await refreshCityData({ cityId: "san-francisco", refreshId: "malformed", actions, loader: async () => { throw new Error("malformed raw provider payload with secret=abc"); }, now: () => now });
    const invalid = read().eventInventory.sources.find((item) => item.status === "invalid");
    expect(invalid?.message).toBe("The collector returned an invalid response.");
    expect(invalid?.message).not.toContain("secret");
  });

  it("retains expired provenance but excludes expired events from current results", async () => {
    const { actions, read } = setup();
    const expired = event("san-francisco", "expired", "2026-08-30T19:00:00.000Z");
    await refreshCityData({ cityId: "san-francisco", refreshId: "expired", actions, loader: async () => snapshot("san-francisco", [expired]), now: () => now });
    expect(read().happenings.some((item) => item.id === "expired")).toBe(true);
    expect(read().eventInventory).toMatchObject({ currentCount: 0 });
    expect(read().visibleHappeningIds).not.toContain("expired");
  });

  it("ignores an older request that completes after a newer snapshot", async () => {
    const { actions, read } = setup();
    const oldPending = deferred<CityEventSnapshotPayload>();
    const newPending = deferred<CityEventSnapshotPayload>();
    const oldRun = refreshCityData({ cityId: "san-francisco", refreshId: "old", actions, loader: async () => oldPending.promise, now: () => now });
    const newRun = refreshCityData({ cityId: "san-francisco", refreshId: "new", actions, loader: async () => newPending.promise, now: () => now });
    newPending.resolve(snapshot("san-francisco", [event("san-francisco", "newer")]));
    await newRun;
    oldPending.resolve(snapshot("san-francisco", [event("san-francisco", "older")]));
    await expect(oldRun).resolves.toMatchObject({ ok: true, applied: false });
    expect(read().eventInventory.refreshId).toBe("new");
    expect(read().eventInventory.currentCount).toBe(1);
    expect(read().happenings.some((item) => item.id === "older")).toBe(false);
  });

  it("ignores a result when the user switches cities during refresh", async () => {
    const { actions, read } = setup("san-francisco");
    const pending = deferred<CityEventSnapshotPayload>();
    const running = refreshCityData({ cityId: "san-francisco", refreshId: "switch", actions, loader: async () => pending.promise, now: () => now });
    actions.switchCity("stockholm");
    pending.resolve(snapshot("san-francisco", [event("san-francisco", "wrong-city-result")]));
    await expect(running).resolves.toMatchObject({ ok: true, applied: false });
    expect(read()).toMatchObject({ activeCityId: "stockholm", places: { length: 33 } });
    expect(read().happenings.some((item) => item.id === "wrong-city-result")).toBe(false);
  });

  it("never changes the current plan when inventory refreshes", async () => {
    const { actions, read } = setup("san-francisco");
    actions.addPlaceStop({ placeId: "sf-horsefeather", purpose: "dinner", plannedStart: "2026-09-02T18:00:00-07:00" });
    const before = structuredClone(read().currentPlan);
    await refreshCityData({ cityId: "san-francisco", refreshId: "plan-safe", actions, loader: async () => snapshot("san-francisco", [event("san-francisco", "plan-safe-event")]), now: () => now });
    expect(read().currentPlan).toEqual(before);
  });

  it("applies pulse independently without changing the current plan", async () => {
    const { actions, read } = setup("san-francisco");
    actions.addPlaceStop({ placeId: "sf-horsefeather", purpose: "dinner", plannedStart: "2026-09-02T18:00:00-07:00" });
    const before = structuredClone(read().currentPlan);
    const result = await refreshCityPulseData({ cityId: "san-francisco", actions, loader: async () => pulse("san-francisco", "Horsefeather"), now: () => now });
    expect(result).toMatchObject({ ok: true, applied: true, liveSignalCount: 1 });
    expect(read().currentPlan).toEqual(before);
    expect(read().eventInventory.sources.at(-1)).toMatchObject({ sourceId: "xai-san-francisco-social-pulse", status: "fresh" });
  });

  it("degrades pulse failure without erasing canonical inventory", async () => {
    const { actions, read } = setup("stockholm");
    const before = read().happenings.length;
    await refreshCityPulseData({ cityId: "stockholm", actions, loader: async () => { throw new Error("provider secret detail"); }, now: () => now });
    expect(read().happenings).toHaveLength(before);
    expect(read().eventInventory.sources.at(-1)).toMatchObject({ sourceId: "xai-stockholm-social-pulse", status: "unavailable", message: "Social pulse is unavailable; canonical events are unchanged." });
    expect(read().eventInventory.sources.at(-1)?.message).not.toContain("secret");
  });
});
