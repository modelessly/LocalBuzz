import type { Happening } from "../../src/domain/types";
import type { BenchmarkEvent, BenchmarkMetrics } from "./types";

const normalize = (value?: string) => value?.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim() ?? "";
const key = (title: string, venue: string | undefined, start: string) => `${normalize(title)}|${normalize(venue)}|${Math.round(Date.parse(start) / (30 * 60_000))}`;

export function compareBenchmark(records: BenchmarkEvent[], happenings: Happening[], rejectedCount: number, queryCount: number): BenchmarkMetrics {
  const canonicalKeys = new Set(happenings.map((item) => key(item.title, item.venue.name, item.timing.start)));
  const overlap = records.filter((record) => canonicalKeys.has(key(record.title, record.venue?.name, record.start)));
  const missing = records.filter((record) => !canonicalKeys.has(key(record.title, record.venue?.name, record.start)));
  const categories = new Map<string, number>();
  for (const record of missing) categories.set(record.category ?? "unknown", (categories.get(record.category ?? "unknown") ?? 0) + 1);
  return {
    canonicalCount: happenings.length,
    providerCount: records.length,
    overlapCount: overlap.length,
    credibleMissingCount: missing.length,
    rejectedCount,
    queryCount,
    incrementalYieldPerQuery: queryCount ? Number((missing.length / queryCount).toFixed(2)) : 0,
    weakCategories: [...categories].map(([category, providerOnlyCount]) => ({ category, providerOnlyCount })).sort((a, b) => b.providerOnlyCount - a.providerOnlyCount || a.category.localeCompare(b.category)),
    weakNeighborhoods: [],
    commercialAssessment: !records.length ? "not_measurable" : missing.length ? "incremental_value_requires_cost_review" : "no_incremental_value",
  };
}
