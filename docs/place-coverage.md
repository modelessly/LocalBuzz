# Place Coverage Snapshot

## Scope

Phase 2 publishes 33 Place snapshots for Stockholm and 33 for San Francisco, verified or reviewed on September 1, 2026. They are source-backed fixtures, not a live directory or reservation guarantee.

The catalog covers restaurant, bar, pub, cocktail lounge, wine bar, music bar and club use cases across dinner, quick bite, drinks and late drinks. Generic chains, fast food, convenience stores, supermarkets, gas stations, food courts, delivery-only kitchens and known closed/unresolved records are excluded. The unresolved 15 Romolo lead was removed during qualification and replaced with Red Window after official-site verification.

## Operational qualification

A Place counts as operationally qualified only when it has an official-source numeric price range and typed weekly hours. Missing data is exposed as unknown and blocks staging. Every qualified visit still warns that exceptional/date-specific hours are unknown unless explicitly captured.

The executable coverage gate uses a 3.5 km straight-line radius as a stable proxy for a roughly 15-minute compact-city journey. It is not a walking, transit or traffic promise. Each corridor below must retain at least three operationally qualified options:

- Stockholm central/Norrmalm
- Stockholm Södermalm
- Stockholm Vasastan
- San Francisco Mission
- San Francisco SoMa
- San Francisco Divisadero/Lower Haight
- San Francisco North Beach

The proxy and minimum are enforced in `src/data/validate.test.ts`. The current operational subset includes official evidence from businesses such as Tjoget, Pelikan, Surfers, Stigbergets Fot, Bar Central, True Laurel, Trick Dog, Foreign Cinema, Horsefeather, The Page, Tosca Cafe, Vesuvio Cafe and Red Window.

## Known gaps

- No route-time provider is used; the distance proxy cannot account for bridges, hills, service frequency or traffic.
- Exceptional and holiday hours are generally unknown.
- Many qualified discovery records intentionally remain non-stageable until their official menu and weekly schedule can be captured reliably.
- Prices are approximate per-person ranges derived from current official menu items, not quotes or total-check guarantees.
- Verification is a dated snapshot. Values older than 90 days generate a staging warning and should be refreshed.
