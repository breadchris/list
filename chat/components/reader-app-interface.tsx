"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { ReactReader, ReactReaderStyle } from "react-reader";
import type { Rendition } from "epubjs";
import { BookOpen, Upload } from "lucide-react";
import { ReaderSettingsPanel } from "./ReaderSettingsPanel";
import { AppSwitcherButton } from "./app-switcher-button";

// iOS status bar control for immersive reading
const setStatusBarHidden = (hidden: boolean) => {
  if (typeof window !== "undefined") {
    (window as any).setStatusBarHidden?.(hidden);
  }
};

interface ReaderAppInterfaceProps {
  onOpenAppSwitcher?: () => void;
}

export function ReaderAppInterface({ onOpenAppSwitcher }: ReaderAppInterfaceProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [epubUrl, setEpubUrl] = useState<string | null>(null);
  const [rendition, setRendition] = useState<Rendition | undefined>(undefined);
  const [location, setLocation] = useState<string | number>(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [bookName, setBookName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const [showControls, setShowControls] = useState(false);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load EPUB from remote URL with caching
  const loadRemoteEpub = async (fileUrl: string) => {
    const CACHE_NAME = "epub-cache-v1";

    try {
      setUploading(true);
      setUploadProgress(0);

      // Check cache first
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(fileUrl);

      if (cachedResponse) {
        // Load from cache - instant!
        const blob = await cachedResponse.blob();
        const objectUrl = URL.createObjectURL(blob);

        setUploadProgress(100);
        setEpubUrl(objectUrl);
        setIsLoaded(true);

        const urlPath = new URL(fileUrl).pathname;
        const fileName = urlPath.split("/").pop() || "Book";
        setBookName(decodeURIComponent(fileName));
        return;
      }

      // Not cached - fetch with streaming progress
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
      }

      const contentLength = response.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      if (!response.body) {
        throw new Error("ReadableStream not supported");
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        received += value.length;

        if (total > 0) {
          setUploadProgress(Math.round((received / total) * 100));
        }
      }

      const blob = new Blob(chunks as BlobPart[], { type: "application/epub+zip" });

      // Store in cache for next time (graceful - if fails, still works)
      try {
        const cacheResponse = new Response(blob, {
          headers: { "Content-Type": "application/epub+zip" },
        });
        await cache.put(fileUrl, cacheResponse);
      } catch (cacheErr) {
        // Quota exceeded or other cache error - continue without caching
        console.warn("Could not cache EPUB:", cacheErr);
      }

      const objectUrl = URL.createObjectURL(blob);

      setUploadProgress(100);
      setEpubUrl(objectUrl);
      setIsLoaded(true);

      const urlPath = new URL(fileUrl).pathname;
      const fileName = urlPath.split("/").pop() || "Book";
      setBookName(decodeURIComponent(fileName));
    } catch (err) {
      console.error("Failed to load EPUB from URL:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load EPUB file",
      );
    } finally {
      setUploading(false);
    }
  };

  // Check for fileUrl query parameter and fetch the file
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fileUrl = params.get("fileUrl");

    if (fileUrl) {
      loadRemoteEpub(fileUrl);
    }
  }, []);

  // Hide iOS status bar when reading, show when leaving
  useEffect(() => {
    if (isLoaded && epubUrl) {
      setStatusBarHidden(true);
    }
    return () => {
      setStatusBarHidden(false);
    };
  }, [isLoaded, epubUrl]);

  // Full-height touch zone styling
  const readerStyles = {
    ...ReactReaderStyle,
    prev: {
      left: 0,
      width: "120px",                // Wider clickable area on desktop
      height: "calc(100% - 100px)",  // Leave top 100px clear for TOC button
      top: 100,                      // Start below the TOC button area
      marginTop: 0,
    },
    next: {
      right: 0,
      width: "120px",                // Wider clickable area on desktop
      height: "100%",
      top: 0,
      marginTop: 0,
    },
    arrow: {
      ...ReactReaderStyle.arrow,
      fontSize: 40,                  // Larger arrow icon
      color: "transparent",          // Hidden by default
      background: "transparent",
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.3s ease",
    },
    arrowHover: {
      color: "#fbbf24",              // amber-400 arrow on hover
      background: "linear-gradient(to right, rgba(38,38,38,0.6), transparent)",
    },
  };

  // Tap to show controls with auto-hide
  const handleTap = useCallback(() => {
    setShowControls(true);
    // Reset hide timer
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Clean up hide timer on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, []);

  // Swipe navigation handlers
  const MIN_SWIPE_DISTANCE = 50;
  const TAP_THRESHOLD = 10;
  const TOP_ZONE_HEIGHT = 100; // Height of the top zone that triggers controls
  const touchStartY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const distance = touchStartX.current - touchEndX.current;
    const absDistance = Math.abs(distance);

    if (absDistance < TAP_THRESHOLD) {
      // This is a tap, not a swipe - only show controls if tapped in top zone
      if (touchStartY.current <= TOP_ZONE_HEIGHT) {
        handleTap();
      }
    } else if (absDistance > MIN_SWIPE_DISTANCE && rendition) {
      if (distance > 0) {
        rendition.next(); // Swipe left = next page
      } else {
        rendition.prev(); // Swipe right = prev page
      }
    }
  };

  const handleClearBook = useCallback(() => {
    setEpubUrl(null);
    setIsLoaded(false);
    setBookName(null);
    setLocation(0);
    setRendition(undefined);
  }, []);

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
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Create a local object URL for the file
      const objectUrl = URL.createObjectURL(file);

      setUploadProgress(100);
      setEpubUrl(objectUrl);
      setIsLoaded(true);
      setBookName(file.name);
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
            Upload an EPUB file to start reading
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
      {/* Register book info to sidebar settings panel */}
      <ReaderSettingsPanel bookName={bookName} onClearBook={handleClearBook} />

      {/* App switcher button - shown on tap, hidden after 3s */}
      {showControls && onOpenAppSwitcher && (
        <AppSwitcherButton
          onClick={onOpenAppSwitcher}
          variant="subtle"
          readerPosition
        />
      )}

      {/* Epub Reader with safe area padding */}
      <div
        className="flex-1 relative"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-full h-full">
          <ReactReader
          url={epubUrl}
          readerStyles={readerStyles}
          epubInitOptions={{ openAs: "epub" }}
          epubOptions={{
            flow: "paginated",
            width: "100%",
            height: "100%",
            spread: "none",
          }}
          location={location}
          locationChanged={(epubcfi: string) => {
            setLocation(epubcfi);
          }}
          getRendition={(_rendition: Rendition) => {
            setRendition(_rendition);
          }}
        />
        </div>
      </div>
    </div>
  );
}
