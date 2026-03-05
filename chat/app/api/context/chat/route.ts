import { openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";

export const maxDuration = 60;

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  sessionId?: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  persona: {
    id: string;
    name: string;
    role: string;
    systemPrompt: string;
  };
  constraints?: Record<string, string>;
  sessionId?: string;
  recentTimeline?: Array<{ content: string; tags?: string[] }>;
  editorContent?: string;
}

const tools = {
  add_idea_to_timeline: tool({
    description:
      "Extracts an idea, thought, or USER QUESTION from the conversation and adds it to the timeline.",
    inputSchema: z.object({
      content: z.string().describe("The idea or question content."),
      tags: z.array(z.string()).optional().describe("Relevant tags"),
    }),
  }),
  update_constraints: tool({
    description: "Updates session constraints (topic, audience, tone, etc.).",
    inputSchema: z.object({
      updates: z
        .record(z.string())
        .describe(
          "Key-value constraint updates. Empty string removes a constraint."
        ),
    }),
  }),
  update_editor: tool({
    description:
      "Appends text to the collaborative editor. Only use when explicitly asked.",
    inputSchema: z.object({
      content: z.string().describe("Markdown content to append."),
    }),
  }),
  write_wiki_page: tool({
    description:
      "Propose a wiki page create/update. Shows confirmation UI to user.",
    inputSchema: z.object({
      path: z
        .string()
        .describe("Hierarchical page path (e.g. 'projects/marketing')."),
      content: z.string().describe("Page content."),
    }),
  }),
  generate_recipe: tool({
    description: "Generate a structured recipe card.",
    inputSchema: z.object({
      title: z.string(),
      description: z.string().optional(),
      prepTime: z.string(),
      cookTime: z.string(),
      servings: z.number().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      calories: z.number().optional(),
      ingredients: z.array(
        z.object({
          item: z.string(),
          quantity: z.string(),
          unit: z.string().optional(),
        })
      ),
      instructions: z.array(
        z.object({
          step: z.number(),
          text: z.string(),
        })
      ),
    }),
  }),
  ask_structured_question: tool({
    description:
      "Present structured questions to the user with multiple-choice options.",
    inputSchema: z.object({
      title: z.string().optional(),
      questions: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          options: z.array(
            z.object({
              id: z.string(),
              label: z.string(),
              description: z.string().optional(),
            })
          ),
          allowCustomInput: z.boolean().optional(),
        })
      ),
    }),
  }),
  add_flow_node: tool({
    description: "Add a node to the flow chart.",
    inputSchema: z.object({
      label: z.string(),
      type: z.enum(["default", "input", "output"]).optional(),
    }),
  }),
  connect_flow_nodes: tool({
    description: "Connect two flow chart nodes.",
    inputSchema: z.object({
      sourceLabel: z.string(),
      targetLabel: z.string(),
      label: z.string().optional(),
    }),
  }),
  layout_flow_nodes: tool({
    description: "Auto-layout flow chart nodes.",
    inputSchema: z.object({
      direction: z.enum(["TB", "LR"]),
    }),
  }),
};

function buildSystemPrompt(
  persona: ChatRequestBody["persona"],
  constraints: Record<string, string>,
  recentTimeline: Array<{ content: string; tags?: string[] }>,
  editorContent?: string
): string {
  const base = persona?.systemPrompt || "You are a helpful assistant.";

  const thoughts = (recentTimeline || [])
    .slice(0, 15)
    .map((t) => `- ${t.content}`);

  const constraintLines =
    Object.entries(constraints).length > 0
      ? `CURRENT CONSTRAINTS:\n${Object.entries(constraints)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}`
      : "";

  return `${base}

IMPORTANT: You are a thinking partner helping build a timeline of thoughts.
1. Save user ideas to the timeline using add_idea_to_timeline.
2. CRITICAL: When the USER asks a question, save it to the timeline too.
3. Do NOT save your own AI questions to the timeline.
4. Check RECENT TIMELINE ENTRIES to avoid duplicates.
5. Only use update_editor when explicitly asked.
6. Only use write_wiki_page when explicitly asked.
7. Maintain constraints via update_constraints when context changes.

${thoughts.length > 0 ? `RECENT TIMELINE ENTRIES:\n${thoughts.join("\n")}` : ""}
${editorContent ? `\nCURRENT EDITOR CONTENT:\n${editorContent}` : ""}
${constraintLines ? `\n${constraintLines}` : ""}

*** RESPONSE FORMATTING ***
Use markdown links for key terms: [Term](#). Aim for 5-10 links per message.
Create a Wikipedia-style reading experience with linkified concepts.`;
}

export async function POST(req: Request) {
  try {
    const body: ChatRequestBody = await req.json();
    const {
      messages,
      persona,
      constraints = {},
      recentTimeline = [],
      editorContent,
    } = body;

    const systemPrompt = buildSystemPrompt(
      persona,
      constraints,
      recentTimeline,
      editorContent
    );

    const recentMessages = (messages || []).slice(-20).map((m) => ({
      role: (m.sender === "user" ? "user" : "assistant") as
        | "user"
        | "assistant",
      content: m.text || "(empty)",
    }));

    const result = await generateText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages: recentMessages,
      tools,
    });

    // Process tool calls
    const newEntries: Array<{
      id: string;
      content: string;
      timestamp: string;
      tags: string[];
      personaId?: string;
    }> = [];
    let structuredQuestion: any = null;
    let editorUpdate: string | null = null;
    let wikiAction: { path: string; content: string } | null = null;
    let constraintsUpdate: Record<string, string> | null = null;
    let recipe: any = null;
    const flowActions: Array<Record<string, unknown>> = [];
    let hasClientInteraction = false;

    if (result.toolCalls && result.toolCalls.length > 0) {
      for (const toolCall of result.toolCalls) {
        const input = toolCall.input as any;
        switch (toolCall.toolName) {
          case "add_idea_to_timeline": {
            newEntries.push({
              id: crypto.randomUUID(),
              content: input.content,
              timestamp: new Date().toISOString(),
              tags: input.tags || [persona?.role || "general"],
              personaId: persona?.id,
            });
            break;
          }
          case "update_constraints": {
            const updates = input.updates;
            if (updates) {
              const merged = { ...constraints };
              for (const [key, value] of Object.entries(updates)) {
                if (value === "" || value === null) delete merged[key];
                else merged[key] = value as string;
              }
              constraintsUpdate = merged;
              hasClientInteraction = true;
            }
            break;
          }
          case "update_editor":
            editorUpdate = input.content;
            hasClientInteraction = true;
            break;
          case "write_wiki_page":
            wikiAction = {
              path: input.path,
              content: input.content,
            };
            hasClientInteraction = true;
            break;
          case "generate_recipe":
            recipe = input;
            hasClientInteraction = true;
            break;
          case "ask_structured_question":
            structuredQuestion = {
              ...input,
              id: crypto.randomUUID(),
            };
            hasClientInteraction = true;
            break;
          case "add_flow_node":
          case "connect_flow_nodes":
          case "layout_flow_nodes":
            flowActions.push({
              type: toolCall.toolName,
              ...input,
            });
            hasClientInteraction = true;
            break;
        }
      }
    }

    let reply = result.text;

    // Second call if tools were data-only (no client interaction) and no text reply
    if (result.toolCalls?.length && !hasClientInteraction && !reply) {
      const secondResult = await generateText({
        model: openai("gpt-4o"),
        system: systemPrompt,
        messages: [
          ...recentMessages,
          {
            role: "assistant" as const,
            content: result.toolCalls.map((tc) => ({
              type: "tool-call" as const,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              input: tc.input,
            })),
          },
          ...result.toolCalls.map((tc) => ({
            role: "tool" as const,
            content: [
              {
                type: "tool-result" as const,
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                output: { type: "text" as const, value: "success" },
              },
            ],
          })),
        ] as any,
      });
      reply = secondResult.text;
    }

    return Response.json({
      reply: reply || "",
      newEntries,
      structuredQuestion,
      editorUpdate,
      wikiAction,
      constraints: constraintsUpdate,
      recipe,
      flowActions: flowActions.length > 0 ? flowActions : null,
    });
  } catch (e: any) {
    console.error("Context chat error:", e);
    return Response.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}
