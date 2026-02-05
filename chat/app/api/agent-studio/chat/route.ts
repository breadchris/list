/**
 * Builder Agent Chat Endpoint
 *
 * Streams responses from the Mastra-powered builder agent.
 */

import { openai } from "@ai-sdk/openai";
import { streamText, type CoreMessage } from "ai";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

interface ChatRequest {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  context: {
    agent_draft: Record<string, unknown> | null;
    workflow_draft: Record<string, unknown> | null;
    tool_draft: Record<string, unknown> | null;
    group_id: string;
    user_id: string;
  };
}

// Builder agent system instructions
const BUILDER_INSTRUCTIONS = `You are an AI Agent Builder assistant. Your role is to help users create, configure, and manage AI agents, tools, and workflows through natural conversation.

## Your Capabilities

You can help users:
1. **Create agents** - Design new AI agents with custom instructions, model configurations, and tools
2. **Manage tools** - Create and configure custom tools for agents
3. **Build workflows** - Design multi-step workflows with branching and parallel execution
4. **Configure settings** - Set up model providers, temperatures, structured output schemas
5. **View and edit** - Browse existing agents, tools, and workflows

## How to Work

When the user describes what they want to build:

1. **Understand their intent** - Ask clarifying questions if needed
2. **Show visual components** - When you need to show interactive UI, include a component marker in this exact format:
   [COMPONENT:{"name":"component-name","props":{...},"instance_id":"unique-id"}]

   Available components:
   - "model-picker" - For model/provider selection (props: provider, model, temperature)
   - "tool-selector" - For choosing tools (props: selected_tool_ids)
   - "instructions-editor" - For writing system prompts (props: instructions)
   - "workflow-editor" - For visual workflow design (props: nodes, edges)
   - "schema-builder" - For structured output configuration (props: schema)
   - "agent-list" - For viewing all agents
   - "tool-list" - For viewing all tools
   - "workflow-list" - For viewing all workflows
   - "trace-list" - For viewing execution logs (props: agent_id optional)
   - "output-config" - For structured output settings (props: enabled, schema)
   - "playground" - For testing/running agents (props: agent_id optional, use_draft boolean)

3. **Guide naturally** - Explain what you're doing and what the user should do next

4. **Confirm before saving** - Always ask for confirmation before creating/updating entities

## Component Format Example

When showing a model picker:
"Let me show you the model configuration options."
[COMPONENT:{"name":"model-picker","props":{"provider":"openai","model":"gpt-4o","temperature":0.7},"instance_id":"mp-001"}]
"You can select your preferred provider and model above."

## Important Rules

- Always show UI components when configuring complex settings
- Generate unique instance_ids for each component (use descriptive prefixes like mp-, ts-, ie-)
- Be conversational and guide users through the process naturally
- Provide reasonable defaults but let users customize
- When editing existing entities, load them first before showing editors`;

/**
 * Build context-aware system message
 */
function buildSystemMessage(context: ChatRequest["context"]): string {
  let contextSection = "\n\n## Current Context\n\n";

  if (context.agent_draft) {
    contextSection += `**Agent Draft:**\n\`\`\`json\n${JSON.stringify(context.agent_draft, null, 2)}\n\`\`\`\n\n`;
  }

  if (context.workflow_draft) {
    contextSection += `**Workflow Draft:**\n\`\`\`json\n${JSON.stringify(context.workflow_draft, null, 2)}\n\`\`\`\n\n`;
  }

  if (context.tool_draft) {
    contextSection += `**Tool Draft:**\n\`\`\`json\n${JSON.stringify(context.tool_draft, null, 2)}\n\`\`\`\n\n`;
  }

  contextSection += `**Session Info:**\n- Group ID: ${context.group_id}\n- User ID: ${context.user_id}\n`;

  return BUILDER_INSTRUCTIONS + contextSection;
}

export async function POST(req: Request) {
  try {
    const body: ChatRequest = await req.json();
    const { messages, context } = body;

    // Build messages array with context-aware system message
    const coreMessages: CoreMessage[] = [
      {
        role: "system",
        content: buildSystemMessage(context),
      },
      ...messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    // Use streamText with GPT-4o for the builder agent
    const result = streamText({
      model: openai("gpt-4o"),
      messages: coreMessages,
      temperature: 0.7,
    });

    // Return streaming response
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Builder chat error:", error);
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
