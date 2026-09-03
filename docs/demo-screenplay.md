# Demo Screenplay

## Purpose

The video should prove human-agent collaboration, not enumerate features.

Target: 2:30–2:50 final runtime.

## Core message

> Local Buzz isn't an AI that tells you what to do tonight. It's a place where you and your agent figure it out together.

## Scene 1: Problem and premise

### 0:00–0:15

Show Local Buzz already open on Stockholm.

Narration:

> "Finding something to do tonight is still fragmented across event calendars, venues, ticket sites and social posts. And even when an AI can find options, chat is a terrible interface for understanding a city."

Briefly show the living map and event density.

## Scene 2: Introduce the collaboration model

### 0:15–0:30

Narration:

> "Local Buzz gives people and their personal agent different interfaces into the same live city. I get the map and timeline. My agent gets structured WebMCP tools."

Prompt the agent:

> "I'm near Slussen with a friend. We have 900 SEK, want something unexpected, and need to be done by midnight. Build us a night."

## Scene 3: Agent compresses complexity

### 0:30–0:55

Agent calls:

1. `search_happenings`
2. `show_candidates`
3. `build_evening_plan`

Visible effects:

- candidate pins become prominent
- cards update
- proposed three-stop plan appears
- budget/time summary appears
- proposal is clearly staged

Narration:

> "The agent isn't clicking through my interface. Local Buzz exposes the capabilities it needs directly, and its actions update the same page I'm looking at."

## Scene 4: Human exercises taste

### 0:55–1:20

Human:

- rejects/replaces first stop or adjusts timing
- locks the live-music stop

Narration:

> "But I don't have to describe every preference in a prompt. I can just react. I don't love this first stop, but I definitely want to keep the music."

Show lock.

This is a critical moment. The human changes shared application state without instructing the agent in prose.

## Scene 5: Agent responds to human state

### 1:20–1:40

Prompt:

> "Make the rest work around that."

Agent calls:

- `read_current_plan`
- optional search
- `repair_plan`

Visible effect:

- only necessary parts adjust
- locked stop remains fixed

Narration:

> "The agent reads what I changed in the product and reorganizes around my decision."

## Scene 6: Reality intervenes

### 1:40–1:55

Trigger deterministic demo update:

> First stop / selected event becomes unavailable.

UI clearly labels:

> Demo live-status simulation

Narration:

> "And a night doesn't stay static. Let's simulate the kind of last-minute update Local Buzz could receive from a venue."

## Scene 7: The wow moment: repair, do not regenerate

### 1:55–2:25

Prompt:

> "Rescue the night. Keep the music."

Agent calls:

- `read_current_plan`
- `repair_plan`

Visible effect:

- unavailable stop replaced
- locked stop untouched
- unaffected stop preserved
- revised cost/time shown
- changes remain staged

Narration:

> "Instead of throwing the itinerary away and generating another answer, the agent repairs the night we already made together."

## Scene 8: Human remains in control

### 2:25–2:35

Human clicks Accept.

Narration:

> "I review the change and accept it."

## Scene 9: Why WebMCP

### 2:35–2:50

Show compact architecture visual or tool list.

Narration:

> "Local Buzz knows Stockholm. My personal agent can know me. The human provides taste, the agent handles complexity, and WebMCP lets both collaborate inside the same living web experience."

End card:

> **Local Buzz**
> What should we do tonight?

## Recording rules

- Avoid showing long agent text.
- Keep the map and state changes visible.
- Do not dwell on implementation.
- Never imply simulated availability is live source data.
- Rehearse the exact prompt/tool sequence until reliable.
- Record a backup successful run before attempting visual-perfect takes.
