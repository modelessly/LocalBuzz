import { describe, expect, it } from "vitest";
import { EVENT_SOURCE_REGISTRY } from "../ingestion/registry";
import { MUNICIPAL_SOURCE_REGISTRY } from "../discovery/registry";
import { SOURCE_OPERATION_POLICIES, policyForSource, sourceRunDecision } from "./policy";

describe("source operational policy", () => {
  it("covers every configured event and municipal source with retention and licensing rules", () => {
    const configured = [...EVENT_SOURCE_REGISTRY, ...MUNICIPAL_SOURCE_REGISTRY].map((source) => source.id);
    expect(configured.every((id) => policyForSource(id))).toBe(true);
    expect(SOURCE_OPERATION_POLICIES.every((policy) => policy.preserveLastGood && policy.attributionRequired && policy.imageReuse === "prohibited_without_explicit_license")).toBe(true);
  });

  it("enforces credentials, refresh intervals and daily quotas deterministically", () => {
    const policy = policyForSource("predicthq_benchmark")!;
    const now = new Date("2026-09-02T12:00:00Z");
    expect(sourceRunDecision(policy, undefined, now, false).reason).toBe("missing_credential");
    expect(sourceRunDecision(policy, { lastAttemptAt: "2026-09-02T11:00:00Z", requestsToday: 1, requestDay: "2026-09-02" }, now, true).reason).toBe("refresh_interval");
    expect(sourceRunDecision(policy, { lastAttemptAt: "2026-08-31T11:00:00Z", requestsToday: 2, requestDay: "2026-09-02" }, now, true).reason).toBe("daily_quota");
    expect(sourceRunDecision(policy, { lastAttemptAt: "2026-08-31T11:00:00Z", requestsToday: 0, requestDay: "2026-09-02" }, now, true)).toMatchObject({ allowed: true, reason: "due" });
  });
});
