"use client";

/**
 * Embedded Workflow Editor
 *
 * Simplified workflow editor embedded in chat.
 * Full editor available via "expand" action.
 */

import { useBuilderContext } from "../builder-context";

interface EmbeddedWorkflowEditorProps {
  props: Record<string, unknown>;
  instanceId: string;
}

export function EmbeddedWorkflowEditor({ props, instanceId }: EmbeddedWorkflowEditorProps) {
  const { workflow_draft } = useBuilderContext();

  const nodes = workflow_draft?.graph?.nodes || (props.nodes as unknown[]) || [];
  const edges = workflow_draft?.graph?.edges || (props.edges as unknown[]) || [];

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-800">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        </div>
        <span className="text-sm font-medium text-neutral-200">Workflow Editor</span>
      </div>

      {/* Simplified visual representation */}
      <div className="min-h-[200px] bg-neutral-800/50 rounded-lg border border-neutral-700 p-4 relative">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8">
            <div className="w-12 h-12 rounded-full bg-neutral-700 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-sm text-neutral-500">No workflow steps yet</p>
            <p className="text-xs text-neutral-600 mt-1">
              Tell me what steps you want in your workflow
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-neutral-400">
              {nodes.length} steps, {edges.length} connections
            </p>
            <p className="text-xs text-neutral-500">
              Describe the workflow you want to build and I'll help configure it.
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-500 mt-3">
        Tip: Describe your workflow steps naturally, e.g., "First extract data, then process it, finally send an email"
      </p>
    </div>
  );
}
