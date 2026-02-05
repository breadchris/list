import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText, streamObject, type CoreMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { LLMProvider, TraceMessage, AgentOutputConfig } from "@/types/agent-studio";
import { jsonSchemaToZod } from "@/lib/agent-studio/json-to-zod";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ExecuteRequest {
  agent_id: string;
  message: string;
  config: {
    name: string;
    instructions: string;
    model_config: {
      provider: LLMProvider;
      model: string;
      temperature: number;
    };
    output_config?: AgentOutputConfig;
  };
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  // Optional: for trace logging
  group_id?: string;
  user_id?: string;
  // Form submission from previous structured output
  form_submission?: {
    schema_id: string;
    values: Record<string, unknown>;
  };
}

/**
 * Get the AI model based on provider and model name
 * Currently supports OpenAI and Anthropic. Other providers fall back to OpenAI.
 */
function getModel(provider: LLMProvider, modelName: string) {
  switch (provider) {
    case "openai":
      return openai(modelName);
    case "anthropic":
      return anthropic(modelName);
    // For other providers, fall back to OpenAI for now
    // These would need additional SDK packages to support:
    // - @ai-sdk/google for Google
    // - @ai-sdk/mistral for Mistral
    // etc.
    default:
      console.warn(
        `Provider ${provider} not yet supported, falling back to OpenAI gpt-4o`
      );
      return openai("gpt-4o");
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const body: ExecuteRequest = await req.json();
    const { agent_id, message, config, history, group_id, user_id, form_submission } = body;

    // Determine if we should use structured output
    const useStructuredOutput =
      config.output_config?.enabled &&
      config.output_config?.schema &&
      Object.keys(config.output_config.schema).length > 0;

    // Build the user message content (include form submission if present)
    let userMessageContent = message;
    if (form_submission) {
      userMessageContent = `[Form Submitted]\n${JSON.stringify(form_submission.values, null, 2)}\n\nUser message: ${message}`;
    }

    // Build messages array
    const messages: CoreMessage[] = [
      // System message with instructions
      {
        role: "system",
        content: useStructuredOutput
          ? `${config.instructions}\n\nIMPORTANT: You must respond with structured data matching the provided schema. Do not include any text outside the JSON structure.`
          : config.instructions,
      },
      // History
      ...history.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      // Current user message
      {
        role: "user" as const,
        content: userMessageContent,
      },
    ];

    // Get the model
    const model = getModel(
      config.model_config.provider,
      config.model_config.model
    );

    if (useStructuredOutput) {
      // Use streamObject for structured output
      const zodSchema = jsonSchemaToZod(config.output_config!.schema!);

      const result = streamObject({
        model,
        schema: zodSchema,
        messages,
        temperature: config.model_config.temperature,
        onFinish: async ({ object, usage }) => {
          // Log trace for structured output
          if (group_id && user_id) {
            try {
              const durationMs = Date.now() - startTime;

              const traceMessages: TraceMessage[] = [
                ...history.map((msg) => ({
                  role: msg.role as "user" | "assistant",
                  content: msg.content,
                  timestamp: new Date().toISOString(),
                })),
                {
                  role: "user" as const,
                  content: userMessageContent,
                  timestamp: new Date().toISOString(),
                },
                {
                  role: "assistant" as const,
                  content: JSON.stringify(object),
                  timestamp: new Date().toISOString(),
                },
              ];

              await supabase.from("content").insert({
                type: "agent-trace",
                data: config.name,
                group_id,
                user_id,
                parent_content_id: agent_id,
                metadata: {
                  agent_id,
                  messages: traceMessages,
                  token_usage: usage ? {
                    prompt_tokens: usage.promptTokens,
                    completion_tokens: usage.completionTokens,
                    total_tokens: usage.totalTokens,
                  } : undefined,
                  duration_ms: durationMs,
                  status: "success",
                  output_type: "structured",
                },
              });
            } catch (traceError) {
              console.error("Error logging trace:", traceError);
            }
          }
        },
      });

      // Return streaming response with structured output header
      const response = result.toTextStreamResponse();
      response.headers.set("X-Output-Mode", "structured");
      return response;
    }

    // Use streamText for regular text output
    const result = streamText({
      model,
      messages,
      temperature: config.model_config.temperature,
      onFinish: async ({ text, usage }) => {
        // Log trace if group_id and user_id are provided
        if (group_id && user_id) {
          try {
            const durationMs = Date.now() - startTime;

            // Build trace messages
            const traceMessages: TraceMessage[] = [
              ...history.map((msg) => ({
                role: msg.role as "user" | "assistant",
                content: msg.content,
                timestamp: new Date().toISOString(),
              })),
              {
                role: "user" as const,
                content: userMessageContent,
                timestamp: new Date().toISOString(),
              },
              {
                role: "assistant" as const,
                content: text,
                timestamp: new Date().toISOString(),
              },
            ];

            await supabase.from("content").insert({
              type: "agent-trace",
              data: config.name,
              group_id,
              user_id,
              parent_content_id: agent_id,
              metadata: {
                agent_id,
                messages: traceMessages,
                token_usage: usage ? {
                  prompt_tokens: usage.promptTokens,
                  completion_tokens: usage.completionTokens,
                  total_tokens: usage.totalTokens,
                } : undefined,
                duration_ms: durationMs,
                status: "success",
              },
            });
          } catch (traceError) {
            console.error("Error logging trace:", traceError);
            // Don't fail the request if trace logging fails
          }
        }
      },
    });

    // Return streaming response
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Agent execution error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
