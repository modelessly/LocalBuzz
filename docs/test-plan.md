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

- creates staged plan without overwriting accepted plan
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
- `stage_evening_plan` and verify staged timeline
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

Through WebMCP, search and stage a plan.

### C. Human-agent collaboration

1. agent stages
2. human locks
3. agent reads
4. agent repairs
5. lock persists

### D. Disruption

1. accepted/staged night exists
2. apply demo unavailable update
3. UI shows conflict
4. agent repair changes only required stop
5. human accepts

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

Manual browser acceptance for Phase 1 is limited to the implementation path: switch to Places, inspect canonical/needs-review cards, stage a dinner or drinks stop, add an event, inspect the mixed map/timeline, stage a custom place, confirm its unverified label, and exercise staged acceptance/rejection only with explicit approval. Do not treat fixture hours or prices as live availability.

## Phase 2 Place qualification regression contract

Automated coverage must prove:

- 33 validated Place snapshots per city with unique IDs/names, official websites, provenance and verification dates;
- no explicit fast-food, generic-chain, convenience, supermarket, gas, food-court or delivery-only leakage;
- at least three operationally qualified records within the documented straight-line corridor proxy;
- Foursquare bounds, category exclusions, closure/quality filtering, stable IDs and deduplication;
- shared purpose/kind/mood/neighborhood/price/open-at filtering in both domain and WebMCP tests;
- closed/incomplete/kitchen/budget/duration/reservation failures and stale/incomplete verification warnings;
- existing event-only and mixed-plan lock/repair behavior.

Browser verification is focused on visible catalog count, filter controls, verification dates and a WebMCP filtered search. It must not accept or reject staged state without explicit approval and is not a substitute for checking official operating data.

## Phase 3 ingestion regression contract

Automated coverage proves JSON-LD, ICS, RSS/Atom, official JSON and sitemap parsing; canonical city/location/time-zone/expiration/URL/currency validation; stable IDs and deduplication; Ticketmaster filters/status/missing-key behavior; Visit Sweden mapping; and last-good retention after empty or failed refreshes. Existing event-only and mixed-plan tests remain the compatibility gate.

Live checks report exact source, date and accepted/rejected counts. They are refresh evidence, not deterministic tests or a coverage guarantee.

## Phase 4 discovery-lead regression contract

Automated coverage must prove public HTTPS URL validation; rejection of malformed, credentialed, local, private, link-local and oversized input; wrong-city handling; staged missing/date/location/duplicate/provenance warnings; no proposal-time canonical mutation; canonical event and Place acceptance; rejection without inventory change; Place-only unverified custom retention; fifteen static tool schemas; and proposal lifecycle targeting the review surface.
