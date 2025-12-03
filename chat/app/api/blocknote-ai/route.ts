import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, toolDefinitions } = body;

  const result = streamText({
    model: openai("gpt-5"),
    messages: convertToModelMessages(messages),
  });

  return result.toTextStreamResponse();
}

export const maxDuration = 30;
