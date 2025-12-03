"use client";

import { useState } from "react";
import { FileUploadInput } from "@/components/FileUploadInput";
import { FileList } from "@/components/FileList";
import { useQueryClient } from "@tanstack/react-query";
import { ANONYMOUS_GROUP_ID } from "@/lib/anonymousUser";

export default function UploadsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const queryClient = useQueryClient();

  const handleUploadComplete = () => {
    // Invalidate queries to refresh file list
    queryClient.invalidateQueries({
      queryKey: ["content", "by-parent", ANONYMOUS_GROUP_ID, null],
    });

    // Force re-render of file list
    setRefreshKey((prev) => prev + 1);
  };

  const handleUploadError = (error: Error) => {
    console.error("Upload error:", error);
    alert(`Upload failed: ${error.message}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">File Uploads</h1>
          <p className="text-gray-600">
            Upload and manage your files. All file types are supported.
          </p>
        </div>

        {/* Upload section */}
        <div className="mb-8">
          <FileUploadInput
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        </div>

        {/* File list section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Files</h2>
          <FileList key={refreshKey} />
        </div>
      </div>
    </div>
  );
}
