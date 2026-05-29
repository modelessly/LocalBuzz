# CLAUDE.md

Claude-specific entry point for this repository.

Use `AGENTS.md` as the canonical agent workflow. This file exists so Claude Code can quickly orient itself without duplicating conflicting instructions.

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

## Working Style

Start each substantial task by summarizing:

- product understanding
- implementation approach
- risks and tradeoffs
- smallest useful first increment

Prefer:

- clarity over cleverness
- maintainability over abstraction
- incremental implementation
- native conventions for the chosen platform
- explicit notes when product requirements are missing

Avoid:

- premature architecture complexity
- speculative features
- generic framework-heavy approaches
- expanding scope beyond the product brief

Always explain major architectural decisions and add durable decisions to `DECISIONS.md`.
