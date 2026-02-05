"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Bot, Trash2, Copy, Play, Users, ChevronRight } from "lucide-react";
import { AgentStudioNav } from "./agent-studio-nav";
import { useGlobalGroup } from "@/components/GlobalGroupContext";
import { GlobalGroupSelector } from "@/components/GlobalGroupSelector";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import { supabase } from "@/lib/list/SupabaseClient";
import type { Agent } from "@/types/agent-studio";

export function AgentStudioLanding() {
  const router = useRouter();
  const { selectedGroup, isLoading: groupsLoading } = useGlobalGroup();
  const [userId, setUserId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch user ID from Supabase auth
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    fetchUser();
  }, []);

  // Fetch agents when group changes
  useEffect(() => {
    if (!selectedGroup) {
      setAgents([]);
      setLoading(false);
      return;
    }

    const fetchAgents = async () => {
      setLoading(true);
      try {
        const data = await agentRepository.getAgents(selectedGroup.id);
        setAgents(data);
      } catch (error) {
        console.error("Error fetching agents:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [selectedGroup]);

  const handleCreateAgent = async () => {
    if (!selectedGroup || !userId) {
      console.warn("Cannot create agent: missing selectedGroup or userId", { selectedGroup, userId });
      return;
    }

    setCreating(true);
    try {
      const agent = await agentRepository.createAgent({
        name: "New Agent",
        group_id: selectedGroup.id,
        user_id: userId,
      });
      router.push(`/agents/${agent.id}`);
    } catch (error) {
      console.error("Error creating agent:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAgent = async (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this agent?")) return;

    try {
      await agentRepository.deleteAgent(agentId);
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch (error) {
      console.error("Error deleting agent:", error);
    }
  };

  const handleCloneAgent = async (agent: Agent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;

    try {
      const cloned = await agentRepository.cloneAgent(
        agent.id,
        `${agent.data} (Copy)`,
        userId
      );
      setAgents((prev) => [cloned, ...prev]);
    } catch (error) {
      console.error("Error cloning agent:", error);
    }
  };

  const isInitialLoading = groupsLoading || (selectedGroup && loading);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pl-14 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-semibold text-neutral-100">
            Agent Studio
          </h1>
        </div>
        <button
          onClick={handleCreateAgent}
          disabled={creating || !selectedGroup || !userId}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {creating ? "Creating..." : "New Agent"}
        </button>
      </div>

      {/* Section Navigation */}
      <AgentStudioNav />

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Group selector */}
          <GlobalGroupSelector
            trigger={
              <button className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-4 hover:border-neutral-700 transition-colors text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Current Group</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-500" />
                </div>
                <p className="mt-2 text-neutral-300 font-medium">
                  {groupsLoading ? "Loading..." : selectedGroup?.name || "No group selected"}
                </p>
              </button>
            }
          />

          {/* Agent Grid */}
          {isInitialLoading ? (
            <div className="flex items-center justify-center h-64 text-neutral-500">
              Loading agents...
            </div>
          ) : !selectedGroup ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg mb-2">Select a group</p>
              <p className="text-sm">Choose a group above to view and create agents</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <Bot className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg mb-2">No agents yet</p>
              <p className="text-sm">Create your first AI agent to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={() => router.push(`/agents/${agent.id}`)}
                  onDelete={(e) => handleDeleteAgent(agent.id, e)}
                  onClone={(e) => handleCloneAgent(agent, e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AgentCardProps {
  agent: Agent;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onClone: (e: React.MouseEvent) => void;
}

function AgentCard({ agent, onClick, onDelete, onClone }: AgentCardProps) {
  const { model_config, tool_ids, description } = agent.metadata;
  const toolCount = tool_ids?.length || 0;

  return (
    <div
      onClick={onClick}
      className="group relative p-4 bg-neutral-900 border border-neutral-800 rounded-lg hover:border-neutral-700 cursor-pointer transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-medium text-neutral-100">{agent.data}</h3>
            <p className="text-xs text-neutral-500">
              {model_config.provider}/{model_config.model}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onClone}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200"
            title="Clone"
          >
            <Copy className="w-4 h-4" />
          </button>
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
        <span>{toolCount} tools</span>
        <span>
          Updated {new Date(agent.updated_at).toLocaleDateString()}
        </span>
      </div>

      {/* Quick test button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="absolute bottom-4 right-4 p-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        title="Test Agent"
      >
        <Play className="w-4 h-4 text-white" />
      </button>
    </div>
  );
}

