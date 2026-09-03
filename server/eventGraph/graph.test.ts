import { describe, expect, it } from "vitest";
import { getCityDefinition } from "../../src/data/cities";
import { buildEventGraph, graphRefreshDue, stableGraphNodeId } from "./graph";

describe("bounded event graph", () => {
  const happening = getCityDefinition("san-francisco").happenings[0];

  it("creates stable trusted identities and provenance edges", () => {
    const graph = buildEventGraph({ seeds: [{ happening, performer: { type: "performer", stableId: "artist-1", name: "Known Artist" } }], existingHappenings: [happening], now: new Date("2026-09-01T00:00:00Z") });
    expect(graph.nodes.some((node) => node.type === "venue" && node.trust === "trusted")).toBe(true);
    expect(graph.nodes.some((node) => node.type === "performer" && node.stableId === "artist-1")).toBe(true);
    expect(graph.edges.every((edge) => edge.sourceUrl && edge.observedAt)).toBe(true);
  });

  it("rejects arbitrary domains, excessive depth and duplicate edges", () => {
    const parentNodeId = stableGraphNodeId({ type: "event", stableId: happening.id, name: happening.title, canonicalUrl: happening.source.url });
    const identity = { type: "event" as const, stableId: "related-1", name: "Related" };
    const candidate = { parentNodeId, relation: "related_official_event" as const, identity, sourceUrl: "https://untrusted.example/event", sourceId: "unknown", action: "propose_allowlisted_source" as const };
    const graph = buildEventGraph({ seeds: [{ happening }], candidates: [candidate], existingHappenings: [happening] });
    expect(graph.rejected[0].reason).toContain("allowlisted");
  });

  it("rejects a relationship that points an existing child back to its ancestor", () => {
    const eventNodeId = stableGraphNodeId({ type: "event", stableId: happening.id, name: happening.title, canonicalUrl: happening.source.url });
    const venueNodeId = stableGraphNodeId({ type: "venue", name: happening.venue.name });
    const graph = buildEventGraph({ seeds: [{ happening }], candidates: [{ parentNodeId: venueNodeId, relation: "related_official_event", identity: { type: "event", stableId: happening.id, name: happening.title, canonicalUrl: happening.source.url }, sourceUrl: "https://www.sfjazz.org/events", sourceId: "venue-san-francisco-sfjazz", action: "suggest_duplicate" }], existingHappenings: [happening] });
    expect(graph.nodes.some((node) => node.id === eventNodeId)).toBe(true);
    expect(graph.rejected[0].reason).toContain("cycle");
  });

  it("creates review-only discovery leads and enforces query limits", () => {
    const parentNodeId = stableGraphNodeId({ type: "event", stableId: happening.id, name: happening.title, canonicalUrl: happening.source.url });
    const leadCandidate = { parentNodeId, relation: "related_official_event" as const, identity: { type: "event" as const, stableId: "related-2", name: "Related SF Event" }, sourceUrl: "https://www.sfjazz.org/events/related", sourceId: "venue-san-francisco-sfjazz", action: "create_discovery_lead" as const, eventFields: { title: "Related SF Event", category: "live_music" as const, venue: { name: "SFJAZZ", address: "201 Franklin St, San Francisco", lat: 37.7764, lng: -122.4211 }, timing: { start: "2026-09-10T20:00:00-07:00", end: "2026-09-10T22:00:00-07:00" }, commerce: { currency: "USD" as const } }, evidence: [{ field: "date_location", sourceUrl: "https://www.sfjazz.org/events/related" }] };
    const queryCandidate = { ...leadCandidate, identity: { type: "performer" as const, stableId: "performer-2", name: "Artist" }, action: "query_existing_provider" as const };
    const graph = buildEventGraph({ seeds: [{ happening }], candidates: [leadCandidate, queryCandidate, { ...queryCandidate, identity: { ...queryCandidate.identity, stableId: "performer-3" } }], existingHappenings: [happening], limits: { maxQueries: 1 }, now: new Date("2026-09-01T00:00:00Z") });
    expect(graph.leads[0]).toMatchObject({ leadType: "event", submittedBy: { kind: "event_graph", rootHappeningId: happening.id } });
    expect(graph.queryCount).toBe(1);
    expect(graph.rejected.some((item) => item.reason.includes("query count"))).toBe(true);
    expect(graphRefreshDue(graph, new Date("2026-09-01T05:59:00Z"))).toBe(false);
    expect(graphRefreshDue(graph, new Date("2026-09-01T06:00:00Z"))).toBe(true);
  });
});
