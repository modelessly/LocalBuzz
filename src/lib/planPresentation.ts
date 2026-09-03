import type { EveningPlan, Happening, Place, PlanStop } from "../domain/types";
import { priceLabel } from "./format";

const stopPricePerPerson = (stop: PlanStop, happenings: Happening[], places: Place[]) => {
  if (stop.kind === "happening") {
    return happenings.find((item) => item.id === stop.happeningId)?.commerce.priceMin;
  }
  if (stop.kind === "place") {
    return places.find((item) => item.id === stop.placeId)?.priceRange.min;
  }
  return stop.customPlace.pricePerPerson;
};

export function planPriceSummary(plan: EveningPlan, happenings: Happening[], places: Place[]) {
  const prices = plan.stops.map((stop) => stopPricePerPerson(stop, happenings, places));
  const hasUnknownPrice = prices.some((price) => price === undefined);
  const knownTotal = prices.reduce<number>((sum, price) => sum + (price ?? 0) * plan.constraints.partySize, 0);

  if (!hasUnknownPrice) {
    const label = priceLabel(plan.totalEstimatedCost, plan.constraints.currency);
    return { label, accessibleLabel: `Estimated price ${label}.`, partial: false };
  }
  if (knownTotal === 0) {
    return {
      label: "Price unavailable",
      accessibleLabel: "Estimated price unavailable because one or more stops have no confirmed price.",
      partial: true,
    };
  }
  const knownLabel = priceLabel(knownTotal, plan.constraints.currency);
  return {
    label: `${knownLabel} · partial`,
    accessibleLabel: `Known estimated price ${knownLabel}. The total is partial because one or more stops have no confirmed price.`,
    partial: true,
  };
}
