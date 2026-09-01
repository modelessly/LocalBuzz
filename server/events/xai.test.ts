import { describe, expect, it, vi } from "vitest";
import { searchWebForFreshEvents } from "./xai";

describe("searchWebForFreshEvents", () => {
  it("keeps the key server-side and restricts Web Search to trusted domains", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({
        output: [{ type: "message", content: [{ type: "output_text", text: "{\"events\":[]}" }] }],
      }), { status: 200 });
    });

    const result = await searchWebForFreshEvents({ apiKey: "server-secret", prompt: "fresh events", fetchImpl });
    expect(result.raw).toEqual({ events: [] });
    expect(capturedInit?.headers).toMatchObject({ Authorization: "Bearer server-secret" });
    const body = JSON.parse(String(capturedInit?.body));
    expect(body.tools).toEqual([expect.objectContaining({ type: "web_search" })]);
    expect(body.tools[0].filters.allowed_domains).toContain("sfpl.org");
    expect(body).not.toHaveProperty("text.format");
  });
});
