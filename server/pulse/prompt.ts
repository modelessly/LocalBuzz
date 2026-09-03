import type { CollectionMode } from "./types";
import type { CityPulseConfig } from "./config/cities";

interface PromptOptions {
  city: CityPulseConfig;
  now: Date;
  mode: CollectionMode;
  handles: string[];
}

export function buildPulsePrompt({ city, now, mode, handles }: PromptOptions): string {
  const cutoff = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const modeInstruction =
    mode === "curated"
      ? `Search only the configured trusted ${city.name} accounts: ${handles.map((handle) => `@${handle}`).join(", ")}.`
      : `Search X semantically and broadly for credible reports of activity across ${city.name}. Useful local terms include: ${city.socialTerms.join(", ")}.`;

  return `You are collecting a small, high-confidence social pulse for Local Buzz.

Current time: ${now.toISOString()}
Hard freshness cutoff: ${cutoff}
City: ${city.name} only.
Time zone: ${city.timeZone}.
Geographic boundary: ${city.searchArea}.
Useful neighborhoods: ${city.neighborhoods.join(", ")}.

${modeInstruction}

Find public, ephemeral things physically happening now or starting imminently: live music, food and drink activity, culture, nightlife, activities, markets, and social gatherings. Prefer evidence posted in the last two hours. Evidence aged 0–30 minutes is very fresh, 30–90 is fresh, and 90–180 is decaying. Reject anything older than three hours unless multiple current sources explicitly say the activity is still happening.

Exclude politics, crime, gossip, private parties, personal location tracking, general recommendations, scheduled events without fresh evidence, stale promotions, online-only activity, and anything outside San Francisco. Never infer a person's live location.

Classify each item as scheduled_event, live_signal, venue_activity, pop_up, city_condition, or community_report. Each signal must cite X status URLs and list the posting handles without @. Count distinct posts as evidence and distinct accounts as independent sources. One clearly official venue, organizer, or city-agency account may be sufficient; add the exact tag "official-source" when relying on that exception. Otherwise require at least two independent sources for spontaneous activity. Return no signal rather than stretching the evidence. Use confidence >= 0.55 only. Return at most 10 signals for this pass; zero is acceptable.

Summaries and reasonActionable must state only what the cited evidence supports. Set location.address to null. Use ISO 8601 timestamps with time zones. Output only the requested structured object.`;
}
