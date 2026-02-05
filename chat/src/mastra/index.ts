/**
 * Mastra Entry Point
 *
 * Registers the builder agent for the chat-first Agent Studio.
 */

import { Mastra } from "@mastra/core/mastra";
import { builderAgent } from "./agents/builder-agent";

export const mastra = new Mastra({
  agents: { builderAgent },
});
