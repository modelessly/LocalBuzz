# DECISIONS.md

Append-only decision log.

Use this file for product and architectural decisions that future agents or collaborators should understand. Do not rewrite history. If a decision changes, add a new entry that supersedes the earlier one.

## Decision Template

```md
---

## YYYY-MM-DD: [Decision Title]

Decision:
[What was decided.]

Reasoning:
[Why this direction was chosen.]

Tradeoffs:
[What this makes easier and what it makes harder.]

Status:
[Proposed / Accepted / Superseded]
```

---

## 2026-05-29: Use This Repository As A Product Harness

Decision:
This repository is a reusable product-start template rather than a product-specific codebase.

Reasoning:
The goal is to help a coding agent start new products faster by providing shared workflow instructions, product-shaping prompts, architecture guidance, and planning documents before application code exists.

Tradeoffs:
The template stays intentionally generic, so each new product still needs a real PRD and initial stack choice before implementation begins.

Status:
Accepted

---

## 2026-05-29: Keep V1 Scope Narrow By Default

Decision:
New products created from this harness should start with a narrow V1 and avoid backend infrastructure, authentication, cloud services, social features, AI generation, analytics, and unnecessary dependencies unless explicitly required by the product brief.

Reasoning:
Most early product risk is about proving the core workflow and user value. Extra infrastructure increases complexity before the product has earned it.

Tradeoffs:
Some products will need to add infrastructure earlier, but that decision should be deliberate and documented.

Status:
Accepted

---

## 2026-08-30: Stockholm Is The Prototype City

Decision:
Use Stockholm as the only prototype city.

Reasoning:
The contest proof benefits from dense event supply, geographic familiarity, and a coherent launch story.

Tradeoffs:
The data model can remain broadly understandable, but no multi-city UX or infrastructure will be built this week.

Status:
Accepted

---

## 2026-08-30: Build The Contest Proof, Not The Full Product

Decision:
Scope the September 3 challenge submission to one polished human-agent collaboration loop.

Reasoning:
The interaction model—not production ingestion or account infrastructure—is the contest thesis.

Tradeoffs:
Useful future capabilities remain out of scope until the core demo is reliable.

Status:
Accepted

---

## 2026-08-30: Use React, Vite, And The Modeless Package

Decision:
Build a React 19 and TypeScript single-page app with Vite 6, consuming a repository-owned tarball of `@modeless/design-system` 0.1.0.

Reasoning:
The product harness has no application scaffold. This matches the tested Modeless external-consumer path while keeping deployment self-contained.

Tradeoffs:
The vendored package must be refreshed deliberately when the design system changes.

Status:
Accepted

---

## 2026-08-30: Keep One Shared State And Domain API

Decision:
Human UI actions and WebMCP tools must dispatch the same domain operations against one in-page state model.

Reasoning:
Shared state is the central product proof and prevents agent-only behavior from diverging from the visible experience.

Tradeoffs:
Domain operations must remain UI-independent and explicitly validated.

Status:
Accepted

---

## 2026-08-30: Stage Material Plan Changes

Decision:
Plan creation and repair are staged for human review; locks and explicit human edits apply immediately.

Reasoning:
The human remains authoritative and agent work stays visible and reversible.

Tradeoffs:
The superseded implementation maintained two plan copies and an additional approval step.

Status:
Superseded on 2026-09-03 by “Use One Directly Editable Itinerary.”

---

## 2026-08-30: Repair Rather Than Regenerate

Decision:
Repairs preserve locked and unaffected stops and replace only conflicting portions.

Reasoning:
This is the clearest product distinction from a static AI itinerary generator.

Tradeoffs:
The prototype uses deterministic repair candidates rather than a generalized optimizer.

Status:
Accepted

---

## 2026-08-30: Use A Curated Data Snapshot And Explicit Simulation

Decision:
Use a local normalized snapshot of real Stockholm venues/happenings with Local Buzz enrichment, plus one clearly labeled deterministic availability simulation.

Reasoning:
This supports a credible, reliable contest demo without building an ingestion platform.

Tradeoffs:
The snapshot is not live inventory and its source verification date must be shown.

Status:
Accepted

---

## 2026-08-30: Use A Dependency-Free SVG Map

Decision:
Project real venue coordinates onto a purpose-built Stockholm SVG map rather than loading remote tiles or adding a mapping SDK.

Reasoning:
The spatial relationship is essential, while live tile loading and API credentials add demo risk without improving the shared-state proof.

Tradeoffs:
The map is intentionally schematic and does not provide pan, zoom, geocoding, or turn-by-turn routing.

Status:
Accepted

---

## 2026-08-30: Use Cloudflare Pages Deployment Shape

Decision:
Configure `dist` as a Cloudflare Pages build output using the same `wrangler.jsonc` convention found in an existing Modeless product repository.

Reasoning:
No deployment configuration existed in the harness. Cloudflare already serves Modeless products and can attach the required `localbuzz.modeless.io` subdomain without application infrastructure.

Tradeoffs:
Actual deployment and DNS attachment require external Modeless Cloudflare credentials and remain an operational step.

Status:
Accepted

---

## 2026-08-30: Keep The Human Interface Primary

Decision:
The map, cards, and timeline must remain understandable and fully operable without an agent.

Reasoning:
WebMCP should add a complementary interface into the same product, not turn the page into an agent-only technical demo.

Tradeoffs:
Every critical operation needs a clear human affordance as well as a tool contract.

Status:
Accepted

---

## 2026-08-30: Replace The Schematic Map With MapLibre And OpenFreeMap

Decision:
Supersede the dependency-free SVG map with MapLibre GL JS using OpenFreeMap's OpenStreetMap-based Liberty style. Keep event markers and plan routes as Local Buzz-owned overlays derived from shared domain state.

Reasoning:
The user needs recognizable real geography, correct roads and place labels, and ordinary map navigation. OpenFreeMap provides that without an account or API key, while MapLibre keeps the renderer open-source and provider-portable.

Tradeoffs:
The map now has an external runtime tile dependency and adds significant client bundle weight. OpenFreeMap's public instance has no SLA. The prototype accepts those costs; production should evaluate self-hosting, supported OpenStreetMap tiles, Mapbox, or Google based on traffic and operational needs.

Status:
Accepted; supersedes "Use A Dependency-Free SVG Map."

---

## 2026-08-30: Seed First, Integrate Second

Decision:
Prefer a validated local snapshot over external APIs until the collaboration loop is complete and reliable.

Reasoning:
Coverage infrastructure is not the contest risk; shared-state collaboration is.

Tradeoffs:
The prototype discloses its verification date and does not claim live inventory.

Status:
Accepted

---

## 2026-08-30: Let The Personal Agent Bring Personal Context

Decision:
Do not build a Local Buzz user profile or preference-onboarding flow for the demo.

Reasoning:
The site knows Stockholm while the user's agent can bring private taste and situational context without creating another profile.

Tradeoffs:
Personalization is expressed through structured constraints passed into tools rather than stored accounts.

Status:
Accepted

---

## 2026-08-30: No Real Booking Or Payment

Decision:
Source and ticket links are sufficient; the prototype will not complete reservations, purchases, or payments.

Reasoning:
Those actions add risk and infrastructure without strengthening the collaboration proof.

Tradeoffs:
The final night is executable as a plan, but transactions remain on source sites.

Status:
Accepted

---

## 2026-08-30: Keep One Primary Implementation Thread And Freeze Wednesday

Decision:
Codex is the primary implementation agent, and feature work freezes September 2 after the collaboration loop is stable.

Reasoning:
A single implementation through-line reduces architecture drift; the final day is reserved for reliability, production verification, recording, and submission.

Tradeoffs:
Optional ideas remain parked even when technically attractive.

Status:
Accepted

---

## 2026-08-30: Supersede Pages With A Static-Assets Worker

Decision:
Deploy Local Buzz as a Cloudflare static-assets Worker named `local-buzz`.

Reasoning:
The authenticated Cloudflare account returned an internal error when creating the required Pages project. Cloudflare's current tooling recommends Workers for new static projects, and the Worker deployed successfully with the same Vite `dist` output and response headers.

Tradeoffs:
The generated public URL is `https://local-buzz.alsmith.workers.dev`. Attaching `localbuzz.modeless.io` is a separate shared-domain routing change that requires explicit authorization.

Status:
Accepted; supersedes “Use Cloudflare Pages Deployment Shape.”

---

## 2026-08-30: Add San Francisco As A City-Scoped Proof Of Concept

Decision:
Support Stockholm and San Francisco through one explicit city-definition model. Use a compact two-option header switch for the proof of concept. Switching cities clears the current plan while preserving only WebMCP connection status.

Reasoning:
Two contrasting cities demonstrate that Local Buzz's shared human-agent workspace, map, provenance, currency, and WebMCP tools are portable. With only two choices, a visible toggle is faster and clearer than a dropdown. Resetting the night prevents mixed-city plans without requiring accounts, routing, or persistent storage.

Tradeoffs:
San Francisco uses a small source-backed snapshot rather than a live ingestion pipeline, and Stockholm remains the primary reliable contest screenplay. A production product may derive city context from subdomains and replace the toggle with searchable city selection as coverage grows.

Status:
Accepted; supersedes “Stockholm Is The Prototype City” only for proof-of-concept breadth, not the primary contest screenplay.

---

## 2026-08-30: Adopt The Local Buzz Visual Target Without Rebuilding The Product

Decision:
Use the supplied dark, editorial Local Buzz mockup as the visual target. Replace the two-city segmented switch with one city dropdown, add a working Right Now / Later / Tomorrow / date selector, and retain the existing map, shared state, staged-plan workflow, repair behavior, and eight WebMCP tools.

Reasoning:
The mockup communicates the consumer proposition more clearly through a compact header, real-map emphasis, calm near-black surfaces, mint wayfinding, and denser event cards. Applying that hierarchy to the current components improves the demonstration without creating a second product architecture.

Tradeoffs:
The proof of concept uses the browser-native date input and a CSS-darkened OpenFreeMap style instead of building a custom calendar or migrating map providers. This favors reliability, accessibility, and zero new credentials over pixel-perfect reproduction. The dropdown supersedes the earlier two-option-toggle choice.

Status:
Accepted; supersedes only the header-control portion of “Add San Francisco As A City-Scoped Proof Of Concept.”

---

## 2026-08-31: Preserve OpenFreeMap Liberty's Original Rendering

Decision:
Use OpenFreeMap's Liberty style without CSS brightness, saturation, hue-rotation, or color-overlay treatments. Keep Local Buzz-owned mint, lime, and unavailable-state markers above the unmodified map.

Reasoning:
The darkening treatment made the real map look distorted and visually strange. Recognizable, trustworthy geography matters more than matching the mockup's dark cartography.

Tradeoffs:
The map is brighter than the approved visual reference, but roads, water, labels, and neighborhoods retain the provider's intended appearance. A future provider-native dark style can be evaluated separately rather than simulated with CSS filters.

Status:
Accepted; supersedes the CSS-darkened-map portion of “Adopt The Local Buzz Visual Target Without Rebuilding The Product.”

---

## 2026-08-31: Add Live City Time And Weather As Optional Header Context

Decision:
Show the active city's local clock and current temperature and weather condition immediately before the city selector. Calculate time locally with the city's IANA time zone and fetch current conditions directly from Open-Meteo every 15 minutes, using local temperature units.

Reasoning:
Time and weather materially improve “what should we do right now?” decisions and make switching cities feel grounded in the current place. Open-Meteo supplies current WMO-coded conditions without credentials and permits a small, client-only integration.

Tradeoffs:
The header now depends on one additional public network request and weather-model availability. Weather remains optional supporting context with an explicit unavailable state; it is not added to shared plan state or WebMCP tool schemas. The displayed conditions link to Open-Meteo for attribution.

Status:
Accepted

---

## 2026-08-31: Isolate The San Francisco Social-Pulse Collector

Decision:
Add one server-side Cloudflare Worker route that calls xAI X Search, validates a narrow normalized contract, and caches successful results for 12 minutes. Keep it disconnected from the production UI and WebMCP state while signal quality is evaluated.

Reasoning:
The API key cannot be exposed to the browser, refreshes should not create new paid searches, and untrusted model output needs a deterministic validation boundary before it can become product inventory.

Tradeoffs:
This introduces a deliberately small server-side dependency and xAI usage cost. It does not yet improve the visible prototype, and curated account configuration will need periodic review.

Status:
Accepted

---

## 2026-08-31: Make Agent Motion Explain Shared-State Changes

Decision:
Use a distinct motion language for WebMCP actions: tool-lifecycle progress, a directional action trail, direct plan-stop arrivals, and surgical repair animation limited to changed stops. Keep motion derived from WebMCP lifecycle events and existing plan state rather than adding agent-owned domain state.

Reasoning:
The interaction is easier to understand when users can see which surface the agent changed and exactly what a repair preserved. Real lifecycle labels also avoid fake AI-thinking theater.

Tradeoffs:
WebMCP calls include a 180ms visual handoff before mutation so the origin and destination can be perceived. The presentation is more distinctive but adds CSS and one small transient React state channel; reduced-motion users receive the same state changes without animation.

Status:
Accepted

---

## 2026-08-31: Reserve the WebMCP Command Bay and Expose Honest City Signals

Decision:
Keep a fixed-width WebMCP command bay in the header across idle and active states. Replace the single action trail with an Intent Loom whose place, time, budget, and taste strands begin on the first real tool-lifecycle event. Add low-amplitude map signals derived from event time and evidence freshness, plus a persistent before/after repair scar while a replacement is staged.

Reasoning:
Agent activity should feel immediate and distinctive without causing header reflow or pretending that generic animation is AI reasoning. Separating agent intent, temporal city activity, and human review makes the shared workspace legible at a glance.

Tradeoffs:
The presentation adds a pure time/freshness classifier and richer SVG/CSS, but no agent-owned domain state. Live pulses require real timing and availability; stale records use a static dashed treatment. All motion remains optional under reduced-motion preferences.

Status:
Accepted

---

## 2026-09-01: Represent Venues As Places And Plans As Mixed Entity Stops

Decision:
Add a canonical source-backed `Place` catalog beside `Happening`, and convert `PlanStop` into a discriminated union for happenings, canonical places, and embedded unverified custom places. Place additions always use the existing staged-review flow. Event disruption and surgical repair remain event-specific while treating every place stop as an unaffected constraint.

Reasoning:
A restaurant or bar is durable inventory, not a scheduled occurrence. Honest entity types let a human and an agent plan dinner, an event, and drinks without inventing event dates for venues. Keeping the catalog, operations, UI, and thirteen statically registered WebMCP tools in the existing shared state preserves the one-state human-agent architecture.

Tradeoffs:
The initial catalog is intentionally only eight official-source records per city. Records with incomplete hours or price evidence remain discoverable as `needs_review` but cannot be staged until the missing operating or price fields are supplied. Custom places can be staged with explicit user-provided availability, price, duration, and coordinates, but remain embedded unverified snapshots rather than canonical inventory. Phase 1 does not ingest venue calendars or add an importer.

Status:
Accepted

---

## 2026-09-01: Scale Places Through Qualified Snapshots And A Review-Only Import Boundary

Decision:
Expand each city to 33 source-backed Place snapshots while publishing numeric hours and prices only for the official-source operational subset. Keep incomplete records discoverable and visibly `needs_review`, but block them from canonical plan staging. Add a city-bounded Foursquare Open Source Places importer that emits review candidates and never writes directly into the product catalog.

Reasoning:
Mixed nights need broader local coverage, but raw provider rows and editorial discovery are not sufficient evidence for operating-time or budget decisions. Separating broad qualification from narrow plan readiness preserves useful discovery without fabricating availability.

Tradeoffs:
The catalog is large enough for supported corridors but remains a dated fixture, not a live directory. The straight-line corridor test is a deterministic coverage proxy rather than routing evidence. Official hours, prices and exceptional dates require periodic refresh, and Foursquare candidates need human official-site review before publication. Overture merging remains deferred.

Status:
Accepted

---

## 2026-09-01: Normalize Allowlisted Event Sources Through One Last-Good Pipeline

Decision:
Keep canonical `Happening` as the product event contract and place sanctioned APIs plus explicitly allowlisted first-party calendars behind one server-side registry, parser/validation/deduplication pipeline and last-good snapshot boundary. Missing credentials, empty responses and malformed sources cannot erase prior valid inventory.

Reasoning:
Mixed plans, locks, repairs, map state and WebMCP already depend on `Happening`. Source-specific candidates can be permissive while publication remains strict about physical city, venue, zoned time, expiration, URL, status and provenance.

Tradeoffs:
Some real rows stay unpublished until venue or time-zone resolution succeeds. Direct venue entries remain disabled while permission/terms review is pending. This yields less inventory than permissive scraping but keeps claims reviewable.

Status:
Accepted

---

## 2026-09-01: Keep Agent Acquisition In A Human-Reviewed Discovery Frontier

Decision:
Add event and Place `DiscoveryLead` records plus two static WebMCP proposal tools. The browser agent reads public pages and submits structured facts; Local Buzz validates the facts and URL but does not fetch arbitrary URLs. Leads remain discovery-only until explicit human review.

Reasoning:
The agent can use its browser context without introducing an SSRF-capable fetcher or bypassing canonical provenance, duplicate and operational checks. A visible frontier preserves the shared human-agent workflow and keeps canonical inventory reviewable.

Tradeoffs:
Agents must supply structured evidence, and incomplete leads require human resolution. Editorial/other-public pages cannot publish canonically without stronger provenance. Only Place leads with explicit location, duration, price and availability assumptions can be retained as unverified custom plan stops.

Status:
Accepted

---

## 2026-09-01: Measure Gaps And Keep Municipal Records As Radar

Decision:
Add a deterministic coverage cube and use its weak cells to generate narrow, manually invoked discovery searches. Keep DataSF closure and PermitSF records in a separate last-good radar snapshot; require independent official event evidence before they can become DiscoveryLeads, and retain human review before canonical publication.

Reasoning:
Collecting another broad feed overrepresents obvious categories while leaving neighborhood, late-night and inexpensive gaps invisible. Municipal records can reveal emerging activity but are operational permits, not public event listings. The existing discovery frontier is the correct boundary for uncertain acquisition.

Tradeoffs:
The fixed neighborhood and 3.5 km corridor configurations are deterministic proxies, not a complete city ontology or travel-time model. Targeted xAI searches remain credential-dependent and manual to control cost. Stockholm municipal radar remains disabled until the official credentialed collection and fields are verified.

Status:
Accepted

---

## 2026-09-02: Bound Relationship Discovery And Keep Benchmarks Non-Canonical

Decision:
Expand only from trusted canonical event identities through a depth-, domain-, query-, record- and cadence-bounded graph. Keep PredictHQ and approved Bandsintown results in benchmark-only snapshots; do not implement Songkick without licensed access. Recheck operational event and Place facts before every direct itinerary mutation.

Reasoning:
Relationship evidence can expose missing inventory, but uncertain identity joins and commercial-provider rows do not meet Local Buzz's canonical publication standard. Explicit operational policy preserves reviewability, quota safety, licensing boundaries and last-good behavior.

Tradeoffs:
The graph will miss valid relationships outside its allowlist and requires prepared structured candidates. Benchmarks require credentials and terms approval and cannot improve visible inventory directly. Direct itinerary mutations may stop when source status or Place operations no longer pass validation.

Status:
Accepted

---

## 2026-09-02: One Request-Scoped Startup Snapshot With Place-First Degradation

Decision:
Make `/api/ingestion/:city` the only event-inventory startup path in `App`. Load canonical Places synchronously, await permitted event collectors inside one server snapshot, and apply results only when city and request ID still match. Keep per-source health in shared state and default to Places whenever the active current-event view is empty.

Reasoning:
Independent SF ingestion and fresh-data effects could overwrite each other and hid delayed or failed collection behind generic copy. A request-scoped snapshot preserves one state owner while letting the product remain useful without credentials or current events.

Tradeoffs:
Cold refresh completion waits for the bounded collector timeout instead of returning a misleading fallback immediately. The UI may honestly show zero current events and disabled sources. Social pulse remains isolated because chatter is not canonical event evidence. Historical event fixtures remain stored for provenance but never count as current.

Status:
Accepted

---

## 2026-09-02: Remove Qualification Tags And The Mission Strip

Decision:
Do not render `verified`, `needs review`, `unverified`, or equivalent qualification statuses as tags in Local Buzz. Remove the numbered mission strip and its city sentence. Preserve source links, checked dates, catalog boundaries and specific operational safeguards in plain language.

Reasoning:
The labels add interface noise without helping a person choose a night. Specific evidence and actionable operating constraints communicate trust more clearly than internal qualification terminology.

Tradeoffs:
Internal status enums remain part of validation, fixtures and WebMCP data contracts for compatibility. The human interface no longer exposes those enum names, and the agent prompt is available through the existing handoff action rather than a persistent mission banner.

Status:
Accepted; supersedes the visible qualification-label portions of the Phase 1 and Phase 2 Place decisions.

---

## 2026-09-03: Use One Directly Editable Itinerary

Decision:
Maintain one canonical `currentPlan`. Explicit human and WebMCP build/add/remove/lock/unlock/repair operations validate first and then update it atomically. Search candidates remain discovery-only. Remove itinerary accept/reject state and tools. Preserve the separate DiscoveryLead catalog-review workflow.

Reasoning:
The itinerary itself is the shared human-agent artifact. An additional approval copy made selected stops ambiguous and slowed the core workflow. Atomic validation, persistent locks and visible direct controls keep changes reviewable without maintaining a second plan.

Tradeoffs:
Valid agent actions take effect immediately. Locks therefore become the hard protection boundary: agents cannot remove, replace, rebuild over or repair a locked stop, while a human may explicitly unlock or remove it. Failed operations must leave the current plan unchanged.

Status:
Accepted; supersedes “Stage Material Plan Changes” and the ghost-plan portion of “Make Agent Motion Explain Shared-State Changes.”

---

## 2026-09-03: Integrate A Bounded Two-City Social Pulse

Decision:
Generalize the server-side xAI X Search pulse to Stockholm and San Francisco, using independent broad and trusted-account passes, strict local validation, deterministic scoring and a 12-minute last-good cache. Merge venue-matched support into scheduled events and expose only safely resolved standalone signals in shared UI/WebMCP state.

Reasoning:
“Right Now” benefits from recent local evidence, but social posts are not canonical availability. Keeping the pulse additive, time-bounded and independently refreshable preserves trustworthy event inventory and the editable itinerary when xAI is slow or unavailable.

Tradeoffs:
Each uncached city refresh can make two paid searches. Signals without a known event or Place location are discarded, and standalone signals with unknown price cannot enter a hard-budget plan. Trusted handle ownership requires periodic operational review.

Status:
Accepted

---

## 2026-09-03: Separate Recommendations From Listings And Remove Admin UI Language

Decision:
Treat human listing filters and agent candidate emphasis as separate state concepts. Candidate tools may add emphasis without replacing the active time-window collection. Present acquisition leads as `Options`, remove pipeline counts and canonicalization terminology from the primary interface, and retain provenance through useful source links rather than an operational status strip.

Your Night displays city-local time, estimated total price, state-labelled lock controls and truthful ticket, reservation or venue links. A dedicated reservation URL is distinct from the official homepage so labels cannot overclaim the destination.

Reasoning:
An agent recommendation should help attention without making the product appear to have only one event. Consumer decisions depend on clear itinerary state, readable local times and actionable destinations; ingestion and validation terminology does not help that decision.

Tradeoffs:
Per-source health and qualification enums remain available to domain/WebMCP consumers and operations, but no longer occupy the primary human surface. Existing Places without a dedicated reservation URL use the honest `Venue website` fallback. Candidate promotion can add a recommended record to a human-filtered listing, but never removes the human's current results.

Status:
Accepted; supersedes the visible admin-language and candidate-replacement portions of earlier discovery decisions.

---

## 2026-09-03: Preserve Candidate Identity And Derive Price Completeness

Decision:
Human search and filter listing updates preserve agent candidate IDs; city switching remains the boundary that clears incompatible candidate state. Itinerary price presentation derives completeness from each referenced stop rather than assuming `totalEstimatedCost: 0` means free. Abbreviated date/time text carries a shared full localized accessible description, and empty searches provide a direct reset.

Reasoning:
Candidate identity and human result restriction are independent state dimensions. A partial numeric total presented as complete is less trustworthy than an explicit partial or unavailable state, and concise visual dates should not cost screen-reader clarity.

Tradeoffs:
Candidate emphasis can remain outside a narrowed human result set until that result set is cleared or the agent promotes the candidate again. Unknown-price events remain blocked by hard-budget validation; the presentation fallback is defensive rather than a planning bypass.

Status:
Accepted.
