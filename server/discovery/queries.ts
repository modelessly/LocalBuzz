import type { CoverageCell, CoverageReport, CoverageSearchTarget } from "./types";

const vocabulary = {
  stockholm: {
    live_music: ["livemusik", "jam", "scen"], club: ["klubb", "after work"], comedy: ["quiz", "scen"], culture: ["vernissage", "scen"], market: ["loppis"], other: ["gratis ikväll"],
  },
  "san-francisco": {
    live_music: ["live music tonight", "open mic"], club: ["drag", "late night"], comedy: ["open mic", "comedy tonight"], culture: ["reading", "art walk"], market: ["night market", "maker"], other: ["pop-up", "free tonight"],
  },
} as const;

const cityName = (id: CoverageCell["cityId"]) => id === "stockholm" ? "Stockholm" : "San Francisco";
const timePhrase = { early_evening: "between 4pm and 7pm", prime_evening: "between 7pm and 10pm", late_night: "after 10pm" } as const;
const pricePhrase = { free: "free", inexpensive: "inexpensive", moderate: "mid-priced", premium: "premium", unknown: "any price with price evidence" } as const;
const leadPhrase = { same_day: "today", next_3_days: "in the next three days", next_7_days: "this week", later: "in the next 30 days" } as const;

function termFor(cell: CoverageCell): string {
  const cityTerms = vocabulary[cell.cityId] as Partial<Record<CoverageCell["category"], readonly string[]>>;
  const terms = cityTerms[cell.category] ?? (cell.cityId === "stockholm" ? ["gratis ikväll"] : ["free tonight"]);
  let hash = 0;
  for (const character of cell.id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return terms[hash % terms.length];
}

function score(cell: CoverageCell): number {
  return (cell.strength === "empty" ? 100 : 60) + (cell.timeWindow === "late_night" ? 20 : 0) + (["free", "inexpensive"].includes(cell.priceBand) ? 15 : 0) + (cell.leadTime === "same_day" ? 10 : 0);
}

export function targetedQueriesFromCoverage(report: CoverageReport, limit = 12): CoverageSearchTarget[] {
  return report.cells
    .filter((cell) => cell.strength !== "covered")
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit))
    .map((cell) => ({
      id: `gap-${cell.id}`,
      cell: { cityId: cell.cityId, neighborhood: cell.neighborhood, category: cell.category, timeWindow: cell.timeWindow, priceBand: cell.priceBand, leadTime: cell.leadTime },
      query: `${termFor(cell)} ${cell.category.replaceAll("_", " ")} in ${cell.neighborhood}, ${cityName(cell.cityId)}, ${timePhrase[cell.timeWindow]}, ${leadPhrase[cell.leadTime]}, ${pricePhrase[cell.priceBand]}; require a public event date, physical location, price evidence when claimed, and direct official source URL`,
      maxResults: 10,
    }));
}
