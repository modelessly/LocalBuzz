# Test Plan

## Goal

Validate the product behavior required for the demo and WebMCP judging criteria.

## Automated domain tests

### Search

- filters by time
- filters unavailable/cancelled where appropriate
- respects max price
- returns deterministic ordering when fixture data is identical

### Plan staging

- builds the canonical plan directly without partial mutation on failure
- calculates estimated total cost
- rejects unknown happening IDs
- flags obvious time conflicts

### Locking

- locks existing stop
- unknown stop returns error
- locked state persists through unrelated state changes

### Repair

Critical tests:

1. unavailable unlocked stop can be replaced
2. locked stop is never silently replaced
3. unaffected stops are preserved
4. staged repair does not commit automatically
5. no valid repair returns structured error
6. budget/timing summary is recomputed

### Acceptance

- accept staged changes updates canonical state
- reject restores canonical state
- no staged changes returns safe no-op/error

### Live updates

- simulated status update marks happening unavailable
- current plan reflects conflict
- source is labeled `demo_simulation`

## Data tests

- all IDs unique
- coordinates valid
- time strings parse
- source URL/name present
- categories valid
- price range valid
- demo replacement candidates available

## WebMCP tests

### Registration

- expected tool names register
- schemas are valid
- descriptions are present

### Shared logic

For each state-changing WebMCP tool, verify it calls the same domain operation used by UI.

### UI visibility

Call:

- `show_candidates` and verify relevant UI state
- `build_evening_plan` and verify the directly editable timeline
- `lock_plan_stop` and verify lock
- `repair_plan` and verify staged diff

### Error safety

- invalid ID
- unavailable event
- locked conflict
- no active plan
- no staged changes

## Manual acceptance tests

### A. Human-only path

Complete a basic night using only the UI.

### B. Agent-only tool path

Through WebMCP, search and build a plan.

### C. Human-agent collaboration

1. agent builds or adds stops
2. human locks
3. agent reads
4. agent repairs
5. lock persists

### D. Disruption

1. current night exists
2. apply demo unavailable update
3. UI shows conflict
4. agent repair changes only required stop
5. current plan already contains the validated repair

## Browser verification

### ChatGPT in-app browser

Required before submission.

Verify:

- site loads
- WebMCP tool discovery
- tool invocation
- UI update
- exact demo path

### Google Chrome

Enable WebMCP testing as documented by the challenge.

Verify the same core path.

## Regression checklist

Before final submission:

- production build
- typecheck
- lint
- tests
- no console-fatal errors
- no missing assets
- no broken source links
- no secret keys
- no nondeterministic demo blockers

## Demo reliability threshold

The exact screenplay should complete successfully at least 5 consecutive times before final recording.

## Phase 1 mixed-night regression contract

Automated coverage must verify:

- both city Place catalogs validate stable IDs, kinds, coordinates, durations, prices, typed hours, evidence and provenance;
- Place search/open-time filtering and shared candidate visibility;
- canonical dinner + event + drinks staging, party-size cost and explicit acceptance;
- closed-place, incomplete-hours/price, currency, overlap, duration/latest-end and budget failures;
- custom availability bounds and persistent `unverified` status;
- union-generic locks, removal, acceptance and rejection;
- event disruption/repair preserves locked and unaffected Place stops exactly;
- the Phase 1 thirteen tools remain registered and the five Place tools mutate the same state as UI actions;
- event-only plan and repair tests continue to pass.

Manual browser verification for Phase 1 is limited to the implementation path: switch to Places, inspect source and operating-data copy, add a dinner or drinks stop, add an event, inspect the mixed map/timeline, add a custom place, and confirm it remains outside the canonical catalog. Do not treat fixture hours or prices as live availability.

## Phase 2 Place qualification regression contract

Automated coverage must prove:

- 33 validated Place snapshots per city with unique IDs/names, official websites, provenance and verification dates;
- no explicit fast-food, generic-chain, convenience, supermarket, gas, food-court or delivery-only leakage;
- at least three operationally qualified records within the documented straight-line corridor proxy;
- Foursquare bounds, category exclusions, closure/quality filtering, stable IDs and deduplication;
- shared purpose/kind/mood/neighborhood/price/open-at filtering in both domain and WebMCP tests;
- closed/incomplete/kitchen/budget/duration/reservation failures and stale/incomplete verification warnings;
- existing event-only and mixed-plan lock/repair behavior.

Browser verification is focused on visible catalog count, filter controls, source checked dates, a WebMCP filtered search and direct plan editing. It must also confirm that qualification statuses are not rendered as tags and is not a substitute for checking official operating data.

## Phase 3 ingestion regression contract

Automated coverage proves JSON-LD, ICS, RSS/Atom, official JSON and sitemap parsing; canonical city/location/time-zone/expiration/URL/currency validation; stable IDs and deduplication; Ticketmaster `latlong`, second-precision date filters, status and missing-key behavior; Billetto header authentication, Swedish-domain pagination, status/location/URL/currency filtering and credential-safe errors; Visit Sweden mapping; and per-source last-good retention after empty or failed refreshes. Existing event-only and mixed-plan tests remain the compatibility gate.

Live checks report exact source, date and accepted/rejected counts. They are refresh evidence, not deterministic tests or a coverage guarantee.

## Phase 4 discovery-lead regression contract

Automated coverage must prove public HTTPS URL validation; rejection of malformed, credentialed, local, private, link-local and oversized input; wrong-city handling; staged missing/date/location/duplicate/provenance warnings; no proposal-time canonical mutation; canonical event and Place acceptance; rejection without inventory change; Place-only unverified custom retention; fifteen static tool schemas; and proposal lifecycle targeting the review surface.

## Phase 5 coverage/radar regression contract

Automated coverage must prove deterministic empty/weak/covered cells; stale inventory and Place-corridor gaps; city/neighborhood/category/time/price/lead-time query constraints; city-specific discovery vocabulary; collector result URL/date/location/provenance/deduplication validation; insertion into the shared DiscoveryLead frontier without canonical mutation; six-hour cache and missing-key/failure last-good behavior; DataSF closure deduplication; PermitSF missing-field honesty; disabled Stockholm source reasoning; permit-only rejection; and independent municipal corroboration.

Time-selection regression coverage must prove that Right Now includes only events active at the current instant, uses the normalized 90-minute duration when an explicit end is absent, and excludes future, ended and over-12-hour provider windows. Normalization must accept four-hour, cross-midnight and exact-12-hour events while rejecting longer weekly/monthly containers with the distinct nightly-limit reason. Retained snapshots, provider adapters, startup replacement and UI/WebMCP search must enforce the same eligibility. `startAfter` must constrain the actual event start, completed ingestion must not restore the entire catalog, and an empty Later selection must remain Later rather than silently showing Tomorrow.

Your Night browser checks cover empty/disconnected and connected states, event-only and mixed plans, locked plans, real unavailable events, and agent-driven repair when a real unavailable source state is present. The timeline must contain no approval controls, colored status chips or removed demo controls. Automated tests remain the deterministic repair gate when no live source supplies an unavailable event during the browser session.

Live verification reports exact DataSF accepted counts and one bounded gap-search outcome. It is operational evidence, not a deterministic test or city-coverage claim.

## Phase 6 consolidation regression contract

Automated coverage must prove stable graph identities; per-edge provenance; depth/domain/query/record/cadence limits; cycle/duplicate rejection; graph leads remaining review-only; PredictHQ city/date parsing; Bandsintown trusted-performer/city/terms constraints; Songkick disabled state; benchmark/canonical separation; missing-credential/failure last-good retention; source policy coverage, cadence and quota decisions; plan-acceptance cancellation/Place-operation rechecks; and the final catalog/corridor/provenance audit.

The complete repository verification remains `npm run verify`. Provider live calls are optional operational evidence and must state credential, subscription and terms limitations. Phase 6 has no new UI, so broad browser exploration is not required; existing human/WebMCP regressions remain covered by the full suite and production build.

## P0 startup and Place-fallback regression contract

Deterministic coverage now includes available/unavailable cold starts, delayed completion, timeout/rejection, empty success, malformed response, last-good retention, expired exclusion, stale-request ordering, city switch during refresh, zero-event Place display, candidate subset restoration, UI/WebMCP inventory agreement, both two-stop default Place fallbacks, and plan immutability during refresh. Browser verification must inspect both cities with credentials unavailable, open source details, surface and restore two Place candidates, stage but not accept each Place fallback, and confirm no expired fixture appears as current.

## Two-city social-pulse regression contract

Automated coverage proves both city configs, trusted-account deduplication and the 20-handle ceiling; strict city/kind/category/time/location/source validation; stale and unsafe evidence rejection; independent confidence and deterministic 0–100 Buzz Score; broad/trusted pass merging; partial-pass survival and total-failure behavior; scheduled-event enrichment versus standalone Place-resolved signals; pulse failure isolation from canonical inventory and `currentPlan`; and WebMCP kind/score/actionability filters. Time-window regression remains the authority for Right Now, Later, Tomorrow and explicit dates.

Live checks run exactly one uncached two-pass cycle per city and report only normalized counts, latency, validation failures and sample titles/scores. Raw posts, authorization headers and environment values must never appear in logs or committed fixtures.
