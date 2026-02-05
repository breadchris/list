"use client";

import { useState, useEffect } from "react";
import { Wrench, Check, ExternalLink, Search } from "lucide-react";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import type { AgentTool } from "@/types/agent-studio";

interface ToolSelectorProps {
  groupId: string;
  selectedToolIds: string[];
  onChange: (toolIds: string[]) => void;
}

export function ToolSelector({
  groupId,
  selectedToolIds,
  onChange,
}: ToolSelectorProps) {
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Fetch available tools
  useEffect(() => {
    const fetchTools = async () => {
      setLoading(true);
      try {
        const data = await agentRepository.getTools(groupId);
        setTools(data);
      } catch (error) {
        console.error("Error fetching tools:", error);
      } finally {
        setLoading(false);
      }
    };

    if (groupId) {
      fetchTools();
    }
  }, [groupId]);

  const toggleTool = (toolId: string) => {
    if (selectedToolIds.includes(toolId)) {
      onChange(selectedToolIds.filter((id) => id !== toolId));
    } else {
      onChange([...selectedToolIds, toolId]);
    }
  };

  const filteredTools = tools.filter(
    (tool) =>
      tool.data.toLowerCase().includes(search.toLowerCase()) ||
      tool.metadata.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="text-sm text-neutral-500 py-4">Loading tools...</div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-500">
        Select tools that this agent can use to perform actions.
      </p>

      {tools.length === 0 ? (
        <div className="text-center py-6">
          <Wrench className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
          <p className="text-sm text-neutral-500 mb-3">No tools available</p>
          <a
            href="/agents/tools"
            className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
          >
            Create a tool
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        <>
          {/* Search */}
          {tools.length > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tools..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          )}

          {/* Tool list */}
          <div className="space-y-2 max-h-64 overflow-auto">
            {filteredTools.map((tool) => {
              const isSelected = selectedToolIds.includes(tool.id);
              return (
                <button
                  key={tool.id}
                  onClick={() => toggleTool(tool.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
                    isSelected
                      ? "border-cyan-500/50 bg-cyan-500/10"
                      : "border-neutral-700 hover:border-neutral-600 bg-neutral-800/50"
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isSelected
                        ? "bg-cyan-500 text-white"
                        : "bg-neutral-700 text-transparent"
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </div>

                  {/* Tool info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                      <span className="font-mono text-sm text-neutral-100 truncate">
                        {tool.data}
                      </span>
                    </div>
                    {tool.metadata.description && (
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                        {tool.metadata.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}

            {filteredTools.length === 0 && search && (
              <p className="text-sm text-neutral-500 text-center py-4">
                No tools match "{search}"
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
            <span className="text-xs text-neutral-500">
              {selectedToolIds.length} of {tools.length} selected
            </span>
            <a
              href="/agents/tools"
              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
            >
              Manage tools
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
