"use client";

/**
 * FormRenderer Component
 *
 * Renders a form from a JSON Schema, supporting progressive streaming.
 * Fields appear as they are populated during streaming.
 */

import { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { FieldRenderer, type FieldConfig } from "./field-renderer";
import type { FormConfig } from "@/types/agent-studio";

interface FormRendererProps {
  schema: Record<string, unknown>;
  values: Record<string, unknown>;
  isStreaming: boolean;
  formConfig?: FormConfig;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel?: () => void;
  onAutofillRequest?: (fieldName: string, fieldContext: string) => Promise<unknown>;
}

/**
 * Parse JSON Schema into field configurations
 */
function parseSchemaToFields(schema: Record<string, unknown>): FieldConfig[] {
  const schemaObj = schema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };

  if (schemaObj.type !== "object" || !schemaObj.properties) {
    return [];
  }

  const required = new Set(schemaObj.required || []);

  return Object.entries(schemaObj.properties).map(([name, propSchema]) => {
    const prop = propSchema as {
      type?: string;
      description?: string;
      enum?: string[];
      items?: Record<string, unknown>;
      properties?: Record<string, unknown>;
      required?: string[];
      default?: unknown;
      format?: string;
      minimum?: number;
      maximum?: number;
    };

    const fieldConfig: FieldConfig = {
      name,
      type: prop.enum ? "enum" : (prop.type as FieldConfig["type"]) || "string",
      label: formatLabel(name),
      description: prop.description,
      required: required.has(name),
      enumValues: prop.enum,
      defaultValue: prop.default,
      format: prop.format,
      minimum: prop.minimum,
      maximum: prop.maximum,
    };

    // Handle array items
    if (prop.type === "array" && prop.items) {
      fieldConfig.items = parseSchemaToFields({
        type: "object",
        properties: { item: prop.items },
      })[0];
    }

    // Handle nested objects
    if (prop.type === "object" && prop.properties) {
      fieldConfig.properties = parseSchemaToFields(prop);
    }

    return fieldConfig;
  });
}

/**
 * Convert snake_case or camelCase to Title Case
 */
function formatLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function FormRenderer({
  schema,
  values,
  isStreaming,
  formConfig,
  onSubmit,
  onCancel,
  onAutofillRequest,
}: FormRendererProps) {
  const [formValues, setFormValues] = useState<Record<string, unknown>>(values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autofillingFields, setAutofillingFields] = useState<Set<string>>(new Set());

  // Parse schema into field configs
  const fields = useMemo(() => parseSchemaToFields(schema), [schema]);

  // Update form values as streaming progresses
  useEffect(() => {
    if (isStreaming) {
      setFormValues((prev) => ({ ...prev, ...values }));
    }
  }, [values, isStreaming]);

  const handleFieldChange = (name: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
    // Clear error when field changes
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleAutofill = async (fieldName: string, fieldContext: string) => {
    if (!onAutofillRequest) return;

    setAutofillingFields((prev) => new Set(prev).add(fieldName));

    try {
      const suggestion = await onAutofillRequest(fieldName, fieldContext);
      handleFieldChange(fieldName, suggestion);
    } catch (error) {
      console.error("Autofill failed:", error);
    } finally {
      setAutofillingFields((prev) => {
        const next = new Set(prev);
        next.delete(fieldName);
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of fields) {
      const value = formValues[field.name];

      // Required field validation
      if (field.required && (value === undefined || value === null || value === "")) {
        newErrors[field.name] = `${field.label} is required`;
        continue;
      }

      // Type-specific validation
      if (value !== undefined && value !== null && value !== "") {
        if (field.type === "number") {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            newErrors[field.name] = `${field.label} must be a number`;
          } else {
            if (field.minimum !== undefined && numValue < field.minimum) {
              newErrors[field.name] = `${field.label} must be at least ${field.minimum}`;
            }
            if (field.maximum !== undefined && numValue > field.maximum) {
              newErrors[field.name] = `${field.label} must be at most ${field.maximum}`;
            }
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formValues);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showAiSuggestions = formConfig?.allow_ai_suggestions ?? true;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex items-center gap-2 text-sm text-cyan-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Generating form...</span>
        </div>
      )}

      {/* Fields */}
      {fields.map((field) => (
        <FieldRenderer
          key={field.name}
          field={field}
          value={formValues[field.name]}
          onChange={(value) => handleFieldChange(field.name, value)}
          error={errors[field.name]}
          disabled={isStreaming}
          showAiSuggest={showAiSuggestions && !!onAutofillRequest}
          isAutofilling={autofillingFields.has(field.name)}
          onAutofill={() => handleAutofill(field.name, field.description || field.label)}
        />
      ))}

      {/* Actions */}
      {!isStreaming && fields.length > 0 && (
        <div className="flex gap-2 pt-4 border-t border-neutral-800">
          {formConfig?.show_cancel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-neutral-400 hover:text-neutral-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {formConfig?.submit_label || "Submit"}
          </button>
        </div>
      )}
    </form>
  );
}
