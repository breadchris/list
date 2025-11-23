import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getBotById } from "@/lib/bots.config";

export interface ChatRequestBody {
  bot_id: string;
  message: string;
  context: Array<{
    username: string;
    content: string;
  }>;
}

export async function POST(req: Request) {
  const body: ChatRequestBody = await req.json();
  const { bot_id, message, context } = body;

  // Validate required fields
  if (!bot_id || typeof bot_id !== "string") {
    return new Response("Missing or invalid bot_id", { status: 400 });
  }

  if (!message || typeof message !== "string") {
    return new Response("Missing or invalid message", { status: 400 });
  }

  // Get bot configuration
  const bot = getBotById(bot_id);
  if (!bot) {
    return new Response(`Unknown bot: ${bot_id}`, { status: 404 });
  }

  // Build the messages array for the AI
  const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];

  // Add system prompt
  messages.push({
    role: "system",
    content: bot.system_prompt,
  });

  // Add context messages if provided
  if (context && Array.isArray(context)) {
    for (const msg of context) {
      // Treat all context messages as user messages with username prefix
      messages.push({
        role: "user",
        content: `[${msg.username}]: ${msg.content}`,
      });
    }
  }

  // Add the triggering message
  messages.push({
    role: "user",
    content: message,
  });

  // Stream the response
  const result = streamText({
    model: openai(bot.model),
    messages,
  });

  return result.toTextStreamResponse();
}
