# MEMORY.md

Durable working preferences for this product harness.

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

## Notes For Future Agents

- If this file conflicts with `PRODUCT.md`, the product brief wins.
- If this file conflicts with explicit user instructions, the user instruction wins.
- If a durable preference changes, update this file directly and record important rationale in `DECISIONS.md`.
