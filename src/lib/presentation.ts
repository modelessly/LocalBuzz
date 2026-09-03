export const browserTitle = (cityName: string) => `Local Buzz · ${cityName}`;

export const placeCandidateSummary = (candidateCount: number, origin: "human" | "agent" | undefined) =>
  `${candidateCount} ${origin === "agent" ? "agent-selected" : "selected"} option${candidateCount === 1 ? "" : "s"}.`;

export const candidateReasonLead = (origin: "human" | "agent" | undefined) =>
  origin === "agent" ? "Agent surfaced" : "Showing";
