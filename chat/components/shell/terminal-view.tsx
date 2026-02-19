"use client";

import { useEffect, useRef, useState } from "react";
import { useYDoc } from "@y-sweet/react";

interface TerminalViewProps {
  docId: string;
}

export function TerminalView({ docId }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const outputOffsetRef = useRef(0);
  const doc = useYDoc();
  const [status, setStatus] = useState<string>("connecting");

  useEffect(() => {
    if (!terminalRef.current || !doc) return;

    let cleanup: (() => void) | null = null;

    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      // CSS import for xterm
      await import("@xterm/xterm/css/xterm.css");

      if (!terminalRef.current) return;

      const terminal = new Terminal({
        cursorBlink: true,
        theme: {
          background: "#0a0a0a",
          foreground: "#e5e5e5",
        },
        fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
        fontSize: 14,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(terminalRef.current);
      fitAddon.fit();
      xtermRef.current = terminal;

      const shell = doc.getMap("shell");

      // Observe output changes -> write to xterm
      const outputObserver = () => {
        const currentOutput = (shell.get("output") as string) || "";
        if (currentOutput.length > outputOffsetRef.current) {
          const newOutput = currentOutput.substring(outputOffsetRef.current);
          outputOffsetRef.current = currentOutput.length;
          terminal.write(newOutput);
        }
      };

      // Observe status
      const statusObserver = () => {
        const s = shell.get("status") as string;
        if (s) setStatus(s);
      };

      shell.observe((event) => {
        outputObserver();
        statusObserver();
      });

      // Capture keystrokes -> append to Y.Map input
      terminal.onData((data: string) => {
        const current = (shell.get("input") as string) || "";
        shell.set("input", current + data);
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        shell.set("cols", terminal.cols);
        shell.set("rows", terminal.rows);
      });
      resizeObserver.observe(terminalRef.current);

      cleanup = () => {
        resizeObserver.disconnect();
        terminal.dispose();
      };
    })();

    return () => {
      cleanup?.();
    };
  }, [doc]);

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      <div className="flex items-center px-3 py-1.5 border-b border-neutral-800 bg-neutral-900/50">
        <div
          className={`w-2 h-2 rounded-full mr-2 ${
            status === "running"
              ? "bg-green-500"
              : status === "exited"
                ? "bg-red-500"
                : "bg-yellow-500 animate-pulse"
          }`}
        />
        <span className="text-xs text-neutral-400">{status}</span>
      </div>
      <div ref={terminalRef} className="flex-1" />
    </div>
  );
}
