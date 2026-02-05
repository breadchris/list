"use client";

/**
 * Embedded Output Config
 *
 * Configure structured output settings for an agent.
 */

import { useCallback } from "react";
import { useBuilderContext } from "../builder-context";

interface EmbeddedOutputConfigProps {
  props: Record<string, unknown>;
  instanceId: string;
}

export function EmbeddedOutputConfig({ props, instanceId }: EmbeddedOutputConfigProps) {
  const { agent_draft, updateAgentDraft, setComponentState } = useBuilderContext();

  const enabled = agent_draft?.output_config?.enabled ?? (props.enabled as boolean) ?? false;
  const errorStrategy = agent_draft?.output_config?.error_strategy || "warn";

  const handleToggle = useCallback(() => {
    const newEnabled = !enabled;
    updateAgentDraft({
      output_config: {
        ...agent_draft?.output_config,
        enabled: newEnabled,
      },
    });
    setComponentState(instanceId, { enabled: newEnabled });
  }, [enabled, agent_draft?.output_config, updateAgentDraft, setComponentState, instanceId]);

  const handleStrategyChange = useCallback((strategy: "strict" | "warn" | "fallback") => {
    updateAgentDraft({
      output_config: {
        ...agent_draft?.output_config,
        enabled,
        error_strategy: strategy,
      },
    });
    setComponentState(instanceId, { error_strategy: strategy });
  }, [enabled, agent_draft?.output_config, updateAgentDraft, setComponentState, instanceId]);

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-800">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <span className="text-sm font-medium text-neutral-200">Output Configuration</span>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg border border-neutral-700 mb-4">
        <div>
          <p className="text-sm font-medium text-neutral-200">Structured Output</p>
          <p className="text-xs text-neutral-500">
            Enable to get typed, structured responses
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-cyan-600" : "bg-neutral-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Error strategy */}
      {enabled && (
        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-2">
            Error Strategy
          </label>
          <div className="space-y-2">
            {[
              { value: "strict", label: "Strict", desc: "Fail if output doesn't match schema" },
              { value: "warn", label: "Warn", desc: "Log warning but continue" },
              { value: "fallback", label: "Fallback", desc: "Use fallback value on error" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleStrategyChange(option.value as "strict" | "warn" | "fallback")}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                  errorStrategy === option.value
                    ? "border-cyan-500/50 bg-cyan-500/10"
                    : "border-neutral-700 bg-neutral-800/50 hover:border-neutral-600"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                    errorStrategy === option.value
                      ? "border-cyan-500 bg-cyan-500"
                      : "border-neutral-600"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-neutral-200">{option.label}</p>
                  <p className="text-xs text-neutral-500">{option.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
