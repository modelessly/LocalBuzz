import type { CityId } from "../../src/domain/types";
import type { BenchmarkCollection, BenchmarkEvent } from "./types";

export type KnownPerformer = { name: string; stableId?: string; sourceHappeningId: string };
const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const bounds: Record<CityId, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = { stockholm: { minLat: 59.15, maxLat: 59.5, minLng: 17.7, maxLng: 18.35 }, "san-francisco": { minLat: 37.7, maxLat: 37.84, minLng: -122.54, maxLng: -122.34 } };

export function buildBandsintownUrl(performer: KnownPerformer, appId: string): string {
  const identity = performer.stableId ? `id_${performer.stableId.replace(/^id_/, "")}` : performer.name;
  const url = new URL(`https://rest.bandsintown.com/artists/${encodeURIComponent(identity)}/events`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("date", "upcoming");
  return url.toString();
}

export function parseBandsintownResponse(value: unknown, performer: KnownPerformer, cityId: CityId, fetchedAt: string): { records: BenchmarkEvent[]; rejected: string[] } {
  if (!Array.isArray(value)) return { records: [], rejected: ["response is not an event array"] };
  const records: BenchmarkEvent[] = []; const rejected: string[] = [];
  for (const [index, raw] of value.entries()) {
    const item = record(raw); const venue = record(item?.venue); const id = text(item?.id) ?? (typeof item?.id === "number" ? String(item.id) : undefined); const start = text(item?.datetime); const title = text(item?.title) ?? performer.name;
    const lat = Number(venue?.latitude); const lng = Number(venue?.longitude); const cityBounds = bounds[cityId];
    if (!id || !start || !Number.isFinite(Date.parse(start)) || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < cityBounds.minLat || lat > cityBounds.maxLat || lng < cityBounds.minLng || lng > cityBounds.maxLng || text(venue?.type) === "Virtual") { rejected.push(`result ${index}: event is invalid, virtual or outside the city`); continue; }
    records.push({ provider: "bandsintown", providerId: id, cityId, title, start, category: "live_music", venue: { name: text(venue?.name), lat, lng }, performer: { name: performer.name, stableId: performer.stableId }, canonicalUrl: text(item?.url), fetchedAt });
  }
  return { records, rejected };
}

export async function collectBandsintown(input: { appId?: string; termsApproved: boolean; performers: KnownPerformer[]; cityId: CityId; now?: Date; fetchImpl?: typeof fetch }): Promise<BenchmarkCollection> {
  if (!input.termsApproved) return { records: [], rejected: [], queryCount: 0, message: "Bandsintown organizational API access has not been approved; benchmark is disabled." };
  if (!input.appId?.trim()) return { records: [], rejected: [], queryCount: 0, message: "BANDSINTOWN_APP_ID is unavailable." };
  if (!input.performers.length) return { records: [], rejected: [], queryCount: 0, message: "No trusted performer identities were supplied." };
  const records: BenchmarkEvent[] = []; const rejected: string[] = [];
  for (const performer of input.performers.slice(0, 10)) {
    const response = await (input.fetchImpl ?? fetch)(buildBandsintownUrl(performer, input.appId), { signal: AbortSignal.timeout(20_000) });
    if (response.status === 404) { rejected.push(`${performer.name}: artist not found`); continue; }
    if (!response.ok) throw new Error(`Bandsintown returned HTTP ${response.status}.`);
    const parsed = parseBandsintownResponse(await response.json(), performer, input.cityId, (input.now ?? new Date()).toISOString());
    records.push(...parsed.records); rejected.push(...parsed.rejected);
  }
  return { records, rejected, queryCount: Math.min(input.performers.length, 10) };
}
