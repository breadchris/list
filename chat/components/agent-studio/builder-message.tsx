"use client";

/**
 * Builder Message
 *
 * Renders chat messages in the Agent Studio builder.
 * Handles text, embedded components, action results, and errors.
 */

import { memo, useMemo } from "react";
import type {
  BuilderMessage as BuilderMessageType,
  EmbeddedComponentName,
} from "@/types/agent-studio";
import { useBuilderContext } from "./builder-context";

// Lazy-loaded embedded components
import { EmbeddedModelPicker } from "./embedded-components/embedded-model-picker";
import { EmbeddedToolSelector } from "./embedded-components/embedded-tool-selector";
import { EmbeddedAgentList } from "./embedded-components/embedded-agent-list";
import { EmbeddedInstructions } from "./embedded-components/embedded-instructions";
import { EmbeddedWorkflowEditor } from "./embedded-components/embedded-workflow-editor";
import { EmbeddedSchemaBuilder } from "./embedded-components/embedded-schema-builder";
import { EmbeddedOutputConfig } from "./embedded-components/embedded-output-config";
import { EmbeddedToolList } from "./embedded-components/embedded-tool-list";
import { EmbeddedWorkflowList } from "./embedded-components/embedded-workflow-list";
import { EmbeddedTraceList } from "./embedded-components/embedded-trace-list";
import { EmbeddedPlayground } from "./embedded-components/embedded-playground";

// ============================================================================
// Component Registry
// ============================================================================

type EmbeddedComponentType = React.ComponentType<{
  props: Record<string, unknown>;
  instanceId: string;
}>;

const COMPONENT_REGISTRY: Record<EmbeddedComponentName, EmbeddedComponentType> = {
  "model-picker": EmbeddedModelPicker,
  "tool-selector": EmbeddedToolSelector,
  "workflow-editor": EmbeddedWorkflowEditor,
  "schema-builder": EmbeddedSchemaBuilder,
  "agent-list": EmbeddedAgentList,
  "tool-list": EmbeddedToolList,
  "workflow-list": EmbeddedWorkflowList,
  "knowledge-list": EmbeddedAgentList, // Placeholder - reuse agent list for now
  "trace-list": EmbeddedTraceList,
  "instructions-editor": EmbeddedInstructions,
  "output-config": EmbeddedOutputConfig,
  "playground": EmbeddedPlayground,
};

// ============================================================================
// Message Content Components
// ============================================================================

interface TextContentProps {
  content: string;
  isStreaming?: boolean;
}

function TextContent({ content, isStreaming }: TextContentProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <p className="whitespace-pre-wrap text-neutral-200 leading-relaxed">
        {content}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-0.5" />
        )}
      </p>
    </div>
  );
}

interface EmbeddedComponentProps {
  name: EmbeddedComponentName;
  props: Record<string, unknown>;
  instanceId: string;
}

function EmbeddedComponent({ name, props, instanceId }: EmbeddedComponentProps) {
  const Component = COMPONENT_REGISTRY[name];

  if (!Component) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/50 p-4 text-red-400 text-sm">
        Unknown component: {name}
      </div>
    );
  }

  return (
    <div className="my-4 rounded-lg border border-neutral-700 bg-neutral-900 overflow-hidden">
      <Component props={props} instanceId={instanceId} />
    </div>
  );
}

interface ActionResultProps {
  type: string;
  entityName: string;
}

function ActionResult({ type, entityName }: ActionResultProps) {
  const actionLabels: Record<string, { label: string; icon: string }> = {
    agent_created: { label: "Created agent", icon: "✓" },
    agent_updated: { label: "Updated agent", icon: "✓" },
    agent_deleted: { label: "Deleted agent", icon: "✗" },
    tool_created: { label: "Created tool", icon: "✓" },
    tool_updated: { label: "Updated tool", icon: "✓" },
    tool_deleted: { label: "Deleted tool", icon: "✗" },
    workflow_created: { label: "Created workflow", icon: "✓" },
    workflow_updated: { label: "Updated workflow", icon: "✓" },
    workflow_deleted: { label: "Deleted workflow", icon: "✗" },
    collection_created: { label: "Created collection", icon: "✓" },
    document_uploaded: { label: "Uploaded document", icon: "✓" },
  };

  const action = actionLabels[type] || { label: type, icon: "•" };

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-green-950/30 border border-green-800/50 text-green-400 text-sm">
      <span className="text-green-500">{action.icon}</span>
      <span>
        {action.label}: <strong>{entityName}</strong>
      </span>
    </div>
  );
}

interface ErrorContentProps {
  error?: string;
}

function ErrorContent({ error }: ErrorContentProps) {
  return (
    <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-red-950/30 border border-red-800/50 text-red-400 text-sm">
      <span className="text-red-500">⚠</span>
      <span>{error || "An error occurred"}</span>
    </div>
  );
}

// ============================================================================
// Main Message Component
// ============================================================================

interface BuilderMessageProps {
  message: BuilderMessageType;
}

function BuilderMessageInner({ message }: BuilderMessageProps) {
  const isUser = message.role === "user";

  // Parse content for embedded component markers
  const parsedContent = useMemo(() => {
    // Check if content contains component JSON
    if (message.type === "component" && message.component) {
      return { text: message.content, component: message.component };
    }

    // Try to extract component from content (tool results)
    try {
      // Look for component markers in the content
      const componentMatch = message.content.match(
        /\[COMPONENT:(\{.*?\})\]/s
      );
      if (componentMatch) {
        const componentData = JSON.parse(componentMatch[1]);
        const textContent = message.content
          .replace(/\[COMPONENT:\{.*?\}\]/s, "")
          .trim();
        return { text: textContent, component: componentData };
      }
    } catch {
      // Not a component message
    }

    return { text: message.content, component: null };
  }, [message]);

  return (
    <div
      className={`flex gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isUser
            ? "bg-neutral-700"
            : "bg-gradient-to-br from-blue-500 to-purple-600"
        }`}
      >
        {isUser ? (
          <svg
            className="w-4 h-4 text-neutral-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 min-w-0 ${
          isUser ? "flex flex-col items-end" : ""
        }`}
      >
        <div
          className={`${
            isUser
              ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]"
              : "max-w-full"
          }`}
        >
          {message.type === "error" ? (
            <ErrorContent error={message.error} />
          ) : message.type === "action" && message.action ? (
            <>
              {parsedContent.text && (
                <TextContent content={parsedContent.text} />
              )}
              <ActionResult
                type={message.action.type}
                entityName={message.action.entity_name}
              />
            </>
          ) : (
            <>
              {parsedContent.text && (
                <TextContent
                  content={parsedContent.text}
                  isStreaming={message.is_streaming}
                />
              )}
              {parsedContent.component && (
                <EmbeddedComponent
                  name={parsedContent.component.name}
                  props={parsedContent.component.props}
                  instanceId={parsedContent.component.instance_id}
                />
              )}
            </>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-neutral-600 mt-1">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

export const BuilderMessage = memo(BuilderMessageInner);
