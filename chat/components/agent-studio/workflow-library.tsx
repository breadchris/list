"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { useGlobalGroup } from "@/components/GlobalGroupContext";
import { AgentStudioNav } from "./agent-studio-nav";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import { supabase } from "@/lib/list/SupabaseClient";
import type { AgentWorkflow, AgentWorkflowMetadata } from "@/types/agent-studio";

const DEFAULT_WORKFLOW_METADATA: AgentWorkflowMetadata = {
  description: "Describe what this workflow does",
  graph: {
    nodes: [
      {
        id: "trigger",
        type: "step",
        position: { x: 250, y: 50 },
        data: { label: "Trigger" },
      },
    ],
    edges: [],
  },
  input_schema: {
    type: "object",
    properties: {
      input: { type: "string", description: "Workflow input" },
    },
  },
};

export function WorkflowLibrary() {
  const router = useRouter();
  const { selectedGroup } = useGlobalGroup();
  const [workflows, setWorkflows] = useState<AgentWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch workflows
  useEffect(() => {
    const fetchWorkflows = async () => {
      if (!selectedGroup) return;

      setLoading(true);
      try {
        const data = await agentRepository.getWorkflows(selectedGroup.id);
        setWorkflows(data);
      } catch (error) {
        console.error("Error fetching workflows:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, [selectedGroup]);

  const handleCreateWorkflow = async () => {
    if (!selectedGroup) return;

    // Get user from Supabase auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.error("No authenticated user");
      return;
    }

    setCreating(true);
    try {
      const newWorkflow = await agentRepository.createWorkflow({
        name: "new_workflow",
        group_id: selectedGroup.id,
        user_id: user.id,
        metadata: DEFAULT_WORKFLOW_METADATA,
      });
      router.push(`/agents/workflows/${newWorkflow.id}`);
    } catch (error) {
      console.error("Error creating workflow:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteWorkflow = async (
    e: React.MouseEvent,
    workflowId: string
  ) => {
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this workflow?")) return;

    try {
      await agentRepository.deleteWorkflow(workflowId);
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
    } catch (error) {
      console.error("Error deleting workflow:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pl-14 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-purple-400" />
          <h1 className="text-xl font-semibold text-neutral-100">Workflows</h1>
        </div>

        <button
          onClick={handleCreateWorkflow}
          disabled={creating || !selectedGroup}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {creating ? "Creating..." : "New Workflow"}
        </button>
      </div>

      {/* Section Navigation */}
      <AgentStudioNav />

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-neutral-500">
            Loading workflows...
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
            <GitBranch className="w-12 h-12 mb-4 text-neutral-600" />
            <p className="text-lg mb-2">No workflows yet</p>
            <p className="text-sm">
              Create a workflow to orchestrate agents, tools, and logic
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                onClick={() => router.push(`/agents/workflows/${workflow.id}`)}
                className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg hover:border-neutral-700 cursor-pointer transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <GitBranch className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-mono text-sm text-neutral-100">
                        {workflow.data}
                      </h3>
                      <p className="text-xs text-neutral-500">
                        {workflow.metadata.graph.nodes.length} steps
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteWorkflow(e, workflow.id)}
                    className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-neutral-400 mb-3 line-clamp-2">
                  {workflow.metadata.description || "No description"}
                </p>

                <p className="text-xs text-neutral-500">
                  Updated {formatDate(workflow.updated_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
