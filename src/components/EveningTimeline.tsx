import { Lock, Sparkles, Unlock, X } from "lucide-react";
import { ModelessButton } from "@modeless/design-system";
import type { EveningPlan, Happening, LocalBuzzState, Place, PlanStop } from "../domain/types";
import type { AgentActivity } from "../webmcp/activity";
import { formatTime, priceLabel } from "../lib/format";

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
      <div className="timeline__status">
        <span>{priceLabel(plan.totalEstimatedCost, plan.constraints.currency)} / {priceLabel(plan.constraints.budget, plan.constraints.currency)}</span>
      </div>
      <ol className="timeline__stops">
        {plan.stops.map((stop, index) => {
          const details = stopDetails(stop);
          if (!details) return null;
          const unavailable = stop.status === "unavailable" || details.unavailable;
          return (
            <li
              key={stop.id}
              className={`${unavailable ? "is-unavailable" : ""} ${["build_evening_plan", "add_happening_stop", "add_place_stop", "add_custom_place_stop"].includes(agentActivity?.toolName ?? "") ? "is-agent-arrival" : ""}`}
              style={{ "--stop-index": index } as React.CSSProperties}
            >
              <div className="timeline__rail"><span>{index + 1}</span></div>
              <div className="timeline__stop-body">
                <div className="timeline__stop-time">{formatTime(stop.plannedStart, timeZone)}–{formatTime(stop.plannedEnd, timeZone)}</div>
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
                  <button type="button" className={`timeline__lock-action ${stop.locked ? "is-locked" : ""}`} aria-pressed={stop.locked} aria-label={stop.locked ? `Unlock ${details.title}` : `Lock ${details.title}`} title={stop.locked ? "Locked — click to unlock" : "Lock this stop"} onClick={() => (stop.locked ? onUnlock(stop.id) : onLock(stop.id))}>
                    {stop.locked ? <Unlock aria-hidden="true" size={14} /> : <Lock aria-hidden="true" size={14} />}
                    {stop.locked ? "Locked" : "Lock"}
                  </button>
                  <button type="button" className="timeline__remove-action" aria-label={`Remove ${details.title}`} onClick={() => onRemove(stop.id)}>
                    <X aria-hidden="true" size={14} /> Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="timeline__summary">
        <div>
          <span>Ends</span>
          <strong>{formatTime(plan.endTime, timeZone)}</strong>
        </div>
        <div><span>Total</span><strong>{priceLabel(plan.totalEstimatedCost, plan.constraints.currency)}</strong></div>
      </div>
    </div>
  );
}
