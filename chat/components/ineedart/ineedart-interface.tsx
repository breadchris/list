"use client";

import { useState, useEffect } from "react";
import { useGlobalGroup } from "@/components/GlobalGroupContext";
import { useSupabaseUser } from "@/hooks/useSupabaseAuth";
import { contentRepository, Content } from "@/lib/list/ContentRepository";
import { PromptForm } from "./prompt-form";
import { ArtRequestCard } from "./art-request-card";
import { ArtRequestView } from "./art-request-view";
import { Plus, Palette, ArrowLeft } from "lucide-react";

export function IneedartInterface() {
  const { selectedGroup, isLoading: groupLoading } = useGlobalGroup();
  const { user, isLoading: userLoading } = useSupabaseUser();
  const [artRequests, setArtRequests] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Content | null>(null);

  // Fetch art requests for the current group
  useEffect(() => {
    async function fetchArtRequests() {
      if (!selectedGroup?.id) return;

      setLoading(true);
      try {
        // Get all content of type "art-request" for this group
        const { data, error } = await contentRepository.getContentByType(
          selectedGroup.id,
          "art-request"
        );
        if (error) throw error;
        setArtRequests(data || []);
      } catch (err) {
        console.error("Error fetching art requests:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchArtRequests();
  }, [selectedGroup?.id]);

  const handleRequestCreated = (newRequest: Content) => {
    setArtRequests((prev) => [newRequest, ...prev]);
    setShowCreateForm(false);
    setSelectedRequest(newRequest);
  };

  const handleDeleteRequest = async (requestId: string) => {
    try {
      await contentRepository.deleteContent(requestId);
      setArtRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (selectedRequest?.id === requestId) {
        setSelectedRequest(null);
      }
    } catch (err) {
      console.error("Error deleting request:", err);
    }
  };

  if (groupLoading || userLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-950">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-neutral-950 p-8">
        <Palette className="w-16 h-16 text-pink-400 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Sign in to create art requests</h2>
        <p className="text-neutral-400 text-center">
          Create prompts with inspiration images and share them with artists
        </p>
      </div>
    );
  }

  if (!selectedGroup) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-950">
        <div className="text-neutral-400">Please select a group</div>
      </div>
    );
  }

  // Show single request view
  if (selectedRequest) {
    return (
      <div className="h-full bg-neutral-950 overflow-auto">
        <ArtRequestView
          request={selectedRequest}
          groupId={selectedGroup.id}
          isOwner={selectedRequest.user_id === user.id}
          onBack={() => setSelectedRequest(null)}
          onDelete={() => handleDeleteRequest(selectedRequest.id)}
        />
      </div>
    );
  }

  // Show create form
  if (showCreateForm) {
    return (
      <div className="h-full bg-neutral-950 overflow-auto">
        <div className="max-w-2xl mx-auto p-4">
          <button
            onClick={() => setShowCreateForm(false)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-white mb-6">Create Art Request</h1>
          <PromptForm
            groupId={selectedGroup.id}
            onCreated={handleRequestCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      </div>
    );
  }

  // Show list of art requests
  return (
    <div className="h-full bg-neutral-950 overflow-auto">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Palette className="w-8 h-8 text-pink-400" />
            <h1 className="text-2xl font-bold text-white">Art Requests</h1>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        </div>

        {loading ? (
          <div className="text-neutral-400 text-center py-12">Loading requests...</div>
        ) : artRequests.length === 0 ? (
          <div className="text-center py-12">
            <Palette className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <p className="text-neutral-400 mb-4">No art requests yet</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-pink-400 hover:text-pink-300"
            >
              Create your first request
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {artRequests.map((request) => (
              <ArtRequestCard
                key={request.id}
                request={request}
                onClick={() => setSelectedRequest(request)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
