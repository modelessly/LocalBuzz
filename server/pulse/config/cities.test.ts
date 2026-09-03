import { describe, expect, it } from "vitest";
import { getCityPulseConfig, resolveTrustedHandles } from "./cities";

describe("city pulse configuration", () => {
  it.each(["stockholm", "san-francisco"] as const)("defines bounded search and geocoding context for %s", (cityId) => {
    const city = getCityPulseConfig(cityId);
    expect(city.timeZone).toBeTruthy();
    expect(city.neighborhoods.length).toBeGreaterThan(3);
    expect(city.geocodingHints.length).toBeGreaterThan(0);
    expect(resolveTrustedHandles(cityId).length).toBeLessThanOrEqual(20);
  });

  it("deduplicates accounts across trusted groups", () => {
    const handles = resolveTrustedHandles("stockholm");
    expect(handles.filter((handle) => handle === "debasersthlm")).toHaveLength(1);
  });
});
