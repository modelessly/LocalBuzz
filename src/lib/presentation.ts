import type { EventInventoryState } from "../domain/types";

export const browserTitle = (cityName: string) => `Local Buzz · ${cityName}`;

export const inventoryCountLabel = (
  visibleEventCount: number,
  visiblePlaceCount: number,
  currentEventCount: number,
  totalPlaceCount: number,
) => `${visibleEventCount + visiblePlaceCount} in view · ${currentEventCount} current events · ${totalPlaceCount} places`;

export const inventorySummaryLabel = (inventory: EventInventoryState, placeCount: number) => {
  const unavailable = inventory.sources.filter((source) => source.status === "unavailable" || source.status === "invalid").length;
  const disabled = inventory.sources.filter((source) => source.status === "disabled").length;
  const suffix = [
    unavailable ? `${unavailable} event source${unavailable === 1 ? "" : "s"} unavailable` : undefined,
    disabled ? `${disabled} disabled` : undefined,
    inventory.refreshing ? "refresh in progress" : undefined,
  ].filter(Boolean).join(" · ");
  return `${inventory.currentCount} current event${inventory.currentCount === 1 ? "" : "s"} · ${placeCount} places${suffix ? ` · ${suffix}` : ""}.`;
};

export const placeCandidateSummary = (candidateCount: number, totalPlaceCount: number, origin: "human" | "agent" | undefined) =>
  `${candidateCount} ${origin === "agent" ? "agent-selected" : "selected"} candidate${candidateCount === 1 ? "" : "s"} from ${totalPlaceCount} places.`;

export const candidateReasonLead = (origin: "human" | "agent" | undefined) =>
  origin === "agent" ? "Agent surfaced" : "Showing";
