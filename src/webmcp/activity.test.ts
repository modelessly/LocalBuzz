import { afterEach, describe, expect, it, vi } from "vitest";
import { agentActivitySpecFor, executeWithAgentActivity } from "./activity";

afterEach(() => {
  vi.useRealTimers();
});

describe("WebMCP agent activity", () => {
  it("maps tools to the surface they visibly affect", () => {
    expect(agentActivitySpecFor("show_candidates").target).toBe("map");
    expect(agentActivitySpecFor("build_evening_plan").target).toBe("timeline");
    expect(agentActivitySpecFor("read_current_plan").target).toBe("shared");
    expect(agentActivitySpecFor("show_place_candidates").target).toBe("map");
    expect(agentActivitySpecFor("add_place_stop").target).toBe("timeline");
    expect(agentActivitySpecFor("propose_event_from_url").target).toBe("review");
    expect(agentActivitySpecFor("propose_place_from_url").target).toBe("review");
  });

  it("reports real received, applying, complete, and clear phases", async () => {
    vi.useFakeTimers();
    const report = vi.fn();
    const execute = vi.fn(() => ({ ok: true, visibleCount: 2 }));
    const tool: WebMcpTool = {
      name: "show_candidates",
      description: "Test candidate surfacing",
      execute,
    };
    const options = { signal: new AbortController().signal };

    const resultPromise = executeWithAgentActivity(
      tool,
      { happeningIds: ["one", "two"] },
      options,
      report,
    );
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({
      label: "Matching candidate IDs",
      status: "working",
      step: 1,
    }));
    expect(execute).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(180);
    await expect(resultPromise).resolves.toEqual({ ok: true, visibleCount: 2 });
    expect(execute).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith(expect.objectContaining({
      label: "Surfacing map signals",
      status: "working",
      step: 2,
    }));
    expect(report).toHaveBeenCalledWith(expect.objectContaining({
      label: "Candidates visible",
      status: "complete",
      step: 3,
    }));

    await vi.advanceTimersByTimeAsync(1_350);
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ status: "clear" }));
  });

  it("reports structured tool failures as attention states", async () => {
    vi.useFakeTimers();
    const report = vi.fn();
    const tool: WebMcpTool = {
      name: "repair_plan",
      description: "Test repair",
      execute: () => ({ ok: false, code: "NO_REPAIR_FOUND" }),
    };
    const resultPromise = executeWithAgentActivity(
      tool,
      {},
      { signal: new AbortController().signal },
      report,
    );
    await vi.advanceTimersByTimeAsync(180);
    await resultPromise;
    expect(report).toHaveBeenCalledWith(expect.objectContaining({
      label: "Tool needs attention",
      status: "error",
    }));
  });
});
