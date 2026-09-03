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
  onAdd: () => void;
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
  onAdd,
}: HappeningCardProps) {
  const unavailable = ["sold_out", "cancelled"].includes(happening.status.availability);
  const pulse = happening.socialPulse;
  const planningReady = happening.commerce.priceMin !== undefined && happening.kind !== "city_condition" && happening.kind !== "community_report";
  return (
    <article
      className={`happening-card ${candidate ? "is-candidate" : ""} ${selected ? "is-selected" : ""} ${inPlan ? "is-in-plan" : ""} ${unavailable ? "is-unavailable" : ""}`}
      onClick={onSelect}
    >
      <div className="happening-card__topline">
        <span>{happening.kind && happening.kind !== "scheduled_event" ? categoryLabel(happening.kind) : categoryLabel(happening.category)}</span>
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
      {pulse ? (
        <div className="happening-card__pulse" aria-label={`Buzz Score ${pulse.buzzScore} out of 100, ${pulse.buzzLabel}`}>
          <div><strong>{pulse.buzzLabel}</strong><span>Buzz Score {pulse.buzzScore}</span></div>
          <p>{pulse.reasonActionable}</p>
          <small>{pulse.independentSourceCount} independent source{pulse.independentSourceCount === 1 ? "" : "s"} · {pulse.freshnessMinutes} min old · confidence {Math.round(pulse.confidence * 100)}%</small>
          <div className="happening-card__evidence">
            {pulse.sourceUrls.slice(0, 3).map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Evidence {index + 1}<ArrowUpRight aria-hidden="true" size={11} /></a>)}
          </div>
          <details className="happening-card__score" onClick={(event) => event.stopPropagation()}>
            <summary>Why this score</summary>
            <p>{Object.entries(pulse.buzzBreakdown).map(([key, value]) => `${categoryLabel(key)} ${value}`).join(" · ")}</p>
          </details>
        </div>
      ) : null}
      {pulse && !planningReady ? <p className="happening-card__pulse-note">Live evidence for discovery; itinerary use needs a confirmed price.</p> : null}
      <dl className="happening-card__meta">
        <div><Clock3 aria-hidden="true" size={14} /><span>{formatTime(happening.timing.start, timeZone)} · {priceLabel(happening.commerce.priceMin, happening.commerce.currency)}</span></div>
        <div><MapPin aria-hidden="true" size={14} /><span>{happening.venue.name} · {happening.venue.neighborhood}</span></div>
      </dl>
      <div className="tag-row">
        {happening.enrichment?.moodTags?.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <div className="happening-card__source">
        <span>{happening.source.lastVerifiedAt
          ? `Source checked ${formatDay(happening.source.lastVerifiedAt, timeZone)}`
          : "Source date unavailable"}</span>
        <a href={happening.source.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          {happening.source.name} <ArrowUpRight aria-hidden="true" size={12} />
        </a>
      </div>
      {candidate && !unavailable ? (
        <div className="happening-card__actions" onClick={(event) => event.stopPropagation()}>
          <ModelessButton variant="outline" size="sm" onClick={onReject} aria-label={`Reject ${happening.title}`}>
            <X aria-hidden="true" size={14} /> Not this
          </ModelessButton>
          {!inPlan && planningReady ? <ModelessButton variant="signal" size="sm" onClick={onAdd}><Plus aria-hidden="true" size={14} /> Add event</ModelessButton> : null}
          {canSwap && !inPlan && planningReady ? <ModelessButton variant="outline" size="sm" onClick={onSwap}>
            <RefreshCw aria-hidden="true" size={14} /> Swap in
          </ModelessButton> : null}
        </div>
      ) : null}
      {!candidate && !unavailable && !inPlan && planningReady ? (
        <div className="happening-card__actions" onClick={(event) => event.stopPropagation()}>
          <ModelessButton variant="signal" size="sm" onClick={onAdd}><Plus aria-hidden="true" size={14} /> Add event</ModelessButton>
        </div>
      ) : null}
    </article>
  );
}
