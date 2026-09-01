import type { Availability, CityId, CurrencyCode, Happening, HappeningCategory } from "../../src/domain/types";

export type EventSourceFormat =
  | "schema_org_jsonld"
  | "ics"
  | "rss_atom"
  | "venue_json"
  | "event_sitemap"
  | "linked_data"
  | "ticketmaster";

export type EventParserId =
  | "schema-org-event"
  | "ics-event"
  | "rss-atom-event"
  | "venue-json-event"
  | "event-sitemap"
  | "visit-sweden-linked-data"
  | "ticketmaster-discovery";

export type SourceTrustTier = "official_api" | "first_party" | "sanctioned_aggregator";
export type TermsReviewStatus = "approved" | "review_required" | "restricted";

export type EventSourceDefinition = {
  id: string;
  cityId: CityId;
  publisher: string;
  venue?: string;
  canonicalUrl: string;
  fetchUrl: string;
  format: EventSourceFormat;
  parser: EventParserId;
  refreshCadenceMinutes: number;
  trustTier: SourceTrustTier;
  termsReview: TermsReviewStatus;
  lastSuccessfulRefresh?: string;
  enabled: boolean;
  defaultVenue?: {
    name: string;
    address: string;
    neighborhood?: string;
    lat: number;
    lng: number;
  };
};

export type EventCandidate = {
  providerId?: string;
  cityId: CityId;
  title: string;
  description?: string;
  category?: HappeningCategory;
  venue: {
    name: string;
    address?: string;
    neighborhood?: string;
    lat?: number;
    lng?: number;
  };
  start: string;
  end?: string;
  performer?: string;
  organizer?: string;
  canonicalUrl: string;
  ticketUrl?: string;
  priceMin?: number;
  priceMax?: number;
  currency?: CurrencyCode;
  availability?: Availability;
};

export type SourceRefreshStatus =
  | "fresh"
  | "retained"
  | "unavailable"
  | "disabled"
  | "invalid";

export type SourceRefreshResult = {
  sourceId: string;
  publisher: string;
  status: SourceRefreshStatus;
  attemptedAt: string;
  lastSuccessfulRefresh?: string;
  eventCount: number;
  rejectedCount: number;
  message?: string;
};

export type CityEventSnapshot = {
  cityId: CityId;
  generatedAt: string;
  retained: boolean;
  happenings: Happening[];
  sources: SourceRefreshResult[];
};

export type ParseContext = {
  source: EventSourceDefinition;
  fetchedAt: string;
};
