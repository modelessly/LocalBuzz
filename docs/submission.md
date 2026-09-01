# Submission Checklist

## Official requirements

Based on the WebMCP Challenge page:

- working live URL
- WebMCP-enabled app
- public demo video under 3 minutes with audio
- public source repository
- source/assets/instructions required to run
- open-source license
- written explanation of:
  - why the use case fits WebMCP
  - how it improves UX
  - what humans and agents can do together that was difficult/impossible before
  - how WebMCP was implemented

## Judging alignment

### WebMCP Leverage

Evidence to show:

- multiple non-trivial tools
- tools drive the main workflow
- shared client-side state
- visible UI updates
- human change informs next agent action
- repair preserves locked state

### Execution

Evidence to show:

- polished map/timeline experience
- coherent states
- reliable deployed demo
- source provenance
- review/accept flow

### Potential Impact

Story:

- city discovery is fragmented
- static recommendation is not enough
- nights change in real time
- personal-agent context can personalize without Local Buzz building another user profile
- potential local network effects improve coverage over time

### Creativity & Ambition

Story:

- city as shared human-agent workspace
- website as domain expert, agent as user expert
- collaborative repair rather than delegated itinerary generation

## Recommended Devpost description skeleton

### What it is

Local Buzz turns the city into a shared workspace for a person and their personal agent.

### Problem

"What should we do tonight?" requires combining fragmented, rapidly changing local information with subjective human taste and personal constraints.

### Why WebMCP

The human needs a visual map and timeline. The agent needs structured search and plan-manipulation capabilities. WebMCP lets both operate on the same page state without the agent scraping/clicking the UI or bypassing the web experience through a separate backend integration.

### Collaboration

The agent stages a plan. The human edits and locks it visually. The agent reads those changes and repairs around them. When an event becomes unavailable, the agent changes only the affected portion and leaves the human's locked choices intact.

### Implementation

Local Buzz registers client-side WebMCP tools for search, candidate display, plan staging, plan reading, locking, repair, and staged-change acceptance. These tools call the same domain functions as the human UI.

### Prototype-data disclosure

The prototype uses a small set of real Stockholm event/venue records. Local Buzz adds derived metadata for experience fit. A last-minute availability change in the demo is explicitly simulated to demonstrate repair behavior.

## Repo hygiene

Before making public:

- remove secrets
- remove private notes
- remove proprietary assets not licensed for public release
- confirm Modless assets/code are publishable
- add license
- verify README instructions from clean clone

## Final deadline

September 3, 2026 at 1:00 PM PDT / 22:00 CEST.

Do not rely on the final hour.
