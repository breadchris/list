import { recipeSchemaObject } from "@/lib/schema";
import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";

export async function POST(req: Request) {
  const { prompt } = await req.json();

  if (!prompt || typeof prompt !== "string") {
    return new Response("Invalid prompt", { status: 400 });
  }

  const result = streamObject({
    schema: recipeSchemaObject,
    output: "object",
    model: openai("gpt-4o-mini"),
    prompt: prompt,
  });

  return result.toTextStreamResponse();
}
