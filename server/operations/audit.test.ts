import { describe, expect, it } from "vitest";
import { formatDataQualityAudit, runDataQualityAudit } from "./audit";

describe("final data-quality audit", () => {
  it("passes the checked-in canonical catalogs and reports their honest boundaries", () => {
    const audit = runDataQualityAudit({ now: new Date("2026-09-02T00:00:00Z") });
    expect(audit.passed).toBe(true);
    expect(audit.summary).toMatchObject({ placesByCity: { stockholm: 33, "san-francisco": 33 }, operationalCorridorsPassing: 7, operationalCorridorsTotal: 7 });
    expect(audit.findings.some((finding) => finding.code === "INVENTORY_BOUNDARIES")).toBe(true);
    expect(formatDataQualityAudit(audit)).toContain("PASS");
  });
});
