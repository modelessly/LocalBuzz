import { buildEventLead, validatePublicSourceUrl } from "../../src/domain/discovery";
import type { DiscoveryLead, Happening } from "../../src/domain/types";
import type { EventGraphEdge, EventGraphExpansionCandidate, EventGraphIdentity, EventGraphLimits, EventGraphNode, EventGraphSeed, EventGraphSnapshot } from "./types";

export const DEFAULT_EVENT_GRAPH_LIMITS: EventGraphLimits = {
  maxDepth: 2,
  maxQueries: 8,
  maxRecords: 40,
  allowedDomains: ["ticketmaster.com", "visitsweden.com", "debaser.se", "sfjazz.org", "bandsintown.com"],
  refreshIntervalMinutes: 6 * 60,
};

const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const hash = (value: string) => {
  let result = 2166136261;
  for (const character of value) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }
  return (result >>> 0).toString(16).padStart(8, "0");
};

export function stableGraphNodeId(identity: EventGraphIdentity): string {
  const external = identity.stableId?.trim() || identity.canonicalUrl?.trim() || normalize(identity.name);
  return `graph-${identity.type}-${hash(`${identity.type}|${external}`)}`;
}

const domainAllowed = (value: string, allowedDomains: string[]) => {
  const checked = validatePublicSourceUrl(value);
  if (!checked.ok) return false;
  const host = new URL(checked.url).hostname.toLowerCase();
  return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
};

const edgeId = (from: string, to: string, relation: EventGraphEdge["relation"], sourceUrl: string) => `edge-${hash(`${from}|${to}|${relation}|${sourceUrl}`)}`;

const createsCycle = (fromNodeId: string, toNodeId: string, edges: Iterable<EventGraphEdge>) => {
  if (fromNodeId === toNodeId) return true;
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge.toNodeId]);
  const pending = [toNodeId]; const visited = new Set<string>();
  while (pending.length) {
    const nodeId = pending.pop()!;
    if (nodeId === fromNodeId) return true;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId); pending.push(...(outgoing.get(nodeId) ?? []));
  }
  return false;
};

function seedNodes(seed: EventGraphSeed, observedAt: string): { nodes: EventGraphNode[]; edges: EventGraphEdge[] } {
  const eventIdentity: EventGraphIdentity = { type: "event", stableId: seed.happening.id, name: seed.happening.title, canonicalUrl: seed.happening.source.url };
  const event: EventGraphNode = { ...eventIdentity, id: stableGraphNodeId(eventIdentity), cityId: seed.happening.cityId, trust: "trusted", depth: 0 };
  const identities: Array<{ identity: EventGraphIdentity; relation: EventGraphEdge["relation"]; sourceUrl: string }> = [
    { identity: { type: "venue", name: seed.happening.venue.name }, relation: "at_venue", sourceUrl: seed.happening.source.url },
  ];
  if (seed.performer) identities.push({ identity: { ...seed.performer, type: "performer" }, relation: "performed_by", sourceUrl: seed.happening.source.url });
  if (seed.organizer) identities.push({ identity: { ...seed.organizer, type: "organizer" }, relation: "organized_by", sourceUrl: seed.happening.source.url });
  if (seed.happening.commerce.bookingUrl) {
    const url = new URL(seed.happening.commerce.bookingUrl);
    identities.push({ identity: { type: "ticket_platform", name: url.hostname, canonicalUrl: `${url.protocol}//${url.hostname}` }, relation: "ticketed_by", sourceUrl: seed.happening.commerce.bookingUrl });
  }
  const nodes = [event];
  const edges: EventGraphEdge[] = [];
  for (const item of identities) {
    const node: EventGraphNode = { ...item.identity, id: stableGraphNodeId(item.identity), cityId: seed.happening.cityId, trust: "trusted", depth: 1 };
    nodes.push(node);
    edges.push({ id: edgeId(event.id, node.id, item.relation, item.sourceUrl), fromNodeId: event.id, toNodeId: node.id, relation: item.relation, sourceUrl: item.sourceUrl, observedAt, trust: "trusted" });
  }
  return { nodes, edges };
}

export function buildEventGraph(input: {
  seeds: EventGraphSeed[];
  candidates?: EventGraphExpansionCandidate[];
  existingHappenings: Happening[];
  now?: Date;
  limits?: Partial<EventGraphLimits>;
}): EventGraphSnapshot {
  if (!input.seeds.length) throw new Error("At least one trusted event seed is required.");
  const cityId = input.seeds[0].happening.cityId;
  if (input.seeds.some((seed) => seed.happening.cityId !== cityId)) throw new Error("Event graph seeds must belong to one city.");
  const now = input.now ?? new Date();
  const generatedAt = now.toISOString();
  const limits = { ...DEFAULT_EVENT_GRAPH_LIMITS, ...input.limits };
  if (limits.maxDepth < 1 || limits.maxDepth > 3 || limits.maxQueries < 0 || limits.maxQueries > 25 || limits.maxRecords < 1 || limits.maxRecords > 200) throw new Error("Event graph limits exceed the bounded contract.");

  const nodeMap = new Map<string, EventGraphNode>();
  const edgeMap = new Map<string, EventGraphEdge>();
  for (const seed of input.seeds) {
    const seeded = seedNodes(seed, generatedAt);
    for (const node of seeded.nodes) {
      const current = nodeMap.get(node.id);
      if (!current || node.depth < current.depth) nodeMap.set(node.id, node);
    }
    for (const edge of seeded.edges) edgeMap.set(edge.id, edge);
  }

  const leads: DiscoveryLead[] = [];
  const sourceProposals: EventGraphExpansionCandidate[] = [];
  const providerQueries: EventGraphExpansionCandidate[] = [];
  const duplicateSuggestions: EventGraphExpansionCandidate[] = [];
  const rejected: EventGraphSnapshot["rejected"] = [];
  let queryCount = 0;
  let truncated = false;

  for (const candidate of input.candidates ?? []) {
    if (nodeMap.size >= limits.maxRecords) { truncated = true; break; }
    const parent = nodeMap.get(candidate.parentNodeId);
    if (!parent) { rejected.push({ candidate, reason: "parent identity is outside the trusted graph" }); continue; }
    const depth = parent.depth + 1;
    if (depth > limits.maxDepth) { rejected.push({ candidate, reason: "maximum graph depth exceeded" }); continue; }
    if (!domainAllowed(candidate.sourceUrl, limits.allowedDomains)) { rejected.push({ candidate, reason: "source domain is not allowlisted" }); continue; }
    const destinationId = stableGraphNodeId(candidate.identity);
    const edge = { id: edgeId(parent.id, destinationId, candidate.relation, candidate.sourceUrl), fromNodeId: parent.id, toNodeId: destinationId, relation: candidate.relation, sourceUrl: candidate.sourceUrl, observedAt: generatedAt, trust: "review_required" as const };
    if (edgeMap.has(edge.id) || createsCycle(parent.id, destinationId, edgeMap.values())) { rejected.push({ candidate, reason: "cycle or duplicate edge detected" }); continue; }

    if (candidate.action === "query_existing_provider") {
      if (queryCount >= limits.maxQueries) { rejected.push({ candidate, reason: "maximum provider query count exceeded" }); truncated = true; continue; }
      queryCount += 1;
      providerQueries.push(candidate);
    } else if (candidate.action === "propose_allowlisted_source") sourceProposals.push(candidate);
    else if (candidate.action === "suggest_duplicate") duplicateSuggestions.push(candidate);
    else {
      if (!candidate.eventFields) { rejected.push({ candidate, reason: "discovery lead facts are missing" }); continue; }
      const root = input.seeds.find((seed) => stableGraphNodeId({ type: "event", stableId: seed.happening.id, name: seed.happening.title, canonicalUrl: seed.happening.source.url }) === parent.id) ?? input.seeds[0];
      const result = buildEventLead({ cityId, sourceUrl: candidate.sourceUrl, sourceType: "official_page", fields: candidate.eventFields, evidence: candidate.evidence ?? [], submittedBy: { kind: "event_graph", sourceId: candidate.sourceId, rootHappeningId: root.happening.id, edgePath: [parent.id, destinationId] } }, cityId, input.existingHappenings, now);
      if (!result.ok) { rejected.push({ candidate, reason: result.message }); continue; }
      leads.push(result.lead);
    }

    nodeMap.set(destinationId, { ...candidate.identity, id: destinationId, cityId, trust: "review_required", depth });
    edgeMap.set(edge.id, edge);
  }

  return { cityId, generatedAt, rootHappeningIds: input.seeds.map((seed) => seed.happening.id), nodes: [...nodeMap.values()], edges: [...edgeMap.values()], leads, sourceProposals, providerQueries, duplicateSuggestions, rejected, limits, queryCount, truncated };
}

export function graphRefreshDue(snapshot: EventGraphSnapshot | undefined, now = new Date()): boolean {
  if (!snapshot) return true;
  return now.getTime() - Date.parse(snapshot.generatedAt) >= snapshot.limits.refreshIntervalMinutes * 60_000;
}
