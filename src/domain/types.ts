export type HappeningCategory =
  | "live_music"
  | "club"
  | "comedy"
  | "food_drink"
  | "culture"
  | "film"
  | "talk"
  | "market"
  | "activity"
  | "other";

export type CityId = "stockholm" | "san-francisco";

export type CurrencyCode = "SEK" | "USD";

export type HappeningKind =
  | "scheduled_event"
  | "live_signal"
  | "venue_activity"
  | "pop_up"
  | "city_condition"
  | "community_report";

export type BuzzLabel = "Quiet" | "Starting" | "Buzzing" | "Hot Now" | "Very Hot";

export type SocialPulseMetadata = {
  evidenceCount: number;
  independentSourceCount: number;
  sourceAccounts: string[];
  confidence: number;
  firstSeen?: string;
  latestSeen: string;
  likelyActiveUntil?: string;
  sourceUrls: string[];
  freshnessMinutes: number;
  actionableNow: boolean;
  buzzScore: number;
  buzzLabel: BuzzLabel;
  buzzBreakdown: {
    timing: number; freshness: number; social: number; corroboration: number;
    sourceDiversity: number; actionability: number; convenience: number; contextCompatibility: number;
  };
  reasonActionable: string;
  mergedIntoScheduledEvent?: boolean;
};

export type PlaceKind =
  | "restaurant"
  | "bar"
  | "pub"
  | "cocktail_lounge"
  | "wine_bar"
  | "music_bar"
  | "club"
  | "cafe";

export type PlacePurpose = "dinner" | "quick_bite" | "drinks" | "late_drinks";
export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type PlaceVerificationStatus = "verified" | "needs_review" | "unverified";

export type OpeningInterval = {
  opensAt: string;
  closesAt: string;
  closesNextDay?: boolean;
};

export type PlaceEvidence = {
  claim: string;
  sourceUrl: string;
};

export type PlaceProvenance = {
  name: string;
  url: string;
  fields: string[];
  fetchedAt: string;
};

export type Place = {
  id: string;
  cityId: CityId;
  name: string;
  officialWebsite?: string;
  kind: PlaceKind;
  location: {
    lat: number;
    lng: number;
    address: string;
    neighborhood: string;
  };
  cuisine: string[];
  drinkFocus: string[];
  moodTags: string[];
  whyInteresting: PlaceEvidence[];
  bestFor: PlacePurpose[];
  typicalVisitDurationMinutes: number;
  priceRange: {
    min?: number;
    max?: number;
    currency: CurrencyCode;
    basis: "per_person";
    band: "budget" | "moderate" | "premium" | "unknown";
    evidence: "official_menu" | "provider_estimate" | "unknown";
    evidenceUrl?: string;
  };
  weeklyHours: Partial<Record<Weekday, OpeningInterval[]>>;
  openingHoursEvidence: {
    status: "verified" | "unknown";
    sourceUrl?: string;
    checkedAt: string;
  };
  exceptionalHours: {
    status: "none_known" | "confirmed" | "unknown";
    note?: string;
  };
  serviceTimes?: {
    kitchenLastOrder?: Partial<Record<Weekday, { type: "at"; localTime: string } | { type: "before_close"; minutes: number }>>;
    barClosesWithVenue: true;
  };
  reservationMode: "required" | "recommended" | "available" | "walk_in" | "unknown";
  provenance: PlaceProvenance[];
  verification: {
    status: PlaceVerificationStatus;
    verifiedAt?: string;
    note?: string;
  };
};

export type Availability =
  | "unknown"
  | "available"
  | "limited"
  | "sold_out"
  | "cancelled"
  | "walk_in";

export type Happening = {
  id: string;
  cityId: CityId;
  kind?: HappeningKind;
  title: string;
  description?: string;
  category: HappeningCategory;
  venue: {
    name: string;
    address?: string;
    lat: number;
    lng: number;
    neighborhood?: string;
  };
  timing: {
    start: string;
    end?: string;
    lastEntry?: string;
    estimatedDurationMinutes?: number;
  };
  commerce: {
    priceMin?: number;
    priceMax?: number;
    currency: CurrencyCode;
    bookingRequired?: boolean;
    bookingUrl?: string;
  };
  status: {
    availability: Availability;
    statusUpdatedAt?: string;
    statusSource?: "source" | "local_buzz" | "demo_simulation";
  };
  source: {
    name: string;
    url: string;
    fetchedAt?: string;
    lastVerifiedAt?: string;
  };
  enrichment?: {
    moodTags?: string[];
    goodForDate?: boolean;
    goodSolo?: boolean;
    spontaneityScore?: number;
    indoorOutdoor?: "indoor" | "outdoor" | "mixed";
    accessibilityNotes?: string[];
    confidence?: number;
    enrichmentMethod?: "manual" | "derived";
  };
  socialPulse?: SocialPulseMetadata;
};

export type SearchFilters = {
  query?: string;
  startAfter?: string;
  endBefore?: string;
  activeAt?: string;
  maxPrice?: number;
  categories?: HappeningCategory[];
  happeningKinds?: HappeningKind[];
  minBuzzScore?: number;
  actionableNow?: boolean;
  near?: { lat: number; lng: number };
  maxDistanceKm?: number;
  maxResults?: number;
};

export type PlanConstraints = {
  budget: number;
  currency: CurrencyCode;
  latestEndTime: string;
  partySize: number;
  startLocation: { lat: number; lng: number; label: string };
};

type PlanStopBase = {
  id: string;
  plannedStart: string;
  plannedEnd: string;
  locked: boolean;
  status: "active" | "conflict" | "unavailable";
};

export type HappeningPlanStop = PlanStopBase & {
  kind: "happening";
  happeningId: string;
};

export type PlacePlanStop = PlanStopBase & {
  kind: "place";
  placeId: string;
  purpose: PlacePurpose;
};

export type CustomPlaceSnapshot = {
  name: string;
  location: Place["location"];
  typicalVisitDurationMinutes: number;
  pricePerPerson: number;
  currency: CurrencyCode;
  availableFrom: string;
  availableUntil: string;
  note?: string;
  verification: { status: "unverified" };
};

export type CustomPlacePlanStop = PlanStopBase & {
  kind: "custom_place";
  customPlace: CustomPlaceSnapshot;
  purpose: PlacePurpose;
};

export type PlanStop = HappeningPlanStop | PlacePlanStop | CustomPlacePlanStop;

export type EveningPlan = {
  id: string;
  stops: PlanStop[];
  totalEstimatedCost: number;
  startTime: string;
  endTime: string;
  constraints: PlanConstraints;
  rationale?: string;
};

export type LiveUpdate = {
  id: string;
  happeningId: string;
  availability: Availability;
  label: string;
  source: "demo_simulation";
  appliedAt: string;
};

export type EventSourceStateStatus =
  | "fresh"
  | "retained"
  | "unavailable"
  | "disabled"
  | "invalid"
  | "refreshing";

export type EventSourceState = {
  sourceId: string;
  publisher: string;
  status: EventSourceStateStatus;
  attemptedAt: string;
  lastSuccessfulRefresh?: string;
  acceptedCount: number;
  rejectedCount: number;
  retainedCount: number;
  expiredCount: number;
  emptySuccessful: boolean;
  candidateCount?: number;
  marginalUniqueCount?: number;
  uniqueVenueCount?: number;
  todayCount?: number;
  tonightCount?: number;
  next24HoursCount?: number;
  rejectionReasons?: Record<string, number>;
  message?: string;
};

export type EventInventoryState = {
  cityId: CityId;
  refreshId?: string;
  generatedAt?: string;
  refreshing: boolean;
  currentCount: number;
  retainedCount: number;
  expiredCount: number;
  sources: EventSourceState[];
};

export type CityEventSnapshotSource = {
  sourceId: string;
  publisher: string;
  status: Exclude<EventSourceStateStatus, "refreshing">;
  attemptedAt: string;
  lastSuccessfulRefresh?: string;
  eventCount: number;
  rejectedCount: number;
  retainedCount: number;
  expiredCount: number;
  emptySuccessful: boolean;
  candidateCount?: number;
  marginalUniqueCount?: number;
  uniqueVenueCount?: number;
  todayCount?: number;
  tonightCount?: number;
  next24HoursCount?: number;
  rejectionReasons?: Record<string, number>;
  message?: string;
};

export type CityEventSnapshotWire = {
  cityId: CityId;
  generatedAt: string;
  retained: boolean;
  happenings: Happening[];
  sources: CityEventSnapshotSource[];
};

export type LocalBuzzState = {
  activeCityId: CityId;
  happenings: Happening[];
  places: Place[];
  filters: SearchFilters;
  placeFilters: PlaceSearchFilters;
  visibleHappeningIds: string[];
  candidateHappeningIds: string[];
  visiblePlaceIds: string[];
  candidatePlaceIds: string[];
  currentPlan: EveningPlan | null;
  liveUpdates: LiveUpdate[];
  eventInventory: EventInventoryState;
  discoveryLeads: DiscoveryLead[];
  selectedHappeningId?: string;
  selectedPlaceId?: string;
  candidateReason?: string;
  candidateReasonOrigin?: "human" | "agent";
  discoveryMode: "events" | "places";
  activityMessage: string;
  webMcp: "checking" | "available" | "unavailable" | "error";
};

export type DomainErrorCode =
  | "INVALID_HAPPENING_ID"
  | "INVALID_PLACE_ID"
  | "INVALID_STOP_ID"
  | "HAPPENING_UNAVAILABLE"
  | "PLACE_CLOSED"
  | "PLACE_DATA_INCOMPLETE"
  | "CURRENCY_CONFLICT"
  | "RESERVATION_CONFLICT"
  | "PLAN_NOT_FOUND"
  | "LOCKED_STOP_CONFLICT"
  | "TIME_CONFLICT"
  | "BUDGET_CONFLICT"
  | "NO_REPAIR_FOUND"
  | "INVALID_INPUT"
  | "INVALID_URL"
  | "WRONG_CITY"
  | "MISSING_DATE"
  | "MISSING_LOCATION"
  | "EXPIRED_EVENT"
  | "UNSUPPORTED_PLACE"
  | "DUPLICATE"
  | "INSUFFICIENT_PROVENANCE"
  | "INVALID_PRICE_CURRENCY"
  | "UNSAFE_INPUT";

export type DiscoveryLeadIssueCode =
  | "MISSING_DATE"
  | "MISSING_LOCATION"
  | "EXPIRED_EVENT"
  | "UNSUPPORTED_PLACE"
  | "DUPLICATE"
  | "INSUFFICIENT_PROVENANCE"
  | "INVALID_PRICE_CURRENCY";

export type DiscoveryLeadEvidence = {
  field: string;
  sourceUrl: string;
  note?: string;
};

type DiscoveryLeadBase = {
  id: string;
  cityId: CityId;
  originalSourceUrl: string;
  sourceType: "official_page" | "venue_calendar" | "ticket_page" | "editorial_page" | "other_public_page";
  submittedBy:
    | { kind: "webmcp_agent"; toolName: "propose_event_from_url" | "propose_place_from_url" }
    | { kind: "targeted_collector"; sourceId: "xai_web_coverage"; coverageCellId: string }
    | { kind: "municipal_corroboration"; sourceId: string; officialIdentifier: string }
    | { kind: "event_graph"; sourceId: string; rootHappeningId: string; edgePath: string[] };
  missingRequiredFields: string[];
  possibleDuplicateMatches: Array<{ id: string; name: string; reason: string }>;
  verificationStatus: "provisional" | "needs_review" | "verified" | "rejected" | "unverified_custom";
  evidence: DiscoveryLeadEvidence[];
  issues: DiscoveryLeadIssueCode[];
  createdAt: string;
  reviewedAt?: string;
  reviewOutcome?: "accepted_canonical" | "rejected" | "kept_custom";
};

export type EventDiscoveryFields = {
  title?: string;
  description?: string;
  category?: HappeningCategory;
  venue?: { name?: string; address?: string; neighborhood?: string; lat?: number; lng?: number };
  timing?: { start?: string; end?: string };
  commerce?: { priceMin?: number; priceMax?: number; currency?: CurrencyCode; bookingUrl?: string };
  availability?: Availability;
  performer?: string;
  organizer?: string;
};

export type PlaceDiscoveryFields = {
  name?: string;
  officialWebsite?: string;
  kind?: PlaceKind;
  location?: { lat?: number; lng?: number; address?: string; neighborhood?: string };
  cuisine?: string[];
  drinkFocus?: string[];
  moodTags?: string[];
  whyInteresting?: PlaceEvidence[];
  bestFor?: PlacePurpose[];
  typicalVisitDurationMinutes?: number;
  priceRange?: Place["priceRange"];
  weeklyHours?: Place["weeklyHours"];
  openingHoursEvidence?: Place["openingHoursEvidence"];
  exceptionalHours?: Place["exceptionalHours"];
  reservationMode?: Place["reservationMode"];
};

export type EventDiscoveryLead = DiscoveryLeadBase & { leadType: "event"; fields: EventDiscoveryFields };
export type PlaceDiscoveryLead = DiscoveryLeadBase & { leadType: "place"; fields: PlaceDiscoveryFields };
export type DiscoveryLead = EventDiscoveryLead | PlaceDiscoveryLead;

export type PlaceSearchFilters = {
  query?: string;
  kinds?: PlaceKind[];
  purposes?: PlacePurpose[];
  moods?: string[];
  neighborhoods?: string[];
  openAt?: string;
  maxPrice?: number;
  near?: { lat: number; lng: number };
  maxDistanceKm?: number;
  maxResults?: number;
};

export type DomainResult<T> =
  | ({ ok: true } & T)
  | {
      ok: false;
      code: DomainErrorCode;
      message: string;
      suggestion?: string;
    };
