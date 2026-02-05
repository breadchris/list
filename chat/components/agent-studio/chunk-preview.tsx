"use client";

import { useState } from "react";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import type { AgentChunk } from "@/types/agent-studio";

interface ChunkPreviewProps {
  chunks: AgentChunk[];
  onRefresh: () => void;
}

const CHUNKS_PER_PAGE = 10;

export function ChunkPreview({ chunks, onRefresh }: ChunkPreviewProps) {
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const totalPages = Math.ceil(chunks.length / CHUNKS_PER_PAGE);
  const startIndex = page * CHUNKS_PER_PAGE;
  const endIndex = Math.min(startIndex + CHUNKS_PER_PAGE, chunks.length);
  const visibleChunks = chunks.slice(startIndex, endIndex);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-neutral-200">
          Chunks Preview
          <span className="ml-2 text-neutral-500">({chunks.length} total)</span>
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {chunks.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-8">
          No chunks yet. Upload documents to create chunks.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {visibleChunks.map((chunk, index) => (
              <div
                key={chunk.id}
                className="p-3 bg-neutral-800 rounded-lg border border-neutral-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-emerald-400">
                    #{startIndex + index + 1}
                  </span>
                  {chunk.metadata.source_filename && (
                    <span className="text-xs text-neutral-500">
                      {chunk.metadata.source_filename}
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-300 line-clamp-3">
                  {chunk.data}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                  <span>{chunk.data.length} chars</span>
                  {chunk.metadata.embedding && (
                    <span className="text-emerald-500">embedded</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
              <span className="text-xs text-neutral-500">
                Showing {startIndex + 1}-{endIndex} of {chunks.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-neutral-400">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
