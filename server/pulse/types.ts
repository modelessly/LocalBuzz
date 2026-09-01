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

export interface PulseSignal {
  id: string;
  kind: "live_signal";
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
    confidence: number;
    source: "x";
    sourceUrls: string[];
  };
  tags: string[];
  reasonActionable: string;
}

export interface PulsePayload {
  generatedAt: string;
  city: "San Francisco";
  signals: PulseSignal[];
  status?: "unavailable";
}

export interface ValidationResult {
  payload: PulsePayload;
  rejected: string[];
}

export interface CollectionResult extends ValidationResult {
  latencyMs: number;
  model: string;
}
