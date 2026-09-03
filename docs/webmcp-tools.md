# WebMCP tools

Local Buzz statically registers sixteen page-defined tools through `document.modelContext.registerTool()`. Registration is owned by one shared `AbortSignal`; unsupported browsers retain the full human UI.

The browser agent and human interface share the same `LocalBuzzActions` instance and one canonical `currentPlan`. Search and candidate tools affect discovery surfaces only. Plan tools validate and update `currentPlan` atomically; a failed mutation leaves it unchanged.

## Discovery

| Tool | Contract |
| --- | --- |
| `search_happenings` | Query active-city events by text, time, category, per-person price and distance. |
| `show_candidates` | Show selected event IDs on the shared map and cards without adding them. |
| `search_places` | Query Places by purpose, price, mood, neighborhood, kind, distance and open-at time. |
| `show_place_candidates` | Show selected Place IDs without adding them. |
| `read_place_details` | Return the complete canonical Place record and operating evidence. |

Search results never enter the itinerary automatically.

## Direct itinerary editing

| Tool | Contract |
| --- | --- |
| `build_evening_plan` | Build or replace an event itinerary after city, time, price, budget and availability validation. Refuses to overwrite a plan containing locks. |
| `add_happening_stop` | Add one canonical event to the current plan. |
| `add_place_stop` | Add one canonical Place with `dinner`, `quick_bite`, `drinks` or `late_drinks` purpose. |
| `add_custom_place_stop` | Add an embedded custom Place with explicit location, price, duration and availability bounds; it remains unverified and outside search. |
| `read_current_plan` | Return active-city inventory status, the canonical plan and live updates. |
| `lock_plan_stop` | Protect a stop from agent removal, replacement, rebuild and repair. |
| `unlock_plan_stop` | Release a stop for editing and repair. |
| `remove_plan_stop` | Remove an unlocked stop; removing the last stop restores the empty night. |
| `repair_plan` | Replace only disrupted, unlocked event stops and apply the valid repair directly. |

All newly added stops start unlocked. Unknown event prices never count as zero: any hard-budget mutation requiring an unknown price fails with `BUDGET_CONFLICT`. Place operations enforce weekly hours, kitchen cutoff, visit duration, reservation mode, party-size cost, currency, adjacent-stop timing and latest-end time.

Locked stops are a hard agent boundary. A human can still explicitly remove a locked stop using the visible timeline control.

## Discovery-lead acquisition

| Tool | Contract |
| --- | --- |
| `propose_event_from_url` | Validate agent-extracted event facts and create a provisional `DiscoveryLead`. |
| `propose_place_from_url` | Validate agent-extracted Place facts and create a provisional `DiscoveryLead`. |

The browser agent reads the public page and submits structured facts plus evidence. Local Buzz does not perform arbitrary URL fetching. Proposals appear in the separate human review surface and never modify the itinerary or canonical catalog automatically. Human review may accept, reject or retain a Place as a visibly unverified custom stop.

## Schemas and errors

Every tool uses a strict schema with `additionalProperties: false`. Mutations return either `{ ok: true, ... }` or a structured error such as:

- `INVALID_INPUT`
- `INVALID_HAPPENING_ID`
- `INVALID_PLACE_ID`
- `INVALID_STOP_ID`
- `PLAN_NOT_FOUND`
- `LOCKED_STOP_CONFLICT`
- `TIME_CONFLICT`
- `BUDGET_CONFLICT`
- `HAPPENING_UNAVAILABLE`
- `PLACE_CLOSED`
- `PLACE_DATA_INCOMPLETE`
- `RESERVATION_CONFLICT`
- `NO_REPAIR_FOUND`

URL proposals additionally expose the discovery validator's invalid URL, wrong city, expired event, duplicate, insufficient provenance, invalid price/currency and unsafe input errors.

## Lifecycle motion

`registerWebMcp` emits real received, applying, complete or error lifecycle events. The command bay responds to the first event and the Intent Loom targets the map, timeline, shared-state or review surface appropriate to the tool. Direct plan additions animate only after the validated state mutation. Reduced-motion mode makes those effects effectively instantaneous.
