"use client";

import {
  Box,
  Bot,
  Wrench,
  GitBranch,
  Layers,
  RotateCw,
  Hand,
} from "lucide-react";

interface WorkflowSidebarProps {
  onAddNode: (type: string, label: string) => void;
}

const STEP_TYPES = [
  {
    type: "step",
    label: "Step",
    description: "Basic processing step",
    icon: Box,
    color: "neutral",
  },
  {
    type: "agent",
    label: "Agent",
    description: "Run an AI agent",
    icon: Bot,
    color: "cyan",
  },
  {
    type: "tool",
    label: "Tool",
    description: "Execute a tool directly",
    icon: Wrench,
    color: "orange",
  },
  {
    type: "branch",
    label: "Branch",
    description: "Conditional branching",
    icon: GitBranch,
    color: "purple",
  },
  {
    type: "parallel",
    label: "Parallel",
    description: "Run steps in parallel",
    icon: Layers,
    color: "blue",
  },
  {
    type: "foreach",
    label: "Loop",
    description: "Iterate over items",
    icon: RotateCw,
    color: "green",
  },
  {
    type: "suspend",
    label: "Suspend",
    description: "Wait for human input",
    icon: Hand,
    color: "yellow",
  },
];

const getColorClasses = (color: string) => {
  switch (color) {
    case "cyan":
      return "bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20";
    case "orange":
      return "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20";
    case "purple":
      return "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20";
    case "blue":
      return "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20";
    case "green":
      return "bg-green-500/10 text-green-400 hover:bg-green-500/20";
    case "yellow":
      return "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20";
    default:
      return "bg-neutral-700/50 text-neutral-400 hover:bg-neutral-700";
  }
};

export function WorkflowSidebar({ onAddNode }: WorkflowSidebarProps) {
  return (
    <div className="w-48 border-r border-neutral-800 bg-neutral-950 p-3 overflow-auto">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
        Step Library
      </div>

      <div className="space-y-2">
        {STEP_TYPES.map((step) => (
          <button
            key={step.type}
            onClick={() => onAddNode(step.type, step.label)}
            className={`w-full flex items-start gap-2 p-2 rounded-lg transition-colors text-left ${getColorClasses(
              step.color
            )}`}
          >
            <step.icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium">{step.label}</div>
              <div className="text-xs opacity-60 truncate">
                {step.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-neutral-800">
        <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
          Tips
        </div>
        <div className="text-xs text-neutral-500 space-y-2">
          <p>Click a step to add it to the canvas.</p>
          <p>Drag between nodes to connect them.</p>
          <p>Select a node to configure it.</p>
        </div>
      </div>
    </div>
  );
}
