import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { browserTitle, candidateReasonLead, placeCandidateSummary } from "./presentation";

describe("shared-state presentation copy", () => {
  it("uses the active city in the browser title", () => {
    expect(browserTitle("San Francisco")).toBe("Local Buzz · San Francisco");
  });

  it("describes highlighted place candidates without inventory pipeline counts", () => {
    expect(placeCandidateSummary(2, "agent")).toBe("2 agent-selected options.");
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
    expect(interfaceSource).not.toMatch(/shared state|agent acquisition|discovery review|awaiting review|accepted canonical|provisional|discovery only|canonical fields are ready for review|evidence references/i);
  });

  it("keeps the top panels independent and preserves the exact footer", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    const styles = readFileSync("src/styles.css", "utf8");
    expect(app).toContain('title={city.name}');
    expect(app).not.toContain("in reach");
    expect(app).toContain("Local Buzz | 2026");
    expect(styles).toMatch(/\.workspace\s*\{[^}]*gap:\s*24px[^}]*background:\s*transparent/s);
    expect(styles).toMatch(/\.map-panel, \.night-panel\s*\{[^}]*overflow:\s*hidden[^}]*contain:\s*paint/s);
    expect(styles).not.toMatch(/\.workspace::(?:before|after)/);
    expect(styles.match(/\.topbar\s*\{([^}]*)\}/)?.[1]).not.toMatch(/border-bottom/);
  });

  it("keeps consumer empty states resettable and prevents tablet header overflow", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    const styles = readFileSync("src/styles.css", "utf8");
    expect(app).toMatch(/No matching events.*Clear search/s);
    expect(app).toMatch(/Source updates may be incomplete/);
    expect(app).toMatch(/No matching places.*Clear filters/s);
    expect(styles).toMatch(/@media \(max-width: 1050px\)[\s\S]*\.topbar\s*\{[^}]*minmax\(0, 1fr\)[^}]*\}[\s\S]*\.header-controls\s*\{[^}]*flex-wrap:\s*wrap/s);
  });
});
