# v1 Scope

## Version

WebMCP Challenge Prototype

## Product promise

A human and their agent can collaboratively construct and repair a source-backed city evening in a shared visual interface. Stockholm is the primary contest screenplay; San Francisco proves the model can switch cities without mixing state.

## One required journey

Starting state:

- San Francisco
- near Mission
- current local time
- no budget cap unless the user supplies one
- end by midnight

Stockholm remains selectable from the city menu for the original near-Slussen contest screenplay.

Required journey:

1. user asks agent for an interesting night
2. agent searches Local Buzz through WebMCP
3. candidates become visible on the map
4. agent stages an evening
5. human changes one part of the plan
6. human locks another part
7. agent reads current plan and adapts
8. an event becomes unavailable
9. agent repairs the minimum necessary portion
10. locked stop remains
11. staged repair is visible
12. human accepts it

## Required screens / regions

The experience may be one page.

Required:

- two-city switcher for Stockholm and San Francisco
- city/map region
- happening cards / discovery region
- "Your Night" timeline
- cost/time summary
- plan status
- staged/accepted distinction
- source/provenance indication

## Required event content

At least enough real Stockholm records to make the central area feel credible.

Target:

- 40–80 normalized happenings
- 10–15 high-quality demo-relevant options
- multiple evening categories
- actual locations
- actual times when available
- actual source URLs

## Required WebMCP capabilities

P0:

- search
- show candidates
- stage plan
- read plan
- lock stop
- repair plan
- accept/reject staged changes

Optional:

- dynamic registration
- compare
- transit
- weather
- booking preview

## Required collaboration behaviors

### Agent to UI

Agent calls visibly change the interface.

### Human to agent

A human edit must materially alter the agent's next action.

### Constraint preservation

Locked stop survives repair.

### Reviewability

Agent plan modifications are staged before commitment.

### Minimal repair

Repair should preserve unaffected plan state.

## Out of scope

- user accounts
- signup
- profiles
- personalization model
- payments
- real reservation confirmation
- ticket purchasing
- friend location
- crowd sensing
- community network
- event organizer portal
- generalized scraping
- production city routing and subdomains
- native app
- production ingestion platform
- production recommendation engine

## Definition of done

v1 is done when the exact demo screenplay can be executed reliably against the deployed build and WebMCP is part of the main workflow rather than an optional side feature.
