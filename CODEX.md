# CODEX.md

Codex-specific entry point for Local Buzz.

Use `AGENTS.md` as the canonical agent workflow. This file exists so Codex can quickly orient itself without duplicating conflicting instructions.

## Required Reading

Before coding, read:

- `README.md`
- `AGENTS.md`
- `MEMORY.md`
- `PRODUCT.md`
- `ARCHITECTURE.md`
- `TASKS.md`
- `PLANNER.md`
- `DECISIONS.md`
- `docs/agent-onboarding.md`
- `docs/design.md`
- `docs/prompts.md`
- `docs/repo-setup.md`
- `docs/v1-scope.md`
- `docs/roadmap.md`
- `docs/data-model.md`
- `docs/demo-screenplay.md`
- `docs/test-plan.md`
- `docs/submission.md`
- `docs/webmcp-tools.md`

## Codex Working Style

For substantial changes:

1. Restate the product intent and the specific task.
2. Inspect the relevant files before editing.
3. Make the smallest coherent change.
4. Keep implementation aligned with `PRODUCT.md`, `ARCHITECTURE.md`, and `docs/v1-scope.md`.
5. Add or update tests where appropriate.
6. Run available validation commands.
7. Update `TASKS.md`, `DECISIONS.md`, or `MEMORY.md` when the change affects product direction, architecture, or future agent context.

Prefer:

- explicit file diffs
- maintainable code over clever code
- typed interfaces where appropriate
- simple local-first architecture
- small commits or patch-sized changes
- clear errors and logs

Avoid:

- broad rewrites without need
- hidden behavior
- speculative abstractions
- adding new dependencies without justification
- changing product scope without updating the planning files

## Local Buzz Critical Path

Work in this order:

1. shared domain model and pure operations
2. curated Stockholm fixture and validation
3. reliable human workflow
4. WebMCP registrations over the same operations
5. exact collaboration screenplay
6. visual polish and submission artifacts

Never create a second agent-only state model. Plan creation and repair remain staged; locked and unaffected stops survive repair. Use the current official `document.modelContext` WebMCP API rather than stale `navigator.modelContext` examples.
