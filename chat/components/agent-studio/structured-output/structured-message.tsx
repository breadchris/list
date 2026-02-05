"use client";

/**
 * StructuredMessage Component
 *
 * Wraps structured output (forms, data cards, tables) in a message bubble.
 * Handles the distinction between text messages and structured messages.
 */

import { FormRenderer } from "./form-renderer";
import type { FormConfig } from "@/types/agent-studio";

interface StructuredMessageProps {
  /** The raw content (may be JSON string) */
  content: string;
  /** The schema for the structured output */
  schema: Record<string, unknown>;
  /** Whether the message is still streaming */
  isStreaming: boolean;
  /** Form configuration options */
  formConfig?: FormConfig;
  /** Callback when form is submitted */
  onSubmit?: (values: Record<string, unknown>) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Callback for AI autofill requests */
  onAutofillRequest?: (fieldName: string, fieldContext: string) => Promise<unknown>;
}

export function StructuredMessage({
  content,
  schema,
  isStreaming,
  formConfig,
  onSubmit,
  onCancel,
  onAutofillRequest,
}: StructuredMessageProps) {
  // Parse the content as JSON
  let parsedData: Record<string, unknown> = {};
  let parseError: string | null = null;

  try {
    if (content) {
      parsedData = JSON.parse(content);
    }
  } catch (error) {
    parseError = "Failed to parse structured content";
    console.error("StructuredMessage parse error:", error);
  }

  if (parseError && !isStreaming) {
    return (
      <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
        <p className="text-sm text-red-300">{parseError}</p>
        <pre className="mt-2 text-xs text-neutral-500 overflow-auto max-h-32">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4">
      <FormRenderer
        schema={schema}
        values={parsedData}
        isStreaming={isStreaming}
        formConfig={formConfig}
        onSubmit={onSubmit || (() => {})}
        onCancel={onCancel}
        onAutofillRequest={onAutofillRequest}
      />
    </div>
  );
}

/**
 * Check if content appears to be structured JSON
 */
export function isStructuredContent(content: string): boolean {
  if (!content) return false;

  const trimmed = content.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * DataCard Component
 *
 * Renders structured data as a read-only card (future use)
 */
export function DataCard({
  data,
  schema,
}: {
  data: Record<string, unknown>;
  schema: Record<string, unknown>;
}) {
  const schemaObj = schema as {
    properties?: Record<string, { description?: string }>;
  };

  return (
    <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4 space-y-3">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex flex-col">
          <span className="text-xs text-neutral-500 uppercase tracking-wide">
            {formatKey(key)}
          </span>
          <span className="text-sm text-neutral-200">
            {formatValue(value)}
          </span>
          {schemaObj.properties?.[key]?.description && (
            <span className="text-xs text-neutral-600">
              {schemaObj.properties[key].description}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
