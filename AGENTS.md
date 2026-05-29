# AGENTS.md

Canonical instructions for AI coding agents working in this repository.

## Start Here

Read all repository documentation files before making changes.

Do not begin coding immediately. First:

1. Read the docs.
2. Summarize your understanding.
3. Propose a plan.
4. Identify risks and tradeoffs.
5. Then implement incrementally.

If the request is small or urgent, still do a quick version of this workflow before editing.

## Product Priorities

Use the product brief as the source of truth. When the product brief is incomplete, prefer these defaults:

1. Simplicity
2. Reliability
3. Fast core workflow
4. Emotional clarity
5. Maintainability
6. Local-first behavior where it fits the product

## Important Constraints

Do not add any of the following unless the product brief explicitly asks for them:

- backend infrastructure
- authentication
- cloud services
- social features
- AI generation features
- analytics or tracking
- unnecessary dependencies
- broad abstraction layers
- premature optimization

When uncertain, choose the smallest reversible approach.

## Product Philosophy

Every new product should define:

- who it is for
- the moment or problem it serves
- what it is intentionally not
- the emotional tone it should carry
- the first version's narrow promise

Do not let implementation convenience broaden the product. Keep the product centered on its core promise.

## UX Principles

The default UX posture is:

- calm
- fast
- trustworthy
- minimal
- clear
- tactile when appropriate

Avoid:

- clutter
- enterprise patterns unless the product is enterprise software
- overly dense screens
- excessive settings
- feature-first navigation before the core workflow is proven

## Technical Direction

Prefer:

- readable code
- small focused files
- native platform patterns
- boring, reliable dependencies
- explicit state ownership
- local persistence when it keeps the product simpler
- modern language features that improve clarity

Avoid:

- speculative architecture
- dependency injection frameworks before they are needed
- generic service layers with no current purpose
- building for future platforms before the first platform works

## Workflow

Before implementing major changes:

- explain the reasoning
- identify tradeoffs
- propose the approach
- keep scope intentionally narrow
- update task and decision docs when the change creates durable context

During implementation:

- work in small increments
- verify behavior with tests, previews, builds, or manual checks as appropriate
- keep unrelated refactors out of the change
- preserve user changes already present in the workspace

When uncertain, prefer simplicity.
