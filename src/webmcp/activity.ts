export type AgentActivityTarget = "map" | "timeline" | "shared" | "review";
export type AgentActivityStatus = "working" | "complete" | "error" | "clear";

export type AgentActivity = {
  id: string;
  toolName: string;
  label: string;
  step: number;
  totalSteps: number;
  status: AgentActivityStatus;
  target: AgentActivityTarget;
};

export type AgentActivityReporter = (activity: AgentActivity) => void;

type ToolActivitySpec = {
  target: AgentActivityTarget;
  phases: [string, string, string];
};

const agentActivitySpecs: Record<string, ToolActivitySpec> = {
  propose_event_from_url: {
    target: "review",
    phases: ["Receiving extracted event facts", "Validating source and duplicates", "Event lead ready for review"],
  },
  propose_place_from_url: {
    target: "review",
    phases: ["Receiving extracted Place facts", "Validating source and duplicates", "Place lead ready for review"],
  },
  search_happenings: {
    target: "map",
    phases: ["Receiving constraints", "Searching city inventory", "Search results ready"],
  },
  show_candidates: {
    target: "map",
    phases: ["Matching candidate IDs", "Surfacing map signals", "Candidates visible"],
  },
  search_places: {
    target: "map",
    phases: ["Receiving place constraints", "Searching source-backed places", "Place results ready"],
  },
  show_place_candidates: {
    target: "map",
    phases: ["Matching place IDs", "Surfacing place signals", "Places visible"],
  },
  read_place_details: {
    target: "shared",
    phases: ["Reading place record", "Checking evidence and hours", "Place details returned"],
  },
  add_place_stop: {
    target: "timeline",
    phases: ["Checking place constraints", "Adding place to the route", "Place added"],
  },
  add_custom_place_stop: {
    target: "timeline",
    phases: ["Reading custom assumptions", "Validating custom stop", "Custom stop added"],
  },
  add_happening_stop: {
    target: "timeline",
    phases: ["Checking event constraints", "Adding event to the route", "Event added"],
  },
  build_evening_plan: {
    target: "timeline",
    phases: ["Checking plan constraints", "Building shared route", "Itinerary ready"],
  },
  read_current_plan: {
    target: "shared",
    phases: ["Reading shared state", "Synchronizing human edits", "Shared state returned"],
  },
  lock_plan_stop: {
    target: "timeline",
    phases: ["Reading selected stop", "Applying human constraint", "Stop protected"],
  },
  unlock_plan_stop: {
    target: "timeline",
    phases: ["Reading selected stop", "Removing lock constraint", "Stop unlocked"],
  },
  remove_plan_stop: {
    target: "timeline",
    phases: ["Reading selected stop", "Recalculating itinerary", "Stop removed"],
  },
  repair_plan: {
    target: "timeline",
    phases: ["Preserving locked stops", "Repairing affected route", "Minimal repair applied"],
  },
};

export const agentActivitySpecFor = (toolName: string): ToolActivitySpec => agentActivitySpecs[toolName] ?? {
  target: "shared",
  phases: ["Receiving tool call", "Updating shared state", "Agent action complete"],
};

let activitySequence = 0;

const pauseForHandoff = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, 180);
  signal.addEventListener("abort", () => {
    clearTimeout(timer);
    reject(new DOMException("WebMCP tool call aborted", "AbortError"));
  }, { once: true });
});

const resultFailed = (result: unknown) => (
  typeof result === "object" && result !== null && "ok" in result && result.ok === false
);

export async function executeWithAgentActivity(
  tool: WebMcpTool,
  input: Record<string, unknown>,
  options: { signal: AbortSignal },
  report: AgentActivityReporter,
) {
  const spec = agentActivitySpecFor(tool.name);
  const id = `${tool.name}-${++activitySequence}`;
  const emit = (step: number, status: AgentActivityStatus, label: string) => report({
    id,
    toolName: tool.name,
    label,
    step,
    totalSteps: spec.phases.length,
    status,
    target: spec.target,
  });

  try {
    emit(1, "working", spec.phases[0]);
    await pauseForHandoff(options.signal);
    emit(2, "working", spec.phases[1]);
    const result = await tool.execute(input, options);
    emit(3, resultFailed(result) ? "error" : "complete", resultFailed(result) ? "Tool needs attention" : spec.phases[2]);
    setTimeout(() => emit(3, "clear", spec.phases[2]), 1_350);
    return result;
  } catch (cause) {
    emit(3, "error", "Tool call interrupted");
    setTimeout(() => emit(3, "clear", "Tool call interrupted"), 1_350);
    throw cause;
  }
}
