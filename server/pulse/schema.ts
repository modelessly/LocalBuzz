import { PULSE_CATEGORIES } from "./types";

export const SF_PULSE_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["generatedAt", "city", "signals"],
  properties: {
    generatedAt: { type: "string" },
    city: { type: "string", const: "San Francisco" },
    signals: {
      type: "array",
      maxItems: 15,
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
          kind: { type: "string", const: "live_signal" },
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
              "confidence",
              "source",
              "sourceUrls",
            ],
            properties: {
              evidenceCount: { type: "integer", minimum: 0 },
              independentSourceCount: { type: "integer", minimum: 0 },
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
} as const;
