/**
 * Types for Agent Studio
 * A UI for building AI agents using the Mastra SDK
 */

/**
 * LLM Provider supported by Mastra
 */
export type LLMProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "groq"
  | "together"
  | "fireworks"
  | "perplexity"
  | "cohere"
  | "amazon-bedrock";

/**
 * Model configuration for an agent
 */
export interface AgentModelConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  max_tokens?: number;
  reasoning_config?: {
    enabled: boolean;
    budget_tokens?: number;
  };
  prompt_caching?: boolean;
}

/**
 * Memory configuration for an agent
 */
export interface AgentMemoryConfig {
  message_history?: {
    enabled: boolean;
    max_messages?: number;
  };
  working_memory?: {
    enabled: boolean;
    type: "markdown" | "structured";
    template?: string; // Markdown template
    schema?: Record<string, unknown>; // JSON schema for structured
  };
  semantic_recall?: {
    enabled: boolean;
    top_k?: number;
    message_range?: number;
    vector_store?: string;
    embedder?: string;
  };
}

/**
 * Form behavior configuration for structured output
 */
export interface FormConfig {
  /** Custom label for submit button */
  submit_label?: string;
  /** Show cancel button */
  show_cancel?: boolean;
  /** Enable AI-powered field suggestions */
  allow_ai_suggestions?: boolean;
}

/**
 * Structured output configuration
 */
export interface AgentOutputConfig {
  enabled: boolean;
  schema?: Record<string, unknown>; // JSON Schema
  error_strategy?: "strict" | "warn" | "fallback";
  fallback_value?: unknown;
  /** Form behavior options when rendering structured output */
  form_config?: FormConfig;
}

/**
 * Structured content in a message (for forms, data cards, etc.)
 */
export interface StructuredContent {
  type: "form" | "data_card" | "table";
  schema: Record<string, unknown>;
  data: Record<string, unknown>;
  is_complete: boolean;
}

/**
 * Agent metadata stored in content.metadata
 */
export interface AgentMetadata {
  /** Display description */
  description?: string;
  /** Model configuration */
  model_config: AgentModelConfig;
  /** System instructions (can be string or array) */
  instructions: string | string[];
  /** IDs of tools this agent can use */
  tool_ids: string[];
  /** Memory configuration */
  memory_config?: AgentMemoryConfig;
  /** Structured output configuration */
  output_config?: AgentOutputConfig;
  /** Tags for organization */
  tags?: string[];
  /** Max steps for multi-turn tool usage */
  max_steps?: number;
}

/**
 * An agent stored in content table
 * type: "agent"
 * data: Agent name
 */
export interface Agent {
  id: string;
  created_at: string;
  updated_at: string;
  type: "agent";
  data: string; // Agent name
  group_id: string;
  user_id: string;
  metadata: AgentMetadata;
}

/**
 * Tool input/output schema field
 */
export interface SchemaField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  required?: boolean;
  items?: SchemaField; // For array types
  properties?: SchemaField[]; // For object types
}

/**
 * Tool metadata stored in content.metadata
 */
export interface AgentToolMetadata {
  /** Tool description (helps LLM understand when to use) */
  description: string;
  /** Input schema as JSON Schema */
  input_schema: Record<string, unknown>;
  /** Output schema as JSON Schema */
  output_schema: Record<string, unknown>;
  /** Execute function code */
  execute_code: string;
  /** Whether this is a built-in or custom tool */
  is_builtin?: boolean;
}

/**
 * A tool stored in content table
 * type: "agent-tool"
 * data: Tool name/ID
 */
export interface AgentTool {
  id: string;
  created_at: string;
  updated_at: string;
  type: "agent-tool";
  data: string; // Tool name
  group_id: string;
  user_id: string;
  metadata: AgentToolMetadata;
}

/**
 * Workflow step types
 */
export type WorkflowStepType =
  | "step"
  | "agent"
  | "tool"
  | "branch"
  | "parallel"
  | "foreach"
  | "dowhile"
  | "dountil"
  | "suspend";

/**
 * A node in the workflow graph (React Flow compatible)
 */
export interface WorkflowNode {
  id: string;
  type: WorkflowStepType;
  position: { x: number; y: number };
  data: {
    label: string;
    /** For agent steps */
    agent_id?: string;
    /** For tool steps */
    tool_id?: string;
    /** Input mapping expression */
    input_mapping?: string;
    /** Branch conditions */
    conditions?: Array<{
      id: string;
      expression: string;
      target_node_id: string;
    }>;
    /** Loop condition */
    loop_condition?: string;
    /** ForEach concurrency */
    concurrency?: number;
    /** Suspend reason template */
    suspend_reason?: string;
    /** Resume schema (JSON Schema) */
    resume_schema?: Record<string, unknown>;
  };
}

/**
 * An edge in the workflow graph (React Flow compatible)
 */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  source_handle?: string;
  target_handle?: string;
  label?: string;
}

/**
 * Workflow graph structure
 */
export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

/**
 * Workflow metadata stored in content.metadata
 */
export interface AgentWorkflowMetadata {
  /** Workflow description */
  description?: string;
  /** React Flow graph data */
  graph: WorkflowGraph;
  /** Input schema (JSON Schema) */
  input_schema?: Record<string, unknown>;
  /** Output schema (JSON Schema) */
  output_schema?: Record<string, unknown>;
}

/**
 * A workflow stored in content table
 * type: "agent-workflow"
 * data: Workflow name
 */
export interface AgentWorkflow {
  id: string;
  created_at: string;
  updated_at: string;
  type: "agent-workflow";
  data: string; // Workflow name
  group_id: string;
  user_id: string;
  metadata: AgentWorkflowMetadata;
}

/**
 * Knowledge collection configuration
 */
export interface CollectionConfig {
  vector_store: "pgvector" | "pinecone" | "qdrant" | "mongodb";
  embedder: "openai" | "google" | "fastembed";
  chunk_size: number;
  chunk_overlap: number;
  chunk_strategy: "recursive" | "sentence" | "paragraph";
}

/**
 * Collection metadata stored in content.metadata
 */
export interface AgentCollectionMetadata {
  /** Collection description */
  description?: string;
  /** Chunking and embedding configuration */
  config: CollectionConfig;
  /** Number of documents in collection */
  document_count?: number;
  /** Number of chunks in collection */
  chunk_count?: number;
}

/**
 * A knowledge collection stored in content table
 * type: "agent-collection"
 * data: Collection name
 */
export interface AgentCollection {
  id: string;
  created_at: string;
  updated_at: string;
  type: "agent-collection";
  data: string; // Collection name
  group_id: string;
  user_id: string;
  metadata: AgentCollectionMetadata;
}

/**
 * A document chunk with embedding
 * type: "agent-chunk"
 * data: Chunk text
 */
export interface AgentChunk {
  id: string;
  created_at: string;
  type: "agent-chunk";
  data: string; // Chunk text
  group_id: string;
  user_id: string;
  parent_content_id: string; // Collection ID
  metadata: {
    chunk_index: number;
    embedding?: number[];
    source_content_id?: string; // Original document
    source_filename?: string;
  };
}

/**
 * Trace message
 */
export interface TraceMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: string;
  tool_call_id?: string;
}

/**
 * Tool call in a trace
 */
export interface TraceToolCall {
  id: string;
  tool_name: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  duration_ms: number;
  error?: string;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Trace metadata stored in content.metadata
 */
export interface AgentTraceMetadata {
  /** Agent ID this trace belongs to */
  agent_id: string;
  /** Conversation messages */
  messages: TraceMessage[];
  /** Tool calls made during execution */
  tool_calls?: TraceToolCall[];
  /** Token usage statistics */
  token_usage?: TokenUsage;
  /** Total execution duration in ms */
  duration_ms?: number;
  /** Execution status */
  status: "success" | "error" | "pending";
  /** Error message if status is error */
  error?: string;
}

/**
 * An execution trace stored in content table
 * type: "agent-trace"
 * data: Agent name (for display)
 */
export interface AgentTrace {
  id: string;
  created_at: string;
  type: "agent-trace";
  data: string; // Agent name for display
  group_id: string;
  user_id: string;
  parent_content_id: string; // Agent ID
  metadata: AgentTraceMetadata;
}

/**
 * Content types for agent studio storage
 */
export const AGENT_CONTENT_TYPE = "agent" as const;
export const AGENT_TOOL_CONTENT_TYPE = "agent-tool" as const;
export const AGENT_WORKFLOW_CONTENT_TYPE = "agent-workflow" as const;
export const AGENT_COLLECTION_CONTENT_TYPE = "agent-collection" as const;
export const AGENT_CHUNK_CONTENT_TYPE = "agent-chunk" as const;
export const AGENT_TRACE_CONTENT_TYPE = "agent-trace" as const;

/**
 * Default model configurations
 */
export const DEFAULT_MODEL_CONFIGS: Record<LLMProvider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-opus-20240229",
    "claude-3-haiku-20240307",
  ],
  google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
  mistral: ["mistral-large-latest", "mistral-medium", "mistral-small"],
  groq: ["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  together: ["meta-llama/Llama-3-70b-chat-hf", "mistralai/Mixtral-8x7B-Instruct-v0.1"],
  fireworks: ["accounts/fireworks/models/llama-v3p1-70b-instruct"],
  perplexity: ["llama-3.1-sonar-large-128k-online", "llama-3.1-sonar-small-128k-online"],
  cohere: ["command-r-plus", "command-r", "command"],
  "amazon-bedrock": [
    "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "anthropic.claude-3-opus-20240229-v1:0",
  ],
};

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_METADATA: AgentMetadata = {
  model_config: {
    provider: "openai",
    model: "gpt-4o",
    temperature: 0.7,
  },
  instructions: "You are a helpful AI assistant.",
  tool_ids: [],
  max_steps: 5,
};

/**
 * Default collection configuration
 */
export const DEFAULT_COLLECTION_CONFIG: CollectionConfig = {
  vector_store: "pgvector",
  embedder: "openai",
  chunk_size: 512,
  chunk_overlap: 50,
  chunk_strategy: "recursive",
};

// ============================================
// Workflow Execution Types
// ============================================

/**
 * Result of a single workflow step execution
 */
export interface WorkflowStepResult {
  node_id: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  started_at?: string;
  completed_at?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  /** For streaming agent responses */
  streaming_content?: string;
}

/**
 * Context passed between workflow steps during execution
 */
export interface WorkflowExecutionContext {
  /** The trigger input that started the workflow */
  trigger: {
    input: string;
    started_at: string;
  };
  /** Results from each executed step, keyed by node ID */
  steps: Record<string, WorkflowStepResult>;
}

/**
 * Overall workflow execution state
 */
export interface WorkflowExecutionState {
  status: "idle" | "running" | "completed" | "failed";
  started_at?: string;
  completed_at?: string;
  context: WorkflowExecutionContext;
  current_node_id?: string;
  /** Node IDs in execution order (topologically sorted) */
  execution_order: string[];
  error?: string;
}

// ============================================
// Builder Chat Types (Chat-First Agent Studio)
// ============================================

/**
 * Embedded component names that can be rendered in chat
 */
export type EmbeddedComponentName =
  | "model-picker"
  | "tool-selector"
  | "workflow-editor"
  | "schema-builder"
  | "agent-list"
  | "tool-list"
  | "workflow-list"
  | "knowledge-list"
  | "trace-list"
  | "instructions-editor"
  | "output-config"
  | "playground";

/**
 * Component embed data returned by builder agent tools
 */
export interface ComponentEmbed {
  /** Component name to render */
  name: EmbeddedComponentName;
  /** Props to pass to the component */
  props: Record<string, unknown>;
  /** Unique instance ID for state tracking */
  instance_id: string;
}

/**
 * Action result from builder agent tools
 */
export interface ActionResult {
  /** Type of action performed */
  type: "agent_created" | "agent_updated" | "agent_deleted" |
        "tool_created" | "tool_updated" | "tool_deleted" |
        "workflow_created" | "workflow_updated" | "workflow_deleted" |
        "collection_created" | "document_uploaded";
  /** ID of the affected entity */
  entity_id: string;
  /** Name of the affected entity */
  entity_name: string;
}

/**
 * Message types in the builder chat
 */
export type BuilderMessageType = "text" | "component" | "action" | "error";

/**
 * A message in the builder chat conversation
 */
export interface BuilderMessage {
  /** Unique message ID */
  id: string;
  /** Message role */
  role: "user" | "assistant";
  /** Message type determines rendering */
  type: BuilderMessageType;
  /** Text content of the message */
  content: string;
  /** Timestamp */
  timestamp: Date;
  /** Is the message currently streaming */
  is_streaming?: boolean;
  /** Component embed data (for type: "component") */
  component?: ComponentEmbed;
  /** Action result data (for type: "action") */
  action?: ActionResult;
  /** Error message (for type: "error") */
  error?: string;
}

/**
 * Builder context state for the chat session
 */
export interface BuilderContextState {
  /** Current agent draft being configured */
  agent_draft: Partial<AgentMetadata> | null;
  /** Current workflow draft being configured */
  workflow_draft: Partial<AgentWorkflowMetadata> | null;
  /** Current tool draft being configured */
  tool_draft: Partial<AgentToolMetadata> | null;
  /** Component states for bidirectional sync (instance_id -> state) */
  component_states: Record<string, unknown>;
  /** Session group ID */
  group_id: string;
  /** Session user ID */
  user_id: string;
  /** Whether there are unsaved changes */
  is_dirty: boolean;
  /** ID of the agent being edited (if editing existing) */
  editing_agent_id?: string;
  /** ID of the workflow being edited (if editing existing) */
  editing_workflow_id?: string;
}

/**
 * Builder context actions
 */
export interface BuilderContextActions {
  /** Update the current agent draft */
  updateAgentDraft: (updates: Partial<AgentMetadata>) => void;
  /** Update the current workflow draft */
  updateWorkflowDraft: (updates: Partial<AgentWorkflowMetadata>) => void;
  /** Update the current tool draft */
  updateToolDraft: (updates: Partial<AgentToolMetadata>) => void;
  /** Set component state by instance ID */
  setComponentState: (instanceId: string, state: unknown) => void;
  /** Get component state by instance ID */
  getComponentState: (instanceId: string) => unknown;
  /** Clear all drafts */
  clearDrafts: () => void;
  /** Save current agent draft to database */
  saveAgent: () => Promise<Agent>;
  /** Save current workflow draft to database */
  saveWorkflow: () => Promise<AgentWorkflow>;
  /** Load an existing agent into context */
  loadAgent: (agentId: string) => Promise<void>;
  /** Load an existing workflow into context */
  loadWorkflow: (workflowId: string) => Promise<void>;
}
