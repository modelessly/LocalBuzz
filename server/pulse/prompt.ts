import type { CollectionMode } from "./types";

interface PromptOptions {
  now: Date;
  mode: CollectionMode;
  handles: string[];
}

export function buildPulsePrompt({ now, mode, handles }: PromptOptions): string {
  const cutoff = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const modeInstruction =
    mode === "curated"
      ? `Search only the configured trusted San Francisco accounts: ${handles.map((handle) => `@${handle}`).join(", ")}.`
      : "Search X semantically and broadly for credible reports of activity across San Francisco.";

  return `You are collecting a small, high-confidence social pulse for Local Buzz.

Current time: ${now.toISOString()}
Hard freshness cutoff: ${cutoff}
City: San Francisco, California only.

${modeInstruction}

Find public, ephemeral things physically happening now or starting imminently: live music, food and drink activity, culture, nightlife, activities, markets, and social gatherings. Prefer evidence posted in the last two hours. Reject anything whose latest credible evidence is older than three hours.

Exclude politics, crime, gossip, private parties, personal location tracking, general recommendations, scheduled events without fresh evidence, stale promotions, online-only activity, and anything outside San Francisco. Never infer a person's live location.

Each signal must cite X status URLs. Count distinct posts as evidence and distinct accounts as independent sources. One clearly official venue, organizer, or city-agency account may be sufficient; add the exact tag "official-source" when relying on that exception. Otherwise require at least two independent sources for spontaneous activity. Return no signal rather than stretching the evidence. Use confidence >= 0.55 only. Return at most 15 signals; zero is acceptable.

Summaries and reasonActionable must state only what the cited evidence supports. Set location.address to null. Use ISO 8601 timestamps with time zones. Output only the requested structured object.`;
}
