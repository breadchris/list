"use client";

/**
 * Embedded Instructions Editor
 *
 * Text editor for agent system prompt/instructions.
 * Integrates with BuilderContext.
 */

import { useCallback, useState, useEffect } from "react";
import { useBuilderContext } from "../builder-context";

interface EmbeddedInstructionsProps {
  props: Record<string, unknown>;
  instanceId: string;
}

export function EmbeddedInstructions({ props, instanceId }: EmbeddedInstructionsProps) {
  const { agent_draft, updateAgentDraft, setComponentState } = useBuilderContext();

  // Local state for immediate feedback
  const [localValue, setLocalValue] = useState(
    (agent_draft?.instructions as string) ||
    (props.instructions as string) ||
    ""
  );

  // Sync from context changes
  useEffect(() => {
    if (agent_draft?.instructions) {
      setLocalValue(
        typeof agent_draft.instructions === "string"
          ? agent_draft.instructions
          : agent_draft.instructions.join("\n")
      );
    }
  }, [agent_draft?.instructions]);

  const handleChange = useCallback(
    (value: string) => {
      setLocalValue(value);
      // Debounced update to context
      const timer = setTimeout(() => {
        updateAgentDraft({ instructions: value });
        setComponentState(instanceId, { instructions: value });
      }, 300);
      return () => clearTimeout(timer);
    },
    [updateAgentDraft, setComponentState, instanceId]
  );

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-800">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <span className="text-sm font-medium text-neutral-200">Instructions</span>
        <span className="text-xs text-neutral-500 ml-auto">
          {localValue.length} characters
        </span>
      </div>

      <p className="text-xs text-neutral-500 mb-3">
        Define how the agent should behave. Be specific about its role, capabilities, and any rules it should follow.
      </p>

      <textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="You are a helpful AI assistant that..."
        rows={8}
        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none leading-relaxed"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs text-neutral-600">Quick tips:</span>
        <button
          onClick={() => handleChange(localValue + "\n\nAlways be helpful and concise.")}
          className="text-xs text-cyan-400 hover:text-cyan-300"
        >
          + Add helpful directive
        </button>
        <button
          onClick={() => handleChange(localValue + "\n\nIf you're unsure, ask for clarification.")}
          className="text-xs text-cyan-400 hover:text-cyan-300"
        >
          + Add clarification rule
        </button>
      </div>
    </div>
  );
}
