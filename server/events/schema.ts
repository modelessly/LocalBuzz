import { FRESH_EVENT_CATEGORIES } from "./types";

export const SF_FRESH_EVENTS_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["generatedAt", "city", "events"],
  properties: {
    generatedAt: { type: "string" },
    city: { type: "string", const: "San Francisco" },
    events: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "description", "category", "venue", "timing", "commerce", "source", "tags", "confidence"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          category: { type: "string", enum: [...FRESH_EVENT_CATEGORIES] },
          venue: {
            type: "object",
            additionalProperties: false,
            required: ["name", "address", "neighborhood", "lat", "lng"],
            properties: {
              name: { type: "string" },
              address: { type: "string" },
              neighborhood: { type: "string" },
              lat: { type: "number" },
              lng: { type: "number" },
            },
          },
          timing: {
            type: "object",
            additionalProperties: false,
            required: ["start", "end"],
            properties: { start: { type: "string" }, end: { type: "string" } },
          },
          commerce: {
            type: "object",
            additionalProperties: false,
            required: ["priceMin", "bookingRequired", "bookingUrl"],
            properties: {
              priceMin: { type: ["number", "null"] },
              bookingRequired: { type: "boolean" },
              bookingUrl: { type: ["string", "null"] },
            },
          },
          source: {
            type: "object",
            additionalProperties: false,
            required: ["name", "url"],
            properties: { name: { type: "string" }, url: { type: "string" } },
          },
          tags: { type: "array", items: { type: "string" }, maxItems: 6 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const;
