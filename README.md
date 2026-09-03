# Local Buzz

Local Buzz is a WebMCP-native web experience for discovering and shaping what to do in a city right now.

For the WebMCP Challenge, the primary screenplay focuses on Stockholm and one core interaction. The proof of concept also includes San Francisco to demonstrate that the interaction model is portable across cities:

> A person and their personal agent collaboratively construct and repair a live evening in the same visual workspace.

The human works through a map, event cards, and an evening timeline. The agent works through structured WebMCP tools. Both operate on the same application state.

## Contest thesis

Local Buzz is not an AI itinerary generator.

It is a shared model of a night that stays alive.

- Local Buzz knows the city.
- The user's agent knows the user.
- The human provides taste and judgment.
- The agent handles complexity and constraint reconciliation.
- The interface keeps both parties grounded in the same plan.

This directly targets the WebMCP Challenge brief: build an app that becomes meaningfully better when people and their agents use it together.

## Deadline

WebMCP Challenge submission deadline:

- September 3, 2026
- 1:00 PM PDT
- 22:00 CEST in Sweden

Internal target: have the submission substantially complete by Thursday afternoon CEST.

## Prototype scope

The contest prototype is deliberately narrow:

- Cities: Stockholm and San Francisco; Stockholm remains the primary demo path
- Time horizon: tonight / near-term evening
- Data: small real dataset, enriched where needed
- Core UI: map + event cards + evening timeline
- Core collaboration loop:
  1. agent searches
  2. agent stages a plan
  3. human edits or locks part of it
  4. agent reads the changed state
  5. agent repairs around the human decision
  6. a simulated live disruption occurs
  7. agent repairs only the affected portion
  8. human accepts the result

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

Run the complete local verification gate:

```bash
npm run verify
```

Individual commands are available as `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.

### Two-city social pulse

For either city, the client loads canonical ingestion from `GET /api/ingestion/:city` and independently requests `GET /api/pulse/:city`. Pulse collection performs one broad X Search pass and one trusted-account pass, validates both locally, deduplicates evidence/accounts, computes a deterministic Buzz Score, and caches successful results for 12 minutes. A slow or failed pulse never delays or erases canonical events. Social signals enter shared UI/WebMCP state only when their venue resolves to an existing source-backed event or Place; matching scheduled events are enriched instead of duplicated.

The event route falls back to a small current set of directly verified official-calendar records when live web collection is empty or unavailable. That fallback is deliberately bounded and source-labelled; it is not a claim of complete city coverage.

Run a full two-pass collection cycle and save the normalized result under the ignored `fixtures/pulse/` directory:

```bash
npm run pulse:city -- --city=stockholm
npm run pulse:city -- --city=san-francisco
```

`pulse:sf` remains a compatibility alias. Optional trusted groups can be supplied with `--groups=venues,culture`; the canonical city boundary, local terms, neighborhoods, handle groups and geocoding hints live in `server/pulse/config/cities.ts`. Raw post text and images are not retained.

Run the scheduled-event collector separately with `XAI_API_KEY=... npm run events:sf`. This diagnostic command writes its normalized response under the ignored `fixtures/events/` directory.

For Cloudflare, set the key as a Worker secret rather than a Vite variable:

```bash
npx wrangler secret put XAI_API_KEY
```

## Implemented architecture

- React 19, TypeScript, and Vite 6
- `@modeless/design-system` 0.1.0 consumed from the checked-in package tarball under `vendor/`
- MapLibre GL JS with OpenFreeMap's OpenStreetMap-based Liberty style
- one client-side `LocalBuzzState` owned through `LocalBuzzActions`
- 60 normalized happening occurrences across Stockholm and San Francisco with source URLs and validation tests
- real, pannable basemaps for both cities with event markers and a plan-route overlay derived from domain state
- static WebMCP registration through the current `document.modelContext` API
- agent-specific motion driven by real WebMCP tool lifecycle events, with direct plan arrivals and minimal repair
- cached server-side San Francisco event and social-pulse routes feeding the canonical city state; no authentication, user profile, or analytics

The UI and WebMCP callbacks receive the same `LocalBuzzActions` instance. For example, both a timeline lock click and `lock_plan_stop` call `actions.lockPlanStop(stopId)`.

Phases 1 and 2 add first-class source-backed Places and mixed nights. Each city has 33 qualified snapshots spanning restaurants, bars, pubs, cocktail lounges, wine bars, music bars and clubs. Records with incomplete operating evidence remain searchable but cannot be added as if their hours or price were known. The Events/Places surface and sixteen WebMCP tools share purpose, price, mood, neighborhood, kind and arrival-time filtering plus direct plan editing, party-size budget, timing, lock/unlock/removal, surgical event repair and review-only event/Place acquisition.

Generate bounded Foursquare Open Source Places review candidates with `npm run places:import`; see `docs/data-sources.md`. Import output never enters the UI automatically.

Measure current inventory gaps with `npm run data:coverage`. Run one explicit, cached gap search with `npm run data:discover -- --city <city> --target <generated-target-id>`, and refresh official municipal radar with `npm run data:radar -- --city <city>`. All search and permit results remain DiscoveryLeads or corroboration-required radar records; none publish canonically. See `docs/coverage.md`.

## WebMCP tools

| Tool | Visible/shared-state effect |
| --- | --- |
| `search_happenings` | Searches normalized inventory and returns source-backed candidates. |
| `show_candidates` | Emphasizes pins/cards on the human interface. |
| `build_evening_plan` | Replaces the editable itinerary after full validation. |
| `add_happening_stop` | Adds one canonical event after validation. |
| `add_place_stop` | Adds one canonical Place and purpose after validation. |
| `add_custom_place_stop` | Adds one visibly unverified custom Place. |
| `read_current_plan` | Returns the current plan, human locks, and disruptions. |
| `lock_plan_stop` | Applies the same lock used by the timeline UI. |
| `unlock_plan_stop` | Releases a stop for agent edits or repair. |
| `remove_plan_stop` | Removes an unlocked stop. |
| `repair_plan` | Directly replaces only disrupted, unlocked stops. |

Tools use strict JSON schemas, structured errors, and abort-signal-owned registration. Stockholm and San Francisco start without a spending cap; plan-building and add-stop tools apply budget validation only when the user supplies an optional total-party `budget`. Unsupported browsers still get the complete human experience.

The conversation does not happen inside Local Buzz. The user talks to their personal agent in a WebMCP-aware browser's agent panel. While this page is open, the browser discovers the tools above; the agent calls them and the resulting candidates or current plan appear in the same map and timeline the human can edit.

Candidate emphasis is additive: agent-highlighted events or Places never replace the human's active city/time-window listing. Explicit human search can narrow the list, and clearing it restores the selected window without changing Your Night, its locks or agent-highlighted identities. The itinerary uses accessible city-local dates and times, shows only its time range and an honest complete, partial or unavailable party-price estimate, and links to tickets, dedicated reservations, event details or official venue websites only when the corresponding destination is valid.

## Map provider

The prototype uses [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) with [OpenFreeMap](https://openfreemap.org/quick_start/). OpenFreeMap's public instance requires no account or API key and automatically supplies the required OpenStreetMap/OpenMapTiles attribution through MapLibre. It does not provide an SLA, so a production launch should either sponsor/self-host the same open stack or choose a supported commercial tile provider.

## Prototype data disclosure

The fixture intentionally separates:

- source-backed fields: titles, venues, coordinates, dates/times, source links, and source-provided pricing where available;
- Local Buzz enrichment: mood tags, estimated visit duration, spontaneity, and experience fit;
- prototype simulation: one deterministic availability change used to demonstrate plan repair.

The fixtures are contest snapshots verified on August 30, 2026—not a claim of live availability. Source links remain visible on every card. The simulated update is labeled in the timeline, activity bar, and documentation. Switching cities resets the active night so plan state and inventory cannot cross city boundaries.

## Deployment

The production target is `https://localbuzz.modeless.io`.

Verified production deployment:

- [https://localbuzz.modeless.io](https://localbuzz.modeless.io)
- HTTP 200 with a valid Cloudflare-managed HTTPS custom domain
- all sixteen current WebMCP tools discovered in the deployed page
- `read_current_plan` completed successfully against the deployed page
- `Permissions-Policy: tools=(self)` confirmed on the deployed response

The earlier `https://local-buzz.alsmith.workers.dev` preview is no longer the production target; the current custom-domain deployment disables the `workers.dev` route by default.

The repository uses Cloudflare static assets through `wrangler.jsonc`, with the existing Vite `dist` output:

```bash
npm run deploy
```

The Worker is named `local-buzz`; its configuration includes the intended `localbuzz.modeless.io` custom-domain route. Attaching that shared-domain route is intentionally a separately approved operational step. Wrangler's `not_found_handling` preserves the single-page fallback. The static `_headers` file applies the same-origin `tools` permissions policy.

Deployment requires an authenticated Cloudflare account and DNS access; no credentials are stored in this repository.

## Repository source-of-truth order

When working in the existing product harness, use this order:

1. `AGENTS.md`
2. `PRODUCT.md`
3. `docs/v1-scope.md`
4. `ARCHITECTURE.md`
5. `PLANNER.md`
6. `TASKS.md`
7. `DECISIONS.md`
8. `MEMORY.md`
9. `CODEX.md` or other agent adapter

Existing harness conventions and Modeless implementation rules take precedence over generic assumptions in this package.

## Agent start here

For a coding agent:

1. Read `CODEX.md`.
2. Inspect the existing repository before changing anything.
3. Read all product and architecture documents.
4. Follow the existing Modeless harness conventions.
5. Update existing files in place rather than creating a nested scaffold.
6. Build the human interaction path first.
7. Expose the same application functions through WebMCP.
8. Do not expand scope until the demo loop is working end to end.

## Event ingestion

Run a bounded server-side refresh with `npm run events:refresh -- stockholm` or `npm run events:refresh -- san-francisco`. Visit Sweden requires no credential. Ticketmaster uses server-only `TICKETMASTER_API_KEY`; Stockholm Billetto uses both server-only `BILLETTO_API_KEY` and `BILLETTO_API_SECRET`. Missing credentials report the source unavailable and preserve its last-good inventory. See `.env.example` and `docs/event-ingestion.md`.

The app cold-starts from the complete checked-in Place catalog and any still-valid retained events, then makes one request to `/api/ingestion/:city`. Per-source status is visible under **Event sources** and through `read_current_plan`. Empty or failed collection never erases last-good data; expired fixtures are provenance only. With zero current events, the app opens on Places and the manual fallback stages a valid two-Place night for review.

## Data acquisition and audit operations

Phase 6 remains development-only and does not add browser tools or canonical-write paths. `npm run data:graph` builds a bounded identity graph from explicitly named canonical happenings. `npm run data:benchmark` compares optional PredictHQ or approved Bandsintown results without publishing them. `npm run data:audit` verifies catalog size, exclusions, provenance, discovery/canonical separation and the seven operational Place corridors. Outputs are written to the ignored `coverage/` directory. See `docs/operations.md`.

## Official references

- Challenge: https://webmcp.devpost.com/
- Resources: https://webmcp.devpost.com/resources
- WebMCP repository: https://github.com/webmachinelearning/webmcp
- WebMCP explainer/spec: https://webmachinelearning.github.io/webmcp/
- OpenAI showcase: https://developers.openai.com/showcase?view=webmcp-apps
