# PRODUCT.md

## Product

**Local Buzz**

## One-line promise

Local Buzz helps a person and their personal agent figure out what to do in a city right now, together, in one living visual workspace.

## Hackathon-specific positioning

Local Buzz demonstrates a new interaction model for the web:

> The website is the domain expert. The personal agent is the user expert. The human remains the taste-maker. All three collaborate through shared state.

Traditional city discovery products make the user search and compare manually.

Traditional AI planners remove the visual interface and return a static answer.

Local Buzz does neither. It lets the person browse and manipulate a visual city experience while their agent uses structured WebMCP tools to search, stage, compare, and repair the same plan.

## The problem

"What should we do tonight?" is deceptively difficult.

The answer depends on:

- what is actually happening
- where the user is
- start and end times
- distance and travel time
- budget
- weather
- availability
- booking requirements
- atmosphere
- social context
- personal taste
- last-minute changes

The underlying information is fragmented across event calendars, venues, ticketing sites, tourism sites, social channels, and word of mouth.

Even when information is available, turning it into an executable night is a combinatorial task.

## Product insight

People and agents are good at different things.

### Humans are good at

- taste
- mood
- visual browsing
- recognizing atmosphere
- changing their mind
- spotting something unexpectedly appealing
- making subjective trade-offs

### Agents are good at

- filtering many options
- reasoning across multiple constraints
- keeping track of timing and budget
- repairing a plan after a change
- applying personal context already known to the user's agent
- translating natural-language intent into structured actions

### Local Buzz is good at

- current city inventory
- venue and event state
- structured availability and provenance
- map and timeline visualization
- plan state
- reviewable changes

## Why WebMCP is essential

Without WebMCP, an agent must either:

1. act through brittle UI automation, or
2. bypass the web experience through a backend API, losing the shared page state.

WebMCP allows Local Buzz to expose its client-side capabilities as tools while keeping the human-facing map and timeline primary.

The same application functions should power both:

- a human clicking "Lock"
- an agent calling `lock_plan_stop`

The result is a shared workspace rather than delegated automation.

## Privacy architecture

Local Buzz should not need a comprehensive user profile.

The website knows the active city.

The user's personal agent may already know preferences such as:

- music taste
- budget tendencies
- preferred atmosphere
- dietary constraints
- tolerance for crowds
- who the user is with
- what they have already booked

The agent can use that private context to query and manipulate Local Buzz without Local Buzz collecting all of it.

This is a core strategic thesis:

> Deep personalization without requiring every website to build another profile of the user.

## Primary contest scenario

A user is in Stockholm near Slussen with a friend.

They ask their personal agent:

> "Help us make an interesting night. We're near Slussen, have 900 SEK, want something unexpected, and need to be done by midnight."

The agent:

1. searches current Local Buzz happenings
2. surfaces a small set on the map
3. stages an evening
4. the human rejects or moves one stop
5. the human locks another stop
6. the agent reads the changed plan state
7. a selected event becomes unavailable
8. the agent repairs the plan while preserving locked stops
9. the validated repair appears directly in the shared night

## Proof-of-concept cities

The proof of concept supports two intentionally contrasting city contexts:

- Stockholm remains the primary contest screenplay and reliability path.
- San Francisco demonstrates that the shared-state model, real map, source provenance, currency, and agent tools are not Stockholm-specific.

For two cities, the human switches through a compact header toggle. Switching cities clears the current night so plans can never mix inventory across cities. A production version may resolve the city from hostnames such as `stockholm.localbuzz.com` while retaining the same city model.

## Product principles

### 1. Shared state over chat history

The plan lives in the application, not in conversational prose.

### 2. Human taste is authoritative

The agent optimizes around human choices instead of arguing with them.

### 3. Repair, do not regenerate

When something changes, preserve accepted state and modify the minimum necessary portion.

### 4. Visible agent work

Agent-created changes are staged and reviewable in the UI.

### 5. Real data where it matters

Use real Stockholm events and venues when feasible. Enrichment may be derived. Live disruption may be simulated and must be labeled honestly.

### 6. Provenance over false certainty

The UI should distinguish source data, derived attributes, and simulated prototype state.

### 7. Product, not technical demo

The experience must feel coherent even before the agent is invoked.

## Network-effect thesis

Longer-term:

1. more data sources improve coverage
2. better coverage attracts more users
3. more users create reports, corrections, and demand
4. organizers gain incentive to publish directly to Local Buzz
5. direct participation improves freshness and long-tail coverage
6. better coverage attracts more users

A future Local Buzz could become a live local-information layer rather than only an event calendar.

## What Local Buzz is not

For this prototype, Local Buzz is not:

- a social network
- a ticket marketplace
- a reservation platform
- a crowd-tracking system
- a full travel planner
- a recommender model trained on user profiles
- a citywide ingestion platform
- a chatbot
- a fully autonomous agent

## Success for the hackathon

A judge should understand within three minutes that:

1. the human and agent have different but complementary interfaces
2. they are acting on the same application state
3. human intervention changes what the agent does next
4. WebMCP is central to the main workflow
5. the experience solves a recognizable real-world problem
6. the product demonstrates something qualitatively different from an AI-generated itinerary

## Data-expansion boundary

Canonical inventory, human-reviewed discovery leads, municipal radar, social pulse and external benchmarks have different evidence standards. Relationship expansion and provider comparisons may identify useful missing records, but they never publish automatically. The user-facing promise remains a calm, reviewable shared night—not an exhaustive city index or an autonomous crawler.
