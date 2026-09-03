# Event Ingestion Operations

## Phase 3 boundary

Phase 3 adds a server-side, allowlisted ingestion layer. It does not crawl arbitrary pages or let agents submit URLs. Canonical `Happening` records still drive the UI, plans, map and WebMCP tools; collectors cannot create a second event model in product state.

The source registry is `server/ingestion/registry.ts`. Every entry declares city, publisher/venue, canonical and fetch URLs, format/parser, cadence, trust tier, terms-review status, last successful refresh when known, and enabled state. A direct source is enabled only after its endpoint and collection permission are understood. Pending venue calendars remain visible in the registry as `review_required` and disabled.

## Supported source formats

- Schema.org `Event` JSON-LD from first-party pages
- RFC 5545-style ICS `VEVENT` records
- RSS/Atom entries with explicit event start fields
- allowlisted official venue JSON endpoints
- event-page sitemaps followed only to bounded first-party pages and parsed as JSON-LD
- Visit Sweden linked-data Event search
- Ticketmaster Discovery API v2
- Billetto Public Event Search API v3 on the Swedish domain

All formats produce `EventCandidate` values and pass through one normalizer. Publication requires a physical venue name/address, city-bounded coordinates, an explicit time and time-zone offset, non-expired dates, safe canonical URLs, city currency when price is present, and valid availability. Unknown price remains unknown. Unknown availability remains `unknown` rather than becoming available.

Canonical events are also bounded to a single usable night. An explicit end must be after the start and no more than 12 hours later; longer ranges are rejected as `event duration exceeds nightly limit` and are never truncated. A missing end receives a 90-minute effective duration. The same rule filters provider output, retained snapshots, startup replacement and UI/WebMCP search. All-day, open-ended, recurring-container and multi-day records are not canonical unless a provider supplies separate, explicitly timed occurrences.

Deduplication uses city, normalized venue, start time and normalized title, with canonical/ticket URL as an additional identity guard. Source/provider IDs feed stable Local Buzz IDs.

## Configuration and local refresh

Ticketmaster and Billetto are server-only:

```bash
TICKETMASTER_API_KEY=... npm run events:refresh -- stockholm
TICKETMASTER_API_KEY=... npm run events:refresh -- san-francisco
BILLETTO_API_KEY=... BILLETTO_API_SECRET=... npm run events:refresh -- stockholm
```

Without the required credentials, the provider returns an explicit unavailable source result. It does not crash the city refresh or replace that provider's existing inventory. Do not prefix any credential with `VITE_`.

The browser reads `GET /api/ingestion/stockholm` or `GET /api/ingestion/san-francisco`. The Cloudflare Worker keeps a longer-lived last-good cache separate from the short response cache. Empty, malformed or failed refreshes return the retained snapshot with `retained: true`, source status and original snapshot timestamp. The local Vite middleware provides the same response contract and retains its last good result for the dev-server lifetime.

## Current source status (measured 2026-09-02)

Visit Sweden is the national linked-data API, not Visit Stockholm. Its API is updated nightly. Bounded `all:Stockholm` measurements returned:

| Schema type | Matching records |
| --- | ---: |
| Event | 63 |
| Place | 9 |
| TouristAttraction | 0 |
| LocalBusiness | 0 |
| FoodEstablishment | 0 |
| CivicStructure | 0 |
| MusicVenue | 0 |
| PerformingArtsTheater | 0 |
| Organization | 0 |

The measured Event response produced 59 candidate occurrences. Strict publication rejected rows that were expired, lacked an explicit time zone, or could not be resolved to a physical Stockholm venue. Visit Sweden is integrated as canonical inventory only when those checks succeed.

Before nightly-range enforcement, the 2026-09-02 bounded Stockholm refresh measured 58 Visit Sweden candidate occurrences with 0 accepted, 100 Ticketmaster candidates with 72 accepted, 669 Billetto candidates with 174 accepted, and 39 Debaser candidates with 37 accepted; cross-source deduplication published 276 events.

After enforcement on the same date, Visit Sweden remained 0/58, Ticketmaster 72/100 and Debaser 37/39. Billetto accepted 131/669 and rejected 42 additional records as `event duration exceeds nightly limit`; combined deduplicated inventory became 233. No over-12-hour record survived, the broad “Premium Bites” range was absent, and the legitimate one-night “Ævestaden” remained. Counts are a development-time provider snapshot, not a permanent coverage claim.

Ticketmaster must use the Discovery v2 `latlong` parameter; `geoPoint` expects a geohash. Its date filters are serialized without fractional seconds because the API rejects millisecond ISO timestamps. Billetto uses `https://billetto.se/api/v3/public/events`, an `Api-Keypair` request header, pages of at most 100 and a hard seven-page run bound. The national response is filtered through Stockholm coordinate bounds. Draft, canceled, completed, unavailable, online, expired, unsafe-URL, wrong-currency and unresolved/out-of-city records never reach canonical inventory. Billetto UTM parameters are retained and images are not ingested.

The Billetto public list and event-detail responses inspected on 2026-09-02 expose only top-level `startdate` and `enddate` for broad scheduled records; the detail response did not expose a trustworthy occurrence/session collection. Local Buzz therefore rejects broad Billetto ranges instead of fabricating performances. Occurrence expansion can be added only if Billetto documents and returns explicit per-session start/end values.

San Francisco continues to have the existing server-side xAI scheduled-event collector and bounded official SFPL fallback alongside the new Ticketmaster adapter. The social-pulse route remains a separately labelled evaluation signal. Direct SF venue calendars are registered but disabled pending endpoint/terms review.

## Snapshot and failure rules

1. Collect each enabled source independently.
2. Parse and normalize through the shared pipeline.
3. Reject expired, malformed, location-incomplete or currency-inconsistent records.
4. Deduplicate the combined valid set.
5. Retain each provider's still-current last-good records when that provider fails or returns no publishable events, even if another provider succeeds.
6. Replace the combined last-good snapshot only with a valid non-empty city snapshot.
7. Report every failed, empty or retained source without provider payloads, query URLs or credentials.

Checked-in fixtures are deterministic test and bootstrap data. A retained fixture or cached snapshot is never described as freshly collected.

## Browser startup contract

The browser makes one request to `/api/ingestion/:city`. The server runs permitted sources concurrently and returns one deterministically ordered `CityEventSnapshot`; the browser applies it only if the active city and refresh request ID still match. The SF xAI scheduled-event collector participates here rather than mutating product state through `/api/events/san-francisco`. That compatibility route now waits for collection and labels missing credentials/failures unavailable instead of returning an apparently fresh empty payload.

Per-source responses include candidate, accepted, rejected, retained, expired, marginal-unique, venue, today, tonight and next-24-hour counts plus explicit empty-success state and aggregated rejection reasons. Safe errors never include credentials, provider URLs with query strings or raw payloads. Direct venue entries pending terms review remain disabled. Expired last-good rows may remain in stored provenance but are excluded from current inventory and time-window search.

## Phase 6 scheduling and source onboarding

`server/operations/policy.ts` provides the shared minimum cadence, per-run/day request bounds, credential requirement, last-good, raw-retention, attribution and licensing rules for every registered event/municipal source plus paid discovery and benchmarks. Refresh orchestration retains source-attributed last-good rows when a source is not yet due.

To add a source: create or update its allowlisted registry entry; record canonical/fetch URLs, parser, cadence, trust, terms and enabled state; add an operational policy; add deterministic parser/normalizer/failure fixtures; document attribution, text/image reuse and raw-retention; then verify empty/failure retention before enabling it. A new source does not gain a canonical publication bypass.
