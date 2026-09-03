import { EVENT_SOURCE_REGISTRY } from "../ingestion/registry";
import { MUNICIPAL_SOURCE_REGISTRY } from "../discovery/registry";

export type SourceOperationPolicy = {
  sourceId: string;
  minimumRefreshMinutes: number;
  requestLimitPerRun: number;
  requestLimitPerDay?: number;
  credentialEnv?: string;
  preserveLastGood: true;
  rawRetention: "none" | "cache_only";
  rawRetentionHours: number;
  attributionRequired: boolean;
  textReuse: "facts_only" | "provider_terms";
  imageReuse: "prohibited_without_explicit_license";
};

const eventPolicies = EVENT_SOURCE_REGISTRY.map((source): SourceOperationPolicy => ({
  sourceId: source.id,
  minimumRefreshMinutes: source.refreshCadenceMinutes,
  requestLimitPerRun: source.parser === "event-sitemap" ? 20 : source.parser === "billetto-public-events" ? 7 : 1,
  requestLimitPerDay: source.trustTier === "sanctioned_aggregator" ? 24 : undefined,
  credentialEnv: source.parser === "ticketmaster-discovery"
    ? "TICKETMASTER_API_KEY"
    : source.parser === "billetto-public-events"
      ? "BILLETTO_API_KEY + BILLETTO_API_SECRET"
    : source.parser === "xai-web-events"
      ? "XAI_API_KEY"
      : undefined,
  preserveLastGood: true,
  rawRetention: source.parser === "xai-web-events" ? "none" : "cache_only",
  rawRetentionHours: source.parser === "xai-web-events" ? 0 : 24,
  attributionRequired: true,
  textReuse: "facts_only",
  imageReuse: "prohibited_without_explicit_license",
}));

const municipalPolicies = MUNICIPAL_SOURCE_REGISTRY.map((source): SourceOperationPolicy => ({
  sourceId: source.id,
  minimumRefreshMinutes: source.refreshCadenceMinutes,
  requestLimitPerRun: 1,
  requestLimitPerDay: Math.max(1, Math.floor(1_440 / source.refreshCadenceMinutes)),
  preserveLastGood: true,
  rawRetention: "cache_only",
  rawRetentionHours: 24,
  attributionRequired: true,
  textReuse: "facts_only",
  imageReuse: "prohibited_without_explicit_license",
}));

export const SOURCE_OPERATION_POLICIES: readonly SourceOperationPolicy[] = [
  ...eventPolicies,
  ...municipalPolicies,
  { sourceId: "xai_web_coverage", minimumRefreshMinutes: 360, requestLimitPerRun: 1, requestLimitPerDay: 4, credentialEnv: "XAI_API_KEY", preserveLastGood: true, rawRetention: "none", rawRetentionHours: 0, attributionRequired: true, textReuse: "facts_only", imageReuse: "prohibited_without_explicit_license" },
  { sourceId: "xai_sf_social_pulse", minimumRefreshMinutes: 12, requestLimitPerRun: 1, requestLimitPerDay: 120, credentialEnv: "XAI_API_KEY", preserveLastGood: true, rawRetention: "none", rawRetentionHours: 0, attributionRequired: true, textReuse: "facts_only", imageReuse: "prohibited_without_explicit_license" },
  { sourceId: "predicthq_benchmark", minimumRefreshMinutes: 1_440, requestLimitPerRun: 1, requestLimitPerDay: 2, credentialEnv: "PREDICTHQ_API_KEY", preserveLastGood: true, rawRetention: "cache_only", rawRetentionHours: 24, attributionRequired: true, textReuse: "provider_terms", imageReuse: "prohibited_without_explicit_license" },
  { sourceId: "bandsintown_benchmark", minimumRefreshMinutes: 1_440, requestLimitPerRun: 10, requestLimitPerDay: 20, credentialEnv: "BANDSINTOWN_APP_ID", preserveLastGood: true, rawRetention: "cache_only", rawRetentionHours: 24, attributionRequired: true, textReuse: "provider_terms", imageReuse: "prohibited_without_explicit_license" },
] satisfies readonly SourceOperationPolicy[];

export type SourceRunLedger = {
  lastAttemptAt?: string;
  requestsToday: number;
  requestDay?: string;
};

export type SourceRunDecision = {
  allowed: boolean;
  reason: "due" | "refresh_interval" | "daily_quota" | "missing_credential";
  retryAt?: string;
};

export function sourceRunDecision(policy: SourceOperationPolicy, ledger: SourceRunLedger | undefined, now: Date, hasCredential = true): SourceRunDecision {
  if (policy.credentialEnv && !hasCredential) return { allowed: false, reason: "missing_credential" };
  const day = now.toISOString().slice(0, 10);
  const usedToday = ledger?.requestDay === day ? ledger.requestsToday : 0;
  if (policy.requestLimitPerDay !== undefined && usedToday + policy.requestLimitPerRun > policy.requestLimitPerDay) {
    return { allowed: false, reason: "daily_quota", retryAt: `${new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10)}T00:00:00.000Z` };
  }
  const lastAttempt = Date.parse(ledger?.lastAttemptAt ?? "");
  if (Number.isFinite(lastAttempt)) {
    const retry = lastAttempt + policy.minimumRefreshMinutes * 60_000;
    if (now.getTime() < retry) return { allowed: false, reason: "refresh_interval", retryAt: new Date(retry).toISOString() };
  }
  return { allowed: true, reason: "due" };
}

export const policyForSource = (sourceId: string) => SOURCE_OPERATION_POLICIES.find((policy) => policy.sourceId === sourceId);
