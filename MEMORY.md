# MEMORY.md

Durable working preferences and current context for Local Buzz.

This file is for cross-product preferences that should survive across agent sessions. Product-specific facts belong in `PRODUCT.md`, `ARCHITECTURE.md`, `TASKS.md`, `PLANNER.md`, or `DECISIONS.md`.

## Collaboration Preferences

- Read the repository docs before making changes.
- Summarize understanding before implementing substantial work.
- Propose a narrow plan and name risks or tradeoffs.
- Prefer small, incremental changes over broad rewrites.
- Keep the user informed when making meaningful edits or decisions.
- Ask only when missing information would materially change the implementation.

## Product Preferences

- Start with the smallest useful version.
- Preserve emotional clarity and a strong core user promise.
- Avoid adding infrastructure before the product earns it.
- Treat future ideas as parking-lot items until they become explicit scope.
- Prefer calm, focused UX unless the product brief calls for another tone.

## Engineering Preferences

- Prefer readable code and native platform conventions.
- Use boring, reliable dependencies.
- Avoid unnecessary abstraction, premature optimization, and speculative architecture.
- Keep files small and focused once the codebase begins to grow.
- Verify meaningful changes with the lightest reliable check available.

## Default Constraints

Do not add these unless the product brief explicitly requires them:

- backend infrastructure
- authentication
- cloud services
- AI generation
- social features
- analytics or tracking
- unnecessary dependencies

## Current Project Context

- Local Buzz is the Modeless submission to the 2026 WebMCP Challenge.
- Deadline: September 3, 2026 at 22:00 CEST.
- Proof-of-concept cities: Stockholm and San Francisco; Stockholm remains the primary contest screenplay.
- Public target: `https://localbuzz.modeless.io`.
- The product is a shared model of a night that stays alive, not an AI itinerary generator.
- The exact proof is: agent stages → human edits and locks → agent reads state → simulated disruption → minimal staged repair → human accepts.
- UI and WebMCP must call the same domain operations against the same state.
- Real source fields, Local Buzz enrichment, and demo simulation must remain distinguishable.

## Current Implementation Direction

- React 19, TypeScript, Vite 6, and the Modeless package tarball.
- One client-side reducer/domain API; no backend or authentication.
- Curated Stockholm snapshot with deterministic validation.
- MapLibre GL JS real map using OpenFreeMap's OpenStreetMap-based public tiles; no API key, but no public-service SLA.
- Static WebMCP tool registration using `document.modelContext` and abort-signal cleanup.

## Verified State — 2026-08-30

- Human workflow and all eight P0 WebMCP tools are implemented.
- 60 records across two city-scoped fixtures pass validation; 13 automated tests pass.
- Lint, typecheck, and production build pass.
- ChatGPT in-app browser discovers every tool.
- Browser test proved UI lock → WebMCP read → simulated disruption → minimum repair → human accept.
- Public Worker deployed at `https://local-buzz.alsmith.workers.dev`; HTTP 200, permissions policy, and WebMCP discovery verified.
- Remaining external work: explicitly authorized `localbuzz.modeless.io` attachment, Chrome challenge-mode verification, repository publication, and submission media.

## Notes For Future Agents

- If this file conflicts with `PRODUCT.md`, the product brief wins.
- If this file conflicts with explicit user instructions, the user instruction wins.
- If a durable preference changes, update this file directly and record important rationale in `DECISIONS.md`.
