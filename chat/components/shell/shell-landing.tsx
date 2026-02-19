"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, Plus } from "lucide-react";

const LAMBDA_URL =
  "https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/content";

export function ShellLanding() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const startSession = async () => {
    setLoading(true);
    try {
      const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const docId = `terminal-${sessionId}`;

      const res = await fetch(LAMBDA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "shell-start",
          payload: { doc_id: docId, cols: 80, rows: 24 },
        }),
      });

      const data = await res.json();
      if (data.success || data.doc_id) {
        router.push(`/shell/${sessionId}`);
      } else {
        console.error("Failed to start shell:", data.error);
        setLoading(false);
      }
    } catch (err) {
      console.error("Failed to start shell:", err);
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Terminal className="w-12 h-12 text-green-400 mx-auto" />
        <h2 className="text-lg text-neutral-200">Shell</h2>
        <p className="text-sm text-neutral-500 max-w-xs">
          Start a remote terminal session synced in real-time via Y-Sweet
        </p>
        <button
          onClick={startSession}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {loading ? "Starting..." : "New Session"}
        </button>
      </div>
    </div>
  );
}
