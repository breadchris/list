"use client";

import { useState, useCallback, memo } from "react";
import { Search, Loader2, Compass } from "lucide-react";

interface RabbitHoleInputProps {
  onSubmit: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const RabbitHoleInput = memo(function RabbitHoleInput({
  onSubmit,
  isLoading = false,
  placeholder = "Enter a topic to explore...",
}: RabbitHoleInputProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedQuery = query.trim();
      if (trimmedQuery && !isLoading) {
        onSubmit(trimmedQuery);
        setQuery("");
      }
    },
    [query, isLoading, onSubmit]
  );

  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="w-full max-w-xl space-y-6">
        {/* Icon and title */}
        <div className="text-center">
          <Compass className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Start Your Exploration
          </h1>
          <p className="text-muted-foreground">
            Enter any topic and dive deep into the rabbit hole
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              disabled={isLoading}
              autoFocus
              className="w-full px-4 py-4 pr-12 bg-card border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition-all text-lg"
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-purple-400 disabled:text-muted-foreground/50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Search className="w-6 h-6" />
              )}
            </button>
          </div>
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-muted disabled:text-muted-foreground text-white rounded-xl transition-colors font-medium text-lg"
          >
            {isLoading ? "Exploring..." : "Explore"}
          </button>
        </form>

        {/* Suggestions */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-3">Try exploring:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "Quantum Computing",
              "Ancient Rome",
              "Machine Learning",
              "Philosophy of Mind",
              "Climate Science",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setQuery(suggestion);
                }}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm bg-muted hover:bg-accent text-foreground rounded-full transition-colors disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
