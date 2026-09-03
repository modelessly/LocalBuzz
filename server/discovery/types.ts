import type { CityId, DiscoveryLead, HappeningCategory } from "../../src/domain/types";

export type CoverageTimeWindow = "early_evening" | "prime_evening" | "late_night";
export type CoveragePriceBand = "free" | "inexpensive" | "moderate" | "premium" | "unknown";
export type CoverageLeadTime = "same_day" | "next_3_days" | "next_7_days" | "later";
export type CoverageStrength = "empty" | "weak" | "covered";

export type CoverageCellDimensions = {
  cityId: CityId;
  neighborhood: string;
  category: HappeningCategory;
  timeWindow: CoverageTimeWindow;
  priceBand: CoveragePriceBand;
  leadTime: CoverageLeadTime;
};

export type CoverageCell = CoverageCellDimensions & {
  id: string;
  eventCount: number;
  strength: CoverageStrength;
  eventIds: string[];
};

export type CorridorGap = {
  cityId: CityId;
  neighborhood: string;
  eventCount: number;
  operationalPlaceCount: number;
  placeIds: string[];
  strength: CoverageStrength;
  radiusKm: number;
};

export type CoverageReport = {
  generatedAt: string;
  asOf: string;
  horizonDays: number;
  weakThreshold: number;
  cells: CoverageCell[];
  summary: {
    totalFutureEvents: number;
    emptyCells: number;
    weakCells: number;
    coveredCells: number;
    staleInventory: Array<{ id: string; title: string; lastVerifiedAt?: string }>;
    overrepresentedCategories: Array<{ cityId: CityId; category: HappeningCategory; count: number }>;
    neighborhoodGaps: Array<{ cityId: CityId; neighborhood: string; eventCount: number }>;
    lateNightGaps: string[];
    inexpensiveGaps: string[];
    corridorGaps: CorridorGap[];
  };
};

export type CoverageSearchTarget = {
  id: string;
  cell: CoverageCellDimensions;
  query: string;
  maxResults: number;
};

export type MunicipalSourceDefinition = {
  id: string;
  cityId: CityId;
  publisher: string;
  canonicalUrl: string;
  fetchUrl?: string;
  refreshCadenceMinutes: number;
  enabled: boolean;
  status: "approved" | "credential_required" | "disabled";
  reason?: string;
};

export type MunicipalRadarRecord = {
  id: string;
  cityId: CityId;
  sourceId: string;
  officialIdentifier: string;
  eventHint?: string;
  location?: { description: string; lat?: number; lng?: number };
  relevantDates: { startsAt?: string; endsAt?: string; submittedAt?: string; expiresAt?: string };
  permitStatus: string;
  officialSourceUrl: string;
  suggestedSearchQuery: string;
  fetchedAt: string;
  corroborationStatus: "required";
};

export type MunicipalRadarSnapshot = {
  cityId: CityId;
  generatedAt: string;
  retained: boolean;
  records: MunicipalRadarRecord[];
  sources: Array<{
    sourceId: string;
    status: "fresh" | "retained" | "unavailable" | "disabled" | "invalid";
    recordCount: number;
    message?: string;
  }>;
};

export type TargetedDiscoverySnapshot = {
  cityId: CityId;
  generatedAt: string;
  retained: boolean;
  target: CoverageSearchTarget;
  leads: DiscoveryLead[];
  status: "fresh" | "cached" | "retained" | "empty" | "unavailable" | "invalid";
  message?: string;
};
