# Agent Onboarding

Use this checklist at the start of a new product session or whenever an agent is reconnecting after a long gap.

## First 10 Minutes

1. Read every repository documentation file.
2. Identify the product name, user, core promise, and V1 scope.
3. Check whether `PRODUCT.md` still contains placeholders.
4. Check whether `ARCHITECTURE.md` names a real platform and stack.
5. Review `TASKS.md` and `PLANNER.md` for current work.
6. Review `DECISIONS.md` for durable constraints.
7. Summarize understanding before making changes.
8. Propose the smallest useful next increment.
9. Name risks, tradeoffs, and missing information.
10. Implement incrementally only after the above is clear.

## Readiness Check

Before coding, answer:

- What user problem are we solving first?
- What is explicitly out of scope?
- What is the smallest end-to-end workflow?
- What can be verified after the first implementation pass?
- Which docs need to be updated as part of the work?

## If The Product Brief Is Incomplete

Do not invent a large product.

Instead:

- state the missing information
- make conservative assumptions
- keep the first implementation reversible
- update `PLANNER.md` with open questions
- prefer scaffolding only when it directly supports the known product direction

## Handoff Expectations

At the end of meaningful work, leave the next agent with:

- what changed
- what was verified
- what remains
- known risks or gaps
- files that matter most

Use `PLANNER.md` for active handoff notes and `DECISIONS.md` for durable decisions.
