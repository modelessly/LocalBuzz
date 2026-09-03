export const PULSE_CATEGORIES = [
  "music",
  "food_drink",
  "culture",
  "nightlife",
  "activity",
  "market",
  "social",
  "other",
] as const;

export type PulseCategory = (typeof PULSE_CATEGORIES)[number];
export type CollectionMode = "broad" | "curated";

export const PULSE_KINDS = [
  "scheduled_event",
  "live_signal",
  "venue_activity",
  "pop_up",
  "city_condition",
  "community_report",
] as const;

export type PulseKind = (typeof PULSE_KINDS)[number];
export type PulseCityId = "stockholm" | "san-francisco";
export type PulseBuzzLabel = "Quiet" | "Starting" | "Buzzing" | "Hot Now" | "Very Hot";
export type PulseBuzzBreakdown = {
  timing: number; freshness: number; social: number; corroboration: number;
  sourceDiversity: number; actionability: number; convenience: number; contextCompatibility: number;
};

export interface PulseSignal {
  id: string;
  kind: PulseKind;
  title: string;
  summary: string;
  category: PulseCategory;
  location: {
    name: string;
    neighborhood: string;
    address: null;
  };
  timing: {
    firstSeen: string | null;
    latestSeen: string;
    likelyActiveUntil: string | null;
  };
  social: {
    evidenceCount: number;
    independentSourceCount: number;
    sourceAccounts: string[];
    confidence: number;
    source: "x";
    sourceUrls: string[];
  };
  tags: string[];
  reasonActionable: string;
  freshnessMinutes: number;
  actionableNow: boolean;
  buzzScore: number;
  buzzLabel: PulseBuzzLabel;
  buzzBreakdown: PulseBuzzBreakdown;
}

export interface PulsePayload {
  generatedAt: string;
  cityId: PulseCityId;
  city: "San Francisco" | "Stockholm";
  signals: PulseSignal[];
  status?: "fresh" | "retained" | "unavailable";
  retainedAt?: string;
}

export interface ValidationResult {
  payload: PulsePayload;
  rejected: string[];
}

export interface CollectionResult extends ValidationResult {
  latencyMs: number;
  model: string;
  passes: Array<{ mode: CollectionMode; latencyMs: number; rejectedCount: number; signalCount: number }>;
}
