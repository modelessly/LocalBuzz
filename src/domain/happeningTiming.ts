import type { Happening } from "./types";

export const DEFAULT_HAPPENING_DURATION_MINUTES = 90;
export const MAX_NIGHTLY_HAPPENING_DURATION_MINUTES = 12 * 60;

export const hasExplicitTimeZone = (value: string) =>
  /T/.test(value) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);

export function happeningTimingEligibility(
  startValue: string,
  endValue?: string,
  estimatedDurationMinutes = DEFAULT_HAPPENING_DURATION_MINUTES,
): { eligible: true; startMs: number; endMs: number; durationMinutes: number } | { eligible: false; reason: string } {
  if (!hasExplicitTimeZone(startValue)) return { eligible: false, reason: "start date lacks an explicit time zone" };
  if (endValue && !hasExplicitTimeZone(endValue)) return { eligible: false, reason: "end date lacks an explicit time zone" };

  const startMs = Date.parse(startValue);
  const explicitEndMs = endValue ? Date.parse(endValue) : undefined;
  const durationMinutes = explicitEndMs === undefined
    ? estimatedDurationMinutes
    : (explicitEndMs - startMs) / 60_000;
  const endMs = explicitEndMs ?? startMs + durationMinutes * 60_000;

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { eligible: false, reason: "dates or timezone are invalid" };
  }
  if (durationMinutes > MAX_NIGHTLY_HAPPENING_DURATION_MINUTES) {
    return { eligible: false, reason: "event duration exceeds nightly limit" };
  }
  return { eligible: true, startMs, endMs, durationMinutes };
}

export const occurrenceEndMs = (happening: Happening) => {
  const timing = happeningTimingEligibility(
    happening.timing.start,
    happening.timing.end,
    happening.timing.estimatedDurationMinutes ?? DEFAULT_HAPPENING_DURATION_MINUTES,
  );
  return timing.eligible ? timing.endMs : Number.NaN;
};

export const isNightlyHappening = (happening: Happening) => happeningTimingEligibility(
  happening.timing.start,
  happening.timing.end,
  happening.timing.estimatedDurationMinutes ?? DEFAULT_HAPPENING_DURATION_MINUTES,
).eligible;
