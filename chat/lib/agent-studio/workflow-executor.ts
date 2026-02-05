/**
 * Workflow Executor - Executes workflow graphs with support for
 * agent nodes, branch conditions, and streaming responses.
 */

import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecutionState,
  WorkflowExecutionContext,
  WorkflowStepResult,
  Agent,
} from "@/types/agent-studio";
import { agentRepository } from "./AgentRepository";
import {
  evaluateInputMapping,
  evaluateBranchCondition,
} from "./expression-evaluator";

export interface ExecuteWorkflowOptions {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  triggerInput: string;
  groupId: string;
  userId: string;
  onStateChange: (state: WorkflowExecutionState) => void;
  signal?: AbortSignal;
}

/**
 * Topological sort using Kahn's algorithm
 * Returns node IDs in execution order
 */
function topologicalSort(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build graph
  for (const edge of edges) {
    const targets = adjacency.get(edge.source) || [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);

    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Find starting nodes (no incoming edges)
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  // Process
  const result: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);

    for (const target of adjacency.get(nodeId) || []) {
      const newDegree = (inDegree.get(target) || 1) - 1;
      inDegree.set(target, newDegree);
      if (newDegree === 0) {
        queue.push(target);
      }
    }
  }

  return result;
}

/**
 * Find which nodes are reachable from a branch via a specific handle
 */
function findNodesOnBranch(
  branchNodeId: string,
  selectedHandle: string,
  edges: WorkflowEdge[],
  allNodeIds: Set<string>
): Set<string> {
  const reachable = new Set<string>();

  // Find the edge from this branch with the selected handle
  const startEdge = edges.find(
    (e) => e.source === branchNodeId && e.source_handle === selectedHandle
  );

  if (!startEdge) return reachable;

  // BFS to find all reachable nodes
  const queue = [startEdge.target];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (!allNodeIds.has(nodeId) || reachable.has(nodeId)) continue;

    reachable.add(nodeId);

    // Find outgoing edges
    for (const edge of edges) {
      if (edge.source === nodeId && allNodeIds.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  return reachable;
}

/**
 * Execute an agent node with streaming response
 */
async function executeAgentNode(
  node: WorkflowNode,
  input: unknown,
  groupId: string,
  userId: string,
  signal: AbortSignal | undefined,
  onUpdate: (result: Partial<WorkflowStepResult>) => void
): Promise<string> {
  const agentId = node.data.agent_id;
  if (!agentId) {
    throw new Error("Agent node missing agent_id");
  }

  // Load agent config
  const agent = await agentRepository.getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  // Call agent execution endpoint with streaming
  const response = await fetch("/api/agent-studio/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: agentId,
      message: String(input),
      config: {
        name: agent.data,
        instructions: agent.metadata.instructions,
        model_config: agent.metadata.model_config,
      },
      history: [],
      group_id: groupId,
      user_id: userId,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Agent execution failed: ${response.status} - ${errorText}`);
  }

  // Handle streaming response
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      fullContent += decoder.decode(value);

      // Update with streaming content
      onUpdate({
        streaming_content: fullContent,
      });
    }
  }

  return fullContent;
}

/**
 * Execute a branch node - evaluate conditions and return selected branch
 */
function executeBranchNode(
  node: WorkflowNode,
  context: WorkflowExecutionContext
): { selected_branch: string } {
  const conditions = node.data.conditions || [];

  // Evaluate each condition in order
  for (const condition of conditions) {
    if (evaluateBranchCondition(condition.expression, context)) {
      return { selected_branch: condition.id };
    }
  }

  // No condition matched - use default
  return { selected_branch: "default" };
}

/**
 * Execute a single workflow node
 */
async function executeNode(
  node: WorkflowNode,
  context: WorkflowExecutionContext,
  groupId: string,
  userId: string,
  signal: AbortSignal | undefined,
  onUpdate: (result: Partial<WorkflowStepResult>) => void
): Promise<WorkflowStepResult> {
  const startedAt = new Date().toISOString();

  // Resolve input mapping
  const input = evaluateInputMapping(node.data.input_mapping, context);

  try {
    let output: unknown;

    switch (node.type) {
      case "agent":
        output = await executeAgentNode(
          node,
          input,
          groupId,
          userId,
          signal,
          onUpdate
        );
        break;

      case "branch":
        output = executeBranchNode(node, context);
        break;

      case "step":
      default:
        // Generic step - just passes through
        output = input;
        break;
    }

    return {
      node_id: node.id,
      status: "completed",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      input,
      output,
    };
  } catch (error) {
    return {
      node_id: node.id,
      status: "failed",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      input,
      error: error instanceof Error ? error.message : "Step execution failed",
    };
  }
}

/**
 * Execute a workflow from trigger input to completion
 */
export async function executeWorkflow(
  options: ExecuteWorkflowOptions
): Promise<WorkflowExecutionState> {
  const { nodes, edges, triggerInput, groupId, userId, onStateChange, signal } =
    options;

  // Build execution order (topological sort)
  const executionOrder = topologicalSort(nodes, edges);

  // Initialize execution state
  const initialState: WorkflowExecutionState = {
    status: "running",
    started_at: new Date().toISOString(),
    context: {
      trigger: {
        input: triggerInput,
        started_at: new Date().toISOString(),
      },
      steps: {},
    },
    execution_order: executionOrder,
  };

  let currentState = initialState;
  onStateChange(currentState);

  // Track which nodes to skip (for branch handling)
  const skippedNodes = new Set<string>();
  const allNodeIds = new Set(nodes.map((n) => n.id));

  try {
    // Execute each node in order
    for (const nodeId of executionOrder) {
      // Check for cancellation
      if (signal?.aborted) {
        throw new Error("Execution cancelled");
      }

      // Skip nodes marked as skipped (wrong branch path)
      if (skippedNodes.has(nodeId)) {
        currentState = {
          ...currentState,
          context: {
            ...currentState.context,
            steps: {
              ...currentState.context.steps,
              [nodeId]: {
                node_id: nodeId,
                status: "skipped",
              },
            },
          },
        };
        onStateChange(currentState);
        continue;
      }

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      // Update current node
      currentState = {
        ...currentState,
        current_node_id: nodeId,
        context: {
          ...currentState.context,
          steps: {
            ...currentState.context.steps,
            [nodeId]: {
              node_id: nodeId,
              status: "running",
              started_at: new Date().toISOString(),
            },
          },
        },
      };
      onStateChange(currentState);

      // Execute the node
      const result = await executeNode(
        node,
        currentState.context,
        groupId,
        userId,
        signal,
        (partialResult) => {
          // Callback for streaming updates
          currentState = {
            ...currentState,
            context: {
              ...currentState.context,
              steps: {
                ...currentState.context.steps,
                [nodeId]: {
                  ...currentState.context.steps[nodeId],
                  ...partialResult,
                },
              },
            },
          };
          onStateChange(currentState);
        }
      );

      // Update context with result
      currentState = {
        ...currentState,
        context: {
          ...currentState.context,
          steps: {
            ...currentState.context.steps,
            [nodeId]: result,
          },
        },
      };
      onStateChange(currentState);

      // Handle branch result - mark non-selected paths as skipped
      if (node.type === "branch" && result.status === "completed") {
        const branchResult = result.output as { selected_branch: string };
        const selectedHandle = branchResult.selected_branch;

        // Find all edges from this branch
        const branchEdges = edges.filter((e) => e.source === nodeId);

        // For each edge NOT on the selected branch, mark downstream nodes as skipped
        for (const edge of branchEdges) {
          if (edge.source_handle !== selectedHandle) {
            // Find all nodes reachable from this non-selected branch
            const nonSelectedNodes = findNodesOnBranch(
              nodeId,
              edge.source_handle || "",
              edges,
              allNodeIds
            );
            for (const skipId of nonSelectedNodes) {
              skippedNodes.add(skipId);
            }
          }
        }
      }

      // Stop on failure
      if (result.status === "failed") {
        throw new Error(result.error || "Step failed");
      }
    }

    // Mark as completed
    const finalState: WorkflowExecutionState = {
      ...currentState,
      status: "completed",
      completed_at: new Date().toISOString(),
      current_node_id: undefined,
    };
    onStateChange(finalState);
    return finalState;
  } catch (error) {
    const errorState: WorkflowExecutionState = {
      ...currentState,
      status: "failed",
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
    onStateChange(errorState);
    return errorState;
  }
}
