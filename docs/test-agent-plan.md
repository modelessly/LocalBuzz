# Local Buzz test-agent plan

Test the existing product at `http://127.0.0.1:5173`. Do not edit code, change external services, or manufacture defects. Report confirmed findings with exact reproduction steps and distinguish observations from failures.

## Primary contract

Local Buzz has one directly editable itinerary: `currentPlan`. There is no itinerary approval, staged-plan, accept, or reject state. Search results remain discovery-only; explicit human or WebMCP add/build actions modify the plan immediately after validation.

Discovery leads are a separate canonical-catalog review workflow. Do not confuse their accept/reject controls with itinerary state.

## WebMCP catalog

Confirm these sixteen page-defined tools:

1. `propose_event_from_url`
2. `propose_place_from_url`
3. `search_happenings`
4. `show_candidates`
5. `search_places`
6. `show_place_candidates`
7. `read_place_details`
8. `add_place_stop`
9. `add_custom_place_stop`
10. `add_happening_stop`
11. `build_evening_plan`
12. `read_current_plan`
13. `lock_plan_stop`
14. `unlock_plan_stop`
15. `remove_plan_stop`
16. `repair_plan`

No `stage_*`, `accept_staged_changes`, or `reject_staged_changes` tool should be registered.

## Required scenarios

Run in both San Francisco and Stockholm:

1. Open the product and confirm the empty state says: “Your night is open. Add something from the map or ask the agent to build it.”
2. Search events and Places. Confirm searching and showing candidates do not add stops.
3. Add one event. Confirm it appears immediately in the timeline and route, unlocked.
4. Add dinner and drinks around the event. Confirm ordering, purpose labels, party-size cost, route and end time.
5. Add a custom Place. Confirm it remains visibly custom/unverified and absent from canonical search.
6. Lock a stop. Confirm persistent selected styling, a clear unlock action, and a minimum 44 by 44 pixel target.
7. Attempt agent removal and replacement of that locked stop. Confirm structured `LOCKED_STOP_CONFLICT` and no mutation.
8. Unlock it through WebMCP and confirm the human control updates. Relock through the human UI and confirm `read_current_plan` updates.
9. Remove unlocked and locked stops through the human UI. Confirm explicit human removal works and totals/routes recalculate.
10. Remove the last stop and confirm the empty state returns.
11. Build an event-only plan with `build_evening_plan`; then build or add a mixed plan. Confirm no extra approval step appears.
12. Try an unavailable/expired event, closed Place, kitchen cutoff, reservation-required Place, overlapping stop, wrong currency, unknown event price and over-budget plan. Confirm each failure leaves the prior plan unchanged.
13. Trigger a real or deterministic disrupted event and call `repair_plan`. Confirm only disrupted unlocked events change, while locked and unaffected stops remain byte-for-byte stable.
14. Switch cities with a populated plan. Confirm the plan clears and the new city’s currency, inventory and map are used.
15. Confirm the footer’s entire visible text is exactly `Local Buzz | 2026`.
16. Check keyboard focus, screen-reader button names and narrow/mobile layout for Lock, Unlock and Remove.
17. Enable reduced motion and repeat one agent addition; no prolonged or fake thinking state should appear.

## Reporting

For every mutation, call `read_current_plan` before and after and record the changed fields. Never infer canonical state only from animation. Treat fixture hours, prices and event snapshots according to their visible provenance; do not report them as confirmed live availability.

Finish with:

- confirmed defects, severity and exact reproduction;
- confirmed working behavior;
- UX observations separated from defects;
- scenarios not completed and why.
