"use client";

/**
 * OutputConfigEditor Component
 *
 * UI for configuring structured output settings in the agent editor.
 * Allows users to enable structured output and define a JSON Schema.
 */

import { useState } from "react";
import { FileJson, Sparkles, AlertCircle } from "lucide-react";
import type { AgentOutputConfig, FormConfig } from "@/types/agent-studio";

interface OutputConfigEditorProps {
  config: AgentOutputConfig;
  onChange: (config: AgentOutputConfig) => void;
}

export function OutputConfigEditor({ config, onChange }: OutputConfigEditorProps) {
  const [schemaText, setSchemaText] = useState(
    config.schema ? JSON.stringify(config.schema, null, 2) : ""
  );
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const handleEnabledChange = (enabled: boolean) => {
    onChange({ ...config, enabled });
  };

  const handleSchemaChange = (text: string) => {
    setSchemaText(text);
    setSchemaError(null);

    if (!text.trim()) {
      onChange({ ...config, schema: undefined });
      return;
    }

    try {
      const parsed = JSON.parse(text);

      // Basic validation
      if (typeof parsed !== "object" || parsed === null) {
        setSchemaError("Schema must be a JSON object");
        return;
      }

      if (parsed.type !== "object") {
        setSchemaError("Root schema type must be 'object'");
        return;
      }

      onChange({ ...config, schema: parsed });
    } catch (error) {
      setSchemaError("Invalid JSON syntax");
    }
  };

  const handleFormConfigChange = (formConfig: FormConfig) => {
    onChange({ ...config, form_config: formConfig });
  };

  return (
    <div className="space-y-4">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-neutral-300">
            Structured Output
          </label>
          <p className="text-xs text-neutral-500">
            Stream responses as structured data (forms, cards)
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => handleEnabledChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
        </label>
      </div>

      {config.enabled && (
        <>
          {/* Schema Editor */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileJson className="w-4 h-4 text-neutral-400" />
              <label className="text-sm font-medium text-neutral-300">
                Output Schema
              </label>
            </div>
            <p className="text-xs text-neutral-500 mb-2">
              Define the JSON Schema for structured output. The agent will stream
              responses matching this schema.
            </p>
            <textarea
              value={schemaText}
              onChange={(e) => handleSchemaChange(e.target.value)}
              placeholder={`{
  "type": "object",
  "properties": {
    "event_name": { "type": "string" },
    "event_date": { "type": "string" },
    "guest_count": { "type": "number" }
  },
  "required": ["event_name"]
}`}
              className={`w-full px-3 py-2 bg-neutral-900 border rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-sm resize-none ${
                schemaError ? "border-red-500" : "border-neutral-700"
              }`}
              rows={12}
            />
            {schemaError && (
              <div className="flex items-center gap-2 mt-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4" />
                {schemaError}
              </div>
            )}
          </div>

          {/* Form Config */}
          <div className="border-t border-neutral-800 pt-4 space-y-3">
            <h4 className="text-sm font-medium text-neutral-300">Form Options</h4>

            {/* Submit Label */}
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                Submit Button Label
              </label>
              <input
                type="text"
                value={config.form_config?.submit_label || ""}
                onChange={(e) =>
                  handleFormConfigChange({
                    ...config.form_config,
                    submit_label: e.target.value || undefined,
                  })
                }
                placeholder="Submit"
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Show Cancel */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.form_config?.show_cancel || false}
                onChange={(e) =>
                  handleFormConfigChange({
                    ...config.form_config,
                    show_cancel: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm text-neutral-400">Show cancel button</span>
            </label>

            {/* AI Suggestions */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.form_config?.allow_ai_suggestions !== false}
                onChange={(e) =>
                  handleFormConfigChange({
                    ...config.form_config,
                    allow_ai_suggestions: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-cyan-500 focus:ring-cyan-500"
              />
              <div className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span className="text-sm text-neutral-400">
                  Enable AI field suggestions
                </span>
              </div>
            </label>
          </div>

          {/* Schema Templates */}
          <div className="border-t border-neutral-800 pt-4">
            <h4 className="text-sm font-medium text-neutral-300 mb-2">
              Quick Templates
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSchemaChange(CONTACT_FORM_SCHEMA)}
                className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
              >
                Contact Form
              </button>
              <button
                type="button"
                onClick={() => handleSchemaChange(EVENT_PLANNING_SCHEMA)}
                className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
              >
                Event Planning
              </button>
              <button
                type="button"
                onClick={() => handleSchemaChange(FEEDBACK_SCHEMA)}
                className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
              >
                Feedback
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Template schemas
const CONTACT_FORM_SCHEMA = JSON.stringify(
  {
    type: "object",
    properties: {
      name: { type: "string", description: "Full name" },
      email: { type: "string", format: "email", description: "Email address" },
      phone: { type: "string", description: "Phone number (optional)" },
      message: { type: "string", description: "Your message" },
    },
    required: ["name", "email", "message"],
  },
  null,
  2
);

const EVENT_PLANNING_SCHEMA = JSON.stringify(
  {
    type: "object",
    properties: {
      event_name: { type: "string", description: "Name of the event" },
      event_date: { type: "string", format: "date", description: "Date of the event" },
      event_time: { type: "string", format: "time", description: "Start time" },
      location: { type: "string", description: "Event location" },
      guest_count: { type: "number", minimum: 1, description: "Number of guests" },
      theme: {
        type: "string",
        enum: ["casual", "formal", "themed", "outdoor"],
        description: "Event theme",
      },
      special_requests: { type: "string", description: "Any special requests" },
    },
    required: ["event_name", "event_date", "guest_count"],
  },
  null,
  2
);

const FEEDBACK_SCHEMA = JSON.stringify(
  {
    type: "object",
    properties: {
      rating: {
        type: "number",
        minimum: 1,
        maximum: 5,
        description: "Rating from 1 to 5",
      },
      category: {
        type: "string",
        enum: ["bug", "feature", "improvement", "other"],
        description: "Feedback category",
      },
      title: { type: "string", description: "Brief summary" },
      description: { type: "string", description: "Detailed feedback" },
      contact_me: { type: "boolean", description: "May we contact you about this?" },
    },
    required: ["rating", "category", "title"],
  },
  null,
  2
);
