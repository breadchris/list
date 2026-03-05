import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { text, persona } = await req.json();

    if (!text || typeof text !== "string") {
      return Response.json({ error: "Missing or invalid text" }, { status: 400 });
    }

    const roleContext = persona?.role
      ? ` Write in the style of a ${persona.role}.`
      : "";

    const result = await generateText({
      model: openai("gpt-4o"),
      system: `You are an expert editor. Your task is to expand and refine the given text while maintaining its core message. Write clearly and concisely. Do not add filler or fluff.${roleContext}`,
      messages: [{ role: "user", content: text }],
    });

    return Response.json({ refined_text: result.text });
  } catch (e: any) {
    console.error("Context refine error:", e);
    return Response.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
