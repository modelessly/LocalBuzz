# Coverage Gaps And Municipal Radar

## Phase 5 boundary

Phase 5 measures canonical inventory and produces review-only discovery work. It never publishes a `Happening`, changes a plan, or treats a permit as proof that a public event exists.

The deterministic cube is:

```text
city × neighborhood × category × time window × price band × lead time
```

Configured neighborhoods are the supported evening corridors in Stockholm and San Francisco. Categories use the canonical `HappeningCategory` set. Time windows are early evening (16:00–19:00), prime evening (19:00–22:00), and late night (22:00–02:00). Price bands are free, inexpensive, moderate, premium, and unknown using city-currency thresholds. Lead time is same day, next three days, next seven days, or later within the 30-day horizon.

A cell is empty at zero events, weak at one event, and covered at two or more. Event evidence older than 14 days is reported as stale. Place-to-event corridor coverage counts operationally qualified Places within the existing 3.5 km deterministic proxy and preserves the Phase 2 minimum of three; it is not a route-time promise.

## Commands

Generate the human report plus machine-readable cube and ranked query files:

```bash
npm run data:coverage
npm run data:coverage -- --as-of 2026-09-01T20:00:00Z --output-dir /absolute/path
```

Run one bounded, server-side xAI search for a specific generated target:

```bash
set -a
source .env
set +a
npm run data:discover -- --city san-francisco --target gap-san-francisco--mission--comedy--late-night--free--same-day
```

Targeted discovery is manual and server-only. One invocation runs at most one Web Search and accepts at most ten results. Matching target snapshots are cached for six hours, including valid empty results. Missing credentials, empty/invalid responses, and request failures preserve a matching last-good snapshot. Results are normal `DiscoveryLead` records with `submittedBy.kind: "targeted_collector"`; `LocalBuzzActions.stageDiscoveryLeads` places them in the same visible human review frontier without changing canonical inventory.

Refresh municipal radar:

```bash
npm run data:radar -- --city san-francisco
npm run data:radar -- --city stockholm
```

Generated files default to the ignored `coverage/` directory. Do not commit paid-search or municipal snapshots as canonical fixtures.

## Municipal source status

San Francisco adapters are bounded to official DataSF SODA datasets:

- SFMTA current/upcoming temporary closures where `type = Special Event`; refreshed daily.
- PermitSF `Special event intake form` records that are recent, active, and not expired where an expiration date exists; refreshed at most every six hours.

Each record retains the official identifier, known location, relevant dates, permit status, official URL, fetch time, and a narrow corroboration query. Missing PermitSF location or event date stays missing. Every record has `corroborationStatus: "required"`. `corroborateMunicipalRecord` requires an independent official/venue/ticket source that identifies the record before it creates a discovery lead.

Stockholm's official Trafikkontoret land-permit preview includes an event category, but its machine-readable OGC/WFS service requires an issued API key and the public preview does not establish a verified collection contract with enough identity/date fields for unattended discovery. The registry entry therefore remains disabled with that exact reason. No Stockholm API was invented.

## Verification snapshot — September 1, 2026

With `--as-of 2026-09-01T20:00:00Z`, the checked-in event snapshots produced 8,400 cells: one weak cell and 8,399 empty cells from one still-future event. This measures the dated repository inventory, not actual city supply.

A bounded live DataSF refresh returned 19 deduplicated special-event closure records and 185 current/recent PermitSF radar records. A single live xAI search for free late-night Mission comedy returned zero candidates. That empty result was retained honestly; no discovery lead or canonical event was manufactured.

## Phase 6 contract

Phase 6 may rely on `CoverageReport`, `CoverageSearchTarget`, `MunicipalRadarSnapshot`, `TargetedDiscoverySnapshot`, deterministic target IDs, collector/municipal `DiscoveryLead.submittedBy` variants, six-hour target caching, municipal last-good retention, and mandatory independent corroboration. It must not bypass the canonical review action.

## Phase 6 completion

Run `npm run data:graph -- --city <city> --happening <canonical-id>` to materialize trusted base identities; optional `--candidates` accepts a prepared JSON array that is still constrained by the graph allowlist and hard limits. Run `npm run data:benchmark -- --provider predicthq --city <city>` or the approved performer-scoped Bandsintown form documented in `docs/operations.md`. Benchmark rows never alter coverage counts or canonical inventory.

`npm run data:audit` is the final deterministic inventory gate. On September 2 it passed with 33 Places in each city, 48 Stockholm and 12 San Francisco event snapshots, and 7/7 supported operational Place corridors. It reported 64 `needs_review` Places honestly. Records missing operational price/hours remain non-stageable; qualified needs-review records stage with explicit warnings rather than false certainty.
