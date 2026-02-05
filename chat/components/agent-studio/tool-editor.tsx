"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Wrench, Play } from "lucide-react";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import { InlineSchemaBuilder } from "./schema-builder";
import type { AgentTool, AgentToolMetadata } from "@/types/agent-studio";

interface ToolEditorProps {
  toolId: string;
}

export function ToolEditor({ toolId }: ToolEditorProps) {
  const router = useRouter();
  const [tool, setTool] = useState<AgentTool | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inputSchema, setInputSchema] = useState<Record<string, unknown>>({
    type: "object",
    properties: {},
  });
  const [outputSchema, setOutputSchema] = useState<Record<string, unknown>>({
    type: "object",
    properties: {},
  });
  const [executeCode, setExecuteCode] = useState("");

  // Test state
  const [testInput, setTestInput] = useState("{}");
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // Fetch tool
  useEffect(() => {
    const fetchTool = async () => {
      setLoading(true);
      try {
        const data = await agentRepository.getTool(toolId);
        if (data) {
          setTool(data);
          setName(data.data);
          setDescription(data.metadata.description || "");
          setInputSchema(data.metadata.input_schema || { type: "object", properties: {} });
          setOutputSchema(data.metadata.output_schema || { type: "object", properties: {} });
          setExecuteCode(data.metadata.execute_code || "");
        }
      } catch (error) {
        console.error("Error fetching tool:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTool();
  }, [toolId]);

  // Track changes
  useEffect(() => {
    if (!tool) return;

    const changed =
      name !== tool.data ||
      description !== (tool.metadata.description || "") ||
      JSON.stringify(inputSchema) !== JSON.stringify(tool.metadata.input_schema) ||
      JSON.stringify(outputSchema) !== JSON.stringify(tool.metadata.output_schema) ||
      executeCode !== (tool.metadata.execute_code || "");

    setHasChanges(changed);
  }, [tool, name, description, inputSchema, outputSchema, executeCode]);

  const handleSave = async () => {
    if (!tool) return;

    setSaving(true);
    try {
      const updated = await agentRepository.updateTool(toolId, {
        name,
        metadata: {
          description,
          input_schema: inputSchema,
          output_schema: outputSchema,
          execute_code: executeCode,
        },
      });
      setTool(updated);
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving tool:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestOutput(null);
    try {
      // Parse input
      const input = JSON.parse(testInput);

      // Create a safe evaluation context
      // Note: In production, this should be executed server-side
      const fn = new Function(
        "inputData",
        `return (${executeCode})({ inputData })`
      );

      const result = await fn(input);
      setTestOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setTestOutput(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        Loading tool...
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        Tool not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pl-14 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/agents/tools")}
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-orange-400" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.replace(/\s/g, "_"))}
              className="text-lg font-semibold bg-transparent border-none outline-none text-neutral-100 font-mono focus:ring-1 focus:ring-cyan-500 rounded px-2 py-1"
              placeholder="tool_name"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Description
            </label>
            <p className="text-xs text-neutral-500 mb-2">
              Helps the LLM understand when and how to use this tool
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this tool does..."
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
              rows={2}
            />
          </div>

          {/* Schemas side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Input Schema */}
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
              <InlineSchemaBuilder
                schema={inputSchema}
                onChange={setInputSchema}
                title="Input Schema"
              />
            </div>

            {/* Output Schema */}
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
              <InlineSchemaBuilder
                schema={outputSchema}
                onChange={setOutputSchema}
                title="Output Schema"
              />
            </div>
          </div>

          {/* Execute Code */}
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Execute Function
            </label>
            <p className="text-xs text-neutral-500 mb-2">
              JavaScript function that runs when the tool is called. Receives{" "}
              <code className="text-cyan-400">inputData</code> object.
            </p>
            <textarea
              value={executeCode}
              onChange={(e) => setExecuteCode(e.target.value)}
              placeholder={`async ({ inputData }) => {
  const { input } = inputData;
  // Your implementation here
  return { result: input };
}`}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none font-mono text-sm"
              rows={10}
              spellCheck={false}
            />
          </div>

          {/* Test Tool */}
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-neutral-400">
                Test Tool
              </label>
              <button
                onClick={handleTest}
                disabled={testing || !executeCode}
                className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-3 h-3" />
                {testing ? "Running..." : "Run"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-500 mb-2">Input (JSON)</p>
                <textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-neutral-100 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                  rows={4}
                  spellCheck={false}
                />
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-2">Output</p>
                <pre className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-neutral-100 font-mono text-sm overflow-auto h-[104px]">
                  {testOutput || "Run the tool to see output"}
                </pre>
              </div>
            </div>
          </div>

          {/* JSON Schema Preview */}
          <details className="text-xs">
            <summary className="text-neutral-500 cursor-pointer hover:text-neutral-400">
              View JSON Schema
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <pre className="p-3 bg-neutral-900 border border-neutral-800 rounded text-neutral-400 overflow-auto">
                {JSON.stringify(inputSchema, null, 2)}
              </pre>
              <pre className="p-3 bg-neutral-900 border border-neutral-800 rounded text-neutral-400 overflow-auto">
                {JSON.stringify(outputSchema, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
