"use client";

/**
 * Builder Context
 *
 * Provides shared state for the chat-first Agent Studio.
 * Manages drafts, component states, and persistence.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  Agent,
  AgentMetadata,
  AgentWorkflow,
  AgentWorkflowMetadata,
  AgentToolMetadata,
  BuilderContextState,
  BuilderContextActions,
} from "@/types/agent-studio";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";

// ============================================================================
// Context Types
// ============================================================================

interface BuilderContextValue extends BuilderContextState, BuilderContextActions {}

const BuilderContext = createContext<BuilderContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface BuilderContextProviderProps {
  groupId: string;
  userId: string;
  children: ReactNode;
}

export function BuilderContextProvider({
  groupId,
  userId,
  children,
}: BuilderContextProviderProps) {
  // State
  const [agentDraft, setAgentDraft] = useState<Partial<AgentMetadata> | null>(null);
  const [workflowDraft, setWorkflowDraft] = useState<Partial<AgentWorkflowMetadata> | null>(null);
  const [toolDraft, setToolDraft] = useState<Partial<AgentToolMetadata> | null>(null);
  const [componentStates, setComponentStates] = useState<Record<string, unknown>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | undefined>();
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | undefined>();

  // Auto-save to localStorage
  useEffect(() => {
    if (agentDraft && isDirty) {
      const saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(
            `builder-draft-${groupId}`,
            JSON.stringify({
              agent_draft: agentDraft,
              workflow_draft: workflowDraft,
              tool_draft: toolDraft,
              editing_agent_id: editingAgentId,
              editing_workflow_id: editingWorkflowId,
            })
          );
        } catch (error) {
          console.error("Error saving draft to localStorage:", error);
        }
      }, 2000); // Debounce 2 seconds

      return () => clearTimeout(saveTimer);
    }
  }, [agentDraft, workflowDraft, toolDraft, isDirty, groupId, editingAgentId, editingWorkflowId]);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`builder-draft-${groupId}`);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.agent_draft) setAgentDraft(data.agent_draft);
        if (data.workflow_draft) setWorkflowDraft(data.workflow_draft);
        if (data.tool_draft) setToolDraft(data.tool_draft);
        if (data.editing_agent_id) setEditingAgentId(data.editing_agent_id);
        if (data.editing_workflow_id) setEditingWorkflowId(data.editing_workflow_id);
      }
    } catch (error) {
      console.error("Error loading draft from localStorage:", error);
    }
  }, [groupId]);

  // Actions
  const updateAgentDraft = useCallback((updates: Partial<AgentMetadata>) => {
    setAgentDraft((prev) => ({
      ...prev,
      ...updates,
    }));
    setIsDirty(true);
  }, []);

  const updateWorkflowDraft = useCallback((updates: Partial<AgentWorkflowMetadata>) => {
    setWorkflowDraft((prev) => ({
      ...prev,
      ...updates,
    }));
    setIsDirty(true);
  }, []);

  const updateToolDraft = useCallback((updates: Partial<AgentToolMetadata>) => {
    setToolDraft((prev) => ({
      ...prev,
      ...updates,
    }));
    setIsDirty(true);
  }, []);

  const setComponentState = useCallback((instanceId: string, state: unknown) => {
    setComponentStates((prev) => ({
      ...prev,
      [instanceId]: state,
    }));
  }, []);

  const getComponentState = useCallback(
    (instanceId: string): unknown => {
      return componentStates[instanceId];
    },
    [componentStates]
  );

  const clearDrafts = useCallback(() => {
    setAgentDraft(null);
    setWorkflowDraft(null);
    setToolDraft(null);
    setComponentStates({});
    setIsDirty(false);
    setEditingAgentId(undefined);
    setEditingWorkflowId(undefined);
    localStorage.removeItem(`builder-draft-${groupId}`);
  }, [groupId]);

  const saveAgent = useCallback(async (): Promise<Agent> => {
    if (!agentDraft) {
      throw new Error("No agent draft to save");
    }

    // Ensure required fields are present
    const name = (agentDraft as { name?: string }).name || "New Agent";
    const metadata: AgentMetadata = {
      model_config: agentDraft.model_config || {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.7,
      },
      instructions: agentDraft.instructions || "You are a helpful AI assistant.",
      tool_ids: agentDraft.tool_ids || [],
      description: agentDraft.description,
      memory_config: agentDraft.memory_config,
      output_config: agentDraft.output_config,
      tags: agentDraft.tags,
      max_steps: agentDraft.max_steps,
    };

    let agent: Agent;

    if (editingAgentId) {
      // Update existing agent
      agent = await agentRepository.updateAgent(editingAgentId, {
        name,
        metadata,
      });
    } else {
      // Create new agent
      agent = await agentRepository.createAgent({
        name,
        group_id: groupId,
        user_id: userId,
        metadata,
      });
    }

    // Clear draft after successful save
    setAgentDraft(null);
    setIsDirty(false);
    setEditingAgentId(undefined);
    localStorage.removeItem(`builder-draft-${groupId}`);

    return agent;
  }, [agentDraft, editingAgentId, groupId, userId]);

  const saveWorkflow = useCallback(async (): Promise<AgentWorkflow> => {
    if (!workflowDraft) {
      throw new Error("No workflow draft to save");
    }

    // Ensure required fields are present
    const name = (workflowDraft as { name?: string }).name || "New Workflow";
    const metadata: AgentWorkflowMetadata = {
      graph: workflowDraft.graph || { nodes: [], edges: [] },
      description: workflowDraft.description,
      input_schema: workflowDraft.input_schema,
      output_schema: workflowDraft.output_schema,
    };

    let workflow: AgentWorkflow;

    if (editingWorkflowId) {
      // Update existing workflow
      workflow = await agentRepository.updateWorkflow(editingWorkflowId, {
        name,
        metadata,
      });
    } else {
      // Create new workflow
      workflow = await agentRepository.createWorkflow({
        name,
        group_id: groupId,
        user_id: userId,
        metadata,
      });
    }

    // Clear draft after successful save
    setWorkflowDraft(null);
    setIsDirty(false);
    setEditingWorkflowId(undefined);

    return workflow;
  }, [workflowDraft, editingWorkflowId, groupId, userId]);

  const loadAgent = useCallback(async (agentId: string): Promise<void> => {
    const agent = await agentRepository.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    setAgentDraft({
      ...agent.metadata,
      name: agent.data,
    } as Partial<AgentMetadata> & { name: string });
    setEditingAgentId(agentId);
    setIsDirty(false);
  }, []);

  const loadWorkflow = useCallback(async (workflowId: string): Promise<void> => {
    const workflow = await agentRepository.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    setWorkflowDraft({
      ...workflow.metadata,
      name: workflow.data,
    } as Partial<AgentWorkflowMetadata> & { name: string });
    setEditingWorkflowId(workflowId);
    setIsDirty(false);
  }, []);

  // Build context value
  const value: BuilderContextValue = {
    // State
    agent_draft: agentDraft,
    workflow_draft: workflowDraft,
    tool_draft: toolDraft,
    component_states: componentStates,
    group_id: groupId,
    user_id: userId,
    is_dirty: isDirty,
    editing_agent_id: editingAgentId,
    editing_workflow_id: editingWorkflowId,
    // Actions
    updateAgentDraft,
    updateWorkflowDraft,
    updateToolDraft,
    setComponentState,
    getComponentState,
    clearDrafts,
    saveAgent,
    saveWorkflow,
    loadAgent,
    loadWorkflow,
  };

  return (
    <BuilderContext.Provider value={value}>
      {children}
    </BuilderContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useBuilderContext(): BuilderContextValue {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error("useBuilderContext must be used within BuilderContextProvider");
  }
  return context;
}
