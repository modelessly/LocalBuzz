import type { CityId, Happening } from "../domain/types";

export type CityEventSourceStatus = {
  sourceId: string;
  publisher: string;
  status: "fresh" | "retained" | "unavailable" | "disabled" | "invalid";
  attemptedAt: string;
  lastSuccessfulRefresh?: string;
  eventCount: number;
  rejectedCount: number;
  message?: string;
};

export type CityEventSnapshotPayload = {
  cityId: CityId;
  generatedAt: string;
  retained: boolean;
  happenings: Happening[];
  sources: CityEventSourceStatus[];
};

export async function loadCityEventSnapshot(cityId: CityId, signal?: AbortSignal): Promise<CityEventSnapshotPayload> {
  const response = await fetch(`/api/ingestion/${cityId}`, { signal });
  if (!response.ok) throw new Error(`Event ingestion returned HTTP ${response.status}`);
  const payload = await response.json() as Partial<CityEventSnapshotPayload>;
  if (payload.cityId !== cityId || !Array.isArray(payload.happenings) || !Array.isArray(payload.sources) || typeof payload.generatedAt !== "string") throw new Error("Event ingestion returned an invalid payload");
  return payload as CityEventSnapshotPayload;
}

export function describeCityEventSnapshot(payload: CityEventSnapshotPayload): string {
  const active = payload.sources.filter((source) => source.status === "fresh" || source.status === "retained");
  const unavailable = payload.sources.filter((source) => source.status === "unavailable");
  const sourceLabel = active.length ? active.map((source) => source.publisher).join(" · ") : "configured sources";
  const retained = payload.retained ? ` Retained last-good snapshot from ${new Date(payload.generatedAt).toLocaleString()}.` : "";
  const degraded = unavailable.length ? ` ${unavailable.length} source${unavailable.length === 1 ? " is" : "s are"} unavailable.` : "";
  return `${payload.happenings.length} canonical events from ${sourceLabel}.${retained}${degraded}`;
}
