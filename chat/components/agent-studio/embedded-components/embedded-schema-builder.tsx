"use client";

/**
 * Embedded Schema Builder
 *
 * JSON Schema builder for structured output configuration.
 */

import { useState, useCallback } from "react";
import { useBuilderContext } from "../builder-context";

interface EmbeddedSchemaBuilderProps {
  props: Record<string, unknown>;
  instanceId: string;
}

interface SchemaField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  required?: boolean;
}

export function EmbeddedSchemaBuilder({ props, instanceId }: EmbeddedSchemaBuilderProps) {
  const { agent_draft, updateAgentDraft, setComponentState } = useBuilderContext();
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<SchemaField["type"]>("string");

  const currentSchema =
    agent_draft?.output_config?.schema || (props.schema as Record<string, unknown>) || {};

  const addField = useCallback(() => {
    if (!newFieldName.trim()) return;

    const newField: SchemaField = {
      name: newFieldName.trim(),
      type: newFieldType,
      required: true,
    };

    const updated = [...fields, newField];
    setFields(updated);
    setNewFieldName("");

    // Convert to JSON Schema
    const schema = {
      type: "object",
      properties: updated.reduce(
        (acc, f) => ({
          ...acc,
          [f.name]: { type: f.type, description: f.description },
        }),
        {}
      ),
      required: updated.filter((f) => f.required).map((f) => f.name),
    };

    updateAgentDraft({
      output_config: {
        ...agent_draft?.output_config,
        enabled: true,
        schema,
      },
    });
    setComponentState(instanceId, { schema });
  }, [newFieldName, newFieldType, fields, agent_draft?.output_config, updateAgentDraft, setComponentState, instanceId]);

  const removeField = useCallback((index: number) => {
    const updated = fields.filter((_, i) => i !== index);
    setFields(updated);

    const schema = {
      type: "object",
      properties: updated.reduce(
        (acc, f) => ({
          ...acc,
          [f.name]: { type: f.type, description: f.description },
        }),
        {}
      ),
      required: updated.filter((f) => f.required).map((f) => f.name),
    };

    updateAgentDraft({
      output_config: {
        ...agent_draft?.output_config,
        enabled: updated.length > 0,
        schema: updated.length > 0 ? schema : undefined,
      },
    });
    setComponentState(instanceId, { schema });
  }, [fields, agent_draft?.output_config, updateAgentDraft, setComponentState, instanceId]);

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-800">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>
        <span className="text-sm font-medium text-neutral-200">Output Schema</span>
      </div>

      <p className="text-xs text-neutral-500 mb-3">
        Define the structure of the agent's output. This enables forms and structured data cards.
      </p>

      {/* Existing fields */}
      {fields.length > 0 && (
        <div className="space-y-2 mb-4">
          {fields.map((field, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-neutral-800/50 rounded-lg border border-neutral-700"
            >
              <span className="font-mono text-sm text-neutral-200">{field.name}</span>
              <span className="text-xs text-neutral-500 px-1.5 py-0.5 bg-neutral-700 rounded">
                {field.type}
              </span>
              <button
                onClick={() => removeField(index)}
                className="ml-auto p-1 text-neutral-500 hover:text-red-400"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add field form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newFieldName}
          onChange={(e) => setNewFieldName(e.target.value)}
          placeholder="Field name"
          className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
        <select
          value={newFieldType}
          onChange={(e) => setNewFieldType(e.target.value as SchemaField["type"])}
          className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="array">Array</option>
          <option value="object">Object</option>
        </select>
        <button
          onClick={addField}
          disabled={!newFieldName.trim()}
          className="px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-cyan-500"
        >
          Add
        </button>
      </div>
    </div>
  );
}
