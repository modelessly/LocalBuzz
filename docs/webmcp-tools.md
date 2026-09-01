# WebMCP Tool Contract

## Purpose

Expose Local Buzz's existing client-side capabilities to the user's browser agent.

Tools are not a backend API replacement.

They should manipulate the same shared page state the human sees.

## Interaction surface

Local Buzz does not embed its own chat box or model. The conversation lives in the personal agent surface provided by a WebMCP-aware browser. With Local Buzz open:

1. the page registers its tools through `document.modelContext`
2. the browser makes those tools available to the user's agent
3. the user asks the agent for help in the browser's agent panel
4. the agent calls tools such as `search_happenings`, `show_candidates`, and `stage_evening_plan`
5. Local Buzz renders those calls as visible candidate, map, and timeline state
6. the human edits, locks, accepts, or rejects directly on the page
7. the agent calls `read_current_plan` before responding to those human changes

The page is therefore the shared artifact, not the chat surface. The manual demo control exists only to make the deterministic screenplay runnable when no agent is attached.

## Design principles

1. narrow, explicit tools
2. structured schemas
3. visible effects
4. preserve human constraints
5. stage material changes
6. return enough state for the agent to reason correctly
7. fail safely and informatively

## Tool 1: `search_happenings`

### Intent

Return structured happening candidates from the human-selected city matching user constraints.

### Input

```json
{
  "query": "live music or something unusual",
  "startAfter": "2026-08-30T18:30:00+02:00",
  "endBefore": "2026-08-31T00:00:00+02:00",
  "maxPrice": 350,
  "near": {
    "lat": 59.319,
    "lng": 18.072
  },
  "maxResults": 12
}
```

### Output

```json
{
  "ok": true,
  "happeningIds": ["h_12", "h_19"],
  "count": 2
}
```

### UI effect

None required beyond optional search-state indication. Prefer returning data first, then use `show_candidates` to determine what is visually surfaced.

## Tool 2: `show_candidates`

### Intent

Make a selected set of happenings prominent in the human UI.

### Input

```json
{
  "happeningIds": ["h_12", "h_19", "h_27"],
  "reason": "Best fits for an unexpected evening near Slussen"
}
```

### Output

```json
{
  "ok": true,
  "visibleCount": 3
}
```

### UI effect

- emphasize corresponding map pins
- render/update candidate cards
- optionally fit map bounds

## Tool 3: `stage_evening_plan`

### Intent

Create a reviewable proposed evening without committing it.

### Input

```json
{
  "stops": [
    {
      "happeningId": "h_12",
      "plannedStart": "2026-08-30T19:00:00+02:00"
    },
    {
      "happeningId": "h_19",
      "plannedStart": "2026-08-30T20:30:00+02:00"
    },
    {
      "happeningId": "h_27",
      "plannedStart": "2026-08-30T22:15:00+02:00"
    }
  ],
  "rationale": "Unexpected but walkable evening under budget"
}
```

### Behavior

Validate:

- happening exists
- approximate timing works
- no known unavailable stop
- price is plausible under current constraints

### Output

Return staged plan summary and warnings.

### UI effect

- show proposed plan on timeline
- show route/sequence
- mark status as proposed
- expose accept/reject

## Tool 4: `read_current_plan`

### Intent

Return the user's current canonical and staged plan state.

### Input

No required fields.

### Output

Must include:

- accepted stops
- locked stops
- current timings
- staged changes
- current constraints
- known disruption states

This is essential after human intervention.

The response also identifies the active city, currency, and time zone so the agent does not infer city context from IDs or prose.

## Tool 5: `lock_plan_stop`

### Intent

Preserve a stop from automated replacement or removal.

### Input

```json
{
  "stopId": "stop_2"
}
```

### Behavior

Set `locked = true`.

### UI effect

Immediate lock indicator.

### Note

A human may also lock through the UI. Both paths must call the same domain function.

## Tool 6: `repair_plan`

### Intent

Stage the minimum necessary repair after a disruption or changed constraint.

### Input

```json
{
  "reason": "Selected event is unavailable",
  "preserveLockedStops": true,
  "replacementHappeningIds": ["h_31", "h_33"]
}
```

### Behavior

Must:

- read current canonical state
- preserve locked stops
- preserve unaffected stops whenever feasible
- avoid full regeneration
- calculate only necessary changes
- stage result for human review

### Output

```json
{
  "ok": true,
  "changedStopIds": ["stop_1"],
  "preservedLockedStopIds": ["stop_2"],
  "warnings": []
}
```

### UI effect

- only changed portion becomes visibly staged
- locked stop remains unchanged
- cost/time summary updates

## Tool 7: `accept_staged_changes`

### Intent

Commit the currently staged plan changes after user approval.

### Input

Optional staged change IDs. If omitted, accept all currently staged changes only when the page state makes that unambiguous.

### UI effect

- staged status disappears
- accepted plan becomes canonical

## Tool 8: `reject_staged_changes`

### Intent

Discard unaccepted agent changes.

### UI effect

Restore canonical accepted plan.

## Optional tool: `compare_happenings`

Only implement after P0.

## Optional dynamic registration

Dynamic registration can strengthen the WebMCP story:

- no plan: discovery tools
- plan exists: plan tools
- staged changes: accept/reject tools

However, robustness outranks cleverness.

## Error codes

Recommended:

- `INVALID_HAPPENING_ID`
- `HAPPENING_UNAVAILABLE`
- `PLAN_NOT_FOUND`
- `LOCKED_STOP_CONFLICT`
- `TIME_CONFLICT`
- `BUDGET_CONFLICT`
- `NO_REPAIR_FOUND`
- `NO_STAGED_CHANGES`

## Tool descriptions

Descriptions should explain when the agent should choose a tool.

Bad:

> "Updates a plan."

Good:

> "Stages the smallest possible repair to the current evening plan after a disruption or changed constraint. Locked stops must be preserved. The repair remains uncommitted until accepted."

## Registration

Use the current WebMCP API supported by the target browser.

Verified August 30, 2026 implementation notes:

- use `document.modelContext`, not the deprecated `navigator.modelContext` shape
- `registerTool()` returns a promise
- pass a shared `AbortSignal` in the registration options to own cleanup
- feature-detect the API so unsupported browsers keep the human workflow
- statically register the fifteen acquisition, event, place, and shared-plan tools for demo reliability

Reference pattern from the official explainer:

```ts
const controller = new AbortController()

await document.modelContext.registerTool({
  name: "search_happenings",
  description: "...",
  inputSchema: { ... },
  execute: async (input) => {
    return searchHappenings(input)
  }
}, { signal: controller.signal })

// Unregister only the tools owned by this application lifecycle.
controller.abort()
```

Do not copy example code blindly. Confirm current types/API against the official resources at implementation time.

## Phase 1 Place tools

The five additional tools are static and call the same `LocalBuzzActions` methods as the human UI:

- `search_places`: filters canonical places by text, kind, purpose, open time, per-person price, mood, neighborhood and distance; returns official website, price/hours evidence, verification and provenance.
- `show_place_candidates`: updates shared visible/candidate Place IDs for map and cards.
- `read_place_details`: returns the complete canonical Place record before staging.
- `stage_place_stop`: appends a canonical place/purpose at an ISO arrival time and runs hours, duration, party-size price, currency, overlap and latest-end checks.
- `stage_custom_place`: appends an embedded unverified snapshot only when explicit coordinates, duration, price/currency and availability bounds cover the visit.

The original `stage_evening_plan` remains backward-compatible for event-only proposals. An agent builds a mixed night by staging its event proposal, then appending canonical or custom Place stops. Every mutation remains uncommitted until `accept_staged_changes`; `read_current_plan` returns the discriminated stop union unchanged.

New structured errors are `INVALID_PLACE_ID`, `PLACE_CLOSED`, `PLACE_DATA_INCOMPLETE`, `CURRENCY_CONFLICT`, and `RESERVATION_CONFLICT`. Successful staging can return warnings for stale or incomplete verification, unknown exceptional hours and recommended reservations. `repair_plan` accepts only replacement happening IDs. It preserves place/custom-place stops and uses their times as neighbor constraints.

## Phase 3 source behavior

No ingestion-only tool is added. The canonical event, Place and plan tools continue to use `Happening`, `Place` and `PlanStop` state. Refreshed events appear in search, candidate display, staging, reads and repair with provenance/freshness. Retained or unavailable collection must not be inferred as confirmed availability.

## Phase 4 acquisition tools

- `propose_event_from_url` accepts structured event, venue, timing, commerce/status and evidence facts already read by the browser agent.
- `propose_place_from_url` accepts structured Place identity, kind, location, use, price, hours and evidence facts already read by the browser agent.

Both require the active city, a public HTTPS source URL, a typed source classification and field-level evidence references. Local Buzz does not fetch the URL. Successful execution creates a provisional `DiscoveryLead`, targets the review surface through the real lifecycle wrapper, and returns missing-field, duplicate and verification issues. It does not publish inventory or stage/commit a night.

Fatal structured errors include `INVALID_URL`, `WRONG_CITY` and `UNSAFE_INPUT`. Review validation can report `MISSING_DATE`, `MISSING_LOCATION`, `EXPIRED_EVENT`, `UNSUPPORTED_PLACE`, `DUPLICATE`, `INSUFFICIENT_PROVENANCE` and `INVALID_PRICE_CURRENCY`.
