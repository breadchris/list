"use client";

import { useState } from "react";
import { useInfiniteContentByParent } from "@/hooks/useContentQueries";
import { ANONYMOUS_GROUP_ID } from "@/lib/anonymousUser";
import { contentRepository, type Content } from "@/components/ContentRepository";
import {
  getFileTypeEmoji,
  getFileTypeLabel,
  getFileActionLabel,
  formatFileSize,
  type ContentFileType,
} from "@/lib/fileTypeUtils";
import { useQueryClient } from "@tanstack/react-query";

type FilterType = "all" | "documents" | "images" | "media";

export function FileList() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteContentByParent(ANONYMOUS_GROUP_ID, null);

  // Flatten all pages into single array
  const allContent = data?.pages.flatMap((page) => page.items) ?? [];

  // Filter content based on selected filter
  const filteredContent = allContent.filter((item) => {
    if (filter === "all") return true;
    if (filter === "documents") {
      return item.type === "epub" || item.type === "pdf";
    }
    if (filter === "images") {
      return item.type === "image";
    }
    if (filter === "media") {
      return item.type === "audio" || item.type === "video";
    }
    return true;
  });

  const handleAction = (content: Content) => {
    const fileUrl = content.metadata?.file_url;
    if (!fileUrl) return;

    if (content.type === "epub") {
      // Navigate to reader app with file URL
      // The reader app will need to fetch and load the EPUB from the URL
      // For now, we'll pass it as a query parameter
      window.location.href = `/reader?fileUrl=${encodeURIComponent(fileUrl)}`;
    } else if (content.type === "pdf") {
      window.open(fileUrl, "_blank");
    } else if (content.type === "image") {
      window.open(fileUrl, "_blank");
    } else if (content.type === "audio" || content.type === "video") {
      window.open(fileUrl, "_blank");
    } else {
      // Generic file - download
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = content.metadata?.file_name || "file";
      link.click();
    }
  };

  const handleDelete = async (content: Content) => {
    if (!confirm(`Delete "${content.data}"?`)) return;

    setDeletingId(content.id);

    try {
      // Delete file from storage
      if (content.metadata?.file_url) {
        await contentRepository.deleteImage(content.metadata.file_url);
      }

      // Delete content record
      await contentRepository.deleteContent(content.id);

      // Invalidate query to refresh list
      queryClient.invalidateQueries({
        queryKey: ["content", "by-parent", ANONYMOUS_GROUP_ID, null],
      });
    } catch (error) {
      console.error("Failed to delete file:", error);
      alert("Failed to delete file. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading files...</div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === "all"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("documents")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === "documents"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Documents
        </button>
        <button
          onClick={() => setFilter("images")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === "images"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Images
        </button>
        <button
          onClick={() => setFilter("media")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === "media"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Media
        </button>
      </div>

      {/* File list */}
      {filteredContent.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="text-6xl mb-4">📂</div>
          <div className="text-lg font-medium text-gray-700">No files yet</div>
          <div className="text-sm text-gray-500 mt-2">
            Upload your first file to get started
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContent.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              {/* File icon and name */}
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl">
                  {getFileTypeEmoji(item.type as ContentFileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate" title={item.data}>
                    {item.data}
                  </div>
                  <div className="text-xs text-gray-500">
                    {getFileTypeLabel(item.type as ContentFileType)}
                    {item.metadata?.file_size && (
                      <> · {formatFileSize(item.metadata.file_size)}</>
                    )}
                  </div>
                </div>
              </div>

              {/* Image preview for image files */}
              {item.type === "image" && item.metadata?.file_url && (
                <div className="mb-3 rounded overflow-hidden bg-gray-100">
                  <img
                    src={item.metadata.file_url}
                    alt={item.data}
                    className="w-full h-32 object-cover"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(item)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  {getFileActionLabel(item.type as ContentFileType)}
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                  className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded transition-colors disabled:opacity-50"
                >
                  {deletingId === item.id ? "..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more button */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 rounded transition-colors disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
