"use client";

/**
 * Embedded Model Picker
 *
 * Wrapper for ModelPicker that integrates with BuilderContext.
 */

import { useCallback } from "react";
import { ModelPicker } from "../model-picker";
import { useBuilderContext } from "../builder-context";
import type { LLMProvider } from "@/types/agent-studio";

interface EmbeddedModelPickerProps {
  props: Record<string, unknown>;
  instanceId: string;
}

export function EmbeddedModelPicker({ props, instanceId }: EmbeddedModelPickerProps) {
  const { agent_draft, updateAgentDraft, setComponentState, getComponentState } =
    useBuilderContext();

  // Get current values from context or props
  const currentProvider =
    (agent_draft?.model_config?.provider as LLMProvider) ||
    (props.provider as LLMProvider) ||
    "openai";
  const currentModel =
    agent_draft?.model_config?.model || (props.model as string) || "gpt-4o";
  const currentTemperature =
    agent_draft?.model_config?.temperature ??
    (props.temperature as number) ??
    0.7;

  const handleProviderChange = useCallback(
    (provider: LLMProvider) => {
      updateAgentDraft({
        model_config: {
          ...agent_draft?.model_config,
          provider,
          model: currentModel,
          temperature: currentTemperature,
        },
      });
      setComponentState(instanceId, { provider, model: currentModel, temperature: currentTemperature });
    },
    [agent_draft?.model_config, currentModel, currentTemperature, updateAgentDraft, setComponentState, instanceId]
  );

  const handleModelChange = useCallback(
    (model: string) => {
      updateAgentDraft({
        model_config: {
          ...agent_draft?.model_config,
          provider: currentProvider,
          model,
          temperature: currentTemperature,
        },
      });
      setComponentState(instanceId, { provider: currentProvider, model, temperature: currentTemperature });
    },
    [agent_draft?.model_config, currentProvider, currentTemperature, updateAgentDraft, setComponentState, instanceId]
  );

  const handleTemperatureChange = useCallback(
    (temperature: number) => {
      updateAgentDraft({
        model_config: {
          ...agent_draft?.model_config,
          provider: currentProvider,
          model: currentModel,
          temperature,
        },
      });
      setComponentState(instanceId, { provider: currentProvider, model: currentModel, temperature });
    },
    [agent_draft?.model_config, currentProvider, currentModel, updateAgentDraft, setComponentState, instanceId]
  );

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-800">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <span className="text-sm font-medium text-neutral-200">Model Configuration</span>
      </div>
      <ModelPicker
        provider={currentProvider}
        model={currentModel}
        temperature={currentTemperature}
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
        onTemperatureChange={handleTemperatureChange}
      />
    </div>
  );
}
