"use client";

import { useState, useEffect } from "react";
import { FileUploadInput } from "@/components/FileUploadInput";
import { FileList } from "@/components/FileList";
import { useQueryClient } from "@tanstack/react-query";
import { useGroupsQuery } from "@/hooks/list/useGroupQueries";
import { getCurrentUser } from "@/lib/list/SupabaseClient";
import { ANONYMOUS_GROUP_ID, getOrCreateAnonymousUserId } from "@/lib/anonymousUser";
import type { User } from "@supabase/supabase-js";

export default function UploadsPage() {
  const queryClient = useQueryClient();

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Group state
  const [selectedGroupId, setSelectedGroupId] = useState<string>(ANONYMOUS_GROUP_ID);
  const { data: groups, isLoading: groupsLoading } = useGroupsQuery({ enabled: !!user });

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Initialize group selection when groups load
  useEffect(() => {
    if (user && groups?.length) {
      // Try to restore last selected group
      const lastGroupId = localStorage.getItem("lastViewedGroupId");
      if (lastGroupId && groups.some((g) => g.id === lastGroupId)) {
        setSelectedGroupId(lastGroupId);
      } else {
        setSelectedGroupId(groups[0].id);
      }
    } else if (!user && !authLoading) {
      // Anonymous user - use anonymous group
      setSelectedGroupId(ANONYMOUS_GROUP_ID);
    }
  }, [user, groups, authLoading]);

  // Get user ID for uploads
  const userId = user?.id || getOrCreateAnonymousUserId();

  // Handle group change
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    if (user) {
      localStorage.setItem("lastViewedGroupId", groupId);
    }
  };

  const handleUploadComplete = () => {
    // Invalidate queries to refresh file list
    queryClient.invalidateQueries({
      queryKey: ["content", "by-parent", selectedGroupId, null],
    });
  };

  const handleUploadError = (error: Error) => {
    console.error("Upload error:", error);
    alert(`Upload failed: ${error.message}`);
  };

  const isLoading = authLoading || (user && groupsLoading);
  const selectedGroup = groups?.find((g) => g.id === selectedGroupId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">File Uploads</h1>

            {/* Group selector for authenticated users */}
            {user && groups && groups.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Group:</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="bg-white border border-gray-300 text-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <p className="text-gray-600">
            Upload and manage your files.
            {user && selectedGroup && (
              <span className="ml-1">
                Uploading to <span className="font-medium">{selectedGroup.name}</span>
              </span>
            )}
            {!user && (
              <span className="ml-1 text-gray-500">
                (Sign in to organize files by group)
              </span>
            )}
          </p>
        </div>

        {/* Upload section */}
        <div className="mb-8">
          <FileUploadInput
            groupId={selectedGroupId}
            userId={userId}
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        </div>

        {/* File list section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Files</h2>
          <FileList groupId={selectedGroupId} />
        </div>
      </div>
    </div>
  );
}
