import type { CityId, Happening, HappeningCategory } from "../../src/domain/types";

export type BenchmarkProviderId = "predicthq" | "bandsintown" | "songkick";
export type BenchmarkStatus = "fresh" | "cached" | "retained" | "unavailable" | "disabled" | "invalid";

export type BenchmarkEvent = {
  provider: Exclude<BenchmarkProviderId, "songkick">;
  providerId: string;
  cityId: CityId;
  title: string;
  start: string;
  end?: string;
  category?: HappeningCategory;
  venue?: { name?: string; lat?: number; lng?: number };
  performer?: { name: string; stableId?: string };
  canonicalUrl?: string;
  fetchedAt: string;
};

export type BenchmarkMetrics = {
  canonicalCount: number;
  providerCount: number;
  overlapCount: number;
  credibleMissingCount: number;
  rejectedCount: number;
  queryCount: number;
  incrementalYieldPerQuery: number;
  weakCategories: Array<{ category: string; providerOnlyCount: number }>;
  weakNeighborhoods: string[];
  commercialAssessment: "no_incremental_value" | "incremental_value_requires_cost_review" | "not_measurable";
};

export type BenchmarkSnapshot = {
  provider: BenchmarkProviderId;
  cityId: CityId;
  generatedAt: string;
  retained: boolean;
  status: BenchmarkStatus;
  records: BenchmarkEvent[];
  metrics: BenchmarkMetrics;
  message?: string;
  termsStatus: "approved" | "approval_required" | "licensed_access_required";
  benchmarkOnly: true;
};

export type BenchmarkCollection = {
  records: BenchmarkEvent[];
  rejected: string[];
  queryCount: number;
  message?: string;
};

export type BenchmarkContext = {
  cityId: CityId;
  happenings: Happening[];
  now: Date;
};
