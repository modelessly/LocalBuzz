import { Check, TriangleAlert, Waypoints } from "lucide-react";
import type { CSSProperties } from "react";
import type { LocalBuzzState } from "../domain/types";
import type { AgentActivity } from "../webmcp/activity";

type AgentProgressProps = {
  activity: AgentActivity | null;
  webMcpStatus: LocalBuzzState["webMcp"];
};

export function AgentProgress({ activity, webMcpStatus }: AgentProgressProps) {
  const complete = activity?.status === "complete";
  const failed = activity?.status === "error";
  return (
    <div
      className={`agent-command-bay ${activity ? `is-${activity.status}` : "is-idle"}`}
      role="status"
      aria-live="polite"
      aria-label={activity ? `Agent: ${activity.label}` : `WebMCP ${webMcpStatus}`}
    >
      <span className="agent-command-bay__glyph" aria-hidden="true">
        {failed ? <TriangleAlert size={14} /> : complete ? <Check size={14} /> : <Waypoints size={14} />}
      </span>
      <span className="agent-command-bay__copy">
        <strong>{activity ? `Agent · ${activity.toolName.replaceAll("_", " ")}` : "WebMCP channel"}</strong>
        <small>{activity?.label ?? (webMcpStatus === "available" ? "Live · awaiting agent" : "Ready · awaiting connection")}</small>
      </span>
      <span className="agent-command-bay__loom" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <i key={index} style={{ "--loom-index": index } as CSSProperties} />
        ))}
      </span>
      {activity ? (
        <span className="agent-command-bay__rail" aria-hidden="true">
          {Array.from({ length: activity.totalSteps }, (_, index) => (
            <i key={index} className={index < activity.step ? "is-filled" : ""} />
          ))}
        </span>
      ) : null}
    </div>
  );
}

const strands = [
  { label: "PLACE", color: "#6fffd0" },
  { label: "TIME", color: "#53c8ff" },
  { label: "BUDGET", color: "#c7ff2a" },
  { label: "TASTE", color: "#b984ff" },
];

export function IntentLoom({ activity }: { activity: AgentActivity | null }) {
  if (!activity || activity.status === "clear") return null;
  const target = activity.target === "map"
    ? { x: 362, y: 326 }
    : activity.target === "timeline"
      ? { x: 790, y: 326 }
      : activity.target === "review"
        ? { x: 580, y: 520 }
      : { x: 580, y: 560 };
  const gradientId = `intent-gradient-${activity.id}`;
  const glowId = `intent-glow-${activity.id}`;
  return (
    <svg className={`intent-loom is-${activity.status}`} viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#53c8ff" stopOpacity=".9" />
          <stop offset=".55" stopColor="#6fffd0" stopOpacity=".72" />
          <stop offset="1" stopColor="#c7ff2a" stopOpacity=".86" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g className="intent-loom__target" transform={`translate(${target.x} ${target.y})`}>
        <circle r="24" />
        <circle r="7" />
        <path d="M-4 0H4M0-4V4" />
      </g>
      {strands.map((strand, index) => {
        const startY = 3 + index * 5;
        const bendX = 875 - index * 22;
        const bendY = 72 + index * 25;
        const approachX = target.x + (index - 1.5) * 34;
        const approachY = target.y - 92 + index * 11;
        const path = `M 972 ${startY} C ${bendX} ${bendY}, ${approachX} ${approachY}, ${target.x} ${target.y}`;
        return (
          <g key={strand.label} className="intent-loom__strand" style={{ "--strand-index": index, "--strand-color": strand.color } as CSSProperties}>
            <path className="intent-loom__echo" d={path} />
            <path key={`${activity.id}-${activity.step}-${strand.label}`} className="intent-loom__signal" d={path} filter={`url(#${glowId})`} />
            <circle className="intent-loom__node" cx="972" cy={startY} r="2.5" />
            <text x="958" y={startY + 2}>{strand.label}</text>
          </g>
        );
      })}
      <path className="intent-loom__convergence" d={`M ${target.x - 34} ${target.y} H ${target.x + 34}`} stroke={`url(#${gradientId})`} />
    </svg>
  );
}
