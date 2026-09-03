# Design

## Design objective

Make Local Buzz feel like a credible consumer product while staying within the existing Modless design system.

Do not create a new component system.

## Experience character

Local Buzz should feel:

- alive
- contemporary
- urban
- spontaneous
- calm enough to support decisions
- visually richer than an analytics dashboard

Avoid:

- enterprise dashboard aesthetics
- dense tables
- chat-first layouts
- excessive decorative animation
- neon "AI" clichés
- autonomous-agent theater

## Primary layout

Desktop-first for the contest demo.

Recommended structure:

```text
┌────────────────────────────────────────────────────────────┐
│ Local Buzz             [Stockholm | San Francisco] Tonight │
├───────────────────────────────────┬────────────────────────┤
│                                   │ YOUR NIGHT             │
│                                   │                        │
│            LIVE MAP               │ 19:00  Stop 1          │
│                                   │ 20:30  Stop 2 [locked] │
│                                   │ 22:15  Stop 3          │
│                                   │                        │
│                                   │ 810 SEK · ends 23:45   │
├───────────────────────────────────┴────────────────────────┤
│ EVENT / CANDIDATE CARDS                                   │
└────────────────────────────────────────────────────────────┘
```

## Visual hierarchy

1. the current night
2. map and spatial relationships
3. current candidates
4. provenance / freshness
5. controls

For the two-city proof of concept, use a compact city dropdown in the header. It should make the active city unmistakable and offer Stockholm and San Francisco without consuming the full control bar. A future larger city catalogue can make this selection searchable or derive city context from the hostname.

Use a neighboring time selector with Right Now, Later, Tomorrow, and Pick a date. The choice must change the real search window and its CTA, not merely change the label.

`Right Now` shows only bounded events whose occurrence is active at the current city-local instant; multi-day passes and provider sale windows longer than 24 hours are not treated as live activity. `Later` shows events that start after the current instant and before local midnight. `Tomorrow` and picked dates show events starting within that local calendar day. Empty selections stay empty and never silently advance to another day. A completed source refresh must reapply the active selection rather than exposing the full unexpired catalog.

When `Right Now` is empty, keep that honest empty state and follow it with a separate `Happening Later` section when canonical events remain later on the same city-local day. The map shows those same fallback events so its pins and visible cards stay aligned. This fallback does not change the selected time window, does not include tomorrow, and does not appear beneath an explicit zero-result text search.

The UI should make it obvious which elements are:

- available
- considered
- selected
- staged
- accepted
- locked
- unavailable

## Required states

### Normal

Default browsing state.

### Agent searching

Avoid fake "AI thinking" animation.

Instead show real interface consequences:

- matching pins become emphasized
- irrelevant options recede
- candidate area updates

### Staged proposal

Agent-created plan is visibly provisional.

Use existing Modless semantic patterns where possible.

Requirements:

- clear "Proposed" or equivalent status
- visible accept/reject controls
- proposed route/timeline differs from accepted state

### Locked

A lock is an explicit human constraint.

Requirements:

- strong but compact visual indicator
- hover/tooltip or label explains meaning
- repair must visibly preserve it

### Human edited

After a direct manipulation, the timeline should immediately reflect the new canonical state.

### Disruption

Example:

> Event unavailable

Must be obvious but not melodramatic.

### Staged repair

Show what changed, ideally at the affected stop only.

### Accepted

Return to a calm canonical state.

## Event cards

Minimum useful content:

- title
- venue
- time
- category
- estimated price
- short atmosphere/mood line if enriched
- source/freshness
- availability state
- action to inspect or use

Do not overload cards with every schema field.

## Provenance

Subtle but credible.

Examples:

- "Visit Stockholm"
- "Ticketmaster"
- "Venue source"
- "Enriched by Local Buzz"
- "Demo live-status simulation"

Do not imply derived or simulated attributes were directly reported by a source.

## Motion

Use motion only to explain state change.

Good:

- pin emphasis
- event entering timeline
- staged replacement
- route adjustment
- status transition

Avoid:

- ambient pulsing everywhere
- decorative particles
- long transitions that slow the demo

## Accessibility

Even under deadline:

- keyboard reachable primary actions
- sufficient contrast
- visible focus
- state not communicated by color alone
- semantic labels for lock/status
- motion should not be required to understand changes

## Mobile

Responsive behavior should not break, but the contest demo may be optimized for desktop/tablet view.

Do not spend critical-path time perfecting mobile before the WebMCP loop works.

## WebMCP motion language

Local Buzz distinguishes agent work from human input without introducing an artificial cursor or generic AI sparkle treatment.

- **Reserved command bay:** the WebMCP instrument keeps the same header footprint when idle, working, complete, or failed, so lifecycle copy never moves the navigation.
- **Intent Loom:** four labeled strands—place, time, budget, and taste—leave the command bay on the first real tool-lifecycle event and converge on the map, timeline, or shared-state surface the tool affects.
- **Real progress instrument:** labels come from the actual tool lifecycle and name the active tool, current operation, completion, or structured failure.
- **Living event signals:** restrained map rings communicate only derived event timing (live or starting soon); stale evidence is shown as a static dashed signal rather than false activity.
- **Plan arrival:** a validated WebMCP addition receives a brief directional arrival treatment tied to the real tool lifecycle; it is already part of the one editable itinerary.
- **Surgical repair:** only replacement changes animate into the timeline and map; the prior stop and route remain as a faint repair scar while the revision is staged, while preserved stops stay anchored.

Human clicks do not emit agent motion. Motion is explanatory, never a source of truth, and `prefers-reduced-motion` reduces every animation and transition to an immediate state change.

## Phase 1 Place language

The discovery surface keeps the existing visual hierarchy and adds an Events/Places switch. Place cards lead with kind, then location, source-backed interest evidence, duration, price range, use-case tags and official-source attribution. Qualification states stay in the data model but are not rendered as tags. Plain operational copy and disabled staging make incomplete records legible without presenting them as closed or poor quality.

Timeline stops identify custom places in supporting copy rather than with qualification or stop-type chips. Staged state remains structural through its review boundary and accept/reject controls, not a colored status badge. Locked and unavailable states use restrained plain text; surgical repair keeps its structural scar and motion without a repair label. Place map pins use a compact square treatment; custom place pins add a dashed treatment. Routes use all stop coordinates in planned order.

The custom-place form intentionally asks for a narrow set of explicit assumptions and keeps the result outside the canonical catalog. Agent tool lifecycle uses the same command bay, Intent Loom targets and reduced-motion behavior; the five Place tools add no new motion state.

## Qualification copy and mission strip

Do not render `verified`, `needs review`, `unverified`, or equivalent qualification statuses as tags anywhere in Local Buzz. Preserve source links, checked dates and domain safeguards. Do not add a red “hours and prices unavailable for planning” message to Place cards; disabled actions retain the guard without the warning row. Do not restore the numbered mission strip or city mission sentence; the city prompt remains available only through the agent handoff action.

## Phase 4 discovery review

Agent-acquired records appear in a dedicated review surface between shared-state status and canonical discovery. Dashed lime boundaries and “Provisional · discovery only” copy distinguish leads from event/Place cards. Each lead shows extracted facts, original source, missing fields, duplicate warnings, verification issues and evidence references before accept/reject/custom actions.

The Intent Loom adds a review target for the two proposal tools but keeps the existing real three-phase lifecycle and reduced-motion behavior. Proposal motion begins only on a WebMCP lifecycle event; human review clicks do not emit agent motion.

## Phase 6 visual boundary

Event graphs, provider benchmarks and operational ledgers remain development artifacts and do not add dashboard surfaces, badges or motion. Graph-created event leads reuse the existing provisional review treatment. Acceptance failures and warnings use the existing structured plan feedback, so staged/accepted, locked/repaired, canonical/custom-place and reduced-motion semantics do not change.

## Your Night metadata boundary

The itinerary does not render state as colored pills, chips or badges. Agent connection, budget, lock and unavailable information is plain text; staged review is communicated by the accept/reject controls and structural boundary. Manual demo staging, disruption and repair controls are not product UI. Real source updates and the statically registered `repair_plan` WebMCP tool continue to use the shared plan domain and motion system.

## Consumer options and itinerary controls

The map and Your Night are independent clipped cards with page background visible through their desktop gap and ordinary stacking on narrow screens. The header must not draw a page-wide bottom divider at the same height as their top edges; only each card owns its outline. City headings use only the city name. The timeline's lock control communicates current state (`Unlocked` or `Locked`) while its accessible name and tooltip communicate the resulting action. Remove remains permanently adjacent, destructive and at least 44 CSS pixels high.

The plan summary contains only the first-to-last stop time range and estimated party total. Stockholm uses a 24-hour clock and San Francisco uses AM/PM; derived final-stop durations are identified accessibly as estimates. Event booking/source links and Place reservation/official-site links are secondary actions with labels that match the actual URL type.

Agent-acquired leads render under `Options` with consumer facts, a working source link, missing-detail and duplicate guidance, and simple add/remove actions. Reviewed leads leave this surface. Internal acquisition, canonicalization, evidence-count, validation and inventory-status language is not primary UI. This supersedes the visible review-console treatment described in Phase 4 while preserving its domain validation and human decision boundary.

Abbreviated city-local dates carry a full localized accessible description. San Francisco inferred ends use a concise `(EST.)` suffix; Stockholm retains `CA` before the inferred end. Empty human searches provide an explicit reset, provider-empty windows avoid claiming that the city itself has no events, and incomplete itinerary prices never render as zero.
