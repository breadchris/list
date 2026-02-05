"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";

interface BranchCondition {
  id: string;
  expression: string;
}

interface BranchNodeData {
  label: string;
  conditions?: BranchCondition[];
  [key: string]: unknown;
}

export const BranchNode = memo(function BranchNode({
  data,
  selected,
}: NodeProps & { data: BranchNodeData }) {
  const conditions = data.conditions || [];

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-neutral-900 min-w-[150px] ${
        selected
          ? "border-purple-400 shadow-lg shadow-purple-500/20"
          : "border-purple-500/30 hover:border-purple-500/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-purple-500 border-2 border-neutral-900"
      />

      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-purple-500/10 flex items-center justify-center">
          <GitBranch className="w-3.5 h-3.5 text-purple-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-neutral-200">
            {data.label || "Branch"}
          </span>
          {conditions.length > 0 && (
            <span className="text-xs text-neutral-500">
              {conditions.length} condition{conditions.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Condition previews */}
      {conditions.length > 0 && conditions.some(c => c.expression) && (
        <div className="mt-2 pt-2 border-t border-neutral-800 space-y-1">
          {conditions.slice(0, 2).map((condition, index) => (
            condition.expression && (
              <div key={condition.id} className="flex items-center gap-1 text-[10px]">
                <span className="text-purple-400">{index + 1}:</span>
                <span className="text-neutral-400 font-mono truncate max-w-[100px]">
                  {condition.expression}
                </span>
              </div>
            )
          ))}
          {conditions.length > 2 && (
            <span className="text-[10px] text-neutral-500">+{conditions.length - 2} more</span>
          )}
        </div>
      )}

      {/* Multiple output handles for each condition + default */}
      <div className="flex justify-around mt-2 pt-2 border-t border-neutral-800">
        {conditions.map((condition, index) => (
          <div key={condition.id} className="relative">
            <Handle
              type="source"
              position={Position.Bottom}
              id={condition.id}
              className="w-2.5 h-2.5 !bg-purple-500 border-2 border-neutral-900"
              style={{ position: "relative", left: 0, transform: "none" }}
            />
            <span className="text-[10px] text-neutral-500 absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
              {index + 1}
            </span>
          </div>
        ))}
        {/* Default/else handle */}
        <div className="relative">
          <Handle
            type="source"
            position={Position.Bottom}
            id="default"
            className="w-2.5 h-2.5 !bg-neutral-500 border-2 border-neutral-900"
            style={{ position: "relative", left: 0, transform: "none" }}
          />
          <span className="text-[10px] text-neutral-500 absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
            else
          </span>
        </div>
      </div>

      {conditions.length === 0 && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-purple-500 border-2 border-neutral-900"
        />
      )}
    </div>
  );
});
