import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { browserTitle, candidateReasonLead, inventoryCountLabel, placeCandidateSummary } from "./presentation";

describe("shared-state presentation copy", () => {
  it("uses the active city in the browser title", () => {
    expect(browserTitle("San Francisco")).toBe("Local Buzz · San Francisco");
  });

  it("distinguishes records in view from the full current inventory", () => {
    expect(inventoryCountLabel(0, 2, 0, 33)).toBe("2 in view · 0 current events · 33 places");
    expect(placeCandidateSummary(2, 33, "agent")).toBe("2 agent-selected candidates from 33 places.");
  });

  it("does not attribute a human search to an agent", () => {
    expect(candidateReasonLead("human")).toBe("Showing");
    expect(candidateReasonLead("agent")).toBe("Agent surfaced");
  });

  it("keeps mission and qualification-status copy out of the human interface", () => {
    const files = [
      "src/App.tsx",
      "src/components/PlaceCard.tsx",
      "src/components/HappeningCard.tsx",
      "src/components/EveningTimeline.tsx",
      "src/components/CityMap.tsx",
      "src/components/DiscoveryReview.tsx",
    ];
    const interfaceSource = files.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(interfaceSource).not.toMatch(/MISSION 01|mission-strip|city\.mission/i);
    expect(interfaceSource).not.toMatch(/needs[ _-]review|unverified|source verified/i);
    expect(interfaceSource).not.toMatch(/hours and prices? unavailable for planning/i);
  });
});
