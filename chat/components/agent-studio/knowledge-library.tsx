"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Database, Plus, Trash2 } from "lucide-react";
import { useGlobalGroup } from "@/components/GlobalGroupContext";
import { AgentStudioNav } from "./agent-studio-nav";
import { agentRepository } from "@/lib/agent-studio/AgentRepository";
import { supabase } from "@/lib/list/SupabaseClient";
import type { AgentCollection, AgentCollectionMetadata } from "@/types/agent-studio";
import { DEFAULT_COLLECTION_CONFIG } from "@/types/agent-studio";

const DEFAULT_COLLECTION_METADATA: AgentCollectionMetadata = {
  description: "Describe this knowledge collection",
  config: DEFAULT_COLLECTION_CONFIG,
  document_count: 0,
  chunk_count: 0,
};

export function KnowledgeLibrary() {
  const router = useRouter();
  const { selectedGroup } = useGlobalGroup();
  const [collections, setCollections] = useState<AgentCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch collections
  useEffect(() => {
    const fetchCollections = async () => {
      if (!selectedGroup) return;

      setLoading(true);
      try {
        const data = await agentRepository.getCollections(selectedGroup.id);
        setCollections(data);
      } catch (error) {
        console.error("Error fetching collections:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, [selectedGroup]);

  const handleCreateCollection = async () => {
    if (!selectedGroup) return;

    // Get user from Supabase auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.error("No authenticated user");
      return;
    }

    setCreating(true);
    try {
      const newCollection = await agentRepository.createCollection({
        name: "new_collection",
        group_id: selectedGroup.id,
        user_id: user.id,
        metadata: DEFAULT_COLLECTION_METADATA,
      });
      router.push(`/agents/knowledge/${newCollection.id}`);
    } catch (error) {
      console.error("Error creating collection:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCollection = async (
    e: React.MouseEvent,
    collectionId: string
  ) => {
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this collection and all its chunks?")) return;

    try {
      await agentRepository.deleteCollection(collectionId);
      setCollections((prev) => prev.filter((c) => c.id !== collectionId));
    } catch (error) {
      console.error("Error deleting collection:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pl-14 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-emerald-400" />
          <h1 className="text-xl font-semibold text-neutral-100">Knowledge Base</h1>
        </div>

        <button
          onClick={handleCreateCollection}
          disabled={creating || !selectedGroup}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {creating ? "Creating..." : "New Collection"}
        </button>
      </div>

      {/* Section Navigation */}
      <AgentStudioNav />

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-neutral-500">
            Loading collections...
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
            <Database className="w-12 h-12 mb-4 text-neutral-600" />
            <p className="text-lg mb-2">No knowledge collections yet</p>
            <p className="text-sm">
              Create a collection to upload documents for RAG
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((collection) => (
              <div
                key={collection.id}
                onClick={() => router.push(`/agents/knowledge/${collection.id}`)}
                className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg hover:border-neutral-700 cursor-pointer transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Database className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-mono text-sm text-neutral-100">
                        {collection.data}
                      </h3>
                      <p className="text-xs text-neutral-500">
                        {collection.metadata.chunk_count || 0} chunks
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteCollection(e, collection.id)}
                    className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-neutral-400 mb-3 line-clamp-2">
                  {collection.metadata.description || "No description"}
                </p>

                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {collection.metadata.config.vector_store} + {collection.metadata.config.embedder}
                  </span>
                  <span>Updated {formatDate(collection.updated_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
