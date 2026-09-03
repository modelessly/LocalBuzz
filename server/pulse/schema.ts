import { PULSE_CATEGORIES, PULSE_KINDS } from "./types";
import type { CityPulseConfig } from "./config/cities";

export function pulseResponseSchema(city: CityPulseConfig) { return {
  type: "object",
  additionalProperties: false,
  required: ["generatedAt", "city", "signals"],
  properties: {
    generatedAt: { type: "string" },
    city: { type: "string", const: city.name },
    signals: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "kind",
          "title",
          "summary",
          "category",
          "location",
          "timing",
          "social",
          "tags",
          "reasonActionable",
        ],
        properties: {
          id: { type: "string" },
          kind: { type: "string", enum: [...PULSE_KINDS] },
          title: { type: "string" },
          summary: { type: "string" },
          category: { type: "string", enum: [...PULSE_CATEGORIES] },
          location: {
            type: "object",
            additionalProperties: false,
            required: ["name", "neighborhood", "address"],
            properties: {
              name: { type: "string" },
              neighborhood: { type: "string" },
              address: { type: "null" },
            },
          },
          timing: {
            type: "object",
            additionalProperties: false,
            required: ["firstSeen", "latestSeen", "likelyActiveUntil"],
            properties: {
              firstSeen: { type: ["string", "null"] },
              latestSeen: { type: "string" },
              likelyActiveUntil: { type: ["string", "null"] },
            },
          },
          social: {
            type: "object",
            additionalProperties: false,
            required: [
              "evidenceCount",
              "independentSourceCount",
              "sourceAccounts",
              "confidence",
              "source",
              "sourceUrls",
            ],
            properties: {
              evidenceCount: { type: "integer", minimum: 0 },
              independentSourceCount: { type: "integer", minimum: 0 },
              sourceAccounts: { type: "array", items: { type: "string" } },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              source: { type: "string", const: "x" },
              sourceUrls: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
          tags: { type: "array", items: { type: "string" } },
          reasonActionable: { type: "string" },
        },
      },
    },
  },
} as const; }
