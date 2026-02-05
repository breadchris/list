"use client";

/**
 * Embedded Trace List
 *
 * Displays execution traces and logs.
 */

import { useState, useEffect } from "react";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import { useBuilderContext } from "../builder-context";
import type { AgentTrace } from "@/types/agent-studio";

interface EmbeddedTraceListProps {
  props: Record<string, unknown>;
  instanceId: string;
}

export function EmbeddedTraceList({ props, instanceId }: EmbeddedTraceListProps) {
  const { group_id } = useBuilderContext();
  const agentId = props.agent_id as string | undefined;
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTraces = async () => {
      setLoading(true);
      setError(null);
      try {
        // Use getTracesByAgent if agentId is provided, otherwise get all traces for group
        const data = agentId
          ? await agentRepository.getTracesByAgent(agentId)
          : await agentRepository.getTraces(group_id);
        setTraces(data);
      } catch (err) {
        console.error("Error fetching traces:", err);
        setError("Failed to load traces");
      } finally {
        setLoading(false);
      }
    };

    if (group_id) {
      fetchTraces();
    }
  }, [group_id, agentId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-green-400 bg-green-500/20";
      case "error":
        return "text-red-400 bg-red-500/20";
      case "pending":
        return "text-yellow-400 bg-yellow-500/20";
      default:
        return "text-neutral-400 bg-neutral-500/20";
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-800">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <span className="text-sm font-medium text-neutral-200">Execution Logs</span>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-neutral-600 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-800">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <span className="text-sm font-medium text-neutral-200">Execution Logs</span>
        <span className="text-xs text-neutral-500 ml-auto">{traces.length} runs</span>
      </div>

      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : traces.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-neutral-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm text-neutral-500">No execution logs yet</p>
          <p className="text-xs text-neutral-600 mt-1">Logs will appear when agents are run</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-auto">
          {traces.map((trace) => (
            <div key={trace.id} className="rounded-lg bg-neutral-800/50 border border-neutral-700 overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === trace.id ? null : trace.id)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-neutral-800/70 transition-colors"
              >
                {/* Status badge */}
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                    trace.metadata.status
                  )}`}
                >
                  {trace.metadata.status}
                </span>

                {/* Agent name */}
                <span className="font-medium text-neutral-200 truncate">{trace.data}</span>

                {/* Timestamp */}
                <span className="text-xs text-neutral-500 ml-auto">
                  {new Date(trace.created_at).toLocaleString()}
                </span>

                {/* Expand icon */}
                <svg
                  className={`w-4 h-4 text-neutral-500 transition-transform ${
                    expandedId === trace.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded content */}
              {expandedId === trace.id && (
                <div className="px-3 pb-3 pt-0 border-t border-neutral-700">
                  {/* Duration & tokens */}
                  <div className="flex gap-4 text-xs text-neutral-500 py-2">
                    {trace.metadata.duration_ms && (
                      <span>Duration: {trace.metadata.duration_ms}ms</span>
                    )}
                    {trace.metadata.token_usage && (
                      <span>Tokens: {trace.metadata.token_usage.total_tokens}</span>
                    )}
                  </div>

                  {/* Error */}
                  {trace.metadata.error && (
                    <div className="mt-2 p-2 rounded bg-red-950/30 border border-red-800/50">
                      <p className="text-xs text-red-400 font-mono">{trace.metadata.error}</p>
                    </div>
                  )}

                  {/* Messages preview */}
                  {trace.metadata.messages && trace.metadata.messages.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-neutral-500">Messages:</p>
                      {trace.metadata.messages.slice(0, 3).map((msg, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-neutral-400 p-2 rounded bg-neutral-900 truncate"
                        >
                          <span className="text-neutral-500">[{msg.role}]</span>{" "}
                          {msg.content.substring(0, 100)}...
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
