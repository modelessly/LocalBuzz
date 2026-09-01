import { ArrowUpRight, Clock3, MapPin, Plus, RefreshCw, X } from "lucide-react";
import { ModelessButton, SignalBadge } from "@modeless/design-system";
import type { Happening } from "../domain/types";
import { categoryLabel, formatDay, formatTime, priceLabel } from "../lib/format";

type HappeningCardProps = {
  happening: Happening;
  timeZone: string;
  candidate: boolean;
  selected: boolean;
  inPlan: boolean;
  canSwap: boolean;
  onSelect: () => void;
  onSwap: () => void;
  onReject: () => void;
  onStage: () => void;
};

export function HappeningCard({
  happening,
  timeZone,
  candidate,
  selected,
  inPlan,
  canSwap,
  onSelect,
  onSwap,
  onReject,
  onStage,
}: HappeningCardProps) {
  const unavailable = ["sold_out", "cancelled"].includes(happening.status.availability);
  return (
    <article
      className={`happening-card ${candidate ? "is-candidate" : ""} ${selected ? "is-selected" : ""} ${inPlan ? "is-in-plan" : ""} ${unavailable ? "is-unavailable" : ""}`}
      onClick={onSelect}
    >
      <div className="happening-card__topline">
        <span>{categoryLabel(happening.category)}</span>
        {unavailable ? (
          <SignalBadge variant="error">unavailable</SignalBadge>
        ) : inPlan ? (
          <SignalBadge variant="live">in your night</SignalBadge>
        ) : candidate ? (
          <SignalBadge variant="stable">candidate</SignalBadge>
        ) : null}
      </div>
      <h3>{happening.title}</h3>
      <p className="happening-card__description">{happening.description}</p>
      <dl className="happening-card__meta">
        <div><Clock3 aria-hidden="true" size={14} /><span>{formatTime(happening.timing.start, timeZone)} · {priceLabel(happening.commerce.priceMin, happening.commerce.currency)}</span></div>
        <div><MapPin aria-hidden="true" size={14} /><span>{happening.venue.name} · {happening.venue.neighborhood}</span></div>
      </dl>
      <div className="tag-row">
        {happening.enrichment?.moodTags?.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <div className="happening-card__source">
        <span>{happening.source.lastVerifiedAt
          ? `Source verified ${formatDay(happening.source.lastVerifiedAt, timeZone)}`
          : "Source verification date unavailable"}</span>
        <a href={happening.source.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          {happening.source.name} <ArrowUpRight aria-hidden="true" size={12} />
        </a>
      </div>
      {candidate && !unavailable ? (
        <div className="happening-card__actions" onClick={(event) => event.stopPropagation()}>
          <ModelessButton variant="outline" size="sm" onClick={onReject} aria-label={`Reject ${happening.title}`}>
            <X aria-hidden="true" size={14} /> Not this
          </ModelessButton>
          <ModelessButton variant="signal" size="sm" onClick={onSwap} disabled={!canSwap || inPlan}>
            <RefreshCw aria-hidden="true" size={14} /> {inPlan ? "Planned" : "Swap in"}
          </ModelessButton>
        </div>
      ) : null}
      {!candidate && !unavailable && !inPlan ? (
        <div className="happening-card__actions" onClick={(event) => event.stopPropagation()}>
          <ModelessButton variant="signal" size="sm" onClick={onStage}><Plus aria-hidden="true" size={14} /> Add event</ModelessButton>
        </div>
      ) : null}
    </article>
  );
}
