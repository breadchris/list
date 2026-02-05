"use client";

import { useState, useCallback } from "react";
import { Upload, File, X, Loader2 } from "lucide-react";
import type { AgentChunk, CollectionConfig } from "@/types/agent-studio";

interface DocumentUploaderProps {
  collectionId: string;
  config: CollectionConfig;
  onChunksAdded: (chunks: AgentChunk[]) => void;
}

interface UploadedFile {
  name: string;
  size: number;
  status: "pending" | "processing" | "done" | "error";
  chunksCreated?: number;
  error?: string;
}

export function DocumentUploader({
  collectionId,
  config,
  onChunksAdded,
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = async (file: File) => {
    // Update status to processing
    setFiles((prev) =>
      prev.map((f) =>
        f.name === file.name ? { ...f, status: "processing" as const } : f
      )
    );

    try {
      // Read file content
      const content = await file.text();

      // Determine file type
      let fileType: "text" | "markdown" | "pdf" = "text";
      if (file.name.endsWith(".md")) {
        fileType = "markdown";
      } else if (file.name.endsWith(".pdf")) {
        fileType = "pdf";
      }

      // Call the embed API
      const response = await fetch("/api/agent-studio/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_id: collectionId,
          file_content: content,
          filename: file.name,
          file_type: fileType,
          config,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to process file");
      }

      // Update status to done
      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name
            ? { ...f, status: "done" as const, chunksCreated: result.chunks_created }
            : f
        )
      );

      // Notify parent of new chunks
      if (result.chunks) {
        onChunksAdded(result.chunks);
      }
    } catch (error) {
      console.error("Error processing file:", error);
      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name
            ? {
                ...f,
                status: "error" as const,
                error: error instanceof Error ? error.message : "Unknown error",
              }
            : f
        )
      );
    }
  };

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const validFiles = Array.from(fileList).filter((file) => {
        const ext = file.name.toLowerCase().split(".").pop();
        return ["txt", "md", "text", "markdown"].includes(ext || "");
      });

      if (validFiles.length === 0) {
        alert("Please upload .txt or .md files");
        return;
      }

      // Add files to state
      const newFiles: UploadedFile[] = validFiles.map((file) => ({
        name: file.name,
        size: file.size,
        status: "pending" as const,
      }));
      setFiles((prev) => [...prev, ...newFiles]);

      // Process each file
      validFiles.forEach((file) => processFile(file));
    },
    [collectionId, config, onChunksAdded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const removeFile = (fileName: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
      <h3 className="text-sm font-medium text-neutral-200 mb-4">Documents</h3>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-neutral-700 hover:border-neutral-600"
        }`}
      >
        <Upload
          className={`w-8 h-8 mx-auto mb-2 ${
            isDragOver ? "text-emerald-400" : "text-neutral-500"
          }`}
        />
        <p className="text-sm text-neutral-400 mb-2">
          Drop files here or click to upload
        </p>
        <p className="text-xs text-neutral-500 mb-4">
          Supports .txt and .md files
        </p>
        <label className="inline-block px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg cursor-pointer transition-colors">
          <input
            type="file"
            multiple
            accept=".txt,.md,.text,.markdown"
            onChange={handleFileInput}
            className="hidden"
          />
          Choose Files
        </label>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-3 p-3 bg-neutral-800 rounded-lg"
            >
              <File className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-200 truncate">{file.name}</p>
                <p className="text-xs text-neutral-500">
                  {formatFileSize(file.size)}
                  {file.status === "done" && file.chunksCreated !== undefined && (
                    <span className="text-emerald-400 ml-2">
                      {file.chunksCreated} chunks created
                    </span>
                  )}
                  {file.status === "error" && (
                    <span className="text-red-400 ml-2">{file.error}</span>
                  )}
                </p>
              </div>
              {file.status === "processing" && (
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              )}
              {file.status === "done" && (
                <span className="text-xs text-emerald-400">Done</span>
              )}
              {file.status === "error" && (
                <span className="text-xs text-red-400">Error</span>
              )}
              <button
                onClick={() => removeFile(file.name)}
                className="p-1 text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
