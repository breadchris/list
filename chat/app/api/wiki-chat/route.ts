import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, wiki_context } = await req.json();

  const systemPrompt = wiki_context
    ? `You are a helpful AI assistant for a wiki. Use the following wiki page content as context when answering questions.\n\n${wiki_context}\n\nAnswer questions based on this context when relevant. Be concise and helpful.`
    : "You are a helpful AI assistant for a wiki. Be concise and helpful.";

  const result = streamText({
    model: openai("gpt-4.1"),
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
