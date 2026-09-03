import { normalizeEventCandidate } from "./pipeline";
import { parseEventSitemap, parseIcsEvents, parseRssAtomEvents, parseSchemaOrgEventJsonLd, parseVenueJsonEvents } from "./parsers";
import type { EventCandidate, EventSourceDefinition } from "./types";

type DirectOptions = { source: EventSourceDefinition; fetchImpl?: typeof fetch; now?: Date };

export async function collectDirectSource(options: DirectOptions) {
  const attemptedAt = (options.now ?? new Date()).toISOString();
  const fetcher = options.fetchImpl ?? fetch;
  const response = await fetcher(options.source.fetchUrl);
  if (!response.ok) throw new Error(`${options.source.publisher} returned HTTP ${response.status}`);
  const context = { source: options.source, fetchedAt: attemptedAt };
  let candidates: EventCandidate[] = [];
  if (options.source.format === "venue_json") candidates = parseVenueJsonEvents(await response.json(), context);
  else {
    const body = await response.text();
    if (options.source.format === "schema_org_jsonld") candidates = parseSchemaOrgEventJsonLd(body, context);
    if (options.source.format === "ics") candidates = parseIcsEvents(body, context);
    if (options.source.format === "rss_atom") candidates = parseRssAtomEvents(body, context);
    if (options.source.format === "event_sitemap") {
      const pageResults = await Promise.allSettled(parseEventSitemap(body).slice(0, 30).map(async (url) => {
        const page = await fetcher(url);
        return page.ok ? parseSchemaOrgEventJsonLd(await page.text(), context) : [];
      }));
      candidates = pageResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    }
  }
  const normalized = candidates.map((candidate) => normalizeEventCandidate(candidate, options.source, attemptedAt, options.now));
  return { happenings: normalized.flatMap((item) => item.happening ? [item.happening] : []), rejected: normalized.flatMap((item) => item.reason ? [item.reason] : []), candidateCount: candidates.length, status: "fresh" as const, attemptedAt };
}
