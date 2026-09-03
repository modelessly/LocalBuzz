# Data Model

## Goal

Normalize small source-backed Stockholm and San Francisco datasets into a stable schema suitable for both the human UI and WebMCP tools.

## Happening

```ts
type Happening = {
  id: string
  cityId: "stockholm" | "san-francisco"
  kind?: "scheduled_event" | "live_signal" | "venue_activity" | "pop_up" | "city_condition" | "community_report"

  title: string
  description?: string
  category: HappeningCategory

  venue: {
    name: string
    address?: string
    lat: number
    lng: number
    neighborhood?: string
  }

  timing: {
    start: string
    end?: string
    lastEntry?: string
    estimatedDurationMinutes?: number
  }

  commerce: {
    priceMin?: number
    priceMax?: number
    currency: "SEK" | "USD"
    bookingRequired?: boolean
    bookingUrl?: string
  }

  status: {
    availability:
      | "unknown"
      | "available"
      | "limited"
      | "sold_out"
      | "cancelled"
      | "walk_in"
    statusUpdatedAt?: string
    statusSource?: "source" | "local_buzz" | "demo_simulation"
  }

  source: {
    name: string
    url: string
    fetchedAt?: string
    lastVerifiedAt?: string
  }

  enrichment?: {
    moodTags?: string[]
    goodForDate?: boolean
    goodSolo?: boolean
    spontaneityScore?: number
    indoorOutdoor?: "indoor" | "outdoor" | "mixed"
    accessibilityNotes?: string[]
    confidence?: number
    enrichmentMethod?: "manual" | "derived"
  }

  socialPulse?: {
    evidenceCount: number
    independentSourceCount: number
    sourceAccounts: string[]
    confidence: number
    firstSeen?: string
    latestSeen: string
    likelyActiveUntil?: string
    sourceUrls: string[]
    freshnessMinutes: number
    actionableNow: boolean
    buzzScore: number
    buzzLabel: "Quiet" | "Starting" | "Buzzing" | "Hot Now" | "Very Hot"
    buzzBreakdown: {
      timing: number
      freshness: number
      social: number
      corroboration: number
      sourceDiversity: number
      actionability: number
      convenience: number
      contextCompatibility: number
    }
    reasonActionable: string
    mergedIntoScheduledEvent?: boolean
  }

  media?: {
    imageUrl?: string
    imageUseAllowed?: boolean
  }
}
```

## Categories

Keep the category list intentionally small.

```ts
type HappeningCategory =
  | "live_music"
  | "club"
  | "comedy"
  | "food_drink"
  | "culture"
  | "film"
  | "talk"
  | "market"
  | "activity"
  | "other"
```

## Data provenance rule

Every field should conceptually belong to one of three classes:

### Source

Directly obtained from a real event/venue source.

Examples:

- title
- start time
- venue
- ticket URL

### Enriched

Added by Local Buzz for product usefulness.

Examples:

- mood tags
- good for a date
- spontaneity score
- expected duration

### Simulated

Only for deterministic prototype state.

Examples:

- a sudden unavailable status used to demonstrate repair

Do not blur these categories in UI or documentation.

## Demo dataset target

Recommended:

- 40–80 total real happenings
- 10–15 especially strong demo candidates
- 3+ categories after 18:00
- geographic concentration around central Stockholm
- enough alternatives to repair one plan deterministically

## Dataset quality checks

Validate:

- unique IDs
- parseable times
- valid lat/lng
- source URL present
- source name present
- no impossible negative prices
- no end time before start
- known category
- demo replacement candidates do not overlap impossibly

## Deduplication

For hackathon scope, basic dedupe is sufficient.

Candidate duplicate if:

- normalized title similarity is high
- venue matches
- start time is within a narrow tolerance

Preserve all source references internally if merged.

Do not invest in generalized entity resolution.

## Actionable Tonight

A useful derived concept:

```ts
type Actionability = {
  actionableNow: boolean
  reasons: string[]
}
```

An event may be real but not useful for tonight.

Example filters:

- start/end timing
- already ended
- sold out/cancelled
- booking impossible
- too far away
- outside budget

This is more valuable to Local Buzz than raw event count.

## Phase 1: Place

`Place` is durable city inventory rather than a dated occurrence. The canonical contract in `src/domain/types.ts` includes stable ID/city, typed kind, coordinates/address/neighborhood, cuisine and drink focus, mood tags, source-linked `whyInteresting` evidence, supported dinner/drinks purposes, typical duration, per-person price range/currency, typed weekly intervals with overnight closing, exceptional-hours state, optional kitchen/bar cutoffs, reservation mode, field-level provenance, and verification status/timestamp.

Supported kinds are `restaurant`, `bar`, `pub`, `cocktail_lounge`, `wine_bar`, `music_bar`, `club`, and `cafe`. Supported plan purposes are `dinner`, `quick_bite`, `drinks`, and `late_drinks`.

The checked-in Phase 1 fixtures contain eight official-source records in Stockholm and eight in San Francisco. `verified` means the operating fields used by Local Buzz were checked at the recorded timestamp. `needs_review` preserves a real official-source lead but makes uncertainty visible. A record missing a complete price range or weekly hours is searchable but cannot be staged as canonical.

## Phase 1: mixed PlanStop union

```ts
type PlanStop =
  | (PlanStopBase & { kind: "happening"; happeningId: string })
  | (PlanStopBase & { kind: "place"; placeId: string; purpose: PlacePurpose })
  | (PlanStopBase & {
      kind: "custom_place"
      purpose: PlacePurpose
      customPlace: CustomPlaceSnapshot & { verification: { status: "unverified" } }
    })
```

Custom place snapshots require explicit ISO availability bounds, visit duration, per-person price/currency and coordinates. They never enter the canonical Place catalog. Every stop owns planned arrival/departure, lock and review status. Plan cost is the sum of each stop's minimum per-person estimate multiplied by `constraints.partySize`.

Operating-time validation requires the whole typical visit to fit an opening interval. An interval can close on the following day. Dinner and quick-bite arrivals also respect a typed kitchen-last-order value when one is available. Exceptional-hours state is exposed but Phase 1 does not ingest holiday calendars.

## Phase 2: qualification fields and filters

The canonical `Place` contract adds `officialWebsite`, an explainable price band and evidence class, and typed opening-hours evidence:

```ts
type PlacePriceRange = {
  min?: number
  max?: number
  currency: "SEK" | "USD"
  basis: "per_person"
  band: "budget" | "moderate" | "premium" | "unknown"
  evidence: "official_menu" | "provider_estimate" | "unknown"
  evidenceUrl?: string
}

type OpeningHoursEvidence = {
  status: "verified" | "unknown"
  sourceUrl?: string
  checkedAt: string
}
```

Search filters now include purpose, maximum per-person price, mood, neighborhood, kind and an ISO `openAt` arrival. UI and WebMCP calls share `LocalBuzzActions.searchPlaces`; open-at filtering excludes records whose operating state cannot be established.

`Place.reservationUrl` is an optional dedicated booking destination and is never inferred from `officialWebsite`. The UI labels it `Reserve table` for restaurants or `Reserve` for other reservable Places. When it is absent, a valid official homepage may be offered only as `Venue website`.

Planning remains stricter than discovery. It rejects closed visits, arrivals after a known kitchen cutoff, unknown price/hours, currency mismatch, party-size budget excess, overlapping adjacent stops, insufficient visit duration and reservation-required spontaneous stops. It returns specific plain-language warnings for incomplete or stale operating evidence, unknown exceptional hours, custom-place assumptions and recommended reservations. Internal qualification enum names are not rendered as UI tags.

## Phase 3 ingestion contracts

`Happening` remains the only published event entity. Server-only `EventSourceDefinition`, `EventCandidate`, `SourceRefreshResult` and `CityEventSnapshot` contracts isolate source variation. Normalization requires city, physical venue/address/coordinates, explicit zoned time, non-expiration, canonical HTTPS URL, valid status and city-consistent currency.

The shared nightly timing contract accepts effective durations up to and including 720 minutes. Explicit longer ends are rejected rather than shortened; missing ends normalize to 90 minutes. `isNightlyHappening` and `occurrenceEndMs` are the common defense used by ingestion, retention, startup inventory and search.

`CityEventSnapshot.retained` and per-source status carry operational truth without changing plan stops. Provenance and freshness continue through `Happening.source`, keeping cards and WebMCP results backward-compatible.

## Phase 4 DiscoveryLead

`DiscoveryLead` is a discriminated event/Place union with city, extracted fields, original source URL/type, WebMCP submission metadata, missing fields, duplicate matches, verification status, evidence references, timestamps and review outcome. Leads are never part of canonical search.

Review outcomes are `accepted_canonical`, `rejected` or `kept_custom`. Canonical acceptance constructs a normal `Happening` or `Place` and runs the existing validators. `kept_custom` is Place-only and produces the existing embedded `CustomPlacePlanStop` with `verification.status: "unverified"`; it does not add a Place to the catalog.

## Phase 5 discovery measurement

`CoverageCell` is a deterministic count keyed by city, configured neighborhood, canonical category, local time window, city-currency price band and lead-time band. It carries stable ID, matching canonical event IDs, count and `empty | weak | covered` strength. `CoverageReport` adds stale inventory and aggregate neighborhood/category/late-night/inexpensive/corridor gaps without becoming product state.

`MunicipalRadarRecord` retains an official identifier, known location/dates, permit status, source URL, fetch time and suggested independent-evidence query. Its immutable corroboration state is `required`; it is not a partial `Happening`.

Collector-produced discovery leads extend `submittedBy` with `targeted_collector` and `municipal_corroboration` variants. They otherwise use the same Phase 4 lead union, validators, review outcomes and canonical acceptance boundary.

## Phase 6 relationship and benchmark contracts

`EventGraphNode` captures stable event, venue, organizer, performer and ticket-platform identities. `EventGraphEdge` carries relationship, source URL, observation time and trust state. `EventGraphSnapshot` includes enforced limits, query count, rejected candidates, duplicate suggestions, source proposals and normal review-only `DiscoveryLead`s. Graph-authored leads use `submittedBy.kind: "event_graph"` with their root canonical happening and edge path.

`BenchmarkEvent` is deliberately not a `Happening`. `BenchmarkSnapshot` always has `benchmarkOnly: true`, provider/terms/status metadata, last-good retention state and comparison metrics. No conversion function to canonical inventory exists. `SourceOperationPolicy` records cadence, per-run/day bounds, credential name, raw-retention, attribution and text/image reuse rules.

Every direct plan mutation reuses canonical Place visit validation and event availability before replacing `currentPlan`. Operational conflicts leave the existing plan unchanged; stale or unknown evidence and custom Place status return explicit warnings.

## Startup inventory state

`LocalBuzzState.eventInventory` is the canonical browser contract for event availability. It carries city/request/generated-at identity, refresh state, current/retained/expired totals, and `EventSourceState[]`.

Each source exposes identifier/publisher, `fresh | retained | unavailable | disabled | invalid | refreshing`, attempt and last-success times, accepted/rejected/retained/expired counts, empty-success state and a safe reason. This is operational metadata, not another copy of `Happening`; canonical records remain in `state.happenings` and plans continue to reference stable IDs.

Visible listing IDs and candidate IDs have distinct meanings. Listing IDs are controlled by the active time window and explicit human searches/filters. Candidate IDs are an additive map/card emphasis layer and cannot reduce the listing. Neither collection owns or mutates the itinerary.

Human listing restoration does not clear candidate IDs; city switching still clears both collections. Consumer plan-price presentation resolves every referenced stop: all-known prices use the canonical plan total, some-known prices display a partial total, and no-known prices display `Price unavailable`. `PlanConstraints.budget` is optional: Stockholm and San Francisco start without a cap, while an explicitly supplied budget enables hard-budget validation. Unknown-price events can be planned only when no cap needs to be verified.
