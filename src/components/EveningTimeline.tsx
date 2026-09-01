import { Check, Lock, RotateCcw, Sparkles, TriangleAlert, Unlock, X } from "lucide-react";
import { ModelessButton, SignalBadge } from "@modeless/design-system";
import type { EveningPlan, Happening, LocalBuzzState, Place, PlanChange, PlanStop } from "../domain/types";
import type { AgentActivity } from "../webmcp/activity";
import { formatTime, priceLabel } from "../lib/format";

type EveningTimelineProps = {
  currentPlan: EveningPlan | null;
  stagedPlan: EveningPlan | null;
  changes: PlanChange[];
  happenings: Happening[];
  places: Place[];
  onStageDemo: () => void;
  onCopyAgentPrompt: () => void;
  webMcpStatus: LocalBuzzState["webMcp"];
  onAccept: () => void;
  onReject: () => void;
  onLock: (id: string) => void;
  onUnlock: (id: string) => void;
  onRemove: (id: string) => void;
  onDisrupt: () => void;
  onRepair: () => void;
  canRepair: boolean;
  timeZone: string;
  agentActivity: AgentActivity | null;
};

export function EveningTimeline({
  currentPlan,
  stagedPlan,
  changes,
  happenings,
  places,
  onStageDemo,
  onCopyAgentPrompt,
  webMcpStatus,
  onAccept,
  onReject,
  onLock,
  onUnlock,
  onRemove,
  onDisrupt,
  onRepair,
  canRepair,
  timeZone,
  agentActivity,
}: EveningTimelineProps) {
  const plan = stagedPlan ?? currentPlan;
  const changedIds = new Set(changes.map((change) => change.stopId));
  const byId = new Map(happenings.map((item) => [item.id, item]));
  const byPlaceId = new Map(places.map((item) => [item.id, item]));
  const stopDetails = (stop: PlanStop) => {
    if (stop.kind === "happening") {
      const item = byId.get(stop.happeningId);
      return item ? { title: item.title, subtitle: item.venue.name, price: item.commerce.priceMin, unavailable: ["sold_out", "cancelled"].includes(item.status.availability), badge: "Event", verification: "canonical" } : undefined;
    }
    if (stop.kind === "place") {
      const item = byPlaceId.get(stop.placeId);
      return item ? { title: item.name, subtitle: item.location.neighborhood, price: item.priceRange.min, unavailable: false, badge: stop.purpose.replace("_", " "), verification: "canonical place" } : undefined;
    }
    return { title: stop.customPlace.name, subtitle: stop.customPlace.location.neighborhood, price: stop.customPlace.pricePerPerson, unavailable: false, badge: stop.purpose.replace("_", " "), verification: "unverified custom" };
  };

  if (!plan) {
    const agentStatus = {
      checking: { variant: "ready" as const, label: "Connecting agent tools…" },
      available: { variant: "live" as const, label: "Agent tools connected" },
      unavailable: { variant: "warning" as const, label: "Agent tools unavailable in this tab" },
      error: { variant: "warning" as const, label: "Agent connection error" },
    }[webMcpStatus];

    return (
      <div className="timeline-empty">
        <div className="timeline-empty__mark"><Sparkles aria-hidden="true" /></div>
        <h3>Your night is open</h3>
        <SignalBadge variant={agentStatus.variant}>{agentStatus.label}</SignalBadge>
        <p className="timeline-empty__agent-copy">
          {webMcpStatus === "available"
            ? "The agent is the chat panel beside this page—nothing opens inside Local Buzz. Ask it to build the night, and its work will appear here."
            : "Local Buzz cannot open an agent itself. Use a WebMCP-enabled browser and talk to the agent in that browser's chat panel."}
        </p>
        <p className="timeline-empty__handoff">Use the suggested city-specific prompt from Local Buzz in the adjacent agent panel.</p>
        <div className="timeline-empty__actions">
          <ModelessButton variant="signal" size="sm" onClick={onCopyAgentPrompt}>Copy prompt for agent</ModelessButton>
          <ModelessButton variant="outline" size="sm" onClick={onStageDemo}>Run manual demo</ModelessButton>
        </div>
      </div>
    );
  }

  return (
    <div className={`timeline ${stagedPlan ? "is-staged" : ""} ${changes.some((change) => change.type === "replace") ? "has-surgical-repair" : ""}`}>
      {stagedPlan ? (
        <div className="timeline__ghost-state" aria-hidden="true">
          <span /> Agent proposal · not committed
        </div>
      ) : null}
      <div className="timeline__status">
        {stagedPlan ? <SignalBadge variant="experimental">staged · review</SignalBadge> : <SignalBadge variant="success">accepted</SignalBadge>}
        <span>{priceLabel(plan.totalEstimatedCost, plan.constraints.currency)} / {priceLabel(plan.constraints.budget, plan.constraints.currency)}</span>
      </div>
      <ol className="timeline__stops">
        {plan.stops.map((stop, index) => {
          const details = stopDetails(stop);
          if (!details) return null;
          const unavailable = stop.status === "unavailable" || details.unavailable;
          const changed = changedIds.has(stop.id);
          const repairChange = changes.find((change) => change.type === "replace" && change.stopId === stop.id);
          const previousDetails = repairChange?.before ? stopDetails(repairChange.before) : undefined;
          return (
            <li
              key={stop.id}
              className={`${unavailable ? "is-unavailable" : ""} ${changed ? "is-changed" : ""} ${changed && changes.some((change) => change.type === "replace" && change.stopId === stop.id) ? "is-repairing" : ""} ${agentActivity?.toolName === "stage_evening_plan" ? "is-agent-arrival" : ""}`}
              style={{ "--stop-index": index } as React.CSSProperties}
            >
              <div className="timeline__rail"><span>{index + 1}</span></div>
              <div className="timeline__stop-body">
                {repairChange?.before && previousDetails ? (
                  <div className="timeline__repair-scar" aria-label={`Replaced ${previousDetails.title}`}>
                    <span className="timeline__repair-scar-line" aria-hidden="true" />
                    <small>Previous route</small>
                    <strong>{previousDetails.title}</strong>
                    <em>{formatTime(repairChange.before.plannedStart, timeZone)}–{formatTime(repairChange.before.plannedEnd, timeZone)}</em>
                  </div>
                ) : null}
                <div className="timeline__stop-time">{formatTime(stop.plannedStart, timeZone)}–{formatTime(stop.plannedEnd, timeZone)}</div>
                <div className="timeline__stop-title">
                  <strong>{details.title}</strong>
                  {stop.locked ? <span className="lock-label"><Lock aria-hidden="true" size={12} /> Human lock</span> : null}
                </div>
                <div className="timeline__stop-badges"><span>{details.badge}</span><span>{details.verification}</span></div>
                <p>{details.subtitle} · {priceLabel(
                  details.price === undefined ? undefined : details.price * plan.constraints.partySize,
                  plan.constraints.currency,
                )} for {plan.constraints.partySize}</p>
                {unavailable ? (
                  <div className="disruption-label"><TriangleAlert aria-hidden="true" size={14} /> Unavailable · demo live-status simulation</div>
                ) : changed ? (
                  <div className="repair-label"><Sparkles aria-hidden="true" size={14} /> Staged replacement · only this stop changed</div>
                ) : null}
                <div className="timeline__stop-actions">
                  <button onClick={() => (stop.locked ? onUnlock(stop.id) : onLock(stop.id))}>
                    {stop.locked ? <Unlock aria-hidden="true" size={14} /> : <Lock aria-hidden="true" size={14} />}
                    {stop.locked ? "Unlock" : "Lock"}
                  </button>
                  <button onClick={() => onRemove(stop.id)} disabled={stop.locked}>
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
        <div>
          <span>Locked</span>
          <strong>{plan.stops.filter((stop) => stop.locked).length}</strong>
        </div>
        <div>
          <span>Changes</span>
          <strong>{changes.length}</strong>
        </div>
      </div>
      {stagedPlan ? (
        <div className="timeline__review-actions">
          <ModelessButton variant="outline" size="sm" onClick={onReject}><RotateCcw aria-hidden="true" size={14} /> Reject staged</ModelessButton>
          <ModelessButton variant="signal" size="sm" onClick={onAccept}><Check aria-hidden="true" size={14} /> Accept night</ModelessButton>
        </div>
      ) : null}
      <div className="demo-controls">
        <p>Reality check <span>Prototype controls</span></p>
        <div>
          <ModelessButton variant="destructive" size="sm" onClick={onDisrupt} disabled={canRepair}>
            <TriangleAlert aria-hidden="true" size={14} /> Simulate disruption
          </ModelessButton>
          <ModelessButton variant="outline" size="sm" onClick={onRepair} disabled={!canRepair}>
            <RotateCcw aria-hidden="true" size={14} /> Repair only affected stop
          </ModelessButton>
        </div>
      </div>
    </div>
  );
}
