import type { PulseBuzzLabel, PulseSignal } from "./types";

export const BUZZ_SCORE_WEIGHTS = {
  timing: 20,
  freshness: 15,
  social: 20,
  corroboration: 10,
  sourceDiversity: 10,
  actionability: 15,
  convenience: 5,
  contextCompatibility: 5,
} as const;

export function buzzLabel(score: number): PulseBuzzLabel {
  if (score >= 80) return "Very Hot";
  if (score >= 60) return "Hot Now";
  if (score >= 40) return "Buzzing";
  if (score >= 20) return "Starting";
  return "Quiet";
}

export function scorePulseSignal(
  signal: Pick<PulseSignal, "kind" | "category" | "location" | "timing" | "social" | "reasonActionable">,
  now: Date,
): Pick<PulseSignal, "freshnessMinutes" | "actionableNow" | "buzzScore" | "buzzLabel"> {
  const latestSeenMs = Date.parse(signal.timing.latestSeen);
  const freshnessMinutes = Math.max(0, Math.round((now.getTime() - latestSeenMs) / 60_000));
  const activeUntilMs = signal.timing.likelyActiveUntil ? Date.parse(signal.timing.likelyActiveUntil) : Number.NaN;
  const clearlyActive = Number.isFinite(activeUntilMs) && activeUntilMs > now.getTime();
  const actionableNow = clearlyActive || (freshnessMinutes <= 90 && signal.kind !== "scheduled_event");
  const timing = clearlyActive ? 20 : freshnessMinutes <= 30 ? 16 : freshnessMinutes <= 90 ? 12 : 6;
  const freshness = freshnessMinutes <= 30 ? 15 : freshnessMinutes <= 90 ? 11 : freshnessMinutes <= 180 ? 6 : 0;
  const social = Math.min(20, signal.social.evidenceCount * 4);
  const corroboration = Math.min(10, signal.social.independentSourceCount * 4);
  const sourceDiversity = Math.min(10, signal.social.sourceAccounts.length * 3);
  const actionability = actionableNow && signal.reasonActionable.trim().length >= 12 ? 15 : actionableNow ? 10 : 3;
  const convenience = signal.location.name.trim() && signal.location.neighborhood.trim() ? 5 : 0;
  const contextCompatibility = signal.category !== "other" && signal.kind !== "city_condition" ? 5 : 2;
  const buzzScore = Math.max(0, Math.min(100, Math.round(timing + freshness + social + corroboration + sourceDiversity + actionability + convenience + contextCompatibility)));
  return { freshnessMinutes, actionableNow, buzzScore, buzzLabel: buzzLabel(buzzScore) };
}
