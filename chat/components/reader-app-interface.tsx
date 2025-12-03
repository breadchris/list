"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { ReactReader } from "react-reader";
import type { Contents, Rendition } from "epubjs";
import { useYjsProvider } from "@y-sweet/react";
import * as Y from "yjs";
import { BookOpen, Upload, X } from "lucide-react";

interface EpubSelection {
  text: string;
  cfiRange: string;
  userId: string;
  color: string;
  timestamp: number;
}

// Generate a random user color
const generateUserColor = () => {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
    "#F8B739",
    "#52B788",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export function ReaderAppInterface() {
  const ysweetProvider = useYjsProvider();
  const [userColor] = useState(() => generateUserColor());
  const [isLoaded, setIsLoaded] = useState(false);
  const [epubUrl, setEpubUrl] = useState<string | null>(null);
  const [rendition, setRendition] = useState<Rendition | undefined>(undefined);
  const [location, setLocation] = useState<string | number>(0);
  const [currentSelection, setCurrentSelection] =
    useState<EpubSelection | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for fileUrl query parameter and fetch the file
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fileUrl = params.get("fileUrl");

    if (fileUrl) {
      // Fetch the EPUB file from the URL and convert to blob
      const loadRemoteEpub = async () => {
        try {
          setUploading(true);
          setUploadProgress(0);

          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
          }

          // Get the file as a blob
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);

          setUploadProgress(100);
          setEpubUrl(objectUrl);
          setIsLoaded(true);
        } catch (err) {
          console.error("Failed to load EPUB from URL:", err);
          setError(
            err instanceof Error ? err.message : "Failed to load EPUB file",
          );
        } finally {
          setUploading(false);
        }
      };

      loadRemoteEpub();
    }
  }, []);

  // Get Yjs doc and awareness
  const awareness = ysweetProvider?.awareness;
  const doc = awareness?.doc;

  // Create shared arrays for highlights and epub URL
  const highlightsArray = useMemo(() => {
    if (!doc) return null;
    return doc.getArray<EpubSelection>("highlights");
  }, [doc]);

  const sharedState = useMemo(() => {
    if (!doc) return null;
    return doc.getMap("readerState");
  }, [doc]);

  // Load epub URL from shared state
  useEffect(() => {
    if (!sharedState) return;

    const url = sharedState.get("epubUrl") as string | undefined;
    if (url) {
      setEpubUrl(url);
      setIsLoaded(true);
    }

    // Listen for changes
    const observer = () => {
      const updatedUrl = sharedState.get("epubUrl") as string | undefined;
      if (updatedUrl && updatedUrl !== epubUrl) {
        setEpubUrl(updatedUrl);
        setIsLoaded(true);
      }
    };

    sharedState.observe(observer);
    return () => sharedState.unobserve(observer);
  }, [sharedState, epubUrl]);

  // Render all highlights when rendition is ready or highlights change
  useEffect(() => {
    if (!rendition || !highlightsArray) return;

    const highlights = highlightsArray.toArray();

    // Clear existing highlights (using type assertion - epubjs accepts undefined at runtime)
    rendition.annotations.remove(undefined as unknown as string, "highlight");

    // Re-add all highlights
    highlights.forEach((highlight) => {
      const color = highlight.color || "#FCD34D"; // yellow-300
      rendition.annotations.add(
        "highlight",
        highlight.cfiRange,
        {},
        undefined,
        "hl",
        {
          fill: color,
          "fill-opacity": "0.3",
          "mix-blend-mode": "multiply",
        },
      );
    });

    // Listen for changes
    const observer = () => {
      const updatedHighlights = highlightsArray.toArray();

      // Clear and re-render all highlights
      rendition.annotations.remove(undefined as unknown as string, "highlight");
      updatedHighlights.forEach((highlight) => {
        const color = highlight.color || "#FCD34D";
        rendition.annotations.add(
          "highlight",
          highlight.cfiRange,
          {},
          undefined,
          "hl",
          {
            fill: color,
            "fill-opacity": "0.3",
            "mix-blend-mode": "multiply",
          },
        );
      });
    };

    highlightsArray.observe(observer);
    return () => highlightsArray.unobserve(observer);
  }, [rendition, highlightsArray]);

  // Handle text selection in epub
  useEffect(() => {
    if (!rendition) return;

    function setRenderSelection(cfiRange: string, contents: Contents) {
      if (rendition) {
        const selectedText = rendition.getRange(cfiRange).toString();
        setCurrentSelection({
          text: selectedText,
          cfiRange,
          userId: awareness?.clientID?.toString() || "unknown",
          color: userColor,
          timestamp: Date.now(),
        });
      }
    }

    rendition.on("selected", setRenderSelection);
    return () => {
      rendition?.off("selected", setRenderSelection);
    };
  }, [rendition, awareness, userColor]);

  const handleSaveSelection = () => {
    if (!currentSelection || !highlightsArray) return;

    // Add to shared highlights array
    highlightsArray.push([currentSelection]);

    setCurrentSelection(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    // Validate file type
    if (!file.name.endsWith(".epub") && file.type !== "application/epub+zip") {
      setError("Please select an EPUB file (.epub format)");
      return;
    }

    setError(null);
    handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    if (!sharedState) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Create a local object URL for the file
      const objectUrl = URL.createObjectURL(file);

      setUploadProgress(100);

      // Store URL in shared state
      sharedState.set("epubUrl", objectUrl);
      setEpubUrl(objectUrl);
      setIsLoaded(true);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to load EPUB file");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  // Show upload interface when no epub is loaded
  if (!isLoaded || !epubUrl) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-neutral-900">
        <div className="text-center p-8 max-w-md">
          {/* Book Icon */}
          <BookOpen className="w-24 h-24 mx-auto text-amber-400 mb-4" />

          {/* Title */}
          <h2 className="text-2xl font-semibold text-neutral-100 mb-2">
            EPUB Reader
          </h2>
          <p className="text-sm text-neutral-400 mb-6">
            Upload an EPUB file to start reading with collaborative highlights
          </p>

          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/epub+zip,.epub"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-6 py-3 bg-amber-500 text-neutral-900 rounded-lg hover:bg-amber-400 transition-colors font-medium shadow-sm mb-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            <Upload className="w-5 h-5" />
            {uploading ? "Loading..." : "Upload EPUB File"}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-4 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Upload Progress */}
          {uploading && uploadProgress > 0 && (
            <div className="mt-4 space-y-1">
              <div className="w-full bg-neutral-800 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-neutral-400 text-center">
                Loading EPUB...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-900">
      {/* Current Selection Panel */}
      {currentSelection && (
        <div className="bg-amber-900/20 border-b border-amber-500/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-100 line-clamp-2">
                {currentSelection.text}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveSelection}
                className="px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors"
              >
                Save Highlight
              </button>
              <button
                onClick={() => setCurrentSelection(null)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Epub Reader */}
      <div className="flex-1 relative">
        <ReactReader
          url={epubUrl}
          epubInitOptions={{ openAs: "epub" }}
          location={location}
          locationChanged={(epubcfi: string) => setLocation(epubcfi)}
          getRendition={(_rendition: Rendition) => {
            setRendition(_rendition);
          }}
        />
      </div>

      {/* Instructions */}
      <div className="bg-neutral-800 border-t border-neutral-700 p-3">
        <p className="text-xs text-neutral-400 text-center">
          💡 <strong className="text-neutral-300">Tip:</strong> Select text to
          create collaborative highlights that everyone can see
        </p>
      </div>
    </div>
  );
}
