# Repository Setup

Use this checklist when cloning the harness for a new product.

## Clone To Product

1. Clone or copy this folder.
2. Rename the folder and repository to the product name.
3. Initialize git if needed.
4. Replace placeholder content in `PRODUCT.md`.
5. Define the initial V1 boundary in `docs/v1-scope.md`.
6. Choose the first platform and stack in `ARCHITECTURE.md`.
7. Fill `TASKS.md` with the first implementation backlog.
8. Set the active milestone in `PLANNER.md`.
9. Keep or edit `MEMORY.md` for this product.
10. Add the first durable setup decision to `DECISIONS.md`.

## Product Naming Pass

Search for template placeholders and replace them:

- `[Product Name]`
- `[must-have capability]`
- `[not in V1]`
- `[future task]`
- `[tone]`
- `[framework]`
- `[language]`

Then search for any old product name if this folder was copied from an existing project.

## First Agent Session

Recommended first instruction:

```text
Read all repository documentation files first. Summarize your understanding, identify remaining placeholders or missing decisions, propose a narrow implementation plan, name risks and tradeoffs, and then begin with the smallest useful increment.
```

## Before Writing Code

Confirm:

- `PRODUCT.md` has a real product promise.
- `docs/v1-scope.md` has clear included and excluded scope.
- `ARCHITECTURE.md` names a real platform and stack.
- `TASKS.md` has ordered implementation work.
- `PLANNER.md` names the current focus.
- `DECISIONS.md` includes any important setup decisions.

## Optional Setup Files

Add these only when useful:

- `.env.example` for documented local configuration.
- `CONTRIBUTING.md` for team conventions.
- `docs/release-checklist.md` when the product is near release.
- CI configuration after there is something meaningful to verify.

Avoid adding operational files just to make the repository look complete.

## Place catalog maintenance

Phase 2's qualified Place snapshots live in `src/data/places.ts` and `src/data/placeExpansion.ts`. Keep discovery evidence, official-source evidence, numeric operational claims and verification state separate. Unknown hours or prices must stay unknown; do not roll old values forward.

For Foursquare candidate generation, obtain a Foursquare Open Source Places extract through the official access process linked in `docs/data-sources.md`, create a city-bounded NDJSON file locally, and run `npm run places:import -- --city <city> --bounds <minLat,maxLat,minLng,maxLng> --input <file> --output <file>`. The command does not download the global dataset and does not update the UI catalog. Review its exclusions and duplicates before using official business sites to promote candidates into the checked-in snapshot.
