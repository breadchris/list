"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ChevronLeft,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  User,
  Bot,
  Coins,
} from "lucide-react";
import { useGlobalGroup } from "@/components/GlobalGroupContext";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import { AgentStudioNav } from "./agent-studio-nav";
import type { AgentTrace, Agent } from "@/types/agent-studio";

export function TraceViewer() {
  const router = useRouter();
  const { selectedGroup, user } = useGlobalGroup();
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<AgentTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterAgentId, setFilterAgentId] = useState<string>("all");

  const loadData = useCallback(async () => {
    if (!selectedGroup) return;

    try {
      const [tracesData, agentsData] = await Promise.all([
        agentRepository.getTraces(selectedGroup.id, 100),
        agentRepository.getAgents(selectedGroup.id),
      ]);
      setTraces(tracesData);
      setAgents(agentsData);
    } catch (error) {
      console.error("Error loading traces:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedGroup]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const filteredTraces = filterAgentId === "all"
    ? traces
    : traces.filter((t) => t.metadata.agent_id === filterAgentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 text-neutral-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pl-14 py-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/agents")}
            className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Activity className="w-5 h-5 text-emerald-500" />
          <h1 className="text-xl font-semibold text-neutral-100">Execution Logs</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Agent filter */}
          <select
            value={filterAgentId}
            onChange={(e) => setFilterAgentId(e.target.value)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm"
          >
            <option value="all">All Agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.data}
              </option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Section Navigation */}
      <AgentStudioNav />

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Trace list */}
        <div className="w-1/2 border-r border-neutral-800 overflow-y-auto">
          {filteredTraces.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500">
              <Activity className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg">No execution logs yet</p>
              <p className="text-sm mt-1">Chat with an agent to see traces here</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {filteredTraces.map((trace) => (
                <button
                  key={trace.id}
                  onClick={() => setSelectedTrace(trace)}
                  className={`w-full p-4 text-left hover:bg-neutral-800/50 transition-colors ${
                    selectedTrace?.id === trace.id ? "bg-neutral-800" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(trace.metadata.status)}
                      <span className="font-medium text-neutral-200">
                        {trace.data}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-500">
                      {formatTimeAgo(trace.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(trace.metadata.duration_ms)}
                    </span>
                    {trace.metadata.token_usage && (
                      <span className="flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {trace.metadata.token_usage.total_tokens} tokens
                      </span>
                    )}
                    <span>
                      {trace.metadata.messages.length} messages
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Trace detail */}
        <div className="w-1/2 overflow-y-auto">
          {selectedTrace ? (
            <TraceDetail trace={selectedTrace} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500">
              <ChevronRight className="w-8 h-8 mb-2 opacity-50" />
              <p>Select a trace to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TraceDetail({ trace }: { trace: AgentTrace }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["messages", "tokens"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
        <h3 className="text-sm font-medium text-neutral-300 mb-3">Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-neutral-500">Agent:</span>
            <span className="ml-2 text-neutral-200">{trace.data}</span>
          </div>
          <div>
            <span className="text-neutral-500">Status:</span>
            <span className={`ml-2 ${
              trace.metadata.status === "success"
                ? "text-emerald-400"
                : trace.metadata.status === "error"
                ? "text-red-400"
                : "text-yellow-400"
            }`}>
              {trace.metadata.status}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Duration:</span>
            <span className="ml-2 text-neutral-200">
              {trace.metadata.duration_ms ? `${trace.metadata.duration_ms}ms` : "-"}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Created:</span>
            <span className="ml-2 text-neutral-200">
              {new Date(trace.created_at).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Token Usage */}
      {trace.metadata.token_usage && (
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
          <button
            onClick={() => toggleSection("tokens")}
            className="flex items-center justify-between w-full text-sm font-medium text-neutral-300"
          >
            <span className="flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Token Usage
            </span>
            {expandedSections.has("tokens") ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          {expandedSections.has("tokens") && (
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-neutral-800 rounded-lg text-center">
                <div className="text-neutral-500 text-xs mb-1">Prompt</div>
                <div className="text-neutral-200 font-mono">
                  {trace.metadata.token_usage.prompt_tokens}
                </div>
              </div>
              <div className="p-3 bg-neutral-800 rounded-lg text-center">
                <div className="text-neutral-500 text-xs mb-1">Completion</div>
                <div className="text-neutral-200 font-mono">
                  {trace.metadata.token_usage.completion_tokens}
                </div>
              </div>
              <div className="p-3 bg-emerald-900/30 rounded-lg text-center">
                <div className="text-emerald-500 text-xs mb-1">Total</div>
                <div className="text-emerald-400 font-mono font-medium">
                  {trace.metadata.token_usage.total_tokens}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
        <button
          onClick={() => toggleSection("messages")}
          className="flex items-center justify-between w-full text-sm font-medium text-neutral-300"
        >
          <span>Messages ({trace.metadata.messages.length})</span>
          {expandedSections.has("messages") ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        {expandedSections.has("messages") && (
          <div className="mt-3 space-y-3">
            {trace.metadata.messages.map((msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-900/20 border border-blue-800/30"
                    : msg.role === "assistant"
                    ? "bg-emerald-900/20 border border-emerald-800/30"
                    : "bg-neutral-800 border border-neutral-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {msg.role === "user" ? (
                    <User className="w-4 h-4 text-blue-400" />
                  ) : msg.role === "assistant" ? (
                    <Bot className="w-4 h-4 text-emerald-400" />
                  ) : null}
                  <span className={`text-xs font-medium ${
                    msg.role === "user"
                      ? "text-blue-400"
                      : msg.role === "assistant"
                      ? "text-emerald-400"
                      : "text-neutral-400"
                  }`}>
                    {msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-neutral-300 whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {trace.metadata.error && (
        <div className="p-4 bg-red-900/20 border border-red-800/30 rounded-lg">
          <h3 className="text-sm font-medium text-red-400 mb-2">Error</h3>
          <p className="text-sm text-red-300 font-mono">
            {trace.metadata.error}
          </p>
        </div>
      )}
    </div>
  );
}
