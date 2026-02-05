"use client";

import { useState, useEffect } from "react";
import { Trash2, Settings2 } from "lucide-react";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import type { Node } from "@xyflow/react";
import type { Agent, AgentTool } from "@/types/agent-studio";

interface WorkflowStepConfigProps {
  selectedNode: Node | null;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
  groupId: string;
}

export function WorkflowStepConfig({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
  groupId,
}: WorkflowStepConfigProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch agents and tools when group changes
  useEffect(() => {
    const fetchData = async () => {
      if (!groupId) return;

      setLoading(true);
      try {
        const [agentsData, toolsData] = await Promise.all([
          agentRepository.getAgents(groupId),
          agentRepository.getTools(groupId),
        ]);
        setAgents(agentsData);
        setTools(toolsData);
      } catch (error) {
        console.error("Error fetching agents/tools:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId]);

  if (!selectedNode) {
    return (
      <div className="w-64 border-l border-neutral-800 bg-neutral-950 p-4">
        <div className="flex flex-col items-center justify-center h-full text-neutral-500">
          <Settings2 className="w-8 h-8 mb-2" />
          <p className="text-sm text-center">
            Select a step to configure it
          </p>
        </div>
      </div>
    );
  }

  const nodeData = selectedNode.data as Record<string, unknown>;

  const handleLabelChange = (label: string) => {
    onUpdateNode(selectedNode.id, { label });
  };

  const handleAgentChange = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    onUpdateNode(selectedNode.id, {
      agent_id: agentId,
      agent_name: agent?.data || "",
    });
  };

  const handleToolChange = (toolId: string) => {
    const tool = tools.find((t) => t.id === toolId);
    onUpdateNode(selectedNode.id, {
      tool_id: toolId,
      tool_name: tool?.data || "",
    });
  };

  const handleInputMappingChange = (inputMapping: string) => {
    onUpdateNode(selectedNode.id, { input_mapping: inputMapping });
  };

  const handleConditionChange = (index: number, expression: string) => {
    const conditions = (nodeData.conditions as Array<{ id: string; expression: string }>) || [];
    const updated = [...conditions];
    if (updated[index]) {
      updated[index] = { ...updated[index], expression };
    }
    onUpdateNode(selectedNode.id, { conditions: updated });
  };

  const handleAddCondition = () => {
    const conditions = (nodeData.conditions as Array<{ id: string; expression: string }>) || [];
    onUpdateNode(selectedNode.id, {
      conditions: [
        ...conditions,
        { id: `cond-${Date.now()}`, expression: "" },
      ],
    });
  };

  const handleRemoveCondition = (index: number) => {
    const conditions = (nodeData.conditions as Array<{ id: string; expression: string }>) || [];
    const updated = conditions.filter((_, i) => i !== index);
    onUpdateNode(selectedNode.id, { conditions: updated });
  };

  return (
    <div className="w-64 border-l border-neutral-800 bg-neutral-950 p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-neutral-200">Step Config</h3>
        <button
          onClick={() => onDeleteNode(selectedNode.id)}
          className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded"
          title="Delete step"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Step type badge */}
        <div className="text-xs text-neutral-500">
          Type: <span className="text-neutral-300">{selectedNode.type}</span>
        </div>

        {/* Label */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">
            Label
          </label>
          <input
            type="text"
            value={(nodeData.label as string) || ""}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        {/* Agent picker for agent nodes */}
        {selectedNode.type === "agent" && (
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Agent
            </label>
            {loading ? (
              <div className="text-sm text-neutral-500">Loading...</div>
            ) : (
              <select
                value={(nodeData.agent_id as string) || ""}
                onChange={(e) => handleAgentChange(e.target.value)}
                className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="">Select an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.data}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Tool picker for tool nodes */}
        {selectedNode.type === "tool" && (
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Tool
            </label>
            {loading ? (
              <div className="text-sm text-neutral-500">Loading...</div>
            ) : (
              <select
                value={(nodeData.tool_id as string) || ""}
                onChange={(e) => handleToolChange(e.target.value)}
                className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="">Select a tool</option>
                {tools.map((tool) => (
                  <option key={tool.id} value={tool.id}>
                    {tool.data}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Input mapping for agent/tool nodes */}
        {(selectedNode.type === "agent" || selectedNode.type === "tool") && (
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Input Mapping
            </label>
            <textarea
              value={(nodeData.input_mapping as string) || ""}
              onChange={(e) => handleInputMappingChange(e.target.value)}
              placeholder='{ "message": "{{trigger.input}}" }'
              className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
              rows={3}
            />
            <p className="text-xs text-neutral-500 mt-1">
              Use {"{{stepId.field}}"} to reference other steps
            </p>
          </div>
        )}

        {/* Conditions for branch nodes */}
        {selectedNode.type === "branch" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-neutral-400">
                Conditions
              </label>
              <button
                onClick={handleAddCondition}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {((nodeData.conditions as Array<{ id: string; expression: string }>) || []).map(
                (condition, index) => (
                  <div key={condition.id} className="flex items-center gap-1">
                    <span className="text-xs text-purple-400 w-4 flex-shrink-0">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={condition.expression}
                      onChange={(e) => handleConditionChange(index, e.target.value)}
                      placeholder='{{agent.output}} === "yes"'
                      className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => handleRemoveCondition(index)}
                      className="p-1 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded flex-shrink-0"
                      title="Remove condition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              )}
              {((nodeData.conditions as Array<unknown>) || []).length === 0 && (
                <p className="text-xs text-neutral-500">
                  Add conditions for branching logic
                </p>
              )}
              {((nodeData.conditions as Array<unknown>) || []).length > 0 && (
                <p className="text-xs text-neutral-500 mt-2">
                  Each condition creates a branch. Use {"{{stepId.field}}"} syntax. Non-matching inputs go to "else".
                </p>
              )}
            </div>
          </div>
        )}

        {/* Node ID (readonly) */}
        <div className="pt-4 border-t border-neutral-800">
          <label className="block text-xs font-medium text-neutral-500 mb-1">
            Node ID
          </label>
          <div className="text-xs text-neutral-400 font-mono truncate">
            {selectedNode.id}
          </div>
        </div>
      </div>
    </div>
  );
}
