# Phase 6 Data Operations

## Boundary

Phase 6 is a development and operational consolidation layer. It does not add UI features, browser-triggered paid calls, arbitrary crawling or automatic canonical publication. Generated output defaults to the ignored `coverage/` directory.

## Event graph

Build trusted base identities:

```bash
npm run data:graph -- --city san-francisco --happening sf-bird-beckett-jam
```

Repeat `--happening` for multiple canonical roots. Optional `--candidates /absolute/path/candidates.json` reads prepared structured candidates; it does not fetch their URLs. The graph enforces maximum depth 2, eight provider queries, 40 records, a six-hour interval, explicit domains and cycle detection. Related event facts create `DiscoveryLead`s for human review only.

## Coverage benchmarks

PredictHQ:

```bash
set -a
source .env
set +a
npm run data:benchmark -- --provider predicthq --city stockholm
```

Bandsintown requires approved organizational access. Each performer must already be tied to a canonical event:

```bash
npm run data:benchmark -- \
  --provider bandsintown \
  --city san-francisco \
  --performer 'Canonical Artist|confirmed-provider-id|trusted-happening-id'
```

At most ten trusted performers are queried per run. Missing credentials/approval, failures and invalid empty replacements preserve last-good results. Songkick reports disabled until licensed access exists. Every snapshot has `benchmarkOnly: true`; no canonical conversion exists.

## Final audit

```bash
npm run data:audit
```

The command checks 30–50 Places per city, structural validation, excluded-category/name leakage, duplicates, provenance/verification dates, discovery/canonical identity separation and three operational options in each supported 3.5 km corridor proxy. It exits nonzero on errors.

## Scheduling, quota and retention

`server/operations/policy.ts` is the executable source-policy registry. Never schedule a source more frequently or above its per-run/day bound without updating its contract and tests. Credential absence is expected. Empty, malformed, rate-limited or failed refreshes cannot erase matching last-good data.

Raw social posts are not retained. Other raw provider/source responses are cache-only for at most 24 hours and must not be committed. Preserve attribution and structured facts; do not republish editorial descriptions. Do not reuse images without explicit licensing evidence.

## Plan-time checks

Before every direct plan mutation, Local Buzz checks cancellation/sellout and canonical Place hours, kitchen cutoff, reservation requirements and operational completeness. A failing mutation leaves the current plan unchanged. Stale verification, unknown exceptional hours, recommended reservations and unverified custom Places remain explicit warnings. A production reservation or ticket confirmation still happens on the official source.

## Startup failure harness

Run the app without `XAI_API_KEY`, `TICKETMASTER_API_KEY`, `BILLETTO_API_KEY` and `BILLETTO_API_SECRET` to exercise the supported degraded path. The source panel must show those collectors unavailable, pending first-party calendars disabled, and all canonical Places still browseable. `/api/ingestion/:city` is the canonical startup endpoint; `/api/events/san-francisco` is compatibility/diagnostic only and must not be wired as a second browser state mutation. Never treat an HTTP 200 with zero records as proof of freshness; inspect `emptySuccessful`, source status and last-success time.

Billetto is capped at seven 100-record pages per run and one run per hour. Ticketmaster is one request per city per run and one run per hour. Provider credentials are header/query transport values only: do not print request objects, full provider URLs, environment values or raw failure bodies. Safe source-health output is limited to counts, aggregated rejection reasons and sanitized status messages.

## Social-pulse operations

The Stockholm and San Francisco pulse endpoints use `XAI_API_KEY` and optional `XAI_MODEL` only in server/Worker code. Each uncached city cycle makes two bounded Responses API calls: one broad X Search and one `allowed_x_handles` search. The cache duration is 12 minutes. Cloudflare retains the most recent successful normalized payload and marks it `retained` after a later failure; local development retains the last successful in-memory payload for the process lifetime.

Run one diagnostic cycle per city with `npm run pulse:city -- --city=stockholm` and `npm run pulse:city -- --city=san-francisco`. The generated `fixtures/pulse/*.latest.json` files are ignored and must not be committed. Review trusted handles periodically and remove any whose ownership or public status can no longer be verified.
