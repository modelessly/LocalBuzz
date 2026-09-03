import { Clock3, MapPin, UtensilsCrossed, Wine } from "lucide-react";
import { ModelessButton } from "@modeless/design-system";
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
  onAdd: (purpose: PlacePurpose) => void;
};

export function PlaceCard({ place, candidate, selected, inPlan, timeZone, onSelect, onAdd }: Props) {
  const addable = place.priceRange.min !== undefined && place.priceRange.max !== undefined && Object.keys(place.weeklyHours).length > 0;
  const officialSource = place.provenance.find((source) => source.url === place.officialWebsite || source.name.toLowerCase().includes("official")) ?? place.provenance[0];
  return (
    <article className={`place-card ${candidate ? "is-candidate" : ""} ${selected ? "is-selected" : ""}`} onClick={onSelect}>
      <div className="place-card__topline">
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
      <div className="place-card__actions">
        {place.bestFor.slice(0, 3).map((purpose) => (
          <ModelessButton key={purpose} variant={purpose === "dinner" ? "signal" : "outline"} size="sm" disabled={!addable} onClick={(event) => { event.stopPropagation(); onAdd(purpose); }}>
            Add {labels[purpose].toLowerCase()}
          </ModelessButton>
        ))}
        {inPlan ? <span>In your night</span> : null}
      </div>
      <small className="place-card__source">
        Source checked {place.verification.verifiedAt ? formatDay(place.verification.verifiedAt, timeZone) : "date unavailable"} · {" "}
        {officialSource ? <a href={officialSource.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{officialSource.name}</a> : "unknown"}
      </small>
    </article>
  );
}
