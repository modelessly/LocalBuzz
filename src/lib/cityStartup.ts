import type { CityId, DomainResult } from "../domain/types";
import type { LocalBuzzActions } from "../domain/store";
import { loadCityEventSnapshot, type CityEventSnapshotPayload } from "./cityEvents";
import { loadCityPulse, type CityPulsePayload } from "./cityPulse";

export type CitySnapshotLoader = (cityId: CityId, signal?: AbortSignal) => Promise<CityEventSnapshotPayload>;
export type CityPulseLoader = (cityId: CityId, signal?: AbortSignal) => Promise<CityPulsePayload>;

export type RefreshCityDataOptions = {
  cityId: CityId;
  refreshId: string;
  actions: LocalBuzzActions;
  signal?: AbortSignal;
  loader?: CitySnapshotLoader;
  timeoutMs?: number;
  now?: () => Date;
};

const safeFailureMessage = (error: unknown, timedOut: boolean) => {
  if (timedOut) return "The permitted event-source refresh timed out.";
  if (error instanceof Error && /invalid|malformed/i.test(error.message)) {
    return "The collector returned an invalid response.";
  }
  return "The permitted event-source refresh was unavailable.";
};

export async function refreshCityData({
  cityId,
  refreshId,
  actions,
  signal,
  loader = loadCityEventSnapshot,
  timeoutMs = 20_000,
  now = () => new Date(),
}: RefreshCityDataOptions): Promise<DomainResult<{ applied: boolean; currentCount: number; placeCount: number }>> {
  const started = actions.beginCityRefresh(cityId, refreshId, now().toISOString());
  if (!started.ok) return started;

  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort("timeout");
  }, timeoutMs);

  try {
    const snapshot = await loader(cityId, controller.signal);
    if (signal?.aborted) {
      const inventory = actions.readInventoryStatus();
      return { ok: true, applied: false, currentCount: inventory.ok ? inventory.currentEventCount : 0, placeCount: inventory.ok ? inventory.placeCount : 0 };
    }
    return actions.applyCityEventSnapshot(snapshot, refreshId, now());
  } catch (error) {
    if (signal?.aborted && !timedOut) {
      const inventory = actions.readInventoryStatus();
      return { ok: true, applied: false, currentCount: inventory.ok ? inventory.currentEventCount : 0, placeCount: inventory.ok ? inventory.placeCount : 0 };
    }
    return actions.failCityRefresh(
      cityId,
      refreshId,
      safeFailureMessage(error, timedOut),
      error instanceof Error && /invalid|malformed/i.test(error.message) ? "invalid" : "unavailable",
      now(),
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function refreshCityPulseData(options: {
  cityId: CityId; actions: LocalBuzzActions; signal?: AbortSignal; loader?: CityPulseLoader; timeoutMs?: number; now?: () => Date;
}): Promise<DomainResult<{ applied: boolean; liveSignalCount: number; enrichedCount: number }>> {
  const { cityId, actions, signal, loader = loadCityPulse, timeoutMs = 100_000, now = () => new Date() } = options;
  const controller = new AbortController(); let timedOut = false;
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort("timeout"); }, timeoutMs);
  try {
    const payload = await loader(cityId, controller.signal);
    if (signal?.aborted) return { ok: true, applied: false, liveSignalCount: 0, enrichedCount: 0 };
    return actions.applyCityPulse(payload, now());
  } catch {
    if (signal?.aborted && !timedOut) return { ok: true, applied: false, liveSignalCount: 0, enrichedCount: 0 };
    actions.failCityPulse(cityId, timedOut ? "Social pulse timed out; canonical events are unchanged." : undefined, now());
    return { ok: true, applied: false, liveSignalCount: 0, enrichedCount: 0 };
  } finally {
    clearTimeout(timer); signal?.removeEventListener("abort", onAbort);
  }
}
