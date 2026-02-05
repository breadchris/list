"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Bot,
  Settings2,
  Wrench,
  Brain,
  FileJson,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import { AgentPlayground } from "./agent-playground";
import { ModelPicker } from "./model-picker";
import { ToolSelector } from "./tool-selector";
import type { Agent, AgentMetadata, AgentOutputConfig, FormConfig, LLMProvider } from "@/types/agent-studio";
import { DEFAULT_MODEL_CONFIGS } from "@/types/agent-studio";
import { OutputConfigEditor } from "./output-config-editor";

interface AgentEditorProps {
  agentId: string;
}

type Section = "model" | "instructions" | "tools" | "memory" | "output";

export function AgentEditor({ agentId }: AgentEditorProps) {
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [provider, setProvider] = useState<LLMProvider>("openai");
  const [model, setModel] = useState("gpt-4o");
  const [temperature, setTemperature] = useState(0.7);
  const [maxSteps, setMaxSteps] = useState(5);
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [outputConfig, setOutputConfig] = useState<AgentOutputConfig>({
    enabled: false,
  });

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Set<Section>>(
    new Set(["model", "instructions"])
  );

  // Fetch agent
  useEffect(() => {
    const fetchAgent = async () => {
      setLoading(true);
      try {
        const data = await agentRepository.getAgent(agentId);
        if (data) {
          setAgent(data);
          setName(data.data);
          setDescription(data.metadata.description || "");
          setInstructions(
            typeof data.metadata.instructions === "string"
              ? data.metadata.instructions
              : data.metadata.instructions.join("\n\n")
          );
          setProvider(data.metadata.model_config.provider);
          setModel(data.metadata.model_config.model);
          setTemperature(data.metadata.model_config.temperature || 0.7);
          setMaxSteps(data.metadata.max_steps || 5);
          setToolIds(data.metadata.tool_ids || []);
          setOutputConfig(data.metadata.output_config || { enabled: false });
        }
      } catch (error) {
        console.error("Error fetching agent:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [agentId]);

  // Track changes
  useEffect(() => {
    if (!agent) return;
    const originalInstructions =
      typeof agent.metadata.instructions === "string"
        ? agent.metadata.instructions
        : agent.metadata.instructions.join("\n\n");

    const changed =
      name !== agent.data ||
      description !== (agent.metadata.description || "") ||
      instructions !== originalInstructions ||
      provider !== agent.metadata.model_config.provider ||
      model !== agent.metadata.model_config.model ||
      temperature !== (agent.metadata.model_config.temperature || 0.7) ||
      maxSteps !== (agent.metadata.max_steps || 5) ||
      JSON.stringify(toolIds) !== JSON.stringify(agent.metadata.tool_ids || []) ||
      JSON.stringify(outputConfig) !== JSON.stringify(agent.metadata.output_config || { enabled: false });

    setHasChanges(changed);
  }, [agent, name, description, instructions, provider, model, temperature, maxSteps, toolIds, outputConfig]);

  const handleSave = async () => {
    if (!agent) return;

    setSaving(true);
    try {
      const updated = await agentRepository.updateAgent(agentId, {
        name,
        metadata: {
          description: description || undefined,
          instructions,
          model_config: {
            provider,
            model,
            temperature,
          },
          tool_ids: toolIds,
          max_steps: maxSteps,
          output_config: outputConfig.enabled ? outputConfig : undefined,
        },
      });
      setAgent(updated);
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving agent:", error);
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: Section) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        Loading agent...
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        Agent not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header - pl-14 accounts for fixed AppSwitcherButton */}
      <div className="flex items-center justify-between p-4 pl-14 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/agents")}
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-cyan-400" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-semibold bg-transparent border-none outline-none text-neutral-100 focus:ring-1 focus:ring-cyan-500 rounded px-2 py-1"
              placeholder="Agent Name"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Main content - split layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Configuration */}
        <div className="w-1/2 border-r border-neutral-800 overflow-auto">
          <div className="p-4 space-y-4">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this agent do?"
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                rows={2}
              />
            </div>

            {/* Model Section */}
            <CollapsibleSection
              title="Model"
              icon={<Settings2 className="w-4 h-4" />}
              expanded={expandedSections.has("model")}
              onToggle={() => toggleSection("model")}
            >
              <ModelPicker
                provider={provider}
                model={model}
                temperature={temperature}
                onProviderChange={setProvider}
                onModelChange={setModel}
                onTemperatureChange={setTemperature}
              />
            </CollapsibleSection>

            {/* Instructions Section */}
            <CollapsibleSection
              title="Instructions"
              icon={<Brain className="w-4 h-4" />}
              expanded={expandedSections.has("instructions")}
              onToggle={() => toggleSection("instructions")}
            >
              <div>
                <p className="text-xs text-neutral-500 mb-2">
                  System prompt that defines the agent's behavior and expertise
                </p>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="You are a helpful AI assistant..."
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none font-mono text-sm"
                  rows={10}
                />
              </div>
            </CollapsibleSection>

            {/* Tools Section */}
            <CollapsibleSection
              title="Tools"
              icon={<Wrench className="w-4 h-4" />}
              expanded={expandedSections.has("tools")}
              onToggle={() => toggleSection("tools")}
              badge={toolIds.length}
            >
              <ToolSelector
                groupId={agent.group_id}
                selectedToolIds={toolIds}
                onChange={setToolIds}
              />
            </CollapsibleSection>

            {/* Advanced Settings */}
            <CollapsibleSection
              title="Advanced"
              icon={<FileJson className="w-4 h-4" />}
              expanded={expandedSections.has("output")}
              onToggle={() => toggleSection("output")}
              badge={outputConfig.enabled ? 1 : undefined}
            >
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Max Steps
                  </label>
                  <p className="text-xs text-neutral-500 mb-2">
                    Maximum number of tool-calling iterations before stopping
                  </p>
                  <input
                    type="number"
                    value={maxSteps}
                    onChange={(e) => setMaxSteps(parseInt(e.target.value) || 1)}
                    min={1}
                    max={20}
                    className="w-24 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div className="border-t border-neutral-800 pt-4">
                  <OutputConfigEditor
                    config={outputConfig}
                    onChange={setOutputConfig}
                  />
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </div>

        {/* Right panel - Playground */}
        <div className="w-1/2 flex flex-col bg-neutral-900/50">
          <AgentPlayground
            agent={agent}
            currentConfig={{
              name,
              instructions,
              model_config: { provider, model, temperature },
              output_config: outputConfig.enabled ? outputConfig : undefined,
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  badge?: number;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  badge,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-neutral-900 hover:bg-neutral-800 transition-colors"
      >
        <div className="flex items-center gap-2 text-neutral-200">
          {icon}
          <span className="font-medium">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-neutral-700 rounded">
              {badge}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-neutral-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        )}
      </button>
      {expanded && (
        <div className="p-4 border-t border-neutral-800">{children}</div>
      )}
    </div>
  );
}
