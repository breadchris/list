"use client";

import { CheckCircle2, Circle, Loader2, XCircle, SkipForward, Zap } from "lucide-react";
import type { WorkflowExecutionState, WorkflowNode } from "@/types/agent-studio";

interface WorkflowTestResultsProps {
  executionState: WorkflowExecutionState | null;
  nodes: WorkflowNode[];
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case "running":
      return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-400" />;
    case "skipped":
      return <SkipForward className="w-4 h-4 text-neutral-500" />;
    case "pending":
    default:
      return <Circle className="w-4 h-4 text-neutral-600" />;
  }
}

function StepResultDisplay({
  nodeId,
  node,
  executionState,
}: {
  nodeId: string;
  node: WorkflowNode | undefined;
  executionState: WorkflowExecutionState;
}) {
  const stepResult = executionState.context.steps[nodeId];
  const status = stepResult?.status || "pending";
  const isCurrentNode = executionState.current_node_id === nodeId;

  return (
    <div
      className={`p-3 rounded-lg border ${
        isCurrentNode
          ? "border-cyan-500/50 bg-cyan-500/5"
          : status === "failed"
          ? "border-red-500/30 bg-red-500/5"
          : status === "completed"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-neutral-800 bg-neutral-900/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <span className="text-sm font-medium text-neutral-200">
          {node?.data.label || nodeId}
        </span>
        <span className="text-xs text-neutral-500 ml-auto">
          {node?.type || "step"}
        </span>
      </div>

      {/* Show streaming content for running agent nodes */}
      {status === "running" && stepResult?.streaming_content && (
        <div className="mt-2 p-2 bg-neutral-800/50 rounded text-xs text-neutral-300 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
          {stepResult.streaming_content}
          <span className="animate-pulse text-cyan-400">|</span>
        </div>
      )}

      {/* Show output for completed nodes */}
      {status === "completed" && stepResult?.output !== undefined && (
        <div className="mt-2 p-2 bg-neutral-800/50 rounded text-xs text-neutral-300 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
          {typeof stepResult.output === "string"
            ? stepResult.output
            : JSON.stringify(stepResult.output, null, 2)}
        </div>
      )}

      {/* Show error for failed nodes */}
      {status === "failed" && stepResult?.error && (
        <div className="mt-2 p-2 bg-red-900/20 border border-red-800/30 rounded text-xs text-red-300">
          {stepResult.error}
        </div>
      )}
    </div>
  );
}

export function WorkflowTestResults({
  executionState,
  nodes,
}: WorkflowTestResultsProps) {
  if (!executionState) {
    return (
      <div className="text-sm text-neutral-500 text-center py-4">
        Click "Run" to execute the workflow
      </div>
    );
  }

  const { execution_order, context, status } = executionState;

  return (
    <div className="space-y-3">
      {/* Trigger */}
      <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-900/50">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-neutral-200">Trigger</span>
          <span className="text-xs text-neutral-500 ml-auto">input</span>
        </div>
        <div className="mt-2 p-2 bg-neutral-800/50 rounded text-xs text-neutral-300 font-mono">
          {context.trigger.input || "(empty)"}
        </div>
      </div>

      {/* Steps in execution order */}
      {execution_order.map((nodeId) => {
        const node = nodes.find((n) => n.id === nodeId);
        return (
          <StepResultDisplay
            key={nodeId}
            nodeId={nodeId}
            node={node}
            executionState={executionState}
          />
        );
      })}

      {/* Overall status */}
      {status === "completed" && (
        <div className="p-3 bg-emerald-900/20 border border-emerald-800/30 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-300">
            Workflow completed successfully
          </span>
        </div>
      )}

      {status === "failed" && executionState.error && (
        <div className="p-3 bg-red-900/20 border border-red-800/30 rounded-lg flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-300">{executionState.error}</span>
        </div>
      )}
    </div>
  );
}
