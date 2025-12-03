"use client";

import { useState, useRef } from "react";
import { contentRepository } from "@/components/ContentRepository";
import { ANONYMOUS_GROUP_ID } from "@/lib/anonymousUser";
import { getContentTypeFromFile, formatFileSize } from "@/lib/fileTypeUtils";
import type { Content } from "@/components/ContentRepository";

// Anonymous system user UUID (matches database)
const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000';

interface FileUploadInputProps {
  onUploadComplete?: (content: Content) => void;
  onUploadError?: (error: Error) => void;
}

export function FileUploadInput({ onUploadComplete, onUploadError }: FileUploadInputProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileType = getContentTypeFromFile(file);

        // 1. Create content item first (to get content ID for storage path)
        const content = await contentRepository.createContent({
          type: fileType,
          data: file.name,
          group_id: ANONYMOUS_GROUP_ID,
        });

        // 2. Upload file to storage using content ID
        const fileUrl = await contentRepository.uploadFile(file, content.id);

        // 3. Update content metadata with file URL and details
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
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));

        // Notify parent component
        if (onUploadComplete) {
          onUploadComplete(content);
        }
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Failed to upload file:", error);
      if (onUploadError) {
        onUploadError(error as Error);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {/* Drag and drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFilePicker}
        className={`
          relative border-2 border-dashed rounded-lg p-8
          transition-colors cursor-pointer
          ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
          ${uploading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          {uploading ? (
            <>
              <div className="text-4xl">⏳</div>
              <div className="text-sm font-medium text-gray-700">
                Uploading... {uploadProgress}%
              </div>
              <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="text-4xl">📎</div>
              <div className="text-sm font-medium text-gray-700">
                Drop files here or click to upload
              </div>
              <div className="text-xs text-gray-500">
                Supports all file types (documents, images, audio, video)
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
