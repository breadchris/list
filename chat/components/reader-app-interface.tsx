"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { ReactReader, ReactReaderStyle } from "react-reader";
import type { Contents, Rendition } from "epubjs";
import { useYjsProvider } from "@y-sweet/react";
import * as Y from "yjs";
import { BookOpen, Upload, X } from "lucide-react";
import { ReaderSettingsPanel } from "./ReaderSettingsPanel";

interface EpubSelection {
  text: string;
  cfiRange: string;
  userId: string;
  color: string;
  timestamp: number;
  epubUrl: string;
}

interface ReadingProgress {
  location: string;
  lastRead: number;
  bookName: string;
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
  const [bookName, setBookName] = useState<string | null>(null);
  const [bookIdentifier, setBookIdentifier] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

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
        setBookIdentifier(fileUrl);

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
      setBookIdentifier(fileUrl);

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

  // Load epub URL from shared state or restore last opened book
  useEffect(() => {
    if (!sharedState) return;

    // Check if we already have a book loaded (from URL param)
    const params = new URLSearchParams(window.location.search);
    const hasUrlParam = params.get("fileUrl");

    // Debug: print current state
    const lastBook = sharedState.get("lastOpenedBook") as string | undefined;
    const progress = sharedState.get("readingProgress") as Record<string, ReadingProgress> | undefined;
    console.log("[Reader] Restore check:", {
      hasUrlParam,
      isLoaded,
      uploading,
      lastOpenedBook: lastBook,
      readingProgress: progress,
      currentBookIdentifier: sharedState.get("currentBookIdentifier"),
    });

    if (!hasUrlParam && !isLoaded && !uploading) {
      // No URL param - check for last opened book
      if (lastBook && progress?.[lastBook]) {
        console.log("[Reader] Restoring last book:", lastBook, "with progress:", progress[lastBook]);
        // For URL-based books, we can restore them by re-fetching
        if (!lastBook.startsWith("upload:")) {
          loadRemoteEpub(lastBook);
          return;
        }
        // Note: For uploaded books, we can't restore without the file
        // We just show the upload UI again
      }
    }

    // Listen for changes (Yjs sync or other tabs/users)
    const observer = () => {
      // Check for epubUrl changes (collaborative loading)
      const updatedUrl = sharedState.get("epubUrl") as string | undefined;
      if (updatedUrl && updatedUrl !== epubUrl) {
        setEpubUrl(updatedUrl);
        setIsLoaded(true);
        return;
      }

      // Check for lastOpenedBook (restore after Yjs sync)
      // Only trigger if we haven't loaded a book yet
      if (!hasUrlParam && !isLoaded && !uploading) {
        const syncedLastBook = sharedState.get("lastOpenedBook") as string | undefined;
        const syncedProgress = sharedState.get("readingProgress") as Record<string, ReadingProgress> | undefined;
        if (syncedLastBook && syncedProgress?.[syncedLastBook] && !syncedLastBook.startsWith("upload:")) {
          console.log("[Reader] Observer: Restoring after Yjs sync:", syncedLastBook);
          loadRemoteEpub(syncedLastBook);
        }
      }
    };

    sharedState.observe(observer);
    return () => sharedState.unobserve(observer);
  }, [sharedState, epubUrl, isLoaded, uploading]);

  // Restore reading progress when book and sharedState are ready
  useEffect(() => {
    if (!sharedState || !bookIdentifier) return;

    // Sync bookIdentifier to sharedState (for URL-based books loaded before sharedState was ready)
    const currentSavedIdentifier = sharedState.get("currentBookIdentifier") as string | undefined;
    if (currentSavedIdentifier !== bookIdentifier) {
      sharedState.set("currentBookIdentifier", bookIdentifier);
    }

    const progress = sharedState.get("readingProgress") as Record<string, ReadingProgress> | undefined;
    if (progress?.[bookIdentifier]) {
      const savedProgress = progress[bookIdentifier];
      setLocation(savedProgress.location);
      if (savedProgress.bookName && !bookName) {
        setBookName(savedProgress.bookName);
      }
    }
  }, [sharedState, bookIdentifier, bookName]);

  // Render all highlights when rendition is ready or highlights change
  useEffect(() => {
    if (!rendition || !highlightsArray || !epubUrl) return;

    // Filter highlights to only show ones for the current book
    const highlights = highlightsArray.toArray().filter(h => h.epubUrl === epubUrl);

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
      // Filter to only show highlights for the current book
      const updatedHighlights = highlightsArray.toArray().filter(h => h.epubUrl === epubUrl);

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
  }, [rendition, highlightsArray, epubUrl]);

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
          epubUrl: epubUrl || "",
        });
      }
    }

    rendition.on("selected", setRenderSelection);
    return () => {
      rendition?.off("selected", setRenderSelection);
    };
  }, [rendition, awareness, userColor, epubUrl]);

  const handleSaveSelection = () => {
    if (!currentSelection || !highlightsArray || !epubUrl) return;

    // Add to shared highlights array with epubUrl
    highlightsArray.push([{ ...currentSelection, epubUrl }]);

    setCurrentSelection(null);
  };

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

  // Swipe navigation handlers
  const MIN_SWIPE_DISTANCE = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const distance = touchStartX.current - touchEndX.current;

    if (Math.abs(distance) > MIN_SWIPE_DISTANCE && rendition) {
      if (distance > 0) {
        rendition.next(); // Swipe left = next page
      } else {
        rendition.prev(); // Swipe right = prev page
      }
    }
  };

  const handleClearBook = useCallback(() => {
    // Clear any pending location save
    if (locationSaveTimeoutRef.current) {
      clearTimeout(locationSaveTimeoutRef.current);
    }

    setEpubUrl(null);
    setIsLoaded(false);
    setBookName(null);
    setBookIdentifier(null);
    setLocation(0);
    setRendition(undefined);
    setCurrentSelection(null);

    if (sharedState) {
      sharedState.delete("epubUrl");
      sharedState.delete("currentBookIdentifier");
      // Note: readingProgress and lastOpenedBook are kept so user can resume later
    }
    // Highlights are NOT cleared - they remain associated with their epubUrl
  }, [sharedState]);

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

      // Create stable identifier for uploaded files (filename + size)
      const fileIdentifier = `upload:${file.name}:${file.size}`;

      setUploadProgress(100);

      // Store URL and identifier in shared state
      sharedState.set("epubUrl", objectUrl);
      sharedState.set("currentBookIdentifier", fileIdentifier);
      setEpubUrl(objectUrl);
      setIsLoaded(true);
      setBookName(file.name);
      setBookIdentifier(fileIdentifier);
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
    // Show loading while Yjs syncs
    if (!sharedState) {
      return (
        <div className="flex flex-col h-screen items-center justify-center bg-neutral-900">
          <div className="text-center p-8">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-neutral-400">Loading reading progress...</p>
          </div>
        </div>
      );
    }

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
      {/* Register book info to sidebar settings panel */}
      <ReaderSettingsPanel bookName={bookName} onClearBook={handleClearBook} />

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
      <div
        className="flex-1 relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <ReactReader
          url={epubUrl}
          readerStyles={readerStyles}
          epubInitOptions={{ openAs: "epub" }}
          location={location}
          locationChanged={(epubcfi: string) => {
            setLocation(epubcfi);

            // Debounced save to Yjs
            if (locationSaveTimeoutRef.current) {
              clearTimeout(locationSaveTimeoutRef.current);
            }
            locationSaveTimeoutRef.current = setTimeout(() => {
              if (sharedState && bookIdentifier) {
                const progress = (sharedState.get("readingProgress") as Record<string, ReadingProgress>) || {};
                progress[bookIdentifier] = {
                  location: epubcfi,
                  lastRead: Date.now(),
                  bookName: bookName || "Unknown",
                };
                sharedState.set("readingProgress", progress);
                sharedState.set("lastOpenedBook", bookIdentifier);
              }
            }, 500);
          }}
          getRendition={(_rendition: Rendition) => {
            setRendition(_rendition);
          }}
        />
      </div>
    </div>
  );
}
