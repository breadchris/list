"use client";

import React, { useState } from "react";
import {
  Folder,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  Upload,
  Trash2,
} from "lucide-react";
import type { Content } from "@/components/ContentRepository";
import type { ViewMode } from "./FinderToolbar";
import {
  formatFileSize,
  getFileActionLabel,
  type ContentFileType,
} from "@/lib/fileTypeUtils";

interface FinderContentProps {
  items: Content[];
  viewMode: ViewMode;
  onFileClick: (content: Content) => void;
  onFileDelete: (content: Content) => void;
  onFileUpload: (files: FileList) => void;
  isLoading?: boolean;
  deletingId?: string | null;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

function getFileIcon(type: string, name: string) {
  const iconClass = "w-5 h-5";

  switch (type) {
    case "image":
      return <Image className={`${iconClass} text-green-500`} />;
    case "video":
      return <Film className={`${iconClass} text-purple-500`} />;
    case "audio":
      return <Music className={`${iconClass} text-orange-500`} />;
    case "epub":
    case "pdf":
      return <FileText className={`${iconClass} text-red-500`} />;
    default:
      return <FileText className={`${iconClass} text-gray-500`} />;
  }
}

function getLargeFileIcon(type: string) {
  const iconClass = "w-10 h-10 md:w-12 md:h-12";

  switch (type) {
    case "image":
      return <Image className={`${iconClass} text-green-500`} />;
    case "video":
      return <Film className={`${iconClass} text-purple-500`} />;
    case "audio":
      return <Music className={`${iconClass} text-orange-500`} />;
    case "epub":
    case "pdf":
      return <FileText className={`${iconClass} text-red-500`} />;
    default:
      return <FileText className={`${iconClass} text-gray-500`} />;
  }
}

function getFileKind(type: string): string {
  switch (type) {
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    case "epub":
      return "EPUB";
    case "pdf":
      return "PDF";
    default:
      return "File";
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ListViewProps {
  items: Content[];
  onFileClick: (content: Content) => void;
  onFileDelete: (content: Content) => void;
  deletingId?: string | null;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

function ListView({
  items,
  onFileClick,
  onFileDelete,
  deletingId,
  hasNextPage,
  onLoadMore,
  isLoadingMore,
}: ListViewProps) {
  return (
    <div className="h-full overflow-auto">
      {/* Header - Desktop */}
      <div className="hidden md:block sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-3">
        <div className="grid grid-cols-12 gap-6 text-xs text-gray-600 uppercase tracking-wide">
          <div className="col-span-5">Name</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Kind</div>
          <div className="col-span-2">Date Added</div>
          <div className="col-span-1"></div>
        </div>
      </div>

      {/* Header - Mobile */}
      <div className="md:hidden sticky top-0 bg-gray-50 border-b border-gray-200 px-4 py-2">
        <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 uppercase tracking-wide">
          <div className="col-span-2">Name</div>
          <div className="text-right">Size</div>
        </div>
      </div>

      {/* Items - Desktop */}
      <div className="hidden md:block px-6 py-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-12 gap-6 py-3 items-center border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer group"
            onClick={() => onFileClick(item)}
          >
            <div className="col-span-5 flex items-center space-x-3">
              {getFileIcon(item.type, item.data)}
              <span className="text-sm text-gray-900 truncate">{item.data}</span>
            </div>
            <div className="col-span-2 text-sm text-gray-600">
              {item.metadata?.file_size
                ? formatFileSize(item.metadata.file_size)
                : "--"}
            </div>
            <div className="col-span-2 text-sm text-gray-600">
              {getFileKind(item.type)}
            </div>
            <div className="col-span-2 text-sm text-gray-600">
              {formatDate(item.created_at)}
            </div>
            <div className="col-span-1 flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFileDelete(item);
                }}
                disabled={deletingId === item.id}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Items - Mobile */}
      <div className="md:hidden px-4 py-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-3 gap-4 py-3 items-center border-b border-gray-100 last:border-b-0 active:bg-gray-50 cursor-pointer"
            onClick={() => onFileClick(item)}
          >
            <div className="col-span-2 flex items-center space-x-2 min-w-0">
              {getFileIcon(item.type, item.data)}
              <span className="text-sm text-gray-900 truncate">{item.data}</span>
            </div>
            <div className="text-sm text-gray-600 text-right">
              {item.metadata?.file_size
                ? formatFileSize(item.metadata.file_size)
                : "--"}
            </div>
          </div>
        ))}
      </div>

      {/* Load more button */}
      {hasNextPage && onLoadMore && (
        <div className="flex justify-center py-4 px-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {isLoadingMore ? "Loading..." : "Load more files"}
          </button>
        </div>
      )}
    </div>
  );
}

interface IconViewProps {
  items: Content[];
  onFileClick: (content: Content) => void;
  onFileDelete: (content: Content) => void;
  deletingId?: string | null;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

function IconView({
  items,
  onFileClick,
  onFileDelete,
  deletingId,
  hasNextPage,
  onLoadMore,
  isLoadingMore,
}: IconViewProps) {
  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 md:gap-6">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col items-center p-3 md:p-4 rounded-lg active:bg-gray-50 md:hover:bg-gray-50 cursor-pointer group relative"
            onClick={() => onFileClick(item)}
          >
            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileDelete(item);
              }}
              disabled={deletingId === item.id}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
            </button>

            {/* Icon or thumbnail */}
            <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center mb-2 md:mb-3">
              {item.type === "image" && item.metadata?.file_url ? (
                <img
                  src={item.metadata.file_url}
                  alt={item.data}
                  className="w-10 h-10 md:w-12 md:h-12 object-cover rounded"
                />
              ) : (
                getLargeFileIcon(item.type)
              )}
            </div>
            <span className="text-xs md:text-sm text-center truncate w-full text-gray-900">
              {item.data}
            </span>
          </div>
        ))}
      </div>

      {/* Load more button */}
      {hasNextPage && onLoadMore && (
        <div className="flex justify-center py-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {isLoadingMore ? "Loading..." : "Load more files"}
          </button>
        </div>
      )}
    </div>
  );
}

export function FinderContent({
  items,
  viewMode,
  onFileClick,
  onFileDelete,
  onFileUpload,
  isLoading,
  deletingId,
  hasNextPage,
  onLoadMore,
  isLoadingMore,
}: FinderContentProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="animate-pulse">Loading files...</div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="h-full flex items-center justify-center text-gray-500"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-center">
          {isDragging ? (
            <>
              <Upload className="w-16 h-16 mx-auto mb-4 text-blue-500" />
              <p className="text-blue-600">Drop files here to upload</p>
            </>
          ) : (
            <>
              <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>No files yet</p>
              <p className="text-sm text-gray-400 mt-2">
                Drag and drop files here to upload
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-blue-50 bg-opacity-90 z-10 flex items-center justify-center border-4 border-dashed border-blue-400">
          <div className="text-center">
            <Upload className="w-16 h-16 mx-auto mb-4 text-blue-500" />
            <p className="text-blue-700">Drop files here to upload</p>
          </div>
        </div>
      )}

      {viewMode === "list" ? (
        <ListView
          items={items}
          onFileClick={onFileClick}
          onFileDelete={onFileDelete}
          deletingId={deletingId}
          hasNextPage={hasNextPage}
          onLoadMore={onLoadMore}
          isLoadingMore={isLoadingMore}
        />
      ) : (
        <IconView
          items={items}
          onFileClick={onFileClick}
          onFileDelete={onFileDelete}
          deletingId={deletingId}
          hasNextPage={hasNextPage}
          onLoadMore={onLoadMore}
          isLoadingMore={isLoadingMore}
        />
      )}
    </div>
  );
}
