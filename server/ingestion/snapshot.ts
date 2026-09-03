import type { CityEventSnapshot, SourceRefreshResult } from "./types";
import { isNightlyHappening, occurrenceEndMs } from "../../src/domain/happeningTiming";

export function selectLastGoodSnapshot(previous: CityEventSnapshot | undefined, candidate: CityEventSnapshot, sourceStatuses: SourceRefreshResult[]): CityEventSnapshot {
  const eligibleCandidate = candidate.happenings.filter((item) => isNightlyHappening(item));
  const valid = eligibleCandidate.length > 0 && eligibleCandidate.every((item) => item.cityId === candidate.cityId && Number.isFinite(Date.parse(item.timing.start)) && Boolean(item.source.url));
  if (valid) return { ...candidate, happenings: eligibleCandidate, retained: false, sources: sourceStatuses };
  if (previous?.happenings.length) {
    const cutoff = Date.parse(candidate.generatedAt);
    const retainedHappenings = previous.happenings.filter((item) => isNightlyHappening(item) && occurrenceEndMs(item) > cutoff);
    const retainedValid = retainedHappenings.length;
    const expired = previous.happenings.length - retainedValid;
    return {
      ...previous,
      happenings: retainedHappenings,
      retained: true,
      sources: sourceStatuses.map((source) => source.status === "fresh"
        ? { ...source, retainedCount: retainedValid, expiredCount: expired }
        : { ...source, status: "retained", lastSuccessfulRefresh: previous.generatedAt, retainedCount: retainedValid, expiredCount: expired, message: source.message ?? "Refresh did not produce a valid non-empty snapshot; retained last good data." }),
    };
  }
  return { ...candidate, retained: false, happenings: [], sources: sourceStatuses };
}
