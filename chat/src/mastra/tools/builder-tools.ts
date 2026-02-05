/**
 * Builder Agent Tools
 *
 * Tools for the chat-first Agent Studio builder agent.
 * These tools allow the agent to:
 * - Display UI components inline in the chat
 * - Perform CRUD operations on agents, tools, and workflows
 * - Manage the current draft context
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// ============================================================================
// Component Display Tools
// ============================================================================

export const showModelPicker = createTool({
  id: "show_model_picker",
  description:
    "Display an interactive model selection component. Use when the user wants to choose or configure the LLM provider, model, or temperature settings.",
  inputSchema: z.object({
    current_provider: z
      .string()
      .optional()
      .describe("Current provider (e.g., openai, anthropic)"),
    current_model: z
      .string()
      .optional()
      .describe("Current model name"),
    current_temperature: z
      .number()
      .optional()
      .describe("Current temperature value (0-2)"),
  }),
  outputSchema: z.object({
    component: z.literal("model-picker"),
    props: z.record(z.unknown()),
    instance_id: z.string(),
  }),
  execute: async (input) => ({
    component: "model-picker" as const,
    props: {
      provider: input.current_provider || "openai",
      model: input.current_model || "gpt-4o",
      temperature: input.current_temperature || 0.7,
    },
    instance_id: crypto.randomUUID(),
  }),
});

export const showToolSelector = createTool({
  id: "show_tool_selector",
  description:
    "Display a tool selection interface. Use when the user wants to add, remove, or view tools for an agent.",
  inputSchema: z.object({
    selected_tool_ids: z
      .array(z.string())
      .optional()
      .describe("Currently selected tool IDs"),
  }),
  outputSchema: z.object({
    component: z.literal("tool-selector"),
    props: z.record(z.unknown()),
    instance_id: z.string(),
  }),
  execute: async (input) => ({
    component: "tool-selector" as const,
    props: {
      selected_tool_ids: input.selected_tool_ids || [],
    },
    instance_id: crypto.randomUUID(),
  }),
});

export const showWorkflowEditor = createTool({
  id: "show_workflow_editor",
  description:
    "Display the visual workflow editor. Use when the user wants to create or edit a multi-step workflow with agents and tools.",
  inputSchema: z.object({
    initial_nodes: z
      .array(z.record(z.unknown()))
      .optional()
      .describe("Initial workflow nodes"),
    initial_edges: z
      .array(z.record(z.unknown()))
      .optional()
      .describe("Initial workflow edges"),
  }),
  outputSchema: z.object({
    component: z.literal("workflow-editor"),
    props: z.record(z.unknown()),
    instance_id: z.string(),
  }),
  execute: async (input) => ({
    component: "workflow-editor" as const,
    props: {
      nodes: input.initial_nodes || [],
      edges: input.initial_edges || [],
    },
    instance_id: crypto.randomUUID(),
  }),
});

export const showSchemaBuilder = createTool({
  id: "show_schema_builder",
  description:
    "Display a JSON Schema builder for structured output. Use when the user wants to define the output format for an agent.",
  inputSchema: z.object({
    initial_schema: z
      .record(z.unknown())
      .optional()
      .describe("Initial JSON Schema"),
  }),
  outputSchema: z.object({
    component: z.literal("schema-builder"),
    props: z.record(z.unknown()),
    instance_id: z.string(),
  }),
  execute: async (input) => ({
    component: "schema-builder" as const,
    props: {
      schema: input.initial_schema || {},
    },
    instance_id: crypto.randomUUID(),
  }),
});

export const showAgentList = createTool({
  id: "show_agent_list",
  description:
    "Display a list of all agents in the current group. Use when the user wants to see, edit, or manage their existing agents.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    component: z.literal("agent-list"),
    props: z.record(z.unknown()),
    instance_id: z.string(),
  }),
  execute: async () => ({
    component: "agent-list" as const,
    props: {},
    instance_id: crypto.randomUUID(),
  }),
});

export const showToolList = createTool({
  id: "show_tool_list",
  description:
    "Display a list of all tools in the current group. Use when the user wants to see, edit, or manage their custom tools.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    component: z.literal("tool-list"),
    props: z.record(z.unknown()),
    instance_id: z.string(),
  }),
  execute: async () => ({
    component: "tool-list" as const,
    props: {},
    instance_id: crypto.randomUUID(),
  }),
});

export const showWorkflowList = createTool({
  id: "show_workflow_list",
  description:
    "Display a list of all workflows in the current group. Use when the user wants to see or manage their workflows.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    component: z.literal("workflow-list"),
    props: z.record(z.unknown()),
    instance_id: z.string(),
  }),
  execute: async () => ({
    component: "workflow-list" as const,
    props: {},
    instance_id: crypto.randomUUID(),
  }),
});

export const showInstructions = createTool({
  id: "show_instructions",
  description:
    "Display an instructions editor. Use when the user wants to write or edit the system prompt/instructions for an agent.",
  inputSchema: z.object({
    current_instructions: z
      .string()
      .optional()
      .describe("Current instructions text"),
  }),
  outputSchema: z.object({
    component: z.literal("instructions-editor"),
    props: z.record(z.unknown()),
    instance_id: z.string(),
  }),
  execute: async (input) => ({
    component: "instructions-editor" as const,
    props: {
      instructions: input.current_instructions || "",
    },
    instance_id: crypto.randomUUID(),
  }),
});

export const showOutputConfig = createTool({
  id: "show_output_config",
  description:
    "Display structured output configuration. Use when the user wants to enable or configure structured output (forms, cards) for an agent.",
  inputSchema: z.object({
    enabled: z.boolean().optional(),
    schema: z.record(z.unknown()).optional(),
  }),
  outputSchema: z.object({
    component: z.literal("output-config"),
    props: z.record(z.unknown()),
    instance_id: z.string(),
  }),
  execute: async (input) => ({
    component: "output-config" as const,
    props: {
      enabled: input.enabled || false,
      schema: input.schema || {},
    },
    instance_id: crypto.randomUUID(),
  }),
});

export const showLogs = createTool({
  id: "show_logs",
  description:
    "Display execution traces and logs. Use when the user wants to see recent agent runs, debug issues, or view performance metrics.",
  inputSchema: z.object({
    agent_id: z.string().optional().describe("Filter by agent ID"),
  }),
  outputSchema: z.object({
    component: z.literal("trace-list"),
    props: z.record(z.unknown()),
    instance_id: z.string(),
  }),
  execute: async (input) => ({
    component: "trace-list" as const,
    props: {
      agent_id: input.agent_id,
    },
    instance_id: crypto.randomUUID(),
  }),
});

// ============================================================================
// CRUD Tools
// ============================================================================

export const createAgent = createTool({
  id: "create_agent",
  description:
    "Create and persist a new agent to the database. Use after the user has configured the agent and confirmed they want to save it.",
  inputSchema: z.object({
    name: z.string().describe("Agent name"),
    description: z.string().optional().describe("Agent description"),
    instructions: z.string().describe("Agent system prompt/instructions"),
    model_config: z
      .object({
        provider: z.string(),
        model: z.string(),
        temperature: z.number().optional(),
      })
      .describe("Model configuration"),
    tool_ids: z.array(z.string()).optional().describe("Tool IDs to attach"),
    output_config: z
      .object({
        enabled: z.boolean(),
        schema: z.record(z.unknown()).optional(),
      })
      .optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    agent_id: z.string().optional(),
    message: z.string(),
  }),
  execute: async (input) => {
    // This will be implemented to call agentRepository.createAgent()
    // For now, return a placeholder
    return {
      success: true,
      agent_id: crypto.randomUUID(),
      message: `Agent "${input.name}" created successfully`,
    };
  },
});

export const updateAgent = createTool({
  id: "update_agent",
  description:
    "Update an existing agent in the database. Use when the user wants to save changes to an agent they're editing.",
  inputSchema: z.object({
    agent_id: z.string().describe("Agent ID to update"),
    name: z.string().optional(),
    description: z.string().optional(),
    instructions: z.string().optional(),
    model_config: z
      .object({
        provider: z.string(),
        model: z.string(),
        temperature: z.number().optional(),
      })
      .optional(),
    tool_ids: z.array(z.string()).optional(),
    output_config: z
      .object({
        enabled: z.boolean(),
        schema: z.record(z.unknown()).optional(),
      })
      .optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async (input) => {
    return {
      success: true,
      message: `Agent updated successfully`,
    };
  },
});

export const deleteAgent = createTool({
  id: "delete_agent",
  description:
    "Delete an agent from the database. Use when the user explicitly confirms they want to delete an agent.",
  inputSchema: z.object({
    agent_id: z.string().describe("Agent ID to delete"),
    confirm: z
      .boolean()
      .describe("Must be true to confirm deletion"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async (input) => {
    if (!input.confirm) {
      return {
        success: false,
        message: "Deletion not confirmed. Please confirm to delete.",
      };
    }
    return {
      success: true,
      message: "Agent deleted successfully",
    };
  },
});

export const createCustomTool = createTool({
  id: "create_custom_tool",
  description:
    "Create a new custom tool. Use when the user wants to define a new tool for their agents.",
  inputSchema: z.object({
    name: z.string().describe("Tool name"),
    description: z.string().describe("Tool description"),
    input_schema: z.record(z.unknown()).describe("Tool input JSON Schema"),
    output_schema: z.record(z.unknown()).describe("Tool output JSON Schema"),
    execute_code: z.string().describe("Tool execution code"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    tool_id: z.string().optional(),
    message: z.string(),
  }),
  execute: async (input) => {
    return {
      success: true,
      tool_id: crypto.randomUUID(),
      message: `Tool "${input.name}" created successfully`,
    };
  },
});

export const createWorkflow = createTool({
  id: "create_workflow",
  description:
    "Create and persist a new workflow to the database. Use after the user has designed the workflow and confirmed they want to save it.",
  inputSchema: z.object({
    name: z.string().describe("Workflow name"),
    description: z.string().optional(),
    nodes: z.array(z.record(z.unknown())).describe("Workflow nodes"),
    edges: z.array(z.record(z.unknown())).describe("Workflow edges"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    workflow_id: z.string().optional(),
    message: z.string(),
  }),
  execute: async (input) => {
    return {
      success: true,
      workflow_id: crypto.randomUUID(),
      message: `Workflow "${input.name}" created successfully`,
    };
  },
});

// ============================================================================
// Context Tools
// ============================================================================

export const loadAgent = createTool({
  id: "load_agent",
  description:
    "Load an existing agent into the builder context for editing. Use when the user wants to edit a specific agent.",
  inputSchema: z.object({
    agent_id: z.string().describe("Agent ID to load"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    agent: z.record(z.unknown()).optional(),
    message: z.string(),
  }),
  execute: async (input) => {
    // This will be implemented to call agentRepository.getAgent()
    return {
      success: true,
      agent: {},
      message: `Agent loaded into context`,
    };
  },
});

export const updateDraft = createTool({
  id: "update_draft",
  description:
    "Update the current agent draft without persisting to the database. Use to track configuration changes during the conversation.",
  inputSchema: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    instructions: z.string().optional(),
    model_config: z
      .object({
        provider: z.string(),
        model: z.string(),
        temperature: z.number().optional(),
      })
      .optional(),
    tool_ids: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async () => {
    return {
      success: true,
      message: "Draft updated",
    };
  },
});

export const clearDraft = createTool({
  id: "clear_draft",
  description:
    "Clear the current draft and start fresh. Use when the user wants to abandon current changes and start over.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async () => {
    return {
      success: true,
      message: "Draft cleared",
    };
  },
});

// ============================================================================
// Export all tools
// ============================================================================

export const builderTools = {
  // Component display
  showModelPicker,
  showToolSelector,
  showWorkflowEditor,
  showSchemaBuilder,
  showAgentList,
  showToolList,
  showWorkflowList,
  showInstructions,
  showOutputConfig,
  showLogs,
  // CRUD
  createAgent,
  updateAgent,
  deleteAgent,
  createCustomTool,
  createWorkflow,
  // Context
  loadAgent,
  updateDraft,
  clearDraft,
};
