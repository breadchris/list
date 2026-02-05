"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Wrench } from "lucide-react";

interface ToolNodeData {
  label: string;
  tool_id?: string;
  tool_name?: string;
  input_mapping?: string;
  [key: string]: unknown;
}

export const ToolNode = memo(function ToolNode({
  data,
  selected,
}: NodeProps & { data: ToolNodeData }) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-neutral-900 min-w-[150px] ${
        selected
          ? "border-orange-400 shadow-lg shadow-orange-500/20"
          : "border-orange-500/30 hover:border-orange-500/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-orange-500 border-2 border-neutral-900"
      />

      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-orange-500/10 flex items-center justify-center">
          <Wrench className="w-3.5 h-3.5 text-orange-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-neutral-200">
            {data.label || "Tool"}
          </span>
          {(data.tool_name || data.tool_id) && (
            <span className="text-xs text-neutral-500 truncate max-w-[120px]">
              {data.tool_name || `ID: ${data.tool_id?.slice(0, 8)}...`}
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-orange-500 border-2 border-neutral-900"
      />
    </div>
  );
});
