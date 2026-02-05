"use client";

import type { LLMProvider } from "@/types/agent-studio";
import { DEFAULT_MODEL_CONFIGS } from "@/types/agent-studio";

interface ModelPickerProps {
  provider: LLMProvider;
  model: string;
  temperature: number;
  onProviderChange: (provider: LLMProvider) => void;
  onModelChange: (model: string) => void;
  onTemperatureChange: (temperature: number) => void;
}

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  mistral: "Mistral",
  groq: "Groq",
  together: "Together AI",
  fireworks: "Fireworks",
  perplexity: "Perplexity",
  cohere: "Cohere",
  "amazon-bedrock": "AWS Bedrock",
};

export function ModelPicker({
  provider,
  model,
  temperature,
  onProviderChange,
  onModelChange,
  onTemperatureChange,
}: ModelPickerProps) {
  const availableModels = DEFAULT_MODEL_CONFIGS[provider] || [];

  const handleProviderChange = (newProvider: LLMProvider) => {
    onProviderChange(newProvider);
    // Reset to first model of new provider
    const models = DEFAULT_MODEL_CONFIGS[newProvider];
    if (models && models.length > 0) {
      onModelChange(models[0]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Provider */}
      <div>
        <label className="block text-sm font-medium text-neutral-400 mb-2">
          Provider
        </label>
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Model */}
      <div>
        <label className="block text-sm font-medium text-neutral-400 mb-2">
          Model
        </label>
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          {availableModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Temperature */}
      <div>
        <label className="block text-sm font-medium text-neutral-400 mb-2">
          Temperature: {temperature.toFixed(1)}
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">0</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <span className="text-xs text-neutral-500">2</span>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Lower values make output more focused, higher values more creative
        </p>
      </div>
    </div>
  );
}
