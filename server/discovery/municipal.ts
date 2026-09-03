import type { Happening } from "../../src/domain/types";
import { buildEventLead, type ProposeEventLeadInput, validatePublicSourceUrl } from "../../src/domain/discovery";
import { MUNICIPAL_SOURCE_REGISTRY } from "./registry";
import type { MunicipalRadarRecord, MunicipalRadarSnapshot } from "./types";

const CLOSURES_ID = "datasf-special-event-closures";
const PERMITS_ID = "permitsf-special-event-intake";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const timestamp = (value: unknown) => text(value);
const utcTimestamp = (value: unknown) => {
  const parsed = text(value);
  return parsed && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(parsed) ? `${parsed}Z` : parsed;
};
const sourceFor = (id: string) => MUNICIPAL_SOURCE_REGISTRY.find((source) => source.id === id)!;

export function municipalCorroborationQuery(record: Pick<MunicipalRadarRecord, "officialIdentifier" | "eventHint" | "location" | "relevantDates" | "permitStatus">): string {
  const identity = record.eventHint ? `"${record.eventHint}"` : `permit "${record.officialIdentifier}"`;
  const location = record.location?.description ? ` near ${record.location.description}` : " in San Francisco";
  const dates = [record.relevantDates.startsAt, record.relevantDates.endsAt, record.relevantDates.expiresAt].filter(Boolean).join(" to ");
  return `${identity}${location}${dates ? ` around ${dates}` : ""} official public event page; verify title, exact event date/time, physical venue, organizer and direct source independently of municipal status ${record.permitStatus}`;
}

function midpoint(shape: unknown): { lat?: number; lng?: number } {
  if (!isRecord(shape) || shape.type !== "LineString" || !Array.isArray(shape.coordinates) || !shape.coordinates.length) return {};
  const coordinates = shape.coordinates.filter((item): item is [number, number] => Array.isArray(item) && item.length >= 2 && typeof item[0] === "number" && typeof item[1] === "number");
  if (!coordinates.length) return {};
  return { lng: coordinates.reduce((sum, item) => sum + item[0], 0) / coordinates.length, lat: coordinates.reduce((sum, item) => sum + item[1], 0) / coordinates.length };
}

export function normalizeClosureRows(value: unknown, fetchedAt = new Date().toISOString()): MunicipalRadarRecord[] {
  if (!Array.isArray(value)) return [];
  const byCase = new Map<string, MunicipalRadarRecord>();
  for (const row of value) {
    if (!isRecord(row) || text(row.type)?.toLowerCase() !== "special event") continue;
    const identifier = text(row.case_num) ?? text(row.objectid);
    const name = text(row.case_name);
    const location = text(row.loc_desc);
    const status = text(row.status);
    if (!identifier || !location || !status) continue;
    const point = midpoint(row.shape);
    const current = byCase.get(identifier);
    const description = current?.location?.description ? `${current.location.description}; ${location}` : location;
    const record: MunicipalRadarRecord = {
      id: `municipal-${CLOSURES_ID}-${identifier}`,
      cityId: "san-francisco",
      sourceId: CLOSURES_ID,
      officialIdentifier: identifier,
      eventHint: name,
      location: { description, ...point },
      relevantDates: { startsAt: utcTimestamp(row.start_utc) ?? timestamp(row.start_dt), endsAt: utcTimestamp(row.end_utc) ?? timestamp(row.end_dt) },
      permitStatus: status,
      officialSourceUrl: sourceFor(CLOSURES_ID).canonicalUrl,
      suggestedSearchQuery: "",
      fetchedAt,
      corroborationStatus: "required",
    };
    record.suggestedSearchQuery = municipalCorroborationQuery(record);
    byCase.set(identifier, record);
  }
  return [...byCase.values()].sort((a, b) => a.officialIdentifier.localeCompare(b.officialIdentifier));
}

export function normalizePermitRows(value: unknown, fetchedAt = new Date().toISOString()): MunicipalRadarRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row): MunicipalRadarRecord[] => {
    if (!isRecord(row) || text(row.recordtype)?.toLowerCase() !== "special event intake form") return [];
    const identifier = text(row.recordno) ?? text(row.recordid);
    const status = text(row.status_detail);
    if (!identifier || !status || status.toLowerCase() === "inactive") return [];
    const expiresAt = timestamp(row.expiration_date);
    if (expiresAt && expiresAt.slice(0, 10) < fetchedAt.slice(0, 10)) return [];
    const urlValue = isRecord(row.url) ? text(row.url.url) : text(row.url);
    const checked = urlValue ? validatePublicSourceUrl(urlValue) : undefined;
    const address = [text(row.streetno), text(row.streetname), text(row.unit), text(row.postalcode)].filter(Boolean).join(" ");
    const record: MunicipalRadarRecord = {
      id: `municipal-${PERMITS_ID}-${identifier}`,
      cityId: "san-francisco",
      sourceId: PERMITS_ID,
      officialIdentifier: identifier,
      location: address ? { description: address } : undefined,
      relevantDates: { submittedAt: timestamp(row.submitted_date), expiresAt },
      permitStatus: status,
      officialSourceUrl: checked?.ok ? checked.url : sourceFor(PERMITS_ID).canonicalUrl,
      suggestedSearchQuery: "",
      fetchedAt,
      corroborationStatus: "required",
    };
    record.suggestedSearchQuery = municipalCorroborationQuery(record);
    return [record];
  }).sort((a, b) => a.officialIdentifier.localeCompare(b.officialIdentifier));
}

async function fetchJson(url: URL, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`DataSF request failed with HTTP ${response.status}.`);
  return response.json() as Promise<unknown>;
}

export async function fetchSpecialEventClosures(options: { now?: Date; fetchImpl?: typeof fetch } = {}): Promise<MunicipalRadarRecord[]> {
  const now = options.now ?? new Date();
  const source = sourceFor(CLOSURES_ID);
  const url = new URL(source.fetchUrl!);
  url.searchParams.set("$limit", "200");
  url.searchParams.set("$order", "start_utc asc");
  url.searchParams.set("$where", `type='Special Event' AND end_utc >= '${now.toISOString().replace("Z", "")}'`);
  return normalizeClosureRows(await fetchJson(url, options.fetchImpl ?? fetch), now.toISOString());
}

export async function fetchPermitSfEvents(options: { fetchImpl?: typeof fetch; now?: Date } = {}): Promise<MunicipalRadarRecord[]> {
  const now = options.now ?? new Date();
  const source = sourceFor(PERMITS_ID);
  const url = new URL(source.fetchUrl!);
  url.searchParams.set("$limit", "200");
  url.searchParams.set("$order", "submitted_date desc");
  const submittedCutoff = new Date(now.getTime() - 180 * 86_400_000).toISOString().replace("Z", "");
  const today = now.toISOString().slice(0, 10);
  url.searchParams.set("$where", `recordtype='Special event intake form' AND status_detail NOT IN ('Inactive','Stopped') AND submitted_date >= '${submittedCutoff}' AND (expiration_date IS NULL OR expiration_date >= '${today}T00:00:00.000')`);
  return normalizePermitRows(await fetchJson(url, options.fetchImpl ?? fetch), now.toISOString());
}

export async function refreshMunicipalRadar(input: { cityId: "stockholm" | "san-francisco"; previous?: MunicipalRadarSnapshot; now?: Date; fetchImpl?: typeof fetch }): Promise<MunicipalRadarSnapshot> {
  const now = input.now ?? new Date();
  const definitions = MUNICIPAL_SOURCE_REGISTRY.filter((source) => source.cityId === input.cityId);
  if (input.cityId === "stockholm") return {
    cityId: "stockholm", generatedAt: input.previous?.generatedAt ?? now.toISOString(), retained: Boolean(input.previous?.records.length), records: input.previous?.records ?? [],
    sources: definitions.map((source) => ({ sourceId: source.id, status: "disabled", recordCount: 0, message: source.reason })),
  };
  const collectors = new Map<string, () => Promise<MunicipalRadarRecord[]>>([
    [CLOSURES_ID, () => fetchSpecialEventClosures({ now, fetchImpl: input.fetchImpl })],
    [PERMITS_ID, () => fetchPermitSfEvents({ now, fetchImpl: input.fetchImpl })],
  ]);
  const records: MunicipalRadarRecord[] = [];
  const sources: MunicipalRadarSnapshot["sources"] = [];
  let retained = false;
  for (const definition of definitions) {
    const previous = input.previous?.records.filter((record) => record.sourceId === definition.id) ?? [];
    try {
      const fresh = await collectors.get(definition.id)!();
      if (!fresh.length && previous.length) {
        retained = true; records.push(...previous); sources.push({ sourceId: definition.id, status: "retained", recordCount: previous.length, message: "Empty refresh retained the last-good municipal records." });
      } else {
        records.push(...fresh); sources.push({ sourceId: definition.id, status: fresh.length ? "fresh" : "invalid", recordCount: fresh.length, message: fresh.length ? undefined : "Refresh returned no valid municipal records." });
      }
    } catch (error) {
      retained = retained || previous.length > 0;
      records.push(...previous);
      sources.push({ sourceId: definition.id, status: previous.length ? "retained" : "unavailable", recordCount: previous.length, message: error instanceof Error ? error.message : "Municipal source unavailable." });
    }
  }
  return { cityId: input.cityId, generatedAt: retained && input.previous ? input.previous.generatedAt : now.toISOString(), retained, records: records.sort((a, b) => a.id.localeCompare(b.id)), sources };
}

const normalized = (value?: string) => value?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";

export function corroborateMunicipalRecord(record: MunicipalRadarRecord, input: ProposeEventLeadInput | undefined, happenings: Happening[], now = new Date()) {
  if (!input) return { ok: false as const, code: "CORROBORATION_REQUIRED" as const, message: "A municipal permit or closure is radar evidence, not a public event. Independent official event evidence is required." };
  const sourceHost = new URL(input.sourceUrl).hostname;
  if (sourceHost.endsWith("sfgov.org") || input.sourceType === "editorial_page" || input.sourceType === "other_public_page") return { ok: false as const, code: "CORROBORATION_REQUIRED" as const, message: "Corroboration must come from an independent official, venue, or ticket source." };
  const evidenceText = input.evidence.map((item) => `${item.field} ${item.note ?? ""}`).join(" ");
  const identityMatch = Boolean(record.eventHint && normalized(input.fields.title).includes(normalized(record.eventHint))) || evidenceText.includes(record.officialIdentifier);
  if (!identityMatch) return { ok: false as const, code: "CORROBORATION_MISMATCH" as const, message: "The official event evidence does not identify this municipal record." };
  const lead = buildEventLead({ ...input, submittedBy: { kind: "municipal_corroboration", sourceId: record.sourceId, officialIdentifier: record.officialIdentifier }, evidence: [...input.evidence, { field: "municipal_radar", sourceUrl: record.officialSourceUrl, note: `Municipal radar ${record.officialIdentifier}; not proof of a public event.` }] }, record.cityId, happenings, now);
  return lead;
}
