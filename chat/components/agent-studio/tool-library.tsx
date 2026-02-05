"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Wrench, Trash2, Copy, ArrowLeft } from "lucide-react";
import { useGlobalGroup } from "@/components/GlobalGroupContext";
import { AgentStudioNav } from "./agent-studio-nav";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import { supabase } from "@/lib/list/SupabaseClient";
import type { AgentTool, AgentToolMetadata } from "@/types/agent-studio";

const DEFAULT_TOOL_METADATA: AgentToolMetadata = {
  description: "Describe what this tool does",
  input_schema: {
    type: "object",
    properties: {
      input: { type: "string", description: "Input value" },
    },
    required: ["input"],
  },
  output_schema: {
    type: "object",
    properties: {
      result: { type: "string" },
    },
  },
  execute_code: `async ({ inputData }) => {
  const { input } = inputData;
  return { result: input };
}`,
};

export function ToolLibrary() {
  const router = useRouter();
  const { selectedGroup, isLoading: groupsLoading } = useGlobalGroup();
  const [userId, setUserId] = useState<string | null>(null);
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch user ID from Supabase auth
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    fetchUser();
  }, []);

  // Fetch tools when group changes
  useEffect(() => {
    if (!selectedGroup) {
      setTools([]);
      setLoading(false);
      return;
    }

    const fetchTools = async () => {
      setLoading(true);
      try {
        const data = await agentRepository.getTools(selectedGroup.id);
        setTools(data);
      } catch (error) {
        console.error("Error fetching tools:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTools();
  }, [selectedGroup]);

  const handleCreateTool = async () => {
    if (!selectedGroup || !userId) {
      console.warn("Cannot create tool: missing selectedGroup or userId");
      return;
    }

    setCreating(true);
    try {
      const tool = await agentRepository.createTool({
        name: "new_tool",
        group_id: selectedGroup.id,
        user_id: userId,
        metadata: DEFAULT_TOOL_METADATA,
      });
      router.push(`/agents/tools/${tool.id}`);
    } catch (error) {
      console.error("Error creating tool:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTool = async (toolId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this tool?")) return;

    try {
      await agentRepository.deleteTool(toolId);
      setTools((prev) => prev.filter((t) => t.id !== toolId));
    } catch (error) {
      console.error("Error deleting tool:", error);
    }
  };

  const isInitialLoading = groupsLoading || (selectedGroup && loading);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pl-14 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/agents")}
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Wrench className="w-6 h-6 text-orange-400" />
          <h1 className="text-xl font-semibold text-neutral-100">
            Tools Library
          </h1>
        </div>
        <button
          onClick={handleCreateTool}
          disabled={creating || !selectedGroup || !userId}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {creating ? "Creating..." : "New Tool"}
        </button>
      </div>

      {/* Section Navigation */}
      <AgentStudioNav />

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          {isInitialLoading ? (
            <div className="flex items-center justify-center h-64 text-neutral-500">
              Loading tools...
            </div>
          ) : !selectedGroup ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <Wrench className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg mb-2">Select a group</p>
              <p className="text-sm">
                Choose a group from the agents page to view tools
              </p>
            </div>
          ) : tools.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <Wrench className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg mb-2">No tools yet</p>
              <p className="text-sm">
                Create your first tool to extend agent capabilities
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  onClick={() => router.push(`/agents/tools/${tool.id}`)}
                  onDelete={(e) => handleDeleteTool(tool.id, e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ToolCardProps {
  tool: AgentTool;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function ToolCard({ tool, onClick, onDelete }: ToolCardProps) {
  const { description, input_schema } = tool.metadata;
  const inputFields = Object.keys(
    (input_schema as { properties?: Record<string, unknown> })?.properties || {}
  );

  return (
    <div
      onClick={onClick}
      className="group relative p-4 bg-neutral-900 border border-neutral-800 rounded-lg hover:border-neutral-700 cursor-pointer transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="font-medium text-neutral-100 font-mono text-sm">
              {tool.data}
            </h3>
            <p className="text-xs text-neutral-500">
              {inputFields.length} input{inputFields.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-neutral-400 mb-3 line-clamp-2">
          {description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-neutral-500">
        <span>Updated {new Date(tool.updated_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
