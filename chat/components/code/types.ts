/**
 * Type definitions for the Code app
 * TSX Component Generator with Claude Code
 */

// Session stored in Supabase content table
export interface CodeSession {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
  type: "code_session";
  data: string; // Session name
  metadata: CodeSessionMetadata;
}

export interface CodeSessionMetadata {
  versions: TsxVersion[];
  last_prompt?: string;
  claude_session_id?: string; // For session continuation
  messages?: CodeMessage[]; // Full chat history for reload
}

// Component version
export interface TsxVersion {
  id: string;
  timestamp: string;
  prompt: string;
  tsx_code: string;
  compiled_js: string;
  filename: string;
  error?: string;
}

// Chat message types (adapted from claude-code-webui)
export type CodeMessageType =
  | "user"
  | "assistant"
  | "thinking"
  | "tool"
  | "tool_result"
  | "system"
  | "error";

export interface BaseCodeMessage {
  id: string;
  timestamp: string;
}

export interface AttachedImage {
  id: string;
  url: string;
  filename?: string;
}

export interface UserMessage extends BaseCodeMessage {
  type: "user";
  content: string;
  images?: AttachedImage[]; // Attached images with URLs for display
}

export interface AssistantMessage extends BaseCodeMessage {
  type: "assistant";
  content: string;
  tsx_code?: string; // Extracted TSX if present
  filename?: string;
}

export interface ThinkingMessage extends BaseCodeMessage {
  type: "thinking";
  content: string;
}

export interface ToolMessage extends BaseCodeMessage {
  type: "tool";
  tool_name: string;
  input: Record<string, unknown>;
}

export interface ToolResultMessage extends BaseCodeMessage {
  type: "tool_result";
  tool_name: string;
  output: string;
  is_error?: boolean;
}

export interface SystemMessage extends BaseCodeMessage {
  type: "system";
  content: string;
}

export interface ErrorMessage extends BaseCodeMessage {
  type: "error";
  content: string;
}

export type CodeMessage =
  | UserMessage
  | AssistantMessage
  | ThinkingMessage
  | ToolMessage
  | ToolResultMessage
  | SystemMessage
  | ErrorMessage;

// Type guards
export function isUserMessage(msg: CodeMessage): msg is UserMessage {
  return msg.type === "user";
}

export function isAssistantMessage(msg: CodeMessage): msg is AssistantMessage {
  return msg.type === "assistant";
}

export function isThinkingMessage(msg: CodeMessage): msg is ThinkingMessage {
  return msg.type === "thinking";
}

export function isToolMessage(msg: CodeMessage): msg is ToolMessage {
  return msg.type === "tool";
}

export function isToolResultMessage(msg: CodeMessage): msg is ToolResultMessage {
  return msg.type === "tool_result";
}

export function isSystemMessage(msg: CodeMessage): msg is SystemMessage {
  return msg.type === "system";
}

export function isErrorMessage(msg: CodeMessage): msg is ErrorMessage {
  return msg.type === "error";
}

// Chat state
export interface CodeChatState {
  messages: CodeMessage[];
  isStreaming: boolean;
  error: string | null;
}

// API request/response types
export interface CodeChatRequest {
  prompt: string;
  image_ids?: string[]; // Content IDs of attached images
  session_id?: string;
  project_path?: string;
}

export interface CodeChatStreamEvent {
  type: "message" | "tool" | "tool_result" | "thinking" | "done" | "error";
  data: CodeMessage | { error: string };
}

// TSX detection result
export interface DetectedTsx {
  filename: string;
  code: string;
  language: string;
}
