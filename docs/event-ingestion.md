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

All formats produce `EventCandidate` values and pass through one normalizer. Publication requires a physical venue name/address, city-bounded coordinates, an explicit time and time-zone offset, non-expired dates, safe canonical URLs, city currency when price is present, and valid availability. Unknown price remains unknown. Unknown availability remains `unknown` rather than becoming available.

Deduplication uses city, normalized venue, start time and normalized title, with canonical/ticket URL as an additional identity guard. Source/provider IDs feed stable Local Buzz IDs.

## Configuration and local refresh

Ticketmaster is server-only:

```bash
TICKETMASTER_API_KEY=... npm run events:refresh -- stockholm
TICKETMASTER_API_KEY=... npm run events:refresh -- san-francisco
```

Without the key, Ticketmaster returns an explicit unavailable source result. It does not crash the city refresh or replace existing inventory. Do not prefix the variable with `VITE_`.

The browser reads `GET /api/ingestion/stockholm` or `GET /api/ingestion/san-francisco`. The Cloudflare Worker keeps a longer-lived last-good cache separate from the short response cache. Empty, malformed or failed refreshes return the retained snapshot with `retained: true`, source status and original snapshot timestamp. The local Vite middleware provides the same response contract and retains its last good result for the dev-server lifetime.

## Current source status (measured 2026-09-01)

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

Debaser's first-party `https://debaser.se/external/events` JSON endpoint returned 35 publishable future Stockholm events and one rejected record in the verification run. Ticketmaster fixtures cover both cities; live Ticketmaster coverage was not measured because no `TICKETMASTER_API_KEY` was configured.

San Francisco continues to have the existing server-side xAI scheduled-event collector and bounded official SFPL fallback alongside the new Ticketmaster adapter. The social-pulse route remains a separately labelled evaluation signal. Direct SF venue calendars are registered but disabled pending endpoint/terms review.

## Snapshot and failure rules

1. Collect each enabled source independently.
2. Parse and normalize through the shared pipeline.
3. Reject expired, malformed, location-incomplete or currency-inconsistent records.
4. Deduplicate the combined valid set.
5. Replace last-good only with a valid non-empty city snapshot.
6. Otherwise retain prior events and report every failed/unavailable source.

Checked-in fixtures are deterministic test and bootstrap data. A retained fixture or cached snapshot is never described as freshly collected.
