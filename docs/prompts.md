# Reusable Prompts

Copy or adapt these prompts when starting work with Codex, Claude Code, Cursor, or another coding agent.

## Start A New Product

```text
Read all repository documentation files before making changes. Then summarize your understanding of the product, identify missing PRD or architecture details, propose a narrow V1 implementation plan, name risks and tradeoffs, and begin with the smallest useful increment.
```

## Turn A PRD Into Tasks

```text
Read PRODUCT.md, docs/v1-scope.md, ARCHITECTURE.md, and the existing TASKS.md. Refactor TASKS.md into a practical implementation backlog for V1. Keep tasks small, ordered, and verifiable. Do not add features that are outside the stated V1 scope.
```

## Review Architecture Before Coding

```text
Read all repository docs and review ARCHITECTURE.md against the product brief. Identify overengineering, missing reliability concerns, unclear state ownership, risky dependencies, and places where the architecture does not support the V1 user promise. Propose focused edits before implementing anything.
```

## Create The First Vertical Slice

```text
Read all repository docs. Identify the smallest end-to-end workflow that proves the V1 promise. Implement only that vertical slice, including minimal UI or interface, minimal persistence if needed, and the lightest useful verification. Update TASKS.md, PLANNER.md, and DECISIONS.md if the work creates durable context.
```

## Continue Existing Work

```text
Read README.md, AGENTS.md, MEMORY.md, PRODUCT.md, ARCHITECTURE.md, TASKS.md, PLANNER.md, DECISIONS.md, and the relevant docs folder files. Summarize current state, identify the next unfinished task, and continue incrementally. Preserve existing user changes.
```

## Product Scope Review

```text
Review PRODUCT.md, docs/v1-scope.md, and docs/roadmap.md. Identify anything that feels too broad for V1, anything important that is missing, and any future idea that should move to the parking lot. Keep the recommendation focused on shipping a useful first version.
```

## Design Direction Review

```text
Review PRODUCT.md and docs/design.md. Clarify the intended emotional tone, interaction posture, and visual direction. Identify UI patterns to avoid. If the app has existing screens, suggest focused changes that better support the product promise without adding clutter.
```

## Handoff

```text
Prepare a concise handoff. Include what changed, what was verified, what remains, known risks, and the next recommended task. Update PLANNER.md with the same handoff context and update DECISIONS.md for any durable product or architecture decisions.
```
