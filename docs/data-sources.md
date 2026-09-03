# Event Data Sources

## Proof-of-concept approach

Local Buzz uses validated, city-scoped snapshots with visible source links. This is intentionally not a production ingestion platform and does not claim live availability.

The first 20-source Stockholm desk sample and its conclusions are recorded in `docs/stockholm-source-coverage-spike.md`.

Current Stockholm records use Visit Stockholm and direct venue sources. San Francisco retains source-backed prototype snapshots and refreshes scheduled events through the unified server-side ingestion snapshot. Its xAI scheduled-event collector is a permitted registry source; social pulse remains isolated and is not published as confirmed event inventory. Neither path claims complete city coverage or live ticket availability.

On startup, all 33 canonical Place snapshots per city are available without a network call. Numeric hours and prices are used for planning only where official-source operational evidence is present. The default Place-only fallback uses Bar Central plus Stigbergets Fot in Stockholm, and Horsefeather plus The Page in San Francisco. ABV and Bender's are additional SF officially evidenced operational alternatives. Unknown hours or prices remain visible but block canonical staging.

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

Visit Sweden and Visit Stockholm remain distinct provenance labels. Ticketmaster uses `TICKETMASTER_API_KEY` only on the server. Billetto requires both `BILLETTO_API_KEY` and `BILLETTO_API_SECRET`, sends them only through `Api-Keypair`, retains provider UTM attribution and does not reuse images. Direct venue sources require approved registry status before fetching.

## Phase 5 coverage and municipal radar

Coverage measurement and commands are documented in `docs/coverage.md`. Gap searches reuse the server-only xAI Responses/Web Search boundary, but are manual, one target per run, capped at ten results and cached for six hours. `XAI_API_KEY` remains server-only. A zero-result search is an honest `empty` snapshot, not evidence that city supply is empty.

DataSF municipal adapters use the official `v9cz-kk5i` temporary-closure view and `tyz3-vt28` PermitSF dataset. The closure dataset is daily; PermitSF updates multiple times per day. Municipal records are discovery radar with public open-data provenance, not event listings. Permit-only evidence can never become canonical.

Stockholm Trafikkontoret's official land-permit preview was investigated. The corresponding OGC/WFS access requires an issued API key, and no public machine-readable event collection with sufficient identity/date fields was verified. Its source-registry record remains disabled rather than guessing a collection or republishing the preview.

## Phase 6 external benchmarks and licensing

PredictHQ uses the official bearer-authenticated event-search API only when `PREDICTHQ_API_KEY` is configured. Results are benchmark-only and measure overlap and credible gaps; subscription geography can make a valid query look empty, so empty output is not treated as proof of no events.

Bandsintown queries are restricted to performers already identified from trusted canonical events. Current ordinary keys are artist-scoped unless Bandsintown approves broader organizational use, so Local Buzz also requires `BANDSINTOWN_TERMS_APPROVED=true`. Unknown artists are negatively cached by the snapshot/cadence boundary rather than repeatedly queried. Songkick is not implemented without licensed access.

Raw social posts are never retained. Other source payloads are cache-only for up to 24 hours for validation/debugging and are not committed. Local Buzz republishes structured facts and attribution, not provider/editorial prose. Event or Place images require explicit reuse permission; Phase 6 does not ingest them.
