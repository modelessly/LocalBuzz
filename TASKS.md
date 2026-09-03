# TASKS.md

## P0: must ship

### Harness and setup

- [x] Inspect existing repository and Git state.
- [x] Read all harness/product/architecture files.
- [x] Identify Modeless design system primitives and existing page patterns.
- [x] Identify build, lint, typecheck, test, and deploy commands.
- [x] Merge this package into existing files in place.
- [x] Merge Local Buzz guidance into the existing `CODEX.md`.
- [x] Add the Modeless MIT license for the public hackathon repo.

### Data

- [x] Implement normalized `Happening` type.
- [x] Create 48-occurrence source-backed Stockholm snapshot.
- [x] Keep source URL and source name on each record.
- [x] Separate source fields from derived/enriched fields.
- [x] Create deterministic demo disruption record.
- [x] Add fixture validation.
- [x] Add a 12-occurrence source-backed San Francisco snapshot.
- [x] Generalize city currency, time-zone, map, mission, and plan defaults.
- [x] Complete a 20-venue Stockholm source-coverage desk spike.

### Shared domain state

- [x] Implement `LocalBuzzState`.
- [x] Implement plan/staged-plan distinction.
- [x] Implement locked plan stops.
- [x] Implement staged changes.
- [x] Implement deterministic live update application.

### Human UI

- [x] Real, pannable Stockholm basemap through MapLibre GL JS and OpenFreeMap.
- [x] Happening pins.
- [x] Happening cards.
- [x] Evening timeline.
- [x] Plan totals: time + estimated cost.
- [x] Lock/unlock affordance.
- [x] Remove/replace affordance.
- [x] Staged-state visual treatment.
- [x] Accept/reject staged changes.
- [x] Unavailable/disruption visual state.
- [x] Provenance/freshness display.
- [x] Two-city Stockholm / San Francisco header dropdown.
- [x] Working Right Now / Later / Tomorrow / date search selector.
- [x] Reset plan state safely when changing cities.

### Domain functions

- [x] `searchHappenings`
- [x] `showCandidates`
- [x] `buildEveningPlan`
- [x] `addHappeningStop`
- [x] `addPlaceStop`
- [x] `addCustomPlaceStop`
- [x] `readCurrentPlan`
- [x] `lockPlanStop`
- [x] `unlockPlanStop`
- [x] `removePlanStop`
- [x] `replacePlanStop`
- [x] `repairPlan`
- [x] `applyLiveUpdate`

### WebMCP

- [x] Register `search_happenings`.
- [x] Register `show_candidates`.
- [x] Register `build_evening_plan`.
- [x] Register `add_happening_stop`.
- [x] Register `add_place_stop`.
- [x] Register `add_custom_place_stop`.
- [x] Register `read_current_plan`.
- [x] Register `lock_plan_stop`.
- [x] Register `unlock_plan_stop`.
- [x] Register `remove_plan_stop`.
- [x] Register `repair_plan`.
- [x] Validate strict JSON schemas.
- [x] Confirm each tool reuses application/domain logic.
- [x] Confirm tools update visible UI.
- [x] Confirm tools do not silently replace locked stops.
- [x] Confirm meaningful errors return structured messages.

### Demo

- [x] Run screenplay through the in-app browser and page-defined tools.
- [x] Human change materially affects next agent action.
- [x] Simulated disruption appears in UI.
- [x] Repair preserves locked stop.
- [x] Repair changes minimum necessary portion.
- [x] User can accept final staged repair.

### Testing

- [x] Domain unit tests.
- [x] Plan repair tests.
- [x] Locked-stop protection tests.
- [x] Data validation tests.
- [x] WebMCP registration smoke test.
- [x] Manual ChatGPT in-app browser test.
- [ ] Manual Chrome WebMCP test.
- [x] Production build passes.
- [x] Typecheck passes.
- [x] Lint passes.
- [x] City inventory isolation and city-switch tests.

### Submission

- [x] Public live Worker URL with WebMCP discovery verified.
- [ ] Attach and verify `localbuzz.modeless.io` after explicit shared-domain approval.
- [ ] Public repository.
- [x] Open-source license visible.
- [x] README setup instructions.
- [ ] Demo video <3 minutes.
- [ ] Devpost product description.
- [x] Explain why WebMCP is essential.
- [x] Explain human-agent collaboration.
- [x] Explain implementation.
- [x] Clearly disclose seeded/enriched/simulated data.
- [x] Final repo diff and secret-pattern review.

## P1: only after P0 works

- [x] Canonical validated Place model and eight-place official-source seed per city.
- [x] Discriminated mixed PlanStop union with canonical and custom unverified places.
- [x] Shared mixed-plan pricing, hours, duration, locks, review, map, timeline and event-repair behavior.
- [x] Five statically registered Place WebMCP tools using the shared domain actions.
- [x] Events/Places human discovery and mixed-night staging controls.
- [x] Expand to 33 qualified Place snapshots per city with explicit operational uncertainty.
- [x] Purpose, price, mood, neighborhood, kind and arrival-time Place filters shared by UI and WebMCP.
- [x] City-bounded Foursquare Open Source Places candidate importer with filtering and deduplication.
- [x] Corridor coverage, operational warning and importer regression gates.

- [ ] Dynamic WebMCP tool registration.
- [ ] Weather context.
- [ ] Public transit context.
- [ ] Comparison panel.
- [ ] Route animation.
- [ ] Multiple mission presets.
- [ ] Better source ingestion.
- [ ] More event images.

## Not this week

- [ ] User accounts.
- [ ] Payments.
- [ ] Real reservation completion.
- [ ] Crowd tracking.
- [ ] Social graph.
- [ ] Personalized recommender model.
- [ ] Citywide generalized scraper.
- [ ] Native mobile app.
- [ ] Organizer portal.
- [ ] Production subdomain routing and city discovery.
- [x] Phase 3 allowlisted multi-source ingestion contracts, parsers, adapters and last-good snapshots.
- [ ] Add further permission-reviewed direct venue sources through the Phase 3 registry.
- [x] Phase 4 WebMCP event/Place discovery leads with visible human review.
- [x] Phase 5 deterministic coverage cube, targeted gap discovery and corroboration-required municipal radar through the lead frontier.
- [x] Phase 6 bounded event graph, external coverage benchmarks, operational hardening and final deterministic data audit.
- [x] Separate agent candidate emphasis from human listings and refine consumer-facing itinerary, Options, localized date and booking-link presentation.
