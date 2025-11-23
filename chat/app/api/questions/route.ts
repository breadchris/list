import { questionsSchemaObject } from "@/lib/schema";
import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";

export async function POST(req: Request) {
  const { prompt } = await req.json();

  if (!prompt || typeof prompt !== "string") {
    return new Response("Invalid prompt", { status: 400 });
  }

  const result = streamObject({
    schema: questionsSchemaObject,
    output: "object",
    model: openai("gpt-4o-mini"),
    prompt: `Generate fun, engaging questions based on this topic: "${prompt}". Default to 5 questions unless a specific number is mentioned in the prompt. Make the questions interesting and thought-provoking.`,
  });

  return result.toTextStreamResponse();
}
