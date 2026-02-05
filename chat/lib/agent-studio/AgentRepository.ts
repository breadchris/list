/**
 * AgentRepository - CRUD operations for AI agents using the content table pattern
 */

import { supabase } from "@/lib/list/SupabaseClient";
import type {
  Agent,
  AgentMetadata,
  AgentTool,
  AgentToolMetadata,
  AgentWorkflow,
  AgentWorkflowMetadata,
  AgentCollection,
  AgentCollectionMetadata,
  AgentTrace,
  AgentTraceMetadata,
  AgentChunk,
} from "@/types/agent-studio";
import {
  AGENT_CONTENT_TYPE,
  AGENT_TOOL_CONTENT_TYPE,
  AGENT_WORKFLOW_CONTENT_TYPE,
  AGENT_COLLECTION_CONTENT_TYPE,
  AGENT_CHUNK_CONTENT_TYPE,
  AGENT_TRACE_CONTENT_TYPE,
  DEFAULT_AGENT_METADATA,
} from "@/types/agent-studio";

/**
 * Repository for managing AI agents and related content
 */
export class AgentRepository {
  // ==================== AGENTS ====================

  /**
   * Create a new agent
   */
  async createAgent(params: {
    name: string;
    group_id: string;
    user_id: string;
    metadata?: Partial<AgentMetadata>;
  }): Promise<Agent> {
    const metadata: AgentMetadata = {
      ...DEFAULT_AGENT_METADATA,
      ...params.metadata,
    };

    const { data, error } = await supabase
      .from("content")
      .insert([
        {
          type: AGENT_CONTENT_TYPE,
          data: params.name,
          group_id: params.group_id,
          user_id: params.user_id,
          metadata,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating agent:", error);
      throw new Error(error.message);
    }

    return data as Agent;
  }

  /**
   * Get all agents for a group
   */
  async getAgents(groupId: string): Promise<Agent[]> {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("type", AGENT_CONTENT_TYPE)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching agents:", error);
      throw new Error(error.message);
    }

    return (data || []) as Agent[];
  }

  /**
   * Get a single agent by ID
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("id", agentId)
      .eq("type", AGENT_CONTENT_TYPE)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      console.error("Error fetching agent:", error);
      throw new Error(error.message);
    }

    return data as Agent;
  }

  /**
   * Update an agent
   */
  async updateAgent(
    agentId: string,
    updates: {
      name?: string;
      metadata?: Partial<AgentMetadata>;
    }
  ): Promise<Agent> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) {
      updateData.data = updates.name;
    }

    if (updates.metadata) {
      // Fetch current metadata to merge
      const current = await this.getAgent(agentId);
      if (!current) {
        throw new Error("Agent not found");
      }
      updateData.metadata = {
        ...current.metadata,
        ...updates.metadata,
      };
    }

    const { data, error } = await supabase
      .from("content")
      .update(updateData)
      .eq("id", agentId)
      .eq("type", AGENT_CONTENT_TYPE)
      .select()
      .single();

    if (error) {
      console.error("Error updating agent:", error);
      throw new Error(error.message);
    }

    return data as Agent;
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    const { error } = await supabase
      .from("content")
      .delete()
      .eq("id", agentId)
      .eq("type", AGENT_CONTENT_TYPE);

    if (error) {
      console.error("Error deleting agent:", error);
      throw new Error(error.message);
    }
  }

  /**
   * Clone an agent
   */
  async cloneAgent(
    agentId: string,
    newName: string,
    userId: string
  ): Promise<Agent> {
    const original = await this.getAgent(agentId);
    if (!original) {
      throw new Error("Agent not found");
    }

    return this.createAgent({
      name: newName,
      group_id: original.group_id,
      user_id: userId,
      metadata: original.metadata,
    });
  }

  // ==================== TOOLS ====================

  /**
   * Create a new tool
   */
  async createTool(params: {
    name: string;
    group_id: string;
    user_id: string;
    metadata: AgentToolMetadata;
  }): Promise<AgentTool> {
    const { data, error } = await supabase
      .from("content")
      .insert([
        {
          type: AGENT_TOOL_CONTENT_TYPE,
          data: params.name,
          group_id: params.group_id,
          user_id: params.user_id,
          metadata: params.metadata,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating tool:", error);
      throw new Error(error.message);
    }

    return data as AgentTool;
  }

  /**
   * Get all tools for a group
   */
  async getTools(groupId: string): Promise<AgentTool[]> {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("type", AGENT_TOOL_CONTENT_TYPE)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tools:", error);
      throw new Error(error.message);
    }

    return (data || []) as AgentTool[];
  }

  /**
   * Get tools by IDs
   */
  async getToolsByIds(toolIds: string[]): Promise<AgentTool[]> {
    if (toolIds.length === 0) return [];

    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("type", AGENT_TOOL_CONTENT_TYPE)
      .in("id", toolIds);

    if (error) {
      console.error("Error fetching tools by IDs:", error);
      throw new Error(error.message);
    }

    return (data || []) as AgentTool[];
  }

  /**
   * Get a single tool by ID
   */
  async getTool(toolId: string): Promise<AgentTool | null> {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("id", toolId)
      .eq("type", AGENT_TOOL_CONTENT_TYPE)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching tool:", error);
      throw new Error(error.message);
    }

    return data as AgentTool;
  }

  /**
   * Update a tool
   */
  async updateTool(
    toolId: string,
    updates: {
      name?: string;
      metadata?: Partial<AgentToolMetadata>;
    }
  ): Promise<AgentTool> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) {
      updateData.data = updates.name;
    }

    if (updates.metadata) {
      const current = await this.getTool(toolId);
      if (!current) {
        throw new Error("Tool not found");
      }
      updateData.metadata = {
        ...current.metadata,
        ...updates.metadata,
      };
    }

    const { data, error } = await supabase
      .from("content")
      .update(updateData)
      .eq("id", toolId)
      .eq("type", AGENT_TOOL_CONTENT_TYPE)
      .select()
      .single();

    if (error) {
      console.error("Error updating tool:", error);
      throw new Error(error.message);
    }

    return data as AgentTool;
  }

  /**
   * Delete a tool
   */
  async deleteTool(toolId: string): Promise<void> {
    const { error } = await supabase
      .from("content")
      .delete()
      .eq("id", toolId)
      .eq("type", AGENT_TOOL_CONTENT_TYPE);

    if (error) {
      console.error("Error deleting tool:", error);
      throw new Error(error.message);
    }
  }

  // ==================== WORKFLOWS ====================

  /**
   * Create a new workflow
   */
  async createWorkflow(params: {
    name: string;
    group_id: string;
    user_id: string;
    metadata: AgentWorkflowMetadata;
  }): Promise<AgentWorkflow> {
    const { data, error } = await supabase
      .from("content")
      .insert([
        {
          type: AGENT_WORKFLOW_CONTENT_TYPE,
          data: params.name,
          group_id: params.group_id,
          user_id: params.user_id,
          metadata: params.metadata,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating workflow:", error);
      throw new Error(error.message);
    }

    return data as AgentWorkflow;
  }

  /**
   * Get all workflows for a group
   */
  async getWorkflows(groupId: string): Promise<AgentWorkflow[]> {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("type", AGENT_WORKFLOW_CONTENT_TYPE)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching workflows:", error);
      throw new Error(error.message);
    }

    return (data || []) as AgentWorkflow[];
  }

  /**
   * Get a single workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<AgentWorkflow | null> {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("id", workflowId)
      .eq("type", AGENT_WORKFLOW_CONTENT_TYPE)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching workflow:", error);
      throw new Error(error.message);
    }

    return data as AgentWorkflow;
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(
    workflowId: string,
    updates: {
      name?: string;
      metadata?: Partial<AgentWorkflowMetadata>;
    }
  ): Promise<AgentWorkflow> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) {
      updateData.data = updates.name;
    }

    if (updates.metadata) {
      const current = await this.getWorkflow(workflowId);
      if (!current) {
        throw new Error("Workflow not found");
      }
      updateData.metadata = {
        ...current.metadata,
        ...updates.metadata,
      };
    }

    const { data, error } = await supabase
      .from("content")
      .update(updateData)
      .eq("id", workflowId)
      .eq("type", AGENT_WORKFLOW_CONTENT_TYPE)
      .select()
      .single();

    if (error) {
      console.error("Error updating workflow:", error);
      throw new Error(error.message);
    }

    return data as AgentWorkflow;
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    const { error } = await supabase
      .from("content")
      .delete()
      .eq("id", workflowId)
      .eq("type", AGENT_WORKFLOW_CONTENT_TYPE);

    if (error) {
      console.error("Error deleting workflow:", error);
      throw new Error(error.message);
    }
  }

  // ==================== COLLECTIONS ====================

  /**
   * Create a new knowledge collection
   */
  async createCollection(params: {
    name: string;
    group_id: string;
    user_id: string;
    metadata: AgentCollectionMetadata;
  }): Promise<AgentCollection> {
    const { data, error } = await supabase
      .from("content")
      .insert([
        {
          type: AGENT_COLLECTION_CONTENT_TYPE,
          data: params.name,
          group_id: params.group_id,
          user_id: params.user_id,
          metadata: params.metadata,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating collection:", error);
      throw new Error(error.message);
    }

    return data as AgentCollection;
  }

  /**
   * Get all collections for a group
   */
  async getCollections(groupId: string): Promise<AgentCollection[]> {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("type", AGENT_COLLECTION_CONTENT_TYPE)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching collections:", error);
      throw new Error(error.message);
    }

    return (data || []) as AgentCollection[];
  }

  /**
   * Get a single collection by ID
   */
  async getCollection(collectionId: string): Promise<AgentCollection | null> {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("id", collectionId)
      .eq("type", AGENT_COLLECTION_CONTENT_TYPE)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching collection:", error);
      throw new Error(error.message);
    }

    return data as AgentCollection;
  }

  /**
   * Update a collection
   */
  async updateCollection(
    collectionId: string,
    updates: {
      name?: string;
      metadata?: Partial<AgentCollectionMetadata>;
    }
  ): Promise<AgentCollection> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) {
      updateData.data = updates.name;
    }

    if (updates.metadata) {
      const current = await this.getCollection(collectionId);
      if (!current) {
        throw new Error("Collection not found");
      }
      updateData.metadata = {
        ...current.metadata,
        ...updates.metadata,
      };
    }

    const { data, error } = await supabase
      .from("content")
      .update(updateData)
      .eq("id", collectionId)
      .eq("type", AGENT_COLLECTION_CONTENT_TYPE)
      .select()
      .single();

    if (error) {
      console.error("Error updating collection:", error);
      throw new Error(error.message);
    }

    return data as AgentCollection;
  }

  /**
   * Delete a collection and all its chunks
   */
  async deleteCollection(collectionId: string): Promise<void> {
    // First delete all chunks belonging to this collection
    await this.deleteChunks(collectionId);

    // Then delete the collection itself
    const { error } = await supabase
      .from("content")
      .delete()
      .eq("id", collectionId)
      .eq("type", AGENT_COLLECTION_CONTENT_TYPE);

    if (error) {
      console.error("Error deleting collection:", error);
      throw new Error(error.message);
    }
  }

  // ==================== CHUNKS ====================

  /**
   * Create a chunk for a collection
   */
  async createChunk(params: {
    text: string;
    collection_id: string;
    group_id: string;
    user_id: string;
    metadata: {
      chunk_index: number;
      embedding?: number[];
      source_filename?: string;
      source_content_id?: string;
    };
  }): Promise<AgentChunk> {
    const { data, error } = await supabase
      .from("content")
      .insert([
        {
          type: AGENT_CHUNK_CONTENT_TYPE,
          data: params.text,
          group_id: params.group_id,
          user_id: params.user_id,
          parent_content_id: params.collection_id,
          metadata: params.metadata,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating chunk:", error);
      throw new Error(error.message);
    }

    return data as AgentChunk;
  }

  /**
   * Create multiple chunks at once
   */
  async createChunks(
    chunks: Array<{
      text: string;
      collection_id: string;
      group_id: string;
      user_id: string;
      metadata: {
        chunk_index: number;
        embedding?: number[];
        source_filename?: string;
        source_content_id?: string;
      };
    }>
  ): Promise<AgentChunk[]> {
    if (chunks.length === 0) return [];

    const insertData = chunks.map((chunk) => ({
      type: AGENT_CHUNK_CONTENT_TYPE,
      data: chunk.text,
      group_id: chunk.group_id,
      user_id: chunk.user_id,
      parent_content_id: chunk.collection_id,
      metadata: chunk.metadata,
    }));

    const { data, error } = await supabase
      .from("content")
      .insert(insertData)
      .select();

    if (error) {
      console.error("Error creating chunks:", error);
      throw new Error(error.message);
    }

    return (data || []) as AgentChunk[];
  }

  /**
   * Get all chunks for a collection
   */
  async getChunks(collectionId: string): Promise<AgentChunk[]> {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("type", AGENT_CHUNK_CONTENT_TYPE)
      .eq("parent_content_id", collectionId)
      .order("metadata->chunk_index", { ascending: true });

    if (error) {
      console.error("Error fetching chunks:", error);
      throw new Error(error.message);
    }

    return (data || []) as AgentChunk[];
  }

  /**
   * Delete all chunks for a collection
   */
  async deleteChunks(collectionId: string): Promise<void> {
    const { error } = await supabase
      .from("content")
      .delete()
      .eq("type", AGENT_CHUNK_CONTENT_TYPE)
      .eq("parent_content_id", collectionId);

    if (error) {
      console.error("Error deleting chunks:", error);
      throw new Error(error.message);
    }
  }

  /**
   * Search chunks by cosine similarity (simple in-memory for now)
   * For production, use pgvector or dedicated vector DB
   */
  async searchChunks(
    collectionId: string,
    queryEmbedding: number[],
    topK: number = 5
  ): Promise<Array<AgentChunk & { similarity: number }>> {
    // Get all chunks for the collection
    const chunks = await this.getChunks(collectionId);

    // Calculate cosine similarity for each chunk
    const results = chunks
      .filter((chunk) => chunk.metadata.embedding && chunk.metadata.embedding.length > 0)
      .map((chunk) => {
        const similarity = this.cosineSimilarity(
          queryEmbedding,
          chunk.metadata.embedding!
        );
        return { ...chunk, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return results;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // ==================== TRACES ====================

  /**
   * Create a new trace for an agent execution
   */
  async createTrace(params: {
    agent_id: string;
    agent_name: string;
    group_id: string;
    user_id: string;
    metadata: AgentTraceMetadata;
  }): Promise<AgentTrace> {
    const { data, error } = await supabase
      .from("content")
      .insert([
        {
          type: AGENT_TRACE_CONTENT_TYPE,
          data: params.agent_name,
          group_id: params.group_id,
          user_id: params.user_id,
          parent_content_id: params.agent_id,
          metadata: params.metadata,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating trace:", error);
      throw new Error(error.message);
    }

    return data as AgentTrace;
  }

  /**
   * Get traces for an agent
   */
  async getTracesByAgent(
    agentId: string,
    limit = 50
  ): Promise<AgentTrace[]> {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("type", AGENT_TRACE_CONTENT_TYPE)
      .eq("parent_content_id", agentId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching traces:", error);
      throw new Error(error.message);
    }

    return (data || []) as AgentTrace[];
  }

  /**
   * Get all traces for a group
   */
  async getTraces(groupId: string, limit = 100): Promise<AgentTrace[]> {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("type", AGENT_TRACE_CONTENT_TYPE)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching traces:", error);
      throw new Error(error.message);
    }

    return (data || []) as AgentTrace[];
  }

  /**
   * Update a trace (e.g., when execution completes)
   */
  async updateTrace(
    traceId: string,
    metadata: Partial<AgentTraceMetadata>
  ): Promise<AgentTrace> {
    const { data: current, error: fetchError } = await supabase
      .from("content")
      .select("metadata")
      .eq("id", traceId)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    const { data, error } = await supabase
      .from("content")
      .update({
        metadata: { ...current.metadata, ...metadata },
        updated_at: new Date().toISOString(),
      })
      .eq("id", traceId)
      .select()
      .single();

    if (error) {
      console.error("Error updating trace:", error);
      throw new Error(error.message);
    }

    return data as AgentTrace;
  }
}

// Export singleton instance
export const agentRepository = new AgentRepository();
