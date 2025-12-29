"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { FinderSidebar } from "./FinderSidebar";
import { FinderToolbar, type ViewMode } from "./FinderToolbar";
import { FinderContent } from "./FinderContent";
import { useGlobalGroupOptional } from "@/components/GlobalGroupContext";
import { useInfiniteContentByParent } from "@/hooks/useContentQueries";
import { contentRepository, type Content } from "@/components/ContentRepository";
import { getContentTypeFromFile } from "@/lib/fileTypeUtils";
import { getCurrentUser } from "@/lib/list/SupabaseClient";
import {
  ANONYMOUS_GROUP_ID,
  getOrCreateAnonymousUserId,
} from "@/lib/anonymousUser";
import type { User } from "@supabase/supabase-js";

export function Finder() {
  const queryClient = useQueryClient();

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Global group context (may be null if outside provider or anonymous)
  const globalGroupContext = useGlobalGroupOptional();

  // Local group ID for anonymous users fallback
  const [localGroupId, setLocalGroupId] = useState<string>(ANONYMOUS_GROUP_ID);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine selected group ID - use global context if available and user is authenticated
  const selectedGroupId = (user && globalGroupContext?.selectedGroup?.id) || localGroupId;

  // Get groups from global context, or empty array for anonymous users
  const groups = globalGroupContext?.groups || [];
  const groupsLoading = globalGroupContext?.isLoading || false;

  // Data queries
  const {
    data: contentData,
    isLoading: contentLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteContentByParent(selectedGroupId, null);

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

  // Sync local state with global context when available
  useEffect(() => {
    if (user && globalGroupContext?.selectedGroup) {
      setLocalGroupId(globalGroupContext.selectedGroup.id);
    } else if (!user && !authLoading) {
      setLocalGroupId(ANONYMOUS_GROUP_ID);
    }
  }, [user, globalGroupContext?.selectedGroup, authLoading]);

  // File types to show in upload viewer (exclude text/other content types)
  const FILE_TYPES = ['epub', 'pdf', 'image', 'audio', 'video', 'file'];

  // Flatten content pages
  const allContent = contentData?.pages.flatMap((page) => page.items) ?? [];

  // Filter content by file types and search
  const filteredContent = allContent
    .filter((item) => FILE_TYPES.includes(item.type))
    .filter((item) => item.data.toLowerCase().includes(searchQuery.toLowerCase()));

  // Get user ID for uploads
  const userId = user?.id || getOrCreateAnonymousUserId();

  // Get selected group name
  const selectedGroup = groups?.find((g) => g.id === selectedGroupId);
  const groupName = selectedGroup?.name || (user ? "" : "Anonymous Files");

  // Handle group selection
  const handleGroupSelect = useCallback(
    (groupId: string) => {
      // Update global context if available
      if (globalGroupContext) {
        const group = groups.find((g) => g.id === groupId);
        if (group) {
          globalGroupContext.setSelectedGroup(group);
        }
      }
      // Always update local state as well
      setLocalGroupId(groupId);
      setSearchQuery("");
      setIsSidebarOpen(false);
    },
    [globalGroupContext, groups]
  );

  // Handle file upload
  const handleFileUpload = useCallback(
    async (files: FileList) => {
      const totalFiles = files.length;
      setIsUploading(true);
      setUploadProgress({ current: 0, total: totalFiles });

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileType = getContentTypeFromFile(file);

          // Create content item
          const content = await contentRepository.createContent({
            type: fileType,
            data: file.name,
            group_id: selectedGroupId,
            user_id: userId,
          });

          // Upload file to storage
          const fileUrl = await contentRepository.uploadFile(file, content.id);

          // Update content metadata
          await contentRepository.updateContent(content.id, {
            metadata: {
              file_url: fileUrl,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
              uploaded_at: new Date().toISOString(),
            },
          });

          // Update progress
          setUploadProgress({ current: i + 1, total: totalFiles });
        }

        // Refresh file list
        queryClient.invalidateQueries({
          queryKey: ["content", "by-parent", selectedGroupId, null],
        });

        toast.success(
          `Uploaded ${totalFiles} file${totalFiles > 1 ? "s" : ""}`
        );
      } catch (error) {
        console.error("Upload failed:", error);
        toast.error("Upload failed. Please try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [selectedGroupId, userId, queryClient]
  );

  // Handle file click (open/download)
  const handleFileClick = useCallback((content: Content) => {
    const fileUrl = content.metadata?.file_url;
    if (!fileUrl) return;

    if (content.type === "epub") {
      window.location.href = `/reader?contentId=${content.id}`;
    } else if (content.type === "pdf") {
      window.open(fileUrl, "_blank");
    } else if (content.type === "image") {
      window.open(fileUrl, "_blank");
    } else if (content.type === "audio" || content.type === "video") {
      window.open(fileUrl, "_blank");
    } else {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = content.metadata?.file_name || "file";
      link.click();
    }
  }, []);

  // Handle file delete
  const handleFileDelete = useCallback(
    async (content: Content) => {
      if (!confirm(`Delete "${content.data}"?`)) return;

      setDeletingId(content.id);

      try {
        if (content.metadata?.file_url) {
          await contentRepository.deleteImage(content.metadata.file_url);
        }
        await contentRepository.deleteContent(content.id);

        queryClient.invalidateQueries({
          queryKey: ["content", "by-parent", selectedGroupId, null],
        });

        toast.success("File deleted");
      } catch (error) {
        console.error("Delete failed:", error);
        toast.error("Failed to delete file");
      } finally {
        setDeletingId(null);
      }
    },
    [selectedGroupId, queryClient]
  );

  const isLoading = authLoading || (user && groupsLoading);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar - Desktop */}
      <div className="hidden md:block w-64 bg-gray-100 border-r border-gray-300">
        <FinderSidebar
          groups={groups || []}
          selectedGroupId={selectedGroupId}
          onGroupSelect={handleGroupSelect}
          isLoading={groupsLoading}
        />
      </div>

      {/* Sidebar - Mobile (Drawer) */}
      <div className="md:hidden">
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setIsSidebarOpen(false)}
            />
            {/* Sidebar Drawer */}
            <div className="fixed inset-y-0 left-0 w-64 bg-gray-100 border-r border-gray-300 z-50 transform transition-transform">
              <FinderSidebar
                groups={groups || []}
                selectedGroupId={selectedGroupId}
                onGroupSelect={handleGroupSelect}
                onClose={() => setIsSidebarOpen(false)}
                isLoading={groupsLoading}
              />
            </div>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-300 flex-shrink-0">
          <FinderToolbar
            groupName={groupName}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        </div>

        {/* Upload Progress Indicator */}
        {isUploading && (
          <div className="bg-blue-500 text-white px-4 py-2 flex items-center gap-2 flex-shrink-0">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            <span>
              Uploading {uploadProgress.current} of {uploadProgress.total} file{uploadProgress.total > 1 ? 's' : ''}...
            </span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 bg-white overflow-hidden">
          <FinderContent
            items={filteredContent}
            viewMode={viewMode}
            onFileClick={handleFileClick}
            onFileDelete={handleFileDelete}
            onFileUpload={handleFileUpload}
            isLoading={contentLoading}
            deletingId={deletingId}
            hasNextPage={hasNextPage}
            onLoadMore={() => fetchNextPage()}
            isLoadingMore={isFetchingNextPage}
          />
        </div>

        {/* Upload button */}
        <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(e.target.files);
                e.target.value = "";
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Files
          </button>
        </div>
      </div>
    </div>
  );
}
