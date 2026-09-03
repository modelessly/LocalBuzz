import type { CityId, DiscoveryLead, EventDiscoveryFields, Happening } from "../../src/domain/types";

export type EventGraphNodeType = "event" | "venue" | "organizer" | "performer" | "ticket_platform";

export type EventGraphIdentity = {
  type: EventGraphNodeType;
  stableId?: string;
  name: string;
  canonicalUrl?: string;
};

export type EventGraphNode = EventGraphIdentity & {
  id: string;
  cityId: CityId;
  trust: "trusted" | "review_required";
  depth: number;
};

export type EventGraphEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: "at_venue" | "organized_by" | "performed_by" | "ticketed_by" | "related_official_event";
  sourceUrl: string;
  observedAt: string;
  trust: "trusted" | "review_required";
};

export type EventGraphSeed = {
  happening: Happening;
  performer?: EventGraphIdentity;
  organizer?: EventGraphIdentity;
};

export type EventGraphExpansionCandidate = {
  parentNodeId: string;
  relation: EventGraphEdge["relation"];
  identity: EventGraphIdentity;
  sourceUrl: string;
  sourceId: string;
  action: "propose_allowlisted_source" | "query_existing_provider" | "create_discovery_lead" | "suggest_duplicate";
  eventFields?: EventDiscoveryFields;
  evidence?: Array<{ field: string; sourceUrl: string; note?: string }>;
};

export type EventGraphLimits = {
  maxDepth: number;
  maxQueries: number;
  maxRecords: number;
  allowedDomains: string[];
  refreshIntervalMinutes: number;
};

export type EventGraphSnapshot = {
  cityId: CityId;
  generatedAt: string;
  rootHappeningIds: string[];
  nodes: EventGraphNode[];
  edges: EventGraphEdge[];
  leads: DiscoveryLead[];
  sourceProposals: EventGraphExpansionCandidate[];
  providerQueries: EventGraphExpansionCandidate[];
  duplicateSuggestions: EventGraphExpansionCandidate[];
  rejected: Array<{ candidate: EventGraphExpansionCandidate; reason: string }>;
  limits: EventGraphLimits;
  queryCount: number;
  truncated: boolean;
};
