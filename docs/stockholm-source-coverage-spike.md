# Stockholm Source Coverage Spike

## Purpose

Test whether Facebook and Instagram are required as primary inventory sources for smaller Stockholm venues, or whether sanctioned feeds and venue-owned calendars cover most of the useful supply.

This is an initial desk spike completed August 30, 2026. It identifies the best acquisition route for 20 representative venues and cultural programs; it is not a production rights review or a claim that every event is captured.

## Sample

| Venue or program | Strongest observed source | Initial acquisition route | Social role |
| --- | --- | --- | --- |
| Debaser | Open venue JSON | Integrate directly; hourly refresh | Promotion and late changes |
| Nalen | Official calendar plus Tickster | Tickster API, retain Nalen URL | Supplement only |
| Södra Teatern | Official calendar plus Tickster | Tickster API, retain venue URL | Supplement only |
| Trädgården / Under Bron | Official program plus Tickster listings | Tickster API plus venue check | Useful for club detail and late changes |
| Kollektivet Livet | Official calendar plus Ticketmaster listings | Ticketmaster or venue partnership | Useful for terrace and free events |
| Fasching | Detailed official calendar | Venue feed or permissioned extraction | Supplement only |
| Fållan | Detailed official calendar; ticket promoter varies | Venue partnership plus promoter links | Useful for club updates |
| Glenn Miller Café | Simple dated venue calendar | Permissioned venue feed | Useful for same-day substitutions |
| Stampen | Stockholm Jazz and venue listings | Venue or festival feed | Useful outside festival coverage |
| Slaktkyrkan | Slakthusen venue pages; promoter varies | Venue partnership plus ticket source | Important for smaller announcements |
| Hus 7 | Slakthusen venue pages; promoter varies | Venue partnership plus ticket source | Important for smaller announcements |
| Cyklopen | Official event pages that sometimes point to Facebook | Venue calendar plus manual verification | High-value discovery signal |
| Kultur Stockholm / Stadsmuseet | Municipal calendar | City-owned feed or permissioned calendar | Low |
| Kulturhuset Stadsteatern | Official and Visit Stockholm calendars | Visit Stockholm plus official page | Low |
| Parkteatern | Municipal cultural calendar | City-owned calendar | Low |
| Fotografiska | Official visit and program pages | Direct venue feed | Supplement only |
| Konserthuset Stockholm | Official programme calendar | Direct venue feed or structured page | Low |
| Cirkus | Official event calendar and ticket links | Ticket partner plus official page | Supplement only |
| Berns | Official calendar and promoter listings | Ticket partner plus official page | Useful for club changes |
| Snösätra / independent block events | Visit Stockholm, organizer pages, social posts | Organizer submission and watchlist | High-value discovery signal |

## What the sample suggests

- **5 of 20** have a clear aggregator or structured-feed route now: Debaser, Nalen, Södra Teatern, Trädgården/Under Bron, and Kollektivet Livet.
- **12 of 20** have useful official calendars that should be approached as direct venue feeds or permissioned source pages.
- **3 of 20** are materially social-sensitive: Cyklopen, Snösätra-style independent programming, and smaller promoter-led listings around venues such as Slaktkyrkan/Hus 7.

The important gap is not “Facebook has everything.” It is that small organizers often publish changes, free side-events, or short-lead announcements socially after the canonical venue calendar is created.

## Recommended implementation order

1. Integrate Debaser, Tickster, Billetto, Kulturbiljetter, Ticketmaster, and Visit Stockholm where terms permit.
2. Establish direct feed agreements with Fasching, Fållan, Glenn Miller Café, Slaktkyrkan/Hus 7, and Kollektivet Livet.
3. Add an organizer submission and “send this event to Local Buzz” flow for social-only discoveries.
4. Maintain a small editorial watchlist for Cyklopen, Snösätra, and independent promoters until organizer connections exist.
5. Treat Facebook and Instagram as evidence and discovery signals, not canonical unattended feeds.

## Freshness

- webhook-driven when the source supports it
- hourly for active tonight/tomorrow inventory
- daily for longer-horizon calendars
- immediate recheck when a selected event is used in an accepted night
- visibly lower confidence when the only evidence is a social post or user submission
