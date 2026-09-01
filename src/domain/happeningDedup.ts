import type { Happening } from "./types";

const normalizedText = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const dedupeKey = (item: Happening) => `${item.cityId}|${normalizedText(item.venue.name)}|${Date.parse(item.timing.start)}|${normalizedText(item.title)}`;
const urlKey = (item: Happening) => `${item.cityId}|${new URL(item.commerce.bookingUrl ?? item.source.url).toString().replace(/\/$/, "")}`;

export function deduplicateHappenings(items: Happening[]): Happening[] {
  const byKey = new Map<string, Happening>();
  const seenUrls = new Set<string>();
  for (const item of [...items].sort((a, b) => Date.parse(b.source.lastVerifiedAt ?? "") - Date.parse(a.source.lastVerifiedAt ?? ""))) {
    const key = dedupeKey(item);
    const canonical = urlKey(item);
    if (byKey.has(key) || seenUrls.has(canonical)) continue;
    byKey.set(key, item);
    seenUrls.add(canonical);
  }
  return [...byKey.values()].sort((a, b) => Date.parse(a.timing.start) - Date.parse(b.timing.start));
}
