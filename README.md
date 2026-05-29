# New Product Harness

An agent-ready starter folder for turning a product idea into a focused, buildable project.

This repository is intentionally lightweight. Clone it, rename it, add the product-specific PRD, and connect it to a coding agent such as Codex or Claude Code. The documentation gives the agent enough context to work quickly while preserving your preferred collaboration style: simple, incremental, reliable, and scope-aware.

## How To Use This Template

1. Rename the folder and repository to the new product name.
2. Replace placeholder text in `PRODUCT.md` with the actual PRD or product brief.
3. Choose the initial technical direction in `ARCHITECTURE.md`.
4. Fill the first milestones in `TASKS.md` and `PLANNER.md`.
5. Review `MEMORY.md` and keep or edit the durable working preferences.
6. Follow `docs/repo-setup.md` for the clone-to-product checklist.
7. Start the coding agent and ask it to read all repository docs before making changes.
8. Record meaningful product and architecture decisions in `DECISIONS.md`.

## Documentation Map

- `AGENTS.md`: canonical instructions for AI coding agents.
- `CLAUDE.md`: Claude-specific entry point that defers to the canonical agent workflow.
- `MEMORY.md`: durable cross-product preferences for future agent sessions.
- `PRODUCT.md`: product brief and PRD template.
- `ARCHITECTURE.md`: technical direction and architecture decision template.
- `TASKS.md`: implementation backlog.
- `PLANNER.md`: active planning board and handoff notes.
- `DECISIONS.md`: append-only decision log.
- `docs/agent-onboarding.md`: first-session checklist for coding agents.
- `docs/design.md`: design principles and UX direction.
- `docs/prompts.md`: reusable startup, planning, review, and handoff prompts.
- `docs/release-checklist.md`: lightweight checklist before shipping or sharing.
- `docs/repo-setup.md`: clone-to-product setup checklist.
- `docs/v1-scope.md`: first-version scope boundaries.
- `docs/roadmap.md`: phased product roadmap.

## Template Principles

- Prefer simple, working product behavior over speculative systems.
- Build incrementally and verify each meaningful change.
- Keep the first version narrow enough to finish.
- Avoid backend, auth, cloud services, AI features, social features, and new dependencies unless the PRD explicitly requires them.
- Preserve emotional clarity: the product should have a clear user, clear job, and clear reason to exist.

## Suggested First Prompt

```text
Read all repository documentation files first. Summarize your understanding of the product, propose a narrow implementation plan, identify risks and tradeoffs, and then begin with the smallest useful increment.
```

For more reusable prompts, see `docs/prompts.md`.
