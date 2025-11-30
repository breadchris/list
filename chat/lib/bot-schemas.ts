/**
 * Bot Schema Registry
 *
 * Maps bot schema IDs to their Zod schemas for structured object streaming.
 * Bots with response_type: "object" must have a schema_id that exists here.
 */

import type { z } from "zod";
import {
  listItemsSchemaObject,
  codeVariantsSchemaObject,
  calendarSchemaObject,
  botBuilderSchemaObject,
  chatResponseSchemaObject,
} from "./schema";

export interface BotSchemaConfig {
  schema: z.ZodSchema<unknown>;
  output: "object" | "array";
  /** Key in the schema object that contains array items (for creating per-item messages) */
  items_key?: string;
}

/**
 * Registry of schemas available for bot object streaming.
 * Add new schemas here when creating bots that need structured output.
 */
export const botSchemas: Record<string, BotSchemaConfig> = {
  list: {
    schema: listItemsSchemaObject,
    output: "object",
    items_key: "items",
  },
  code: {
    schema: codeVariantsSchemaObject,
    output: "object",
    items_key: "variants",
  },
  calendar: {
    schema: calendarSchemaObject,
    output: "object",
    items_key: "events",
  },
  bot: {
    schema: botBuilderSchemaObject,
    output: "object",
  },
  chat: {
    schema: chatResponseSchemaObject,
    output: "object",
  },
};

/**
 * Get schema config by ID
 */
export function getBotSchema(schemaId: string): BotSchemaConfig | undefined {
  return botSchemas[schemaId];
}
