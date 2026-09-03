import { ArrowUpRight, Lock, Sparkles, Unlock, X } from "lucide-react";
import { ModelessButton } from "@modeless/design-system";
import type { EveningPlan, Happening, LocalBuzzState, Place, PlanStop } from "../domain/types";
import type { AgentActivity } from "../webmcp/activity";
import { formatDateTimeRange, formatDateTimeRangeAccessible, formatTimeRange, priceLabel } from "../lib/format";
import { planPriceSummary } from "../lib/planPresentation";
import { timelineStopLink } from "../lib/timelineLinks";

type EveningTimelineProps = {
  currentPlan: EveningPlan | null;
  happenings: Happening[];
  places: Place[];
  onCopyAgentPrompt: () => void;
  webMcpStatus: LocalBuzzState["webMcp"];
  onLock: (id: string) => void;
  onUnlock: (id: string) => void;
  onRemove: (id: string) => void;
  timeZone: string;
  agentActivity: AgentActivity | null;
};

export function EveningTimeline({
  currentPlan,
  happenings,
  places,
  onCopyAgentPrompt,
  webMcpStatus,
  onLock,
  onUnlock,
  onRemove,
  timeZone,
  agentActivity,
}: EveningTimelineProps) {
  const plan = currentPlan;
  const byId = new Map(happenings.map((item) => [item.id, item]));
  const byPlaceId = new Map(places.map((item) => [item.id, item]));
  const lastStop = plan?.stops.at(-1);
  const estimatedEnd = lastStop?.kind === "happening"
    ? !byId.get(lastStop.happeningId)?.timing.end
    : Boolean(lastStop);
  const priceSummary = plan ? planPriceSummary(plan, happenings, places) : undefined;
  const stopDetails = (stop: PlanStop) => {
    if (stop.kind === "happening") {
      const item = byId.get(stop.happeningId);
      return item ? { title: item.title, type: item.category.replace("_", " "), subtitle: [item.venue.name, item.venue.neighborhood].filter(Boolean).join(" · "), price: item.commerce.priceMin, unavailable: ["sold_out", "cancelled"].includes(item.status.availability) } : undefined;
    }
    if (stop.kind === "place") {
      const item = byPlaceId.get(stop.placeId);
      return item ? { title: item.name, type: stop.purpose.replace("_", " "), subtitle: item.location.neighborhood, price: item.priceRange.min, unavailable: false } : undefined;
    }
    return { title: stop.customPlace.name, type: stop.purpose.replace("_", " "), subtitle: `${stop.customPlace.location.neighborhood} · Custom place`, price: stop.customPlace.pricePerPerson, unavailable: false };
  };

  if (!plan) {
    const agentStatus = {
      checking: "Connecting agent tools…",
      available: "Agent tools connected",
      unavailable: "Agent tools unavailable in this tab",
      error: "Agent connection error",
    }[webMcpStatus];

    return (
      <div className="timeline-empty">
        <div className="timeline-empty__mark"><Sparkles aria-hidden="true" /></div>
        <h3>Your night is open</h3>
        <p className="timeline-empty__agent-copy">Add something from the map or ask the agent to build it.</p>
        <p className="timeline-empty__connection" role="status">{agentStatus}</p>
        <div className="timeline-empty__actions">
          <ModelessButton variant="signal" size="sm" onClick={onCopyAgentPrompt}>Copy prompt for agent</ModelessButton>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline">
      <ol className="timeline__stops">
        {plan.stops.map((stop, index) => {
          const details = stopDetails(stop);
          if (!details) return null;
          const unavailable = stop.status === "unavailable" || details.unavailable;
          const link = timelineStopLink(stop, happenings, places);
          const stopEndEstimated = stop.kind === "happening" ? !byId.get(stop.happeningId)?.timing.end : true;
          return (
            <li
              key={stop.id}
              className={`${unavailable ? "is-unavailable" : ""} ${["build_evening_plan", "add_happening_stop", "add_place_stop", "add_custom_place_stop"].includes(agentActivity?.toolName ?? "") ? "is-agent-arrival" : ""}`}
              style={{ "--stop-index": index } as React.CSSProperties}
            >
              <div className="timeline__rail"><span>{index + 1}</span></div>
              <div className="timeline__stop-body">
                <div className="timeline__stop-time"><time dateTime={stop.plannedStart} aria-label={formatDateTimeRangeAccessible(stop.plannedStart, stop.plannedEnd, timeZone, stopEndEstimated)}>{formatDateTimeRange(stop.plannedStart, stop.plannedEnd, timeZone, stopEndEstimated)}</time></div>
                <div className="timeline__stop-title">
                  <strong>{details.title}</strong>
                </div>
                <div className="timeline__stop-type">{details.type}</div>
                <p>{details.subtitle} · {priceLabel(
                  details.price === undefined ? undefined : details.price * plan.constraints.partySize,
                  plan.constraints.currency,
                )} for {plan.constraints.partySize}</p>
                {unavailable ? (
                  <p className="timeline__availability" role="status">Unavailable</p>
                ) : null}
                <div className="timeline__stop-actions">
                  <button type="button" className={`timeline__lock-action ${stop.locked ? "is-locked" : ""}`} aria-pressed={stop.locked} aria-label={stop.locked ? `Locked — unlock ${details.title}` : `Unlocked — lock ${details.title}`} title={stop.locked ? "Locked — click to unlock" : "Unlocked — click to lock"} onClick={() => (stop.locked ? onUnlock(stop.id) : onLock(stop.id))}>
                    {stop.locked ? <Lock aria-hidden="true" size={14} /> : <Unlock aria-hidden="true" size={14} />}
                    {stop.locked ? "Locked" : "Unlocked"}
                  </button>
                  <button type="button" className="timeline__remove-action" aria-label={`Remove ${details.title} from Your Night`} title={`Remove ${details.title} from Your Night`} onClick={() => onRemove(stop.id)}>
                    <X aria-hidden="true" size={14} /> Remove
                  </button>
                </div>
                {link ? <a className="timeline__external-link" href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.accessibleLabel}>{link.label} <ArrowUpRight aria-hidden="true" size={12} /></a> : null}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="timeline__summary">
        <div>
          <span>Time</span>
          <strong title={estimatedEnd ? "The ending time is estimated from the final stop's typical duration." : undefined} aria-label={estimatedEnd ? `${formatTimeRange(plan.startTime, plan.endTime, timeZone)}. Ending time estimated.` : undefined}>{formatTimeRange(plan.startTime, plan.endTime, timeZone)}</strong>
        </div>
        <div><span>Estimated price</span><strong aria-label={priceSummary?.accessibleLabel} title={priceSummary?.partial ? priceSummary.accessibleLabel : undefined}>{priceSummary?.label}</strong></div>
      </div>
    </div>
  );
}
