import { describe, expect, it, vi } from "vitest";
import { searchXForPulse } from "./xai";

describe("searchXForPulse", () => {
  it("uses the Responses API with X Search and strict structured output", async () => {
    let capturedUrl: RequestInfo | URL | undefined;
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(JSON.stringify({
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ signals: [] }) }] }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const result = await searchXForPulse({
      apiKey: "secret-test-key",
      prompt: "test prompt",
      mode: "curated",
      handles: ["SFJAZZ"],
      now: new Date("2026-08-31T18:00:00.000Z"),
      fetchImpl,
    });

    expect(result.raw).toEqual({ signals: [] });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(capturedUrl).toBe("https://api.x.ai/v1/responses");
    expect(capturedInit?.headers).toMatchObject({ Authorization: "Bearer secret-test-key" });
    const body = JSON.parse(String(capturedInit?.body));
    expect(body.model).toBe("grok-4.6");
    expect(body.tools).toEqual([expect.objectContaining({ type: "x_search", allowed_x_handles: ["SFJAZZ"] })]);
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
  });

  it("does not add an allowlist in broad mode", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({
        output: [{ type: "message", content: [{ type: "output_text", text: "{\"signals\":[]}" }] }],
      }), { status: 200 });
    });
    await searchXForPulse({
      apiKey: "secret-test-key",
      prompt: "test prompt",
      mode: "broad",
      handles: [],
      now: new Date("2026-08-31T18:00:00.000Z"),
      fetchImpl,
    });
    const body = JSON.parse(String(capturedInit?.body));
    expect(body.tools[0]).not.toHaveProperty("allowed_x_handles");
  });
});
