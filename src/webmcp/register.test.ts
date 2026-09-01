import { describe, expect, it, vi } from "vitest";
import { createInitialState, LocalBuzzActions } from "../domain/store";
import type { LocalBuzzState } from "../domain/types";
import { createWebMcpTools, registerWebMcp } from "./register";

const setup = () => {
  let state: LocalBuzzState = createInitialState("stockholm");
  const actions = new LocalBuzzActions(
    () => state,
    (next) => {
      state = next;
    },
  );
  return { actions, read: () => state };
};

describe("WebMCP registration", () => {
  it("exposes the fifteen static acquisition, event, place and shared-plan tools with strict schemas", () => {
    const { actions } = setup();
    const tools = createWebMcpTools(actions);
    expect(tools.map((tool) => tool.name)).toEqual([
      "propose_event_from_url",
      "propose_place_from_url",
      "search_happenings",
      "show_candidates",
      "search_places",
      "show_place_candidates",
      "read_place_details",
      "stage_place_stop",
      "stage_custom_place",
      "stage_evening_plan",
      "read_current_plan",
      "lock_plan_stop",
      "repair_plan",
      "accept_staged_changes",
      "reject_staged_changes",
    ]);
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(50);
      expect(tool.inputSchema?.additionalProperties).toBe(false);
    }
  });

  it("lets an agent stage the same mixed canonical and custom place stops as the UI", async () => {
    const { actions, read } = setup();
    const tools = new Map(createWebMcpTools(actions).map((tool) => [tool.name, tool]));
    const options = { signal: new AbortController().signal };
    await tools.get("stage_evening_plan")?.execute({ stops: [{ happeningId: "ukraine-festival", plannedStart: "2026-08-30T18:00:00+02:00" }] }, options);
    await tools.get("stage_place_stop")?.execute({ placeId: "sthlm-tjoget", purpose: "drinks", plannedStart: "2026-08-30T20:00:00+02:00" }, options);
    const details = await tools.get("read_place_details")?.execute({ placeId: "sthlm-tjoget" }, options);
    expect(details).toMatchObject({ ok: true, place: { verification: { status: "verified" } } });
    expect(read().stagedPlan?.stops.map((stop) => stop.kind)).toEqual(["happening", "place"]);
    expect(actions.readCurrentPlan()).toMatchObject({ ok: true, stagedPlan: { status: "staged" } });
  });

  it("exposes qualified Place filters and operational evidence through search_places", async () => {
    const { actions } = setup();
    const tools = new Map(createWebMcpTools(actions).map((tool) => [tool.name, tool]));
    const result = await tools.get("search_places")?.execute({
      purposes: ["drinks"], kinds: ["pub"], moods: ["relaxed"], neighborhoods: ["Södermalm"],
      maxPrice: 200, openAt: "2026-08-30T20:00:00+02:00", maxResults: 20,
    }, { signal: new AbortController().signal });

    expect(result).toMatchObject({ ok: true, count: 1 });
    const place = (result as { places: Array<Record<string, unknown>> }).places[0];
    expect(place).toMatchObject({
      id: "sthlm-stigbergets-fot",
      openingHoursEvidence: { status: "verified" },
      verification: { status: "needs_review" },
    });
    expect(place.officialWebsite).toMatch(/^https:\/\//);
  });

  it("tool execution mutates the exact shared state used by UI actions", async () => {
    const { actions, read } = setup();
    const tools = new Map(createWebMcpTools(actions).map((tool) => [tool.name, tool]));
    const options = { signal: new AbortController().signal };

    await tools.get("show_candidates")?.execute(
      { happeningIds: ["forro-dance"], reason: "Agent pick" },
      options,
    );
    expect(read().candidateHappeningIds).toEqual(["forro-dance"]);

    await tools.get("stage_evening_plan")?.execute(
      {
        stops: [
          { happeningId: "forro-dance", plannedStart: "2026-08-30T18:00:00+02:00" },
          { happeningId: "weeping-willows", plannedStart: "2026-08-30T19:30:00+02:00" },
        ],
      },
      options,
    );
    expect(read().stagedPlan?.stops).toHaveLength(2);

    await tools.get("lock_plan_stop")?.execute({ stopId: "stop-2" }, options);
    expect(read().stagedPlan?.stops[1].locked).toBe(true);
    expect(actions.readCurrentPlan()).toMatchObject({
      ok: true,
      stagedPlan: { stops: [{ locked: false }, { locked: true }] },
    });
  });

  it("owns registration lifecycle with an AbortSignal", async () => {
    const { actions } = setup();
    const signals: AbortSignal[] = [];
    const modelContext: WebMcpModelContext = {
      registerTool: vi.fn(async (_tool, options) => {
        if (options?.signal) signals.push(options.signal);
      }),
    };
    const status = vi.fn();
    const cleanup = registerWebMcp(actions, status, modelContext);
    await vi.waitFor(() => expect(status).toHaveBeenCalledWith("available"));
    expect(modelContext.registerTool).toHaveBeenCalledTimes(15);
    cleanup();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("uses the registration signal when the browser omits execution options", async () => {
    const { actions, read } = setup();
    const registered = new Map<string, WebMcpTool>();
    const modelContext: WebMcpModelContext = {
      registerTool: vi.fn(async (tool) => {
        registered.set(tool.name, tool);
      }),
    };
    const activity = vi.fn();
    registerWebMcp(actions, vi.fn(), modelContext, activity);
    await vi.waitFor(() => expect(registered.size).toBe(15));

    await registered.get("show_candidates")?.execute(
      { happeningIds: ["forro-dance"] },
      undefined as unknown as { signal: AbortSignal },
    );

    expect(read().candidateHappeningIds).toEqual(["forro-dance"]);
    expect(activity).toHaveBeenCalledWith(expect.objectContaining({ status: "complete" }));
  });

  it("stages agent URL proposals in the same discovery-lead state used by the review UI", async () => {
    const { actions, read } = setup();
    const tools = new Map(createWebMcpTools(actions).map((tool) => [tool.name, tool]));
    const result = await tools.get("propose_event_from_url")?.execute({
      cityId: "stockholm", sourceUrl: "https://venue.example/new-show", sourceType: "official_page",
      fields: { title: "Agent-found show", category: "live_music", venue: { name: "Nalen", address: "Regeringsgatan 74, Stockholm", neighborhood: "Norrmalm", lat: 59.337, lng: 18.0665 }, timing: { start: "2026-09-05T19:00:00+02:00", end: "2026-09-05T21:00:00+02:00" }, commerce: { currency: "SEK", priceMin: 200 } },
      evidence: [{ field: "title", sourceUrl: "https://venue.example/new-show", note: "Official page title" }],
    }, { signal: new AbortController().signal });
    expect(result).toMatchObject({ ok: true, lead: { leadType: "event", verificationStatus: "provisional" } });
    expect(read().discoveryLeads).toHaveLength(1);
    expect(read().happenings.some((item) => item.title === "Agent-found show")).toBe(false);

    const placeResult = await tools.get("propose_place_from_url")?.execute({
      cityId: "stockholm", sourceUrl: "https://bar.example/", sourceType: "official_page",
      fields: { name: "Agent-found bar", kind: "bar", location: { address: "Barvägen 1, Stockholm", neighborhood: "Norrmalm", lat: 59.335, lng: 18.066 }, typicalVisitDurationMinutes: 60, priceRange: { min: 100, max: 200, currency: "SEK", basis: "per_person", band: "moderate", evidence: "official_menu", evidenceUrl: "https://bar.example/menu" } },
      evidence: [{ field: "name", sourceUrl: "https://bar.example/", note: "Official page" }],
    }, { signal: new AbortController().signal });
    expect(placeResult).toMatchObject({ ok: true, lead: { leadType: "place" } });
    expect(read().discoveryLeads.map((lead) => lead.leadType)).toEqual(["place", "event"]);
  });
});
