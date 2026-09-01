import type { CityEventSnapshot, SourceRefreshResult } from "./types";

export function selectLastGoodSnapshot(previous: CityEventSnapshot | undefined, candidate: CityEventSnapshot, sourceStatuses: SourceRefreshResult[]): CityEventSnapshot {
  const valid = candidate.happenings.length > 0 && candidate.happenings.every((item) => item.cityId === candidate.cityId && Number.isFinite(Date.parse(item.timing.start)) && Boolean(item.source.url));
  if (valid) return { ...candidate, retained: false, sources: sourceStatuses };
  if (previous?.happenings.length) {
    return {
      ...previous,
      retained: true,
      sources: sourceStatuses.map((source) => source.status === "fresh" ? source : { ...source, status: "retained", lastSuccessfulRefresh: previous.generatedAt, message: source.message ?? "Refresh did not produce a valid non-empty snapshot; retained last good data." }),
    };
  }
  return { ...candidate, retained: false, happenings: [], sources: sourceStatuses };
}
