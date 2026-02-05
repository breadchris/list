"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";

interface QueryResult {
  id: string;
  text: string;
  similarity: number;
  source_filename?: string;
}

interface QueryTesterProps {
  collectionId: string;
}

export function QueryTester({ collectionId }: QueryTesterProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QueryResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const response = await fetch("/api/agent-studio/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_id: collectionId,
          query: query.trim(),
          top_k: 5,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.results || []);
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
      <h3 className="text-sm font-medium text-neutral-200 mb-4">Query Tester</h3>

      {/* Search input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a search query..."
          className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {searching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-neutral-500">
            Top {results.length} results:
          </p>
          {results.map((result, index) => (
            <div
              key={result.id}
              className="p-3 bg-neutral-800 rounded-lg border border-neutral-700"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-emerald-400">
                  #{index + 1}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-400">
                    Score: {(result.similarity * 100).toFixed(1)}%
                  </span>
                  {result.source_filename && (
                    <span className="text-neutral-500">
                      {result.source_filename}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-neutral-300 line-clamp-3">
                {result.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Empty state after search */}
      {results.length === 0 && !searching && !error && query && (
        <p className="mt-4 text-sm text-neutral-500 text-center">
          No results found. Try a different query.
        </p>
      )}
    </div>
  );
}
