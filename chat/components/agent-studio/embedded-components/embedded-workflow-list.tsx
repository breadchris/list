"use client";

/**
 * Embedded Workflow List
 *
 * Displays a list of workflows in the group.
 */

import { useState, useEffect } from "react";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import { useBuilderContext } from "../builder-context";
import type { AgentWorkflow } from "@/types/agent-studio";

interface EmbeddedWorkflowListProps {
  props: Record<string, unknown>;
  instanceId: string;
}

export function EmbeddedWorkflowList({ props, instanceId }: EmbeddedWorkflowListProps) {
  const { group_id, loadWorkflow } = useBuilderContext();
  const [workflows, setWorkflows] = useState<AgentWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkflows = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await agentRepository.getWorkflows(group_id);
        setWorkflows(data);
      } catch (err) {
        console.error("Error fetching workflows:", err);
        setError("Failed to load workflows");
      } finally {
        setLoading(false);
      }
    };

    if (group_id) {
      fetchWorkflows();
    }
  }, [group_id]);

  const handleEdit = async (workflowId: string) => {
    try {
      await loadWorkflow(workflowId);
    } catch (err) {
      console.error("Error loading workflow:", err);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-800">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-neutral-200">Your Workflows</span>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-neutral-600 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-800">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        </div>
        <span className="text-sm font-medium text-neutral-200">Your Workflows</span>
        <span className="text-xs text-neutral-500 ml-auto">{workflows.length} workflows</span>
      </div>

      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : workflows.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-neutral-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-sm text-neutral-500">No workflows yet</p>
          <p className="text-xs text-neutral-600 mt-1">Tell me what workflow you want to build</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-auto">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="group flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50 border border-neutral-700 hover:border-neutral-600 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-neutral-200 truncate">{workflow.data}</p>
                {workflow.metadata.description && (
                  <p className="text-xs text-neutral-500 truncate">
                    {workflow.metadata.description}
                  </p>
                )}
                <p className="text-xs text-neutral-600 mt-1">
                  {workflow.metadata.graph?.nodes?.length || 0} steps
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(workflow.id)}
                  className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition-colors"
                  title="Edit workflow"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
