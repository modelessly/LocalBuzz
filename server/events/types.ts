export const FRESH_EVENT_CATEGORIES = [
  "live_music",
  "club",
  "comedy",
  "food_drink",
  "culture",
  "film",
  "talk",
  "market",
  "activity",
  "other",
] as const;

export type FreshEventCategory = (typeof FRESH_EVENT_CATEGORIES)[number];

export interface FreshEvent {
  id: string;
  title: string;
  description: string;
  category: FreshEventCategory;
  venue: {
    name: string;
    address: string;
    neighborhood: string;
    lat: number;
    lng: number;
  };
  timing: {
    start: string;
    end: string;
  };
  commerce: {
    priceMin: number | null;
    bookingRequired: boolean;
    bookingUrl: string | null;
  };
  source: {
    name: string;
    url: string;
  };
  tags: string[];
  confidence: number;
}

export interface FreshEventsPayload {
  generatedAt: string;
  city: "San Francisco";
  events: FreshEvent[];
  status?: "unavailable";
}

export interface FreshEventsValidationResult {
  payload: FreshEventsPayload;
  rejected: string[];
}

export interface FreshEventsCollectionResult extends FreshEventsValidationResult {
  latencyMs: number;
  model: string;
}
