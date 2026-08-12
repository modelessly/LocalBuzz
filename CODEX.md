Codex-specific entry point for this repository.

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