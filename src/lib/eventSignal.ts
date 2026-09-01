import type { Happening } from "../domain/types";

export type EventSignalState = "live" | "starting-soon" | "stale" | "quiet";

const SOON_WINDOW_MS = 2 * 60 * 60 * 1000;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function eventSignalState(happening: Happening, nowMs: number): EventSignalState {
  if (["sold_out", "cancelled"].includes(happening.status.availability)) return "quiet";

  const startMs = Date.parse(happening.timing.start);
  const explicitEndMs = happening.timing.end ? Date.parse(happening.timing.end) : Number.NaN;
  const estimatedEndMs = Number.isFinite(startMs)
    ? startMs + (happening.timing.estimatedDurationMinutes ?? 120) * 60 * 1000
    : Number.NaN;
  const endMs = Number.isFinite(explicitEndMs) ? explicitEndMs : estimatedEndMs;

  if (Number.isFinite(startMs) && startMs <= nowMs && nowMs < endMs) return "live";
  if (Number.isFinite(startMs) && startMs > nowMs && startMs - nowMs <= SOON_WINDOW_MS) return "starting-soon";

  const evidenceAt = happening.source.lastVerifiedAt ?? happening.source.fetchedAt;
  const evidenceMs = evidenceAt ? Date.parse(evidenceAt) : Number.NaN;
  if (Number.isFinite(evidenceMs) && nowMs - evidenceMs > STALE_AFTER_MS) return "stale";

  return "quiet";
}
