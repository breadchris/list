"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Box } from "lucide-react";

interface StepNodeData {
  label: string;
  [key: string]: unknown;
}

export const StepNode = memo(function StepNode({
  data,
  selected,
}: NodeProps & { data: StepNodeData }) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-neutral-900 min-w-[150px] ${
        selected
          ? "border-neutral-400 shadow-lg"
          : "border-neutral-700 hover:border-neutral-600"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-neutral-500 border-2 border-neutral-900"
      />

      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-neutral-700/50 flex items-center justify-center">
          <Box className="w-3.5 h-3.5 text-neutral-400" />
        </div>
        <span className="text-sm font-medium text-neutral-200">
          {data.label || "Step"}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-neutral-500 border-2 border-neutral-900"
      />
    </div>
  );
});
