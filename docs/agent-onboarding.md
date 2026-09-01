# Agent Onboarding

## What you are building

Local Buzz is a WebMCP-native two-city proof of concept for the 2026 WebMCP Challenge. Stockholm remains the primary contest screenplay; San Francisco proves the city model is portable.

Do not interpret it as a general event-discovery app.

The required innovation is a human and personal agent manipulating the same evening plan through different interfaces.

## Read before coding

1. `AGENTS.md`
2. `PRODUCT.md`
3. `docs/v1-scope.md`
4. `ARCHITECTURE.md`
5. `PLANNER.md`
6. `TASKS.md`
7. `DECISIONS.md`
8. `MEMORY.md`
9. your agent-specific adapter

## Critical mental model

Human:

- browses map
- judges atmosphere
- locks choices
- changes mind

Agent:

- searches structured inventory
- reconciles constraints
- stages plans
- reads current state
- repairs around changes

Both:

- use the same application model

## The non-negotiable demo behavior

Agent acts → UI changes → human intervenes → agent reads intervention → environment changes → agent repairs shared state → human accepts.

If a proposed implementation does not strengthen that sequence, it is probably out of scope.
