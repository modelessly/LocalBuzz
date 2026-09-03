import type { CityId, Happening, HappeningCategory, Place } from "../../src/domain/types";
import type { CoverageCell, CoverageLeadTime, CoveragePriceBand, CoverageReport, CoverageStrength, CoverageTimeWindow, CorridorGap } from "./types";

export const COVERAGE_CATEGORIES: readonly HappeningCategory[] = ["live_music", "club", "comedy", "food_drink", "culture", "film", "talk", "market", "activity", "other"];
export const COVERAGE_TIME_WINDOWS: readonly CoverageTimeWindow[] = ["early_evening", "prime_evening", "late_night"];
export const COVERAGE_PRICE_BANDS: readonly CoveragePriceBand[] = ["free", "inexpensive", "moderate", "premium", "unknown"];
export const COVERAGE_LEAD_TIMES: readonly CoverageLeadTime[] = ["same_day", "next_3_days", "next_7_days", "later"];
export const COVERAGE_NEIGHBORHOODS: Record<CityId, readonly string[]> = {
  stockholm: ["Gamla stan", "Hornstull", "Norrmalm", "Slussen", "Södermalm", "Vasastan", "Östermalm"],
  "san-francisco": ["Civic Center", "Golden Gate Park", "Haight-Ashbury", "Lower Haight", "Mission", "North Beach", "SoMa"],
};

const HORIZON_DAYS = 30;
const STALE_DAYS = 14;
const WEAK_THRESHOLD = 2;
const CORRIDOR_RADIUS_KM = 3.5;

const normalize = (value?: string) => value?.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";
const strengthFor = (count: number): CoverageStrength => count === 0 ? "empty" : count < WEAK_THRESHOLD ? "weak" : "covered";
const corridorStrengthFor = (count: number): CoverageStrength => count === 0 ? "empty" : count < 3 ? "weak" : "covered";
const cellId = (parts: Array<string>) => parts.map((part) => normalize(part).replaceAll(" ", "-")).join("--");

function localHour(iso: string): number {
  const match = iso.match(/T(\d{2}):/);
  return match ? Number(match[1]) : new Date(iso).getUTCHours();
}

function timeWindowFor(iso: string): CoverageTimeWindow | undefined {
  const hour = localHour(iso);
  if (hour >= 16 && hour < 19) return "early_evening";
  if (hour >= 19 && hour < 22) return "prime_evening";
  if (hour >= 22 || hour < 2) return "late_night";
  return undefined;
}

function priceBandFor(event: Happening): CoveragePriceBand {
  if (event.commerce.priceMin === undefined) return "unknown";
  if (event.commerce.priceMin === 0) return "free";
  const inexpensive = event.commerce.currency === "SEK" ? 250 : 25;
  const moderate = event.commerce.currency === "SEK" ? 500 : 50;
  if (event.commerce.priceMin <= inexpensive) return "inexpensive";
  if (event.commerce.priceMin <= moderate) return "moderate";
  return "premium";
}

function leadTimeFor(start: string, now: Date): CoverageLeadTime {
  const hours = (Date.parse(start) - now.getTime()) / 3_600_000;
  if (hours < 24) return "same_day";
  if (hours < 72) return "next_3_days";
  if (hours < 168) return "next_7_days";
  return "later";
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radians = (value: number) => value * Math.PI / 180;
  const lat = radians(b.lat - a.lat);
  const lng = radians(b.lng - a.lng);
  const value = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lng / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

const operationalPlace = (place: Place) => place.priceRange.min !== undefined && place.openingHoursEvidence.status === "verified" && Object.keys(place.weeklyHours).length > 0;

function corridorGaps(cityId: CityId, events: Happening[], places: Place[]): CorridorGap[] {
  return COVERAGE_NEIGHBORHOODS[cityId].map((neighborhood) => {
    const localEvents = events.filter((event) => normalize(event.venue.neighborhood) === normalize(neighborhood));
    const anchors = localEvents.map((event) => event.venue);
    const matched = places.filter((place) => operationalPlace(place) && (normalize(place.location.neighborhood) === normalize(neighborhood) || anchors.some((anchor) => haversineKm(anchor, place.location) <= CORRIDOR_RADIUS_KM)));
    return { cityId, neighborhood, eventCount: localEvents.length, operationalPlaceCount: matched.length, placeIds: matched.map((place) => place.id).sort(), strength: corridorStrengthFor(matched.length), radiusKm: CORRIDOR_RADIUS_KM };
  }).filter((gap) => gap.eventCount > 0 && gap.strength !== "covered");
}

export function buildCoverageReport(input: { happenings: Happening[]; places: Place[]; now?: Date }): CoverageReport {
  const now = input.now ?? new Date();
  const horizon = now.getTime() + HORIZON_DAYS * 86_400_000;
  const future = input.happenings.filter((event) => {
    const start = Date.parse(event.timing.start);
    const end = Date.parse(event.timing.end ?? event.timing.start);
    return Number.isFinite(start) && end > now.getTime() && start <= horizon && !["cancelled", "sold_out"].includes(event.status.availability);
  });
  const cells: CoverageCell[] = [];
  for (const cityId of ["stockholm", "san-francisco"] as const) for (const neighborhood of COVERAGE_NEIGHBORHOODS[cityId]) for (const category of COVERAGE_CATEGORIES) for (const timeWindow of COVERAGE_TIME_WINDOWS) for (const priceBand of COVERAGE_PRICE_BANDS) for (const leadTime of COVERAGE_LEAD_TIMES) {
    const matched = future.filter((event) => event.cityId === cityId && normalize(event.venue.neighborhood) === normalize(neighborhood) && event.category === category && timeWindowFor(event.timing.start) === timeWindow && priceBandFor(event) === priceBand && leadTimeFor(event.timing.start, now) === leadTime);
    cells.push({ cityId, neighborhood, category, timeWindow, priceBand, leadTime, id: cellId([cityId, neighborhood, category, timeWindow, priceBand, leadTime]), eventCount: matched.length, strength: strengthFor(matched.length), eventIds: matched.map((event) => event.id).sort() });
  }

  const categoryCounts = new Map<string, number>();
  for (const event of future) categoryCounts.set(`${event.cityId}:${event.category}`, (categoryCounts.get(`${event.cityId}:${event.category}`) ?? 0) + 1);
  const overrepresentedCategories = (["stockholm", "san-francisco"] as const).flatMap((cityId) => {
    const counts = COVERAGE_CATEGORIES.map((category) => ({ cityId, category, count: categoryCounts.get(`${cityId}:${category}`) ?? 0 }));
    const average = counts.reduce((sum, item) => sum + item.count, 0) / counts.length;
    return counts.filter((item) => item.count >= 3 && item.count > average * 1.5);
  });
  const neighborhoodGaps = (["stockholm", "san-francisco"] as const).flatMap((cityId) => COVERAGE_NEIGHBORHOODS[cityId].map((neighborhood) => ({ cityId, neighborhood, eventCount: future.filter((event) => event.cityId === cityId && normalize(event.venue.neighborhood) === normalize(neighborhood)).length })).filter((item) => item.eventCount === 0));
  const staleCutoff = now.getTime() - STALE_DAYS * 86_400_000;
  const staleInventory = input.happenings.filter((event) => {
    const verified = event.source.lastVerifiedAt ?? event.source.fetchedAt;
    return !verified || !Number.isFinite(Date.parse(verified)) || Date.parse(verified) < staleCutoff;
  }).map((event) => ({ id: event.id, title: event.title, lastVerifiedAt: event.source.lastVerifiedAt ?? event.source.fetchedAt })).sort((a, b) => a.id.localeCompare(b.id));
  const weakCells = cells.filter((cell) => cell.strength === "weak");
  const emptyCells = cells.filter((cell) => cell.strength === "empty");
  const gapIds = (predicate: (cell: CoverageCell) => boolean) => cells.filter((cell) => cell.strength !== "covered" && predicate(cell)).map((cell) => cell.id);
  const corridors = (["stockholm", "san-francisco"] as const).flatMap((cityId) => corridorGaps(cityId, future.filter((event) => event.cityId === cityId), input.places.filter((place) => place.cityId === cityId)));
  return {
    generatedAt: now.toISOString(), asOf: now.toISOString(), horizonDays: HORIZON_DAYS, weakThreshold: WEAK_THRESHOLD, cells,
    summary: { totalFutureEvents: future.length, emptyCells: emptyCells.length, weakCells: weakCells.length, coveredCells: cells.length - emptyCells.length - weakCells.length, staleInventory, overrepresentedCategories, neighborhoodGaps, lateNightGaps: gapIds((cell) => cell.timeWindow === "late_night"), inexpensiveGaps: gapIds((cell) => cell.priceBand === "free" || cell.priceBand === "inexpensive"), corridorGaps: corridors },
  };
}

export function formatCoverageReport(report: CoverageReport): string {
  const priority = report.cells.filter((cell) => cell.strength !== "covered").sort((a, b) => Number(b.strength === "empty") - Number(a.strength === "empty") || a.id.localeCompare(b.id)).slice(0, 8);
  const lines = [
    `Local Buzz coverage as of ${report.asOf}`,
    `${report.summary.totalFutureEvents} future events · ${report.summary.coveredCells} covered cells · ${report.summary.weakCells} weak · ${report.summary.emptyCells} empty`,
    `${report.summary.staleInventory.length} stale records · ${report.summary.corridorGaps.length} place-to-event corridor gaps`,
    "Priority gaps:",
    ...priority.map((cell) => `- ${cell.cityId} / ${cell.neighborhood} / ${cell.category} / ${cell.timeWindow} / ${cell.priceBand} / ${cell.leadTime}: ${cell.strength}`),
  ];
  return lines.join("\n");
}
