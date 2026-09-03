# PLANNER.md

## Objective

Ship a coherent Local Buzz WebMCP prototype before the September 3, 2026 challenge deadline.

The build is driven backward from the demo.

## Production status — September 3

- `https://localbuzz.modeless.io` is attached as the sole custom-domain trigger for the `local-buzz` Cloudflare Worker.
- The apex `modeless.io` site and `www` were not changed.
- The release gate passed: lint, both TypeScript checks, 181 tests, and the Vite production build.
- HTTPS, production assets, `Permissions-Policy: tools=(self)`, the rendered San Francisco experience, and all sixteen WebMCP tools were verified on the custom domain.
- A deployed `read_current_plan` call succeeded and reported fresh Ticketmaster inventory.
- The optional xAI scheduled-event collector reported a bounded timeout, and a direct social-pulse smoke request did not return within 90 seconds. The app remained responsive with fresh Ticketmaster inventory and no browser console warnings or errors.

## Current status — August 30

The complete local contest loop is implemented and verified in the ChatGPT in-app browser:

- 48 validated source-backed Stockholm occurrences
- 12 source-backed San Francisco occurrences with a two-city switch
- city-scoped currency, time zone, map origin, prompt, inventory, and plan reset behavior
- Modeless map, happening cards, and reviewable evening timeline
- human stage, replace/remove, lock/unlock, accept/reject, and disruption controls
- eight strict WebMCP tools registered through `document.modelContext`
- UI lock observed through `read_current_plan`
- deterministic disruption repaired through `repair_plan`
- only the affected stop changed; locked and unaffected stops remained identical
- 13 automated tests covering the original collaboration loop, city isolation, and San Francisco staging
- no browser console warnings or errors during the exact sequence
- public Worker deployment: `https://local-buzz.alsmith.workers.dev`
- deployed response returns HTTP 200 and `Permissions-Policy: tools=(self)`
- all eight tools are discoverable on the public Worker in the ChatGPT in-app browser

## Next

1. Run the exact path five consecutive times on the custom-domain URL.
2. Verify WebMCP in Google Chrome with challenge testing enabled.
3. Investigate the optional xAI collector/pulse latency without blocking the current Ticketmaster-backed production experience.
4. Record the sub-three-minute demo and complete the Devpost submission.

## Blocked externally

None.

## Critical path

### Milestone 0: Harness reconciliation

Before implementation:

- inspect repository and Git status
- read existing harness files
- identify existing Modless components and tokens
- identify package manager, test commands, lint/typecheck, app entry points
- update existing docs in place
- do not create a nested app
- do not replace established conventions without a documented reason

### Milestone 1: Human product works without an agent

A user must be able to:

- view real Stockholm happenings
- inspect event cards
- add/stage a plan
- lock a stop
- remove or replace a stop
- see a clear timeline
- accept/reject staged changes
- trigger the demo disruption manually in development/demo mode

This must work before WebMCP is added.

### Milestone 2: Shared domain functions

Refactor UI interactions so all state-changing actions go through reusable domain functions.

Prove:

- UI calls domain function
- state updates
- map and timeline rerender
- no duplicated "agent" version of the same logic

### Milestone 3: WebMCP tools

Register the minimum viable tool set.

Prove:

- agent can search
- agent can stage a plan
- agent can read current plan
- agent can preserve locked state
- agent can repair after a disruption

### Milestone 4: Collaboration loop

Run the exact contest sequence:

1. agent search
2. agent plan
3. human edits
4. agent reads changed state
5. disruption
6. agent repairs
7. human accepts

Do not advance to polish until this works.

### Milestone 5: Product polish

Focus only on:

- visual hierarchy
- map legibility
- staged versus accepted state
- locked state
- event provenance
- clear empty/loading/error states
- deterministic demo path

### Milestone 6: Submission

- public deployment
- public repository
- open-source license
- README instructions
- <3 minute public YouTube video
- Devpost description
- architecture and WebMCP explanation
- final repo review

## Daily sequence

### Sunday, August 30

Goal: deployed human-facing shell.

- reconcile package with harness
- finalize source-of-truth docs
- choose map implementation
- create normalized data model
- seed initial Stockholm dataset
- build map + cards + timeline shell
- deploy early

### Monday, August 31

Goal: complete manual interaction.

- stage plan
- lock/unlock
- remove/replace
- staged diff
- accept/reject
- deterministic live disruption
- basic tests

### Tuesday, September 1

Goal: WebMCP collaboration works.

- implement tool registrations
- test discovery
- test input schemas
- test agent call paths
- verify human changes are visible to next agent action
- verify lock preservation
- verify repair behavior

### Wednesday, September 2

Goal: freeze features.

- run exact demo repeatedly
- fix tool descriptions
- fix state bugs
- polish UI
- complete README/submission text
- record backup demo
- validate public repo

### Thursday, September 3

Goal: submit.

No new features.

- regression
- deployment verification
- ChatGPT in-app browser test
- Chrome WebMCP test
- final video recording
- final submission
- submit well before 22:00 CEST

## Scope-cut order if behind

Cut in this order:

1. live external APIs beyond the initial data snapshot
2. dynamic WebMCP registration
3. route animation
4. weather
5. transit
6. comparisons
7. optional event imagery
8. extra missions / modes

Never cut:

- shared application state
- human visual intervention
- agent reading changed state
- lock preservation
- one directly editable canonical plan
- disruption and repair
- WebMCP tool implementation

## Phase 3 event-ingestion handoff — September 1

The repository now has a canonical multi-source ingestion boundary: registry, JSON-LD/ICS/RSS/official-JSON/sitemap parsers, Visit Sweden and Ticketmaster adapters, strict normalization/deduplication and last-good snapshot selection. The browser and Worker expose city ingestion routes while preserving existing Place/mixed-plan/WebMCP contracts. Direct sources stay allowlisted; Debaser's explicit public JSON endpoint is enabled, while unresolved venue calendars remain disabled and labelled for review.

Phase 4 can rely on `EventSourceDefinition`, `EventCandidate`, `CityEventSnapshot`, `GET /api/ingestion/:city`, canonical `Happening` publication and non-destructive refresh behavior. It should add permission-reviewed venue endpoints and discovery-lead workflow without bypassing this boundary.

## Phase 4 discovery-lead handoff — September 1

The shared state now includes review-only event/Place `DiscoveryLead` records. Two static WebMCP tools submit agent-read structured facts and evidence without URL fetching; lifecycle motion targets the visible provisional review surface. Humans can accept canonically, reject, or retain an eligible Place as a custom plan stop outside the catalog. Proposals never publish or modify a night automatically.

Phase 5 can rely on fifteen static tools, strict public-URL validation, duplicate/missing/provenance issue contracts, canonical validator reuse, and the three review outcomes. It can add municipal permit radar and coverage-gap discovery as lead producers, but must not write canonical inventory directly.

## Phase 5 coverage/radar handoff — September 1

The repository now measures a deterministic 8,400-cell city/neighborhood/category/time/price/lead-time cube, ranks narrow city-specific search targets, and exposes human plus JSON reports through `npm run data:coverage`. One explicit target can run through the existing server-only xAI architecture; at most ten results become Phase 4 `DiscoveryLead` records, with six-hour cost caching and matching last-good retention.

Official DataSF closure and PermitSF adapters retain municipal facts and suggested independent-evidence queries. A municipal record cannot become an event lead without separate official/venue/ticket corroboration. Stockholm's relevant official permit source stays disabled because its OGC/WFS contract requires a key and a verified event collection was not established.

Phase 6 can rely on the coverage/radar/target snapshot types, deterministic target IDs, `LocalBuzzActions.stageDiscoveryLeads`, collector submission metadata, and mandatory corroboration. It should add bounded event-graph expansion and benchmarks without converting radar or benchmark records directly into canonical inventory.

## Phase 6 consolidation handoff — September 2

The six-phase expansion is integrated behind the existing shared-state planning boundary. Trusted canonical happenings can seed a bounded, provenance-bearing event graph; official related-event facts become review-only leads. PredictHQ and terms-approved Bandsintown adapters produce benchmark-only snapshots with overlap and incremental-yield metrics, while Songkick remains disabled. Refresh, quota, raw-retention, attribution and licensing policy is explicit, and plan acceptance rechecks event and Place operations.

The final deterministic audit passes for 33 Places per city and all seven supported three-option corridor proxies. Records lacking operational price/hours evidence are non-stageable, while other incomplete operating evidence produces specific warnings. Qualification states remain internal and are no longer rendered as tags. No Phase 6 provider credential was configured or live benchmark run performed, and no benchmark or graph record was connected to the UI.
