# ARCHITECTURE.md

## Goal

Implement the smallest architecture that convincingly demonstrates shared human-agent state through WebMCP.

Do not optimize for production-scale ingestion, accounts, payments, or recommendation infrastructure.

## High-level architecture

```text
External event sources / seed dataset
                |
                v
        Normalized happenings
                |
                v
        Local Buzz application
        ----------------------
        Shared domain state
          |             |
          |             |
     Human UI       WebMCP tools
     map/cards      structured calls
     timeline            |
          \             /
           \           /
            same functions
                |
                v
       staged / accepted plan
```

## Core rule

Human UI actions and WebMCP tools must call the same domain functions.

Do not create separate "agent state" and "UI state."

Example:

```ts
lockPlanStop(stopId)
```

should be callable from both:

```ts
onClick={() => lockPlanStop(stop.id)}
```

and:

```ts
document.modelContext.registerTool({
  name: "lock_plan_stop",
  execute: ({ stopId }) => lockPlanStop(stopId)
})
```

This is the architectural heart of the prototype.

## Implemented stack

Repository inspection found a documentation-only harness, so the smallest matching application stack was added:

- React 19
- TypeScript 5.7+
- Vite 6
- npm and `package-lock.json`
- `@modeless/design-system` 0.1.0 from a checked-in local tarball
- MapLibre GL JS with OpenFreeMap vector tiles
- Vitest for pure domain/data/WebMCP tests
- ESLint 9 for source linting
- Cloudflare Worker with static-asset fallback and cached `/api/events/san-francisco` and `/api/pulse/san-francisco` routes

There is one application route and no routing dependency. Application and plan state remain client-owned. Server-side San Francisco collectors own the xAI secret and return validated event or pulse records; the client adapts accepted records into the same canonical state used by the UI and WebMCP tools.

Application entry points:

- `index.html`
- `src/main.tsx`
- `src/App.tsx`

State and domain entry point:

- `src/domain/store.ts`

WebMCP entry point:

- `src/webmcp/register.ts`

## Shared state model

```ts
type LocalBuzzState = {
  activeCityId: "stockholm" | "san-francisco"
  happenings: Happening[]
  filters: SearchFilters
  visibleHappeningIds: string[]
  candidateHappeningIds: string[]

  currentPlan: EveningPlan | null
  liveUpdates: LiveUpdate[]

  selectedHappeningId?: string
  activityMessage: string
  webMcp: "checking" | "available" | "unavailable" | "error"
}
```

## Domain entities

### CityContext

```ts
type CityContext = {
  city: "Stockholm" | "San Francisco"
  currentTime: string
  startLocation?: GeoPoint
  endLocation?: GeoPoint
  budget?: number // absent means no spending cap
  currency: "SEK" | "USD"
  latestEndTime?: string
  partySize?: number
}
```

### Happening

See `docs/data-model.md`.

### EveningPlan

```ts
type EveningPlan = {
  id: string
  stops: PlanStop[]
  totalEstimatedCost: number
  startTime: string
  endTime: string
  constraints: PlanConstraints
  rationale?: string
}
```

### PlanStop

```ts
type PlanStop = {
  id: string
  happeningId: string
  plannedStart: string
  plannedEnd: string
  locked: boolean
  status: "active" | "conflict" | "unavailable"
}
```

## Domain functions

At minimum, implement:

```ts
searchHappenings(filters)
showCandidates(ids)
buildEveningPlan(input)
addHappeningStop(input)
addPlaceStop(input)
addCustomPlaceStop(input)
readCurrentPlan()
lockPlanStop(stopId)
unlockPlanStop(stopId)
removePlanStop(stopId)
replacePlanStop(stopId, replacementHappeningId)
retimePlanStop(stopId, newStartTime)
repairPlan(input)
applyLiveUpdate(update)
```

Not every function must become a WebMCP tool. Some are internal support operations.

## Direct-edit plan model

`currentPlan` is the sole itinerary. Human and WebMCP mutations run the same validators and update it atomically; invalid operations leave it unchanged. Searches only change candidate visibility. Locks protect user intent from agent removal, replacement, rebuild and repair until explicitly unlocked. A human may explicitly remove a locked stop.

## WebMCP registration

The prototype uses a robust static set of sixteen discovery, acquisition and direct-plan tools. Dynamic registration is deliberately deferred.

Example:

### Before a plan exists

- `search_happenings`
- `show_candidates`
- `build_evening_plan`
- `add_happening_stop`
- `add_place_stop`
- `add_custom_place_stop`

### After a plan exists

Add:

- `read_current_plan`
- `lock_plan_stop`
- `unlock_plan_stop`
- `remove_plan_stop`
- `repair_plan`

The current official `document.modelContext.registerTool()` API is feature-detected. Each registration uses a shared `AbortSignal`, so React cleanup unregisters the exact tools owned by the component lifecycle. Browsers without WebMCP keep the complete human workflow.

## Data architecture

For the contest implementation:

- ingest or curate a small real Stockholm dataset
- normalize into a typed local fixture
- keep source provenance on every record
- enrich with prototype-specific attributes in a separate field
- make demo-specific live-status changes deterministic

The checked-in fixtures have 60 occurrences across Stockholm and San Francisco and validate city ownership, unique IDs, dates, coordinates, categories, prices, currencies, and provenance. No generalized scraping framework.

Each city definition owns its inventory, currency, time zone, map origin, agent prompt, demo plan, and search defaults. A city switch creates a fresh city-scoped state while preserving only the WebMCP connection status. This prevents cross-city plans without introducing routing or a backend.

No ingestion pipeline unless a source can be integrated quickly and reliably.

## Two-city social pulse

`worker/index.ts` and the local Vite middleware handle `GET /api/pulse/stockholm` and `GET /api/pulse/san-francisco`. Each route calls xAI's Responses API with the built-in X Search tool in parallel broad and trusted-account passes, then locally validates, merges, scores and bounds the structured output. The key remains server-only as `XAI_API_KEY`.

City-specific boundaries, terms, time zones, neighborhoods, trusted account groups and geocoding hints live in `server/pulse/config/cities.ts`, outside collector logic. Successful results are cached for 12 minutes. The Worker retains the last successful payload and labels it `retained` when a later collection fails; without a last-good payload the route returns explicit `unavailable`. Logs contain timing and counts, never raw posts or authorization headers.

## San Francisco fresh event inventory

`worker/index.ts` also handles `GET /api/events/san-francisco`. A server-side xAI Web Search collector discovers current scheduled events, while a local validator enforces exact times, physical San Francisco coordinates, safe source URLs, temporal integrity, and minimum confidence. Empty or unavailable live collection falls back to a bounded set of directly verified official-calendar records with a fixed verification timestamp.

On city selection, canonical ingestion and pulse refresh independently. `LocalBuzzActions.applyCityPulse` strips expired prior pulse decoration, merges support into scheduled events by venue, admits only safely resolved standalone signals, and never modifies `currentPlan`. Time-window search remains authoritative, so Tomorrow and non-today date views do not inherit current pulse signals.

## Agent motion architecture

WebMCP motion is a derived presentation channel, not a second source of product state. `registerWebMcp` wraps page-defined tool execution with typed lifecycle events: received, applying, and completed or failed. React consumes those events to render the fixed-width command bay and four-strand Intent Loom; human UI actions continue to call the same domain operations without emitting agent-origin motion. The first `received` event is emitted before the short presentation handoff, so the page visibly responds as soon as WebMCP execution starts without inventing an indeterminate thinking state.

Plan arrival motion derives from real WebMCP lifecycle events and the resulting canonical `currentPlan`. Repair updates that plan directly while locked and unaffected stops remain anchored. Map event signals are separately derived from canonical timing, availability and source-verification timestamps; they never claim live activity for unavailable or merely stale records. Motion never delays or changes validation, plan calculations or repair rules beyond a short 180ms visual handoff before the shared-state mutation.

All effects degrade to effectively instantaneous state changes under `prefers-reduced-motion: reduce`.

## Phase 1 mixed-place architecture

`CityDefinition` owns separate `happenings` and `places` catalogs. Both are copied into `LocalBuzzState`; visible/candidate/selected IDs remain explicit per entity type so map and card presentation never becomes a second source of truth.

`PlanStop` is a discriminated union:

- `kind: "happening"` references a canonical `Happening` ID.
- `kind: "place"` references a canonical `Place` ID and carries a dinner/drinks purpose.
- `kind: "custom_place"` embeds the user's explicit location, duration, price, availability and an immutable `unverified` marker.

Shared plan summarization resolves cost by stop kind and multiplies the per-person minimum by the plan party size. Place staging additionally validates city currency, supported purpose, typed weekly/overnight hours, kitchen cutoffs when available, typical duration, overlap, budget and latest end. Records without both a price range and weekly hours fail with `PLACE_DATA_INCOMPLETE`; they remain useful discovery evidence without becoming false operating claims.

`stageHappeningStop`, `stagePlaceStop`, and `stageCustomPlace` all append through the same staged-plan validator used by human controls. Locks, removal, acceptance and rejection are union-generic. `applyLiveUpdate`, event replacement and `repairPlan` narrow to happening stops; mixed-plan neighbor times still constrain the repair, and locked/unaffected place stops are copied unchanged.

Map routes resolve coordinates for every stop kind. Canonical place pins use the shared Place catalog; custom stops use their embedded coordinates and a dashed treatment. Timeline labels expose event versus place, purpose, custom-place identity, staged versus accepted, locks, disruptions and repairs without qualification-status tags. Agent motion remains derived only from tool lifecycle and shared plan state.

## Phase 2 Place qualification architecture

The catalog now composes the small Phase 1 seed with a city-specific expansion snapshot, producing 33 Places per city without changing state ownership. Discovery evidence comes from the city editorial sources; official business pages own identity and operational claims. Records with unknown hours or prices stay searchable but are deliberately non-stageable.

`searchPlaces` is the single filtering boundary for the React controls and `search_places`. Purpose, price, mood, neighborhood, kind and arrival-time checks therefore cannot drift between the human and agent surfaces. Staging adds structured failures for reservation conflicts and operational uncertainty, plus non-blocking warnings for stale/incomplete verification and exceptional-hours uncertainty.

`src/data/foursquareImporter.ts` is an isolated candidate-ingestion boundary. It accepts already city-bounded rows, filters and deduplicates them, and emits review candidates with stable provider IDs. It does not mutate `CityDefinition`, write into the canonical catalog, contact Foursquare, or introduce a backend. Official-site review is required before a candidate can become a published `Place`.

## Map architecture

The map is a human interface, not the core data model.

Keep map state derived from domain state:

- happenings determine pins
- visible IDs determine currently shown pins
- plan stops determine route/sequence overlays
- status determines visual state

Avoid storing duplicate domain truth inside map component state.

The implemented map uses MapLibre GL JS with OpenFreeMap's OpenStreetMap-based Liberty vector style. It provides real roads, water, neighborhoods, labels, pan, and zoom without an API credential. Local Buzz owns only the domain overlays: DOM event markers, the active city's start-location context, and a GeoJSON plan route.

The public OpenFreeMap service has no SLA. A tile failure must not corrupt Local Buzz state; the timeline, cards, and WebMCP tools remain independent of map rendering. Before production-scale launch, choose between the same stack with self-hosted/supported tiles or a commercial provider.

## Error handling

WebMCP tools should fail with actionable, structured messages.

Example:

```json
{
  "ok": false,
  "code": "LOCKED_STOP_CONFLICT",
  "message": "The proposed repair would replace a locked stop.",
  "suggestion": "Choose a different replacement or ask the user to unlock the stop."
}
```

## Security and privacy

For the prototype:

- no secrets in client code
- no collection of personal profile data unless required
- no real payment
- no real reservation confirmation
- no hidden location tracking
- no claims of crowd density without a legitimate source
- clearly label simulated live updates

Follow official WebMCP security guidance before final submission:
https://developer.chrome.com/docs/ai/webmcp-security/

## Deployment

Use the deployment path already favored by the harness unless it blocks ChatGPT in-app browser or WebMCP testing.

Acceptance requirement:

- public live URL
- WebMCP tools discoverable in ChatGPT's in-app browser
- WebMCP tools testable in Chrome with WebMCP testing enabled

## Phase 3 allowlisted event ingestion

`server/ingestion` is the server-side boundary for sanctioned APIs and allowlisted first-party calendars. The registry owns source configuration; parsers emit `EventCandidate` records; the shared pipeline validates and converts them into canonical `Happening`; and snapshot selection prevents empty or invalid refreshes from replacing last-good inventory. Product state, mixed plans, the map and WebMCP continue to consume only `Happening`.

`GET /api/ingestion/:city` runs in local Vite middleware and the Cloudflare Worker. Source failures are isolated, and metadata distinguishes fresh, retained, unavailable, disabled and invalid sources. Ticketmaster and xAI credentials remain server-side. Sitemap traversal is bounded to allowlisted first-party URLs. See `docs/event-ingestion.md`.

## Phase 4 discovery frontier

`LocalBuzzState.discoveryLeads` is a review-only frontier beside canonical `happenings` and `places`. `propose_event_from_url` and `propose_place_from_url` accept structured agent-read facts plus public evidence URLs and call the same `LocalBuzzActions` methods used by the review UI. Local Buzz performs no arbitrary URL fetch.

Proposal validation blocks non-HTTPS, credentialed, local, private, link-local, oversized and control-character inputs. Missing fields, duplicate matches and insufficient provenance remain visible on a provisional lead. Only `acceptDiscoveryLead` can invoke canonical validators and append inventory; rejection changes no inventory; a Place may instead be staged through the existing unverified custom-stop validator.

## Phase 5 demand-shaped discovery

`server/discovery` adds a pure coverage cube beside, not inside, product state. It classifies canonical future events across city, configured neighborhood, category, local evening window, city-currency price band and lead-time band. The report also derives stale inventory, overrepresented categories, neighborhood/late/inexpensive gaps and operational Place-to-event corridor gaps. `npm run data:coverage` writes stable ordered JSON and a concise terminal report.

Ranked weak cells become bounded `CoverageSearchTarget` values. `npm run data:discover` runs one explicit target through a server-only xAI Web Search, validates at most ten results through the Phase 4 discovery builder and emits `DiscoveryLead` records rather than `Happening`. Matching searches, including valid empty searches, are cached for six hours; failures and missing credentials retain matching last-good leads. The browser never starts a paid gap search automatically.

Municipal adapters retain DataSF closure/PermitSF facts in `MunicipalRadarSnapshot`. They have no canonical conversion. A deterministic suggested query requests independent evidence, and `corroborateMunicipalRecord` requires a separate official/venue/ticket source that identifies the municipal record before producing a discovery lead. Empty/failed municipal refreshes preserve per-source last-good records. The Stockholm official land-permit source is registered but disabled until its credentialed collection/field contract is verified.

## Phase 6 graph, benchmarks and operations

`server/eventGraph` builds a bounded relationship graph only from explicitly trusted canonical happenings. Stable event, venue, organizer, performer and ticket-platform identities retain provenance on every edge. Expansion is capped by depth, records, provider queries, refresh interval and an explicit domain allowlist; cycles and uncertain identities are rejected or left for review. Related official event facts can produce a normal `DiscoveryLead`, never a `Happening`.

`server/benchmarks` isolates PredictHQ and Bandsintown results in `BenchmarkSnapshot` records with `benchmarkOnly: true`. Comparison measures overlap, credible provider-only candidates, weak categories and incremental yield per request. Missing credentials, provider failures and empty/invalid refreshes preserve matching last-good records. Bandsintown requires approved organizational access and trusted performer identities; Songkick remains disabled without licensed access.

`server/operations` owns refresh/quota/retention/licensing policy and the deterministic final audit. Source raw payloads are either not retained or cache-only, text reuse is facts-only unless provider terms govern it, and images are prohibited without explicit permission. Immediately before plan acceptance, the shared domain action rechecks event cancellation/sellout and canonical Place hours, kitchen cutoff, reservation and operational completeness; uncertainty is returned as warnings.

## P0 unified city startup and observable inventory

`createInitialState` synchronously loads the active city's complete canonical Place snapshot plus any checked-in event occurrences that are still unexpired. `refreshCityData` is the only browser startup owner. It assigns a request ID, marks permitted registry sources `refreshing`, awaits the single `/api/ingestion/:city` snapshot, and applies it through `LocalBuzzActions`. A result is ignored when its request ID is stale or its city is no longer active.

The ingestion endpoint awaits all permitted collectors, including the server-only SF xAI scheduled-event collector, and orders results by registry order before deterministic deduplication. Social pulse remains non-canonical and is not converted into confirmed events. Empty, malformed, timed-out and failed refreshes preserve unexpired last-good records; expired records remain in provenance history but are excluded from current/search views.

`LocalBuzzState.eventInventory` is shared by UI and WebMCP. It records the active request, current/retained/expired totals and per-source fresh/retained/unavailable/disabled/invalid/refreshing state with safe counts and diagnostics. Inventory refresh never stages, accepts, rejects or edits a plan.

## Listing and candidate-state boundary

`visibleHappeningIds` and `visiblePlaceIds` represent the human's current listing, including the active city/time window and any explicit human search or filter. `candidateHappeningIds` and `candidatePlaceIds` are an independent emphasis layer. WebMCP `show_candidates` and `show_place_candidates` may promote IDs into the current listing and highlight them, but never remove unrelated visible records. Human search may narrow a listing; clearing it recomputes the complete active time window without mutating `currentPlan`, locks or candidate IDs. City switching clears all incompatible listing, candidate and plan state.

Operational inventory metadata remains in shared state and WebMCP results, but is not rendered as a primary consumer-facing status strip. Source attribution stays attached to event and Place records.

Timeline price presentation resolves the evidence for every referenced stop rather than trusting a numeric zero. Incomplete totals are labelled partial or unavailable. Budget validation is activated only when the user supplies a cap; without one, unknown prices remain visible uncertainty rather than blocking the itinerary.
