import { describe, expect, it, vi } from "vitest";
import { createInitialState, LocalBuzzActions } from "../domain/store";
import type { LocalBuzzState } from "../domain/types";
import { createWebMcpTools, registerWebMcp } from "./register";

const setup = () => {
  let state: LocalBuzzState = createInitialState("stockholm");
  const actions = new LocalBuzzActions(() => state, (next) => { state = next; }, () => new Date("2026-08-30T12:00:00Z"));
  return { actions, read: () => state };
};

describe("WebMCP registration", () => {
  it("exposes sixteen static discovery and direct-plan tools with strict schemas", () => {
    const names = createWebMcpTools(setup().actions).map((tool) => tool.name);
    expect(names).toEqual([
      "propose_event_from_url", "propose_place_from_url", "search_happenings", "show_candidates",
      "search_places", "show_place_candidates", "read_place_details", "add_place_stop",
      "add_custom_place_stop", "add_happening_stop", "build_evening_plan", "read_current_plan",
      "lock_plan_stop", "unlock_plan_stop", "remove_plan_stop", "repair_plan",
    ]);
    expect(names.some((name) => name.includes("staged") || name.startsWith("stage_"))).toBe(false);
    for (const tool of createWebMcpTools(setup().actions)) {
      expect(tool.description.length).toBeGreaterThan(50);
      expect(tool.inputSchema?.additionalProperties).toBe(false);
    }
  });

  it("lets an agent build and extend the same canonical mixed plan used by the UI", async () => {
    const { actions, read } = setup();
    const tools = new Map(createWebMcpTools(actions).map((tool) => [tool.name, tool]));
    const options = { signal: new AbortController().signal };
    await tools.get("build_evening_plan")?.execute({ stops: [{ happeningId: "fringe-closing", plannedStart: "2026-08-30T17:30:00+02:00" }] }, options);
    await tools.get("add_place_stop")?.execute({ placeId: "sthlm-tjoget", purpose: "drinks", plannedStart: "2026-08-30T19:30:00+02:00" }, options);
    expect(read().currentPlan?.stops.map((stop) => stop.kind)).toEqual(["happening", "place"]);
    expect(actions.readCurrentPlan()).toMatchObject({ ok: true, currentPlan: { stops: [{ status: "active" }, { status: "active" }] } });
  });

  it("adds an event, locks, unlocks and removes through direct tools", async () => {
    const { actions, read } = setup();
    const tools = new Map(createWebMcpTools(actions).map((tool) => [tool.name, tool]));
    const options = { signal: new AbortController().signal };
    await tools.get("add_happening_stop")?.execute({ happeningId: "fringe-closing", plannedStart: "2026-08-30T17:30:00+02:00" }, options);
    expect(read().currentPlan?.stops).toHaveLength(1);
    await tools.get("lock_plan_stop")?.execute({ stopId: "stop-1" }, options);
    expect(read().currentPlan?.stops[0].locked).toBe(true);
    await tools.get("unlock_plan_stop")?.execute({ stopId: "stop-1" }, options);
    expect(read().currentPlan?.stops[0].locked).toBe(false);
    await tools.get("remove_plan_stop")?.execute({ stopId: "stop-1" }, options);
    expect(read().currentPlan).toBeNull();
  });

  it("keeps agent removal from bypassing locked-stop protection", async () => {
    const { actions, read } = setup();
    const tools = new Map(createWebMcpTools(actions).map((tool) => [tool.name, tool]));
    const options = { signal: new AbortController().signal };
    await tools.get("add_happening_stop")?.execute({ happeningId: "fringe-closing", plannedStart: "2026-08-30T17:30:00+02:00" }, options);
    await tools.get("lock_plan_stop")?.execute({ stopId: "stop-1" }, options);
    expect(await tools.get("remove_plan_stop")?.execute({ stopId: "stop-1" }, options)).toMatchObject({ ok: false, code: "LOCKED_STOP_CONFLICT" });
    expect(read().currentPlan?.stops).toHaveLength(1);
  });

  it("returns qualified Place filters and source evidence", async () => {
    const { actions, read } = setup();
    const tools = new Map(createWebMcpTools(actions).map((tool) => [tool.name, tool]));
    const result = await tools.get("search_places")?.execute({ purposes: ["drinks"], kinds: ["pub"], moods: ["relaxed"], neighborhoods: ["Södermalm"], maxPrice: 200, openAt: "2026-08-30T20:00:00+02:00", maxResults: 20 }, { signal: new AbortController().signal });
    expect(result).toMatchObject({ ok: true, count: 1 });
    expect((result as { places: Array<Record<string, unknown>> }).places[0]).toMatchObject({ id: "sthlm-stigbergets-fot", openingHoursEvidence: { status: "verified" } });
    expect(await tools.get("show_place_candidates")?.execute({ placeIds: ["sthlm-stigbergets-fot"], reason: "Agent-selected pub" }, { signal: new AbortController().signal })).toMatchObject({ ok: true, visibleCount: 1 });
    expect(read()).toMatchObject({ discoveryMode: "places", candidatePlaceIds: ["sthlm-stigbergets-fot"], candidateReasonOrigin: "agent" });
  });

  it("exposes social kind, Buzz Score and actionability filters without changing existing calls", async () => {
    const { actions, read } = setup();
    read().happenings.push({ ...read().happenings[0], id: "pulse-filter-test", kind: "live_signal", socialPulse: {
      evidenceCount: 2, independentSourceCount: 2, sourceAccounts: ["one", "two"], confidence: 0.78,
      latestSeen: "2026-08-30T11:50:00.000Z", likelyActiveUntil: "2026-08-30T14:00:00.000Z",
      sourceUrls: ["https://x.com/one/status/1", "https://x.com/two/status/2"], freshnessMinutes: 10,
      actionableNow: true, buzzScore: 82, buzzLabel: "Very Hot", reasonActionable: "The activity is currently underway.",
    } });
    const tool = createWebMcpTools(actions).find((item) => item.name === "search_happenings");
    const result = await tool?.execute({ happeningKinds: ["live_signal"], minBuzzScore: 80, actionableNow: true }, { signal: new AbortController().signal });
    expect(result).toMatchObject({ ok: true, count: 1, happenings: [{ id: "pulse-filter-test", kind: "live_signal", socialPulse: { buzzScore: 82 } }] });
  });

  it("registers every tool with a shared abort lifecycle", async () => {
    const signals: AbortSignal[] = [];
    const modelContext: WebMcpModelContext = { registerTool: vi.fn(async (_tool, options) => { if (options?.signal) signals.push(options.signal); }) };
    const status = vi.fn();
    const cleanup = registerWebMcp(setup().actions, status, modelContext);
    await vi.waitFor(() => expect(status).toHaveBeenCalledWith("available"));
    expect(modelContext.registerTool).toHaveBeenCalledTimes(16);
    cleanup();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("creates discovery leads without changing the current itinerary", async () => {
    const { actions, read } = setup();
    const tools = new Map(createWebMcpTools(actions).map((tool) => [tool.name, tool]));
    const before = structuredClone(read().currentPlan);
    const result = await tools.get("propose_event_from_url")?.execute({
      cityId: "stockholm", sourceUrl: "https://venue.example/new-show", sourceType: "official_page",
      fields: { title: "Agent-found show", category: "live_music", venue: { name: "Nalen", address: "Regeringsgatan 74, Stockholm", neighborhood: "Norrmalm", lat: 59.337, lng: 18.0665 }, timing: { start: "2026-09-05T19:00:00+02:00", end: "2026-09-05T21:00:00+02:00" }, commerce: { currency: "SEK", priceMin: 200 } },
      evidence: [{ field: "title", sourceUrl: "https://venue.example/new-show", note: "Official page title" }],
    }, { signal: new AbortController().signal });
    expect(result).toMatchObject({ ok: true, lead: { leadType: "event", verificationStatus: "provisional" } });
    expect(read().discoveryLeads).toHaveLength(1);
    expect(read().currentPlan).toEqual(before);
  });
});
