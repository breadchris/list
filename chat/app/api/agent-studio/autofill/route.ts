import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import type { LLMProvider } from "@/types/agent-studio";

// Allow up to 30 seconds for autofill
export const maxDuration = 30;

interface AutofillRequest {
  field_name: string;
  field_context: string;
  conversation_context: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  model_config?: {
    provider: LLMProvider;
    model: string;
  };
}

/**
 * Get the AI model based on provider and model name
 * Uses a smaller/faster model for autofill suggestions
 */
function getModel(provider: LLMProvider, modelName?: string) {
  switch (provider) {
    case "openai":
      // Use gpt-4o-mini for fast suggestions
      return openai(modelName || "gpt-4o-mini");
    case "anthropic":
      // Use haiku for fast suggestions
      return anthropic(modelName || "claude-3-haiku-20240307");
    default:
      return openai("gpt-4o-mini");
  }
}

export async function POST(req: Request) {
  try {
    const body: AutofillRequest = await req.json();
    const { field_name, field_context, conversation_context, model_config } = body;

    // Build context summary from conversation
    const contextSummary = conversation_context
      .slice(-10) // Last 10 messages for context
      .map((m) => `${m.role}: ${m.content.slice(0, 500)}`) // Truncate long messages
      .join("\n");

    const model = getModel(
      model_config?.provider || "openai",
      undefined // Always use fast model for autofill
    );

    const { text } = await generateText({
      model,
      maxTokens: 200,
      temperature: 0.3, // Lower temperature for more predictable suggestions
      prompt: `Based on the conversation context, suggest a value for the form field.

Field name: ${field_name}
Field description: ${field_context}

Conversation context:
${contextSummary}

Provide ONLY the suggested value, no explanation or additional text. If you cannot determine a good suggestion based on the context, respond with an empty string.`,
    });

    return Response.json({ suggestion: text.trim() });
  } catch (error) {
    console.error("Autofill error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Autofill failed" },
      { status: 500 }
    );
  }
}
