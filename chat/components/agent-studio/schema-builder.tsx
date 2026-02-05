"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

type FieldType = "string" | "number" | "boolean" | "array" | "object";

interface SchemaField {
  name: string;
  type: FieldType;
  description: string;
  required: boolean;
  items?: { type: FieldType }; // For array types
}

interface SchemaBuilderProps {
  schema: Record<string, unknown>;
  onChange: (schema: Record<string, unknown>) => void;
  title?: string;
}

export function SchemaBuilder({ schema, onChange, title }: SchemaBuilderProps) {
  const [expanded, setExpanded] = useState(true);

  // Parse existing schema to fields
  const parseSchemaToFields = (): SchemaField[] => {
    const properties =
      (schema as { properties?: Record<string, unknown> })?.properties || {};
    const required =
      (schema as { required?: string[] })?.required || [];

    return Object.entries(properties).map(([name, prop]) => {
      const propObj = prop as {
        type?: FieldType;
        description?: string;
        items?: { type: FieldType };
      };
      return {
        name,
        type: propObj.type || "string",
        description: propObj.description || "",
        required: required.includes(name),
        items: propObj.items,
      };
    });
  };

  const [fields, setFields] = useState<SchemaField[]>(parseSchemaToFields);

  // Convert fields back to JSON Schema
  const fieldsToSchema = (fields: SchemaField[]): Record<string, unknown> => {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const field of fields) {
      const prop: Record<string, unknown> = {
        type: field.type,
      };
      if (field.description) {
        prop.description = field.description;
      }
      if (field.type === "array" && field.items) {
        prop.items = field.items;
      }
      properties[field.name] = prop;

      if (field.required) {
        required.push(field.name);
      }
    }

    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  };

  const updateFields = (newFields: SchemaField[]) => {
    setFields(newFields);
    onChange(fieldsToSchema(newFields));
  };

  const addField = () => {
    const newField: SchemaField = {
      name: `field_${fields.length + 1}`,
      type: "string",
      description: "",
      required: false,
    };
    updateFields([...fields, newField]);
  };

  const removeField = (index: number) => {
    updateFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<SchemaField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    updateFields(newFields);
  };

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-neutral-900 hover:bg-neutral-800 transition-colors"
      >
        <span className="font-medium text-neutral-200">{title || "Schema"}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">
            {fields.length} field{fields.length !== 1 ? "s" : ""}
          </span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-4 border-t border-neutral-800 space-y-3">
          {/* Fields */}
          {fields.map((field, index) => (
            <FieldEditor
              key={index}
              field={field}
              onChange={(updates) => updateField(index, updates)}
              onRemove={() => removeField(index)}
            />
          ))}

          {/* Add Field Button */}
          <button
            onClick={addField}
            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors w-full"
          >
            <Plus className="w-4 h-4" />
            Add Field
          </button>
        </div>
      )}
    </div>
  );
}

interface FieldEditorProps {
  field: SchemaField;
  onChange: (updates: Partial<SchemaField>) => void;
  onRemove: () => void;
}

function FieldEditor({ field, onChange, onRemove }: FieldEditorProps) {
  return (
    <div className="flex items-start gap-2 p-3 bg-neutral-800/50 rounded-lg">
      {/* Name */}
      <input
        type="text"
        value={field.name}
        onChange={(e) => onChange({ name: e.target.value.replace(/\s/g, "_") })}
        placeholder="field_name"
        className="flex-1 px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-sm font-mono text-neutral-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
      />

      {/* Type */}
      <select
        value={field.type}
        onChange={(e) => {
          const type = e.target.value as FieldType;
          const updates: Partial<SchemaField> = { type };
          if (type === "array") {
            updates.items = { type: "string" };
          } else {
            updates.items = undefined;
          }
          onChange(updates);
        }}
        className="px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
      >
        <option value="string">string</option>
        <option value="number">number</option>
        <option value="boolean">boolean</option>
        <option value="array">array</option>
        <option value="object">object</option>
      </select>

      {/* Array item type */}
      {field.type === "array" && (
        <select
          value={field.items?.type || "string"}
          onChange={(e) =>
            onChange({ items: { type: e.target.value as FieldType } })
          }
          className="px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="string">of string</option>
          <option value="number">of number</option>
          <option value="boolean">of boolean</option>
          <option value="object">of object</option>
        </select>
      )}

      {/* Required toggle */}
      <label className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-neutral-400 cursor-pointer">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="rounded border-neutral-600 bg-neutral-800 text-cyan-500 focus:ring-cyan-500"
        />
        req
      </label>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="p-1.5 hover:bg-neutral-700 rounded text-neutral-500 hover:text-red-400"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Description (below) */}
      <input
        type="text"
        value={field.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Description..."
        className="absolute -bottom-8 left-0 right-0 hidden"
      />
    </div>
  );
}

// Simplified version for inline use
export function InlineSchemaBuilder({
  schema,
  onChange,
  title,
}: SchemaBuilderProps) {
  const parseSchemaToFields = (): SchemaField[] => {
    const properties =
      (schema as { properties?: Record<string, unknown> })?.properties || {};
    const required =
      (schema as { required?: string[] })?.required || [];

    return Object.entries(properties).map(([name, prop]) => {
      const propObj = prop as {
        type?: FieldType;
        description?: string;
        items?: { type: FieldType };
      };
      return {
        name,
        type: propObj.type || "string",
        description: propObj.description || "",
        required: required.includes(name),
        items: propObj.items,
      };
    });
  };

  const [fields, setFields] = useState<SchemaField[]>(parseSchemaToFields);

  const fieldsToSchema = (fields: SchemaField[]): Record<string, unknown> => {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const field of fields) {
      const prop: Record<string, unknown> = {
        type: field.type,
      };
      if (field.description) {
        prop.description = field.description;
      }
      if (field.type === "array" && field.items) {
        prop.items = field.items;
      }
      properties[field.name] = prop;

      if (field.required) {
        required.push(field.name);
      }
    }

    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  };

  const updateFields = (newFields: SchemaField[]) => {
    setFields(newFields);
    onChange(fieldsToSchema(newFields));
  };

  const addField = () => {
    const newField: SchemaField = {
      name: `field_${fields.length + 1}`,
      type: "string",
      description: "",
      required: false,
    };
    updateFields([...fields, newField]);
  };

  const removeField = (index: number) => {
    updateFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<SchemaField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    updateFields(newFields);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-300">{title}</span>
        <button
          onClick={addField}
          className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-2 bg-neutral-800/50 rounded"
          >
            <input
              type="text"
              value={field.name}
              onChange={(e) =>
                updateField(index, { name: e.target.value.replace(/\s/g, "_") })
              }
              className="flex-1 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs font-mono text-neutral-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <select
              value={field.type}
              onChange={(e) =>
                updateField(index, { type: e.target.value as FieldType })
              }
              className="px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-100 focus:outline-none"
            >
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="array">array</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-neutral-500">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) =>
                  updateField(index, { required: e.target.checked })
                }
                className="rounded border-neutral-600 bg-neutral-800"
              />
              req
            </label>
            <button
              onClick={() => removeField(index)}
              className="p-1 hover:bg-neutral-700 rounded text-neutral-500 hover:text-red-400"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        {fields.length === 0 && (
          <p className="text-xs text-neutral-500 italic py-2">No fields defined</p>
        )}
      </div>
    </div>
  );
}
