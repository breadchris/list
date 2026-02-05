"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Play, GitBranch, X, Send, Square } from "lucide-react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import { WorkflowSidebar } from "./workflow-sidebar";
import { WorkflowStepConfig } from "./workflow-step-config";
import { StepNode } from "./workflow-nodes/step-node";
import { AgentNode } from "./workflow-nodes/agent-node";
import { ToolNode } from "./workflow-nodes/tool-node";
import { BranchNode } from "./workflow-nodes/branch-node";
import type { AgentWorkflow, WorkflowNode, WorkflowEdge, WorkflowExecutionState } from "@/types/agent-studio";
import { executeWorkflow } from "@/lib/agent-studio/workflow-executor";
import { WorkflowTestResults } from "./workflow-test-results";

// Register custom node types
const nodeTypes: NodeTypes = {
  step: StepNode,
  agent: AgentNode,
  tool: ToolNode,
  branch: BranchNode,
};

interface WorkflowEditorProps {
  workflowId: string;
}

export function WorkflowEditor({ workflowId }: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorContent workflowId={workflowId} />
    </ReactFlowProvider>
  );
}

function WorkflowEditorContent({ workflowId }: WorkflowEditorProps) {
  const { fitView } = useReactFlow();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<AgentWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [executionState, setExecutionState] = useState<WorkflowExecutionState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch workflow
  useEffect(() => {
    const fetchWorkflow = async () => {
      setLoading(true);
      try {
        const data = await agentRepository.getWorkflow(workflowId);
        if (data) {
          setWorkflow(data);
          setName(data.data);
          setDescription(data.metadata.description || "");

          // Convert workflow nodes to React Flow nodes
          const rfNodes: Node[] = data.metadata.graph.nodes.map((node: WorkflowNode) => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: node.data,
          }));
          setNodes(rfNodes);

          // Convert workflow edges to React Flow edges
          const rfEdges: Edge[] = data.metadata.graph.edges.map((edge: WorkflowEdge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.source_handle,
            targetHandle: edge.target_handle,
            label: edge.label,
          }));
          setEdges(rfEdges);
        }
      } catch (error) {
        console.error("Error fetching workflow:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId]);

  // Track changes
  useEffect(() => {
    if (!workflow) return;

    const originalNodes = JSON.stringify(workflow.metadata.graph.nodes);
    const originalEdges = JSON.stringify(workflow.metadata.graph.edges);
    const currentNodes = JSON.stringify(
      nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      }))
    );
    const currentEdges = JSON.stringify(
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        source_handle: e.sourceHandle,
        target_handle: e.targetHandle,
        label: e.label,
      }))
    );

    const changed =
      name !== workflow.data ||
      description !== (workflow.metadata.description || "") ||
      currentNodes !== originalNodes ||
      currentEdges !== originalEdges;

    setHasChanges(changed);
  }, [workflow, name, description, nodes, edges]);

  const handleSave = async () => {
    if (!workflow) return;

    setSaving(true);
    try {
      // Convert React Flow nodes/edges back to workflow format
      const workflowNodes = nodes.map((n) => ({
        id: n.id,
        type: n.type as WorkflowNode["type"],
        position: n.position,
        data: n.data as WorkflowNode["data"],
      }));

      const workflowEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        source_handle: e.sourceHandle ?? undefined,
        target_handle: e.targetHandle ?? undefined,
        label: e.label as string | undefined,
      }));

      const updated = await agentRepository.updateWorkflow(workflowId, {
        name,
        metadata: {
          description: description || undefined,
          graph: {
            nodes: workflowNodes,
            edges: workflowEdges,
          },
        },
      });
      setWorkflow(updated);
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving workflow:", error);
    } finally {
      setSaving(false);
    }
  };

  // React Flow event handlers
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect: OnConnect = useCallback(
    (connection) =>
      setEdges((eds) =>
        addEdge({ ...connection, id: `e-${Date.now()}` }, eds)
      ),
    []
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Add new node from sidebar
  const handleAddNode = useCallback(
    (type: string, label: string) => {
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position: { x: 250, y: nodes.length * 100 + 150 },
        data: { label },
      };
      setNodes((nds) => [...nds, newNode]);
      // Auto-fit view after adding node (with small delay for state update)
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    },
    [nodes.length, fitView]
  );

  // Update selected node
  const handleUpdateNode = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        )
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) =>
          prev ? { ...prev, data: { ...prev.data, ...data } } : null
        );
      }
    },
    [selectedNode?.id]
  );

  // Delete selected node
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
    },
    [selectedNode?.id]
  );

  // Run workflow execution
  const handleRun = useCallback(async () => {
    if (!workflow || executionState?.status === "running") return;

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Convert React Flow nodes/edges to workflow format
    const workflowNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type as WorkflowNode["type"],
      position: n.position,
      data: n.data as WorkflowNode["data"],
    }));

    const workflowEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      source_handle: e.sourceHandle ?? undefined,
      target_handle: e.targetHandle ?? undefined,
      label: e.label as string | undefined,
    }));

    await executeWorkflow({
      nodes: workflowNodes,
      edges: workflowEdges,
      triggerInput: testInput,
      groupId: workflow.group_id,
      userId: workflow.user_id,
      onStateChange: setExecutionState,
      signal: abortControllerRef.current.signal,
    });

    abortControllerRef.current = null;
  }, [workflow, nodes, edges, testInput, executionState?.status]);

  // Cancel workflow execution
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const isRunning = executionState?.status === "running";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        Loading workflow...
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        Workflow not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pl-14 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/agents/workflows")}
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-purple-400" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-semibold bg-transparent border-none outline-none text-neutral-100 focus:ring-1 focus:ring-purple-500 rounded px-2 py-1"
              placeholder="Workflow Name"
            />
            {hasChanges && (
              <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                Unsaved
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTestPanel(!showTestPanel)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showTestPanel
                ? "bg-emerald-600 text-white"
                : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            }`}
          >
            <Play className="w-4 h-4" />
            Test
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Main content - 3 column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Step library */}
        <WorkflowSidebar onAddNode={handleAddNode} />

        {/* Center - Canvas */}
        <div className="flex-1 bg-neutral-900">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            className="workflow-canvas"
          >
            <Background color="#333" gap={20} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case "agent":
                    return "#06b6d4";
                  case "tool":
                    return "#f97316";
                  case "branch":
                    return "#a855f7";
                  default:
                    return "#525252";
                }
              }}
              style={{ background: "#171717" }}
            />
          </ReactFlow>
        </div>

        {/* Right sidebar - Step configuration */}
        <WorkflowStepConfig
          selectedNode={selectedNode}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          groupId={workflow.group_id}
        />
      </div>

      {/* Test Panel */}
      {showTestPanel && (
        <div className="border-t border-neutral-800 bg-neutral-950 p-4 max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" />
              Test Workflow
            </h3>
            <button
              onClick={() => setShowTestPanel(false)}
              className="p-1 text-neutral-500 hover:text-neutral-300 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs text-neutral-500 mb-1">
                Trigger Input
              </label>
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Enter test input for the workflow..."
                disabled={isRunning}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>
            {isRunning ? (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors self-end"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={nodes.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors self-end disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Run
              </button>
            )}
          </div>

          {/* Execution Results */}
          <WorkflowTestResults
            executionState={executionState}
            nodes={nodes.map((n) => ({
              id: n.id,
              type: n.type as WorkflowNode["type"],
              position: n.position,
              data: n.data as WorkflowNode["data"],
            }))}
          />
        </div>
      )}
    </div>
  );
}
