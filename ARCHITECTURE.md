# ARCHITECTURE.md

Technical direction template.

Use this file to make the initial implementation choices explicit. Keep it current as durable architectural decisions are made.

## Platform

- Primary platform: `[iOS / macOS / web / desktop / CLI / other]`
- Secondary platforms, if any: `[none / list]`
- Minimum supported version or runtime: `[version]`

## Core Technologies

- UI: `[framework]`
- Language: `[language]`
- Persistence: `[storage approach]`
- Networking: `[none / API / local network / other]`
- Build tooling: `[tooling]`
- Testing: `[test approach]`

Prefer the simplest reliable option that supports the V1 product promise.

## Architectural Goals

Prioritize:

- maintainability
- clarity
- fast iteration
- small focused modules
- testable core behavior
- platform-native conventions

Avoid:

- over-abstraction
- excessive protocols or interfaces before they have a job
- unnecessary dependency injection frameworks
- speculative infrastructure
- optimizing for features not in the current product scope

## Initial Structure

Proposed starting structure:

- `App`: application entry point and composition
- `Features`: user-facing workflows
- `Models`: domain models and value types
- `Persistence`: local storage and migrations
- `Services`: platform integrations with clear ownership
- `SharedUI`: reusable UI primitives, if a UI exists
- `Tests`: focused tests for durable behavior

Adjust this structure to fit the actual platform and product. Do not create empty folders just to satisfy this outline.

## Data Model

Document the first durable entities here:

- `[Entity]`: `[purpose and key fields]`
- `[Entity]`: `[purpose and key fields]`
- `[Entity]`: `[purpose and key fields]`

## State Ownership

Define:

- what state is local to a screen or component
- what state is shared across workflows
- what state persists across launches
- how errors and loading states are represented

## Persistence Philosophy

Default to local persistence unless the product clearly requires a server.

Before adding backend infrastructure, answer:

- What user value requires a backend now?
- What simpler local version could validate the product first?
- What operational burden does the backend introduce?

## Integration Boundaries

List external services, SDKs, APIs, or device capabilities here:

- `[integration]`: `[why it is needed, failure behavior, privacy implications]`

Do not add integrations without updating this section and `DECISIONS.md`.

## Reliability Requirements

The first version should handle:

- permissions and denial states
- interrupted workflows
- empty states
- storage or persistence failures
- offline behavior, if relevant
- app restarts or browser refreshes, if relevant

## Future-Proofing

Future-proof by keeping boundaries clear, not by building unused systems.

Acceptable future-proofing:

- clear domain models
- isolated platform integrations
- simple persistence migrations
- tests around important behavior

Avoid future-proofing through:

- unused plugin systems
- abstract service locators
- speculative sync engines
- generic multi-platform layers before one platform works
