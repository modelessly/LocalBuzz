# Event Data Sources

## Proof-of-concept approach

Local Buzz uses validated, city-scoped snapshots with visible source links. This is intentionally not a production ingestion platform and does not claim live availability.

The first 20-source Stockholm desk sample and its conclusions are recorded in `docs/stockholm-source-coverage-spike.md`.

Current Stockholm records use Visit Stockholm and direct venue sources. San Francisco retains its source-backed prototype snapshots and refreshes its visible inventory from server-side event and social-pulse endpoints when that city is selected. The event route uses constrained web search with strict local validation and a bounded official-calendar fallback; neither path claims complete city coverage or live ticket availability.

## Live city context

The header requests current `temperature_2m`, `weather_code`, and `is_day` from the Open-Meteo Forecast API using the active city's map center and IANA time zone. Weather refreshes on city change and every 15 minutes, uses Celsius for Stockholm and Fahrenheit for San Francisco, and links directly to Open-Meteo for the required attribution. Local clock time is calculated in the browser and refreshes every 30 seconds.

Weather is supporting context rather than canonical plan state: a failed request shows a compact unavailable state and does not block search, planning, repair, or WebMCP tools.

## Structured sources to pursue next

### Stockholm

- Visit Stockholm Open API
- Debaser's open event JSON
- Tickster Event API
- Billetto Public Event Search API
- Kulturbiljetter Events API
- Ticketmaster Discovery API
- direct venue JSON, RSS, ICS, and Schema.org Event feeds

### San Francisco

- Ticketmaster Discovery API
- Eventbrite organizer-authorized feeds and public publisher access where available
- DataSF SODA datasets for relevant public and permitted events
- San Francisco Travel calendars
- direct venue JSON, RSS, ICS, and Schema.org Event feeds

## Social sources

Facebook and Instagram are discovery signals, not dependable citywide event APIs. A future product should support organizer-authorized Page or professional-account connections and a “send this event to Local Buzz” link flow. It should not depend on broad social scraping.

### San Francisco X Search experiment

The repository includes a server-side xAI Responses API collector using the built-in X Search tool. It supports broad semantic search and curated account groups, filters to evidence no older than three hours, and requires either two independent sources or an explicitly tagged official source. Local validation rejects stale timestamps, unrelated-city content, low confidence, inconsistent evidence counts, and non-X status URLs.

The collector remains an evaluation feed rather than confirmed event availability. Successful responses are cached for 12 minutes, raw posts are not retained, and accepted signals are merged into the shared UI and WebMCP state only when their named venue resolves to a known source-backed place. The editable starter account list is in `server/pulse/config/handles.ts`; handles should be rechecked before production use because social account names and ownership can change.

### San Francisco scheduled-event refresh

`GET /api/events/san-francisco` requests current, physical San Francisco events through xAI Web Search, then rejects expired, undated, out-of-city, low-confidence, or location-incomplete records before they reach the client. If live collection is empty or unavailable, the route returns a small directly verified set from official San Francisco Public Library calendars. The fallback carries its own fixed verification timestamp and source links so stale records naturally disappear rather than being silently rolled forward.

## Ingestion rules

- preserve the canonical source URL and source name
- record `fetchedAt` and `lastVerifiedAt`
- keep source fields separate from Local Buzz enrichment
- prefer webhooks where available; otherwise refresh active evening inventory hourly
- show lower confidence for unverified social or user-submitted records
- deduplicate by normalized title, venue, and start time before publishing

## Phase 2 Place snapshots

Places are checked-in qualification snapshots, not live availability. Each city has 33 canonical records. Stockholm discovery uses Visit Stockholm nightlife, cocktail, wine-bar and restaurant guides; San Francisco discovery uses the controlled SF Travel nightlife and bar-hopping guides. Local Buzz does not copy either publisher's editorial prose. Every record links its short, independently written `whyInteresting` evidence to the business's official site and retains both the discovery and official-source provenance.

Operational qualification is intentionally narrower than catalog inclusion. A record publishes numeric price and weekly-hours evidence only when those fields were observed on an official page on the recorded verification date. Records without both remain visible with an approximate `priceRange.band`, `openingHoursEvidence.status: "unknown"`, and `verification.status: "needs_review"`; the planner returns `PLACE_DATA_INCOMPLETE` instead of guessing. Exceptional hours remain unknown unless a dated exception is explicitly captured.

The current official-source operational subset and corridor proxy are documented in `docs/place-coverage.md`.

## Foursquare Open Source Places candidate import

Local Buzz includes a repeatable, city-bounded importer for a locally obtained Foursquare Open Source Places NDJSON extract. Obtain the source dataset using Foursquare's official [access instructions](https://docs.foursquare.com/data-products/docs/access-fsq-os-places) and [schema reference](https://docs.foursquare.com/data-products/docs/places-os-data-schema), filter/export only the desired city bounds outside this repository, then run:

```bash
npm run places:import -- \
  --city stockholm \
  --bounds 59.20,59.43,17.75,18.30 \
  --input /absolute/path/to/stockholm.ndjson \
  --output fixtures/place-import/stockholm.candidates.json
```

The input is one JSON object per line using the documented `FoursquarePlaceRow` fields in `src/data/foursquareImporter.ts`. The importer applies city bounds, allow/deny category rules, closed-record filtering, identity/coordinate quality checks, major-chain exclusions, provider-ID stability, and provider/name-distance deduplication. Output is a deterministic review-candidate snapshot with Foursquare provenance. It never publishes candidates into `src/data/places.ts`; official-site qualification remains a separate human-reviewed step.

Do not commit a global source dump. `fixtures/place-import/*.json` is for bounded review output. Overture merging is explicitly deferred.

## Phase 3 implementation

The source registry, parsers, adapters, validation/deduplication and last-good behavior are under `server/ingestion`. Operations, measured Visit Sweden coverage and source status are documented in `docs/event-ingestion.md`.

Visit Sweden and Visit Stockholm remain distinct provenance labels. Ticketmaster uses `TICKETMASTER_API_KEY` only on the server. Direct venue sources require approved registry status before fetching.
