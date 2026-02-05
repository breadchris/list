"use client";

/**
 * FieldRenderer Component
 *
 * Renders individual form fields based on their type.
 * Supports: string, number, boolean, enum, array, object
 */

import { Sparkles, Loader2, Plus, X } from "lucide-react";

export interface FieldConfig {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object" | "enum";
  label: string;
  description?: string;
  required?: boolean;
  enumValues?: string[];
  items?: FieldConfig;
  properties?: FieldConfig[];
  defaultValue?: unknown;
  format?: string;
  minimum?: number;
  maximum?: number;
}

interface FieldRendererProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  showAiSuggest?: boolean;
  isAutofilling?: boolean;
  onAutofill?: () => void;
}

const baseInputClass = `
  w-full px-3 py-2 bg-neutral-900 border rounded-lg
  text-neutral-100 placeholder-neutral-500
  focus:outline-none focus:ring-1 focus:ring-cyan-500
  disabled:opacity-50 disabled:cursor-not-allowed
`;

export function FieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled,
  showAiSuggest,
  isAutofilling,
  onAutofill,
}: FieldRendererProps) {
  const inputClassName = `${baseInputClass} ${error ? "border-red-500" : "border-neutral-700"}`;

  return (
    <div className="space-y-1">
      {/* Label and AI Suggest button */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-neutral-300">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>

        {showAiSuggest && onAutofill && (
          <button
            type="button"
            onClick={onAutofill}
            disabled={disabled || isAutofilling}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-colors"
          >
            {isAutofilling ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            AI Fill
          </button>
        )}
      </div>

      {/* Description */}
      {field.description && (
        <p className="text-xs text-neutral-500">{field.description}</p>
      )}

      {/* Field input based on type */}
      {renderFieldInput(field, value, onChange, inputClassName, disabled)}

      {/* Error message */}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function renderFieldInput(
  field: FieldConfig,
  value: unknown,
  onChange: (value: unknown) => void,
  inputClassName: string,
  disabled?: boolean
) {
  switch (field.type) {
    case "string":
      return renderStringField(field, value, onChange, inputClassName, disabled);

    case "number":
      return (
        <input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => {
            const num = e.target.valueAsNumber;
            onChange(isNaN(num) ? undefined : num);
          }}
          min={field.minimum}
          max={field.maximum}
          className={inputClassName}
          disabled={disabled}
          placeholder={field.description}
        />
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-cyan-500 focus:ring-cyan-500"
            disabled={disabled}
          />
          <span className="text-sm text-neutral-400">
            {value ? "Yes" : "No"}
          </span>
        </label>
      );

    case "enum":
      return (
        <select
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={inputClassName}
          disabled={disabled}
        >
          <option value="">Select...</option>
          {field.enumValues?.map((opt) => (
            <option key={opt} value={opt}>
              {formatEnumValue(opt)}
            </option>
          ))}
        </select>
      );

    case "array":
      return (
        <ArrayField
          field={field}
          value={(value as unknown[]) || []}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "object":
      return (
        <ObjectField
          field={field}
          value={(value as Record<string, unknown>) || {}}
          onChange={onChange}
          disabled={disabled}
        />
      );

    default:
      return (
        <input
          type="text"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
          disabled={disabled}
        />
      );
  }
}

function renderStringField(
  field: FieldConfig,
  value: unknown,
  onChange: (value: unknown) => void,
  inputClassName: string,
  disabled?: boolean
) {
  // Determine input type based on format
  const format = field.format;

  if (format === "textarea" || (field.description?.length || 0) > 100) {
    return (
      <textarea
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClassName} resize-none`}
        disabled={disabled}
        rows={3}
        placeholder={field.description}
      />
    );
  }

  let inputType = "text";
  if (format === "email") inputType = "email";
  else if (format === "url") inputType = "url";
  else if (format === "date") inputType = "date";
  else if (format === "date-time") inputType = "datetime-local";
  else if (format === "time") inputType = "time";

  return (
    <input
      type={inputType}
      value={(value as string) || ""}
      onChange={(e) => onChange(e.target.value)}
      className={inputClassName}
      disabled={disabled}
      placeholder={field.description}
    />
  );
}

function formatEnumValue(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

interface ArrayFieldProps {
  field: FieldConfig;
  value: unknown[];
  onChange: (value: unknown[]) => void;
  disabled?: boolean;
}

function ArrayField({ field, value, onChange, disabled }: ArrayFieldProps) {
  const addItem = () => {
    const defaultValue = getDefaultValue(field.items?.type || "string");
    onChange([...value, defaultValue]);
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, newValue: unknown) => {
    const updated = [...value];
    updated[index] = newValue;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {value.map((item, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            value={(item as string) || ""}
            onChange={(e) => updateItem(index, e.target.value)}
            className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            disabled={disabled}
            placeholder={`Item ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            disabled={disabled}
            className="p-2 text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        disabled={disabled}
        className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        Add item
      </button>
    </div>
  );
}

interface ObjectFieldProps {
  field: FieldConfig;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
}

function ObjectField({ field, value, onChange, disabled }: ObjectFieldProps) {
  if (!field.properties || field.properties.length === 0) {
    return (
      <div className="text-sm text-neutral-500 italic">
        No properties defined
      </div>
    );
  }

  const handleFieldChange = (fieldName: string, fieldValue: unknown) => {
    onChange({ ...value, [fieldName]: fieldValue });
  };

  return (
    <div className="pl-4 border-l-2 border-neutral-700 space-y-3">
      {field.properties.map((subField) => (
        <FieldRenderer
          key={subField.name}
          field={subField}
          value={value[subField.name]}
          onChange={(val) => handleFieldChange(subField.name, val)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function getDefaultValue(type: string): unknown {
  switch (type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
}
