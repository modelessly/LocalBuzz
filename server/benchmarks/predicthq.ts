import type { CityId, HappeningCategory } from "../../src/domain/types";
import type { BenchmarkCollection, BenchmarkEvent } from "./types";

const API_URL = "https://api.predicthq.com/v1/events/";
const cityConfig: Record<CityId, { center: string; radius: string }> = {
  stockholm: { center: "59.3293,18.0686", radius: "25km" },
  "san-francisco": { center: "37.7749,-122.4194", radius: "15mi" },
};
const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const list = (value: unknown) => Array.isArray(value) ? value : [];
const category = (value?: string): HappeningCategory => value === "concerts" ? "live_music" : value === "festivals" || value === "performing-arts" ? "culture" : value === "community" ? "activity" : value === "conferences" ? "talk" : "other";

export function buildPredictHqUrl(input: { cityId: CityId; start: string; end: string; limit?: number }): string {
  const url = new URL(API_URL);
  url.searchParams.set("active.gte", input.start);
  url.searchParams.set("active.lte", input.end);
  url.searchParams.set("within", `${cityConfig[input.cityId].radius}@${cityConfig[input.cityId].center}`);
  url.searchParams.set("limit", String(Math.min(input.limit ?? 100, 200)));
  url.searchParams.set("sort", "start");
  return url.toString();
}

export function parsePredictHqResponse(value: unknown, cityId: CityId, fetchedAt: string): { records: BenchmarkEvent[]; rejected: string[] } {
  const results = list(record(value)?.results);
  const records: BenchmarkEvent[] = [];
  const rejected: string[] = [];
  for (const [index, raw] of results.entries()) {
    const item = record(raw);
    const id = text(item?.id); const title = text(item?.title); const start = text(item?.start);
    const location = list(item?.location);
    if (!id || !title || !start || !Number.isFinite(Date.parse(start))) { rejected.push(`result ${index}: identity, title or start is invalid`); continue; }
    const entities = list(item?.entities).map(record).filter((entry): entry is Record<string, unknown> => Boolean(entry));
    const venue = entities.find((entity) => text(entity.type)?.toLowerCase() === "venue");
    const performer = entities.find((entity) => ["person", "artist"].includes(text(entity.type)?.toLowerCase() ?? ""));
    records.push({ provider: "predicthq", providerId: id, cityId, title, start, end: text(item?.end), category: category(text(item?.category)), venue: { name: text(venue?.name), lng: typeof location[0] === "number" ? location[0] : undefined, lat: typeof location[1] === "number" ? location[1] : undefined }, performer: performer && text(performer.name) ? { name: text(performer.name)!, stableId: text(performer.entity_id) } : undefined, canonicalUrl: text(item?.url), fetchedAt });
  }
  return { records, rejected };
}

export async function collectPredictHq(input: { apiKey?: string; cityId: CityId; start: string; end: string; now?: Date; fetchImpl?: typeof fetch }): Promise<BenchmarkCollection> {
  if (!input.apiKey?.trim()) return { records: [], rejected: [], queryCount: 0, message: "PREDICTHQ_API_KEY is unavailable." };
  const response = await (input.fetchImpl ?? fetch)(buildPredictHqUrl(input), { headers: { Authorization: `Bearer ${input.apiKey}`, Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`PredictHQ returned HTTP ${response.status}.`);
  const parsed = parsePredictHqResponse(await response.json(), input.cityId, (input.now ?? new Date()).toISOString());
  return { ...parsed, queryCount: 1 };
}
