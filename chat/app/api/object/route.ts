import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { getBotById } from "@/lib/bots.config";
import { getBotSchema } from "@/lib/bot-schemas";

export interface ObjectRequestBody {
  prompt: string;
  bot_id?: string;
  context_messages?: Array<{ username: string; content: string }>;
}

export async function POST(req: Request) {
  const body: ObjectRequestBody = await req.json();
  const { prompt, bot_id, context_messages = [] } = body;

  if (!prompt || typeof prompt !== "string") {
    return new Response("Invalid prompt", { status: 400 });
  }

  // If bot_id is provided, use bot-specific schema and settings
  if (bot_id) {
    const bot = getBotById(bot_id);
    if (!bot) {
      return new Response(`Unknown bot: ${bot_id}`, { status: 404 });
    }

    if (!bot.schema_id) {
      return new Response(`Bot ${bot_id} has no schema_id configured`, {
        status: 400,
      });
    }

    const schemaConfig = getBotSchema(bot.schema_id);
    if (!schemaConfig) {
      return new Response(`Unknown schema: ${bot.schema_id}`, { status: 404 });
    }

    // Build messages array with context
    const messages = [
      { role: "system" as const, content: bot.system_prompt },
      ...context_messages.map((m) => ({
        role: "user" as const,
        content: `[${m.username}]: ${m.content}`,
      })),
      { role: "user" as const, content: prompt },
    ];

    // Stream object using schema
    const result = streamObject({
      schema: schemaConfig.schema,
      output: "object",
      model: openai(bot.model),
      messages: messages,
    });
    return result.toTextStreamResponse();
  }

  // Default behavior: use recipe schema (for backwards compatibility)
  const result = streamObject({
    schema: {} as any,
    output: "object",
    model: openai("gpt-4.1"),
    prompt: prompt,
  });

  return result.toTextStreamResponse();
}
