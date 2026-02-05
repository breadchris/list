"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Database } from "lucide-react";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import { DocumentUploader } from "./document-uploader";
import { ChunkPreview } from "./chunk-preview";
import { QueryTester } from "./query-tester";
import type { AgentCollection, AgentChunk, CollectionConfig } from "@/types/agent-studio";

interface CollectionEditorProps {
  collectionId: string;
}

export function CollectionEditor({ collectionId }: CollectionEditorProps) {
  const router = useRouter();
  const [collection, setCollection] = useState<AgentCollection | null>(null);
  const [chunks, setChunks] = useState<AgentChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<CollectionConfig>({
    vector_store: "pgvector",
    embedder: "openai",
    chunk_size: 512,
    chunk_overlap: 50,
    chunk_strategy: "recursive",
  });

  // Fetch collection and chunks
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [collectionData, chunksData] = await Promise.all([
          agentRepository.getCollection(collectionId),
          agentRepository.getChunks(collectionId),
        ]);
        if (collectionData) {
          setCollection(collectionData);
          setName(collectionData.data);
          setDescription(collectionData.metadata.description || "");
          setConfig(collectionData.metadata.config);
          setChunks(chunksData);
        }
      } catch (error) {
        console.error("Error fetching collection:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [collectionId]);

  // Track changes
  useEffect(() => {
    if (!collection) return;

    const changed =
      name !== collection.data ||
      description !== (collection.metadata.description || "") ||
      JSON.stringify(config) !== JSON.stringify(collection.metadata.config);

    setHasChanges(changed);
  }, [collection, name, description, config]);

  const handleSave = async () => {
    if (!collection) return;

    setSaving(true);
    try {
      const updated = await agentRepository.updateCollection(collectionId, {
        name,
        metadata: {
          description: description || undefined,
          config,
          chunk_count: chunks.length,
        },
      });
      setCollection(updated);
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving collection:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleChunksAdded = (newChunks: AgentChunk[]) => {
    setChunks((prev) => [...prev, ...newChunks]);
  };

  const handleRefreshChunks = async () => {
    try {
      const chunksData = await agentRepository.getChunks(collectionId);
      setChunks(chunksData);
    } catch (error) {
      console.error("Error refreshing chunks:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        Loading collection...
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        Collection not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pl-14 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/agents/knowledge")}
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-semibold bg-transparent border-none outline-none text-neutral-100 focus:ring-1 focus:ring-emerald-500 rounded px-2 py-1"
              placeholder="Collection Name"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this collection contains..."
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            rows={2}
          />
        </div>

        {/* Configuration */}
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
          <h3 className="text-sm font-medium text-neutral-200 mb-4">Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Vector Store</label>
              <select
                value={config.vector_store}
                onChange={(e) =>
                  setConfig({ ...config, vector_store: e.target.value as CollectionConfig["vector_store"] })
                }
                className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100"
              >
                <option value="pgvector">pgvector</option>
                <option value="pinecone">Pinecone</option>
                <option value="qdrant">Qdrant</option>
                <option value="mongodb">MongoDB</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Embedder</label>
              <select
                value={config.embedder}
                onChange={(e) =>
                  setConfig({ ...config, embedder: e.target.value as CollectionConfig["embedder"] })
                }
                className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100"
              >
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
                <option value="fastembed">FastEmbed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Chunk Size</label>
              <input
                type="number"
                value={config.chunk_size}
                onChange={(e) =>
                  setConfig({ ...config, chunk_size: parseInt(e.target.value) || 512 })
                }
                className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Overlap</label>
              <input
                type="number"
                value={config.chunk_overlap}
                onChange={(e) =>
                  setConfig({ ...config, chunk_overlap: parseInt(e.target.value) || 50 })
                }
                className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs text-neutral-500 mb-1">Chunking Strategy</label>
            <select
              value={config.chunk_strategy}
              onChange={(e) =>
                setConfig({ ...config, chunk_strategy: e.target.value as CollectionConfig["chunk_strategy"] })
              }
              className="w-full max-w-xs px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100"
            >
              <option value="recursive">Recursive</option>
              <option value="sentence">Sentence</option>
              <option value="paragraph">Paragraph</option>
            </select>
          </div>
        </div>

        {/* Document Uploader */}
        <DocumentUploader
          collectionId={collectionId}
          config={config}
          onChunksAdded={handleChunksAdded}
        />

        {/* Query Tester */}
        <QueryTester collectionId={collectionId} />

        {/* Chunk Preview */}
        <ChunkPreview chunks={chunks} onRefresh={handleRefreshChunks} />
      </div>
    </div>
  );
}
