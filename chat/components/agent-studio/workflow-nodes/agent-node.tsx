"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";

interface AgentNodeData {
  label: string;
  agent_id?: string;
  agent_name?: string;
  input_mapping?: string;
  [key: string]: unknown;
}

export const AgentNode = memo(function AgentNode({
  data,
  selected,
}: NodeProps & { data: AgentNodeData }) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-neutral-900 min-w-[150px] ${
        selected
          ? "border-cyan-400 shadow-lg shadow-cyan-500/20"
          : "border-cyan-500/30 hover:border-cyan-500/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-cyan-500 border-2 border-neutral-900"
      />

      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-cyan-500/10 flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-neutral-200">
            {data.label || "Agent"}
          </span>
          {(data.agent_name || data.agent_id) && (
            <span className="text-xs text-neutral-500 truncate max-w-[120px]">
              {data.agent_name || `ID: ${data.agent_id?.slice(0, 8)}...`}
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-cyan-500 border-2 border-neutral-900"
      />
    </div>
  );
});
