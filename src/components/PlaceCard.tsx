import { Clock3, MapPin, ShieldAlert, UtensilsCrossed, Wine } from "lucide-react";
import { ModelessButton, SignalBadge } from "@modeless/design-system";
import type { Place, PlacePurpose } from "../domain/types";
import { formatDay, priceLabel } from "../lib/format";

const labels: Record<PlacePurpose, string> = {
  dinner: "Dinner", quick_bite: "Quick bite", drinks: "Drinks", late_drinks: "Late drinks",
};

type Props = {
  place: Place;
  candidate: boolean;
  selected: boolean;
  inPlan: boolean;
  timeZone: string;
  onSelect: () => void;
  onStage: (purpose: PlacePurpose) => void;
};

export function PlaceCard({ place, candidate, selected, inPlan, timeZone, onSelect, onStage }: Props) {
  const stageable = place.priceRange.min !== undefined && place.priceRange.max !== undefined && Object.keys(place.weeklyHours).length > 0;
  const officialSource = place.provenance.find((source) => source.url === place.officialWebsite || source.name.toLowerCase().includes("official")) ?? place.provenance[0];
  return (
    <article className={`place-card ${candidate ? "is-candidate" : ""} ${selected ? "is-selected" : ""}`} onClick={onSelect}>
      <div className="place-card__topline">
        <SignalBadge variant={place.verification.status === "verified" ? "success" : "warning"}>
          {place.verification.status.replace("_", " ")}
        </SignalBadge>
        <span>{place.kind.replace("_", " ")}</span>
      </div>
      <h3>{place.name}</h3>
      <p className="place-card__location"><MapPin aria-hidden="true" size={14} /> {place.location.neighborhood} · {place.location.address}</p>
      <p>{place.whyInteresting[0]?.claim}</p>
      <div className="place-card__facts">
        <span><Clock3 aria-hidden="true" size={13} /> {place.typicalVisitDurationMinutes} min</span>
        <span>{place.priceRange.min !== undefined && place.priceRange.max !== undefined ? `${priceLabel(place.priceRange.min, place.priceRange.currency)}–${priceLabel(place.priceRange.max, place.priceRange.currency)}` : `${place.priceRange.band} price band`} / person</span>
      </div>
      <div className="place-card__tags">
        {place.bestFor.map((purpose) => <span key={purpose}>{purpose === "dinner" || purpose === "quick_bite" ? <UtensilsCrossed size={12} /> : <Wine size={12} />}{labels[purpose]}</span>)}
      </div>
      {!stageable ? <p className="place-card__review"><ShieldAlert aria-hidden="true" size={13} /> Review hours and price before staging</p> : null}
      <div className="place-card__actions">
        {place.bestFor.slice(0, 3).map((purpose) => (
          <ModelessButton key={purpose} variant={purpose === "dinner" ? "signal" : "outline"} size="sm" disabled={!stageable} onClick={(event) => { event.stopPropagation(); onStage(purpose); }}>
            Add {labels[purpose].toLowerCase()}
          </ModelessButton>
        ))}
        {inPlan ? <span>Staged in your night</span> : null}
      </div>
      <small className="place-card__source">
        Verified {place.verification.verifiedAt ? formatDay(place.verification.verifiedAt, timeZone) : "date unknown"} · Source:{" "}
        {officialSource ? <a href={officialSource.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{officialSource.name}</a> : "unknown"}
      </small>
    </article>
  );
}
