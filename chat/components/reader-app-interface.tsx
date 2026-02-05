"use client";

import React, { useEffect, useState, useRef, useCallback, Dispatch, SetStateAction } from "react";
import { ReactReader, ReactReaderStyle } from "react-reader";
import type { Rendition, Contents } from "epubjs";
import { BookOpen, Upload, LayoutGrid, Highlighter, X, Trash2 } from "lucide-react";
import { ReaderSettingsPanel } from "./ReaderSettingsPanel";
import { useReadingPosition } from "@/hooks/reader/useReadingPosition";
import { useEpubLoader } from "@/hooks/reader/useEpubLoader";
import { GroupBooksList } from "./reader/GroupBooksList";
import { ReaderSkeleton } from "./reader/ReaderSkeleton";
import type { GroupBook } from "@/hooks/reader/useGroupBooks";
import type { Highlight } from "@/types/reading-position";
import { useGlobalGroup } from "@/components/GlobalGroupContext";
import { useContentById } from "@/hooks/useContentQueries";
import { useClubBook, useClubMemberProgress } from "@/hooks/reader/useClubBook";
import { supabase } from "@/lib/list/SupabaseClient";

// iOS status bar control for immersive reading
const setStatusBarHidden = (hidden: boolean) => {
  if (typeof window !== "undefined") {
    (window as any).setStatusBarHidden?.(hidden);
  }
};

// iOS safe area color control for immersive reading
const setSafeAreaColor = (color: string) => {
  if (typeof window !== "undefined") {
    (window as any).setSafeAreaColor?.(color);
  }
};

// Check if running in iOS app with EPUB highlight handler
const isIOSApp = () => {
  return (
    typeof window !== "undefined" &&
    !!(window as any).webkit?.messageHandlers?.epubHighlightHandler
  );
};

// Notify iOS when text is selected in EPUB
const notifyIOSTextSelected = (text: string, cfiRange: string) => {
  if (isIOSApp()) {
    (window as any).webkit.messageHandlers.epubHighlightHandler.postMessage({
      type: "textSelected",
      text,
      cfiRange,
    });
  }
};

// Hook for persisted state in localStorage
function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }, [key, value]);

  return [value, setValue];
}

export type ReaderTheme = "light" | "dark" | "sepia";
export type ReaderFontFamily = "default" | "serif" | "sans";

interface EpubSelection {
  text: string;
  cfiRange: string;
  rect?: { x: number; y: number; width: number; height: number };
}

interface ReaderAppInterfaceProps {
  onToggleAppSwitcher?: () => void;
  bookContentId?: string | null;
  groupId?: string | null;
}

export function ReaderAppInterface({
  onToggleAppSwitcher,
  bookContentId: propBookContentId = null,
  groupId: propGroupId = null,
}: ReaderAppInterfaceProps) {
  // URL of remote EPUB to load (triggers useEpubLoader)
  const [pendingFileUrl, setPendingFileUrl] = useState<string | null>(null);
  // Local file blob URL (for uploaded files, bypasses useEpubLoader)
  const [localEpubUrl, setLocalEpubUrl] = useState<string | null>(null);
  const [rendition, setRendition] = useState<Rendition | undefined>(undefined);

  // Parallel loading: useEpubLoader for remote files
  const { blobUrl: remoteEpubUrl, isLoading: isLoadingRemoteEpub, error: epubError } = useEpubLoader(pendingFileUrl);

  // Combined epub URL (remote or local)
  const epubUrl = remoteEpubUrl || localEpubUrl;
  const isLoaded = !!epubUrl;

  // Get global group context
  const { selectedGroup } = useGlobalGroup();

  // State for book selected from book list
  // Extract contentId from URL synchronously to enable React Query cache lookup on first render
  const [selectedBookContentId, setSelectedBookContentId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("contentId");
  });
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Use props if provided, otherwise use selected state, fallback to global group
  const bookContentId = propBookContentId || selectedBookContentId;
  const groupId = propGroupId || selectedGroupId || selectedGroup?.id || null;

  // Fetch content metadata using React Query (cached between page loads)
  const { data: contentData } = useContentById(selectedBookContentId || "", {
    enabled: !!selectedBookContentId && !pendingFileUrl, // Only fetch if we don't already have the URL
  });

  // When content metadata arrives (from cache or network), set the file URL
  useEffect(() => {
    if (contentData?.metadata?.file_url && !pendingFileUrl) {
      setSelectedGroupId(contentData.group_id);
      setBookName(contentData.data || contentData.metadata?.file_name || "Book");
      setPendingFileUrl(contentData.metadata.file_url);
    }
  }, [contentData, pendingFileUrl]);

  // Local location state (used when no bookContentId is provided)
  const [localLocation, setLocalLocation] = useState<string | number>(0);

  // Reading position hook (used when bookContentId is provided)
  const {
    location: persistedLocation,
    updateLocation: updatePersistedLocation,
    isLoading: isLoadingPosition,
    highlights,
    addHighlight,
    removeHighlight,
  } = useReadingPosition({
    bookContentId,
    groupId,
    enabled: !!bookContentId && !!groupId,
  });

  // Text selection state for highlighting
  const [currentSelection, setCurrentSelection] = useState<EpubSelection | null>(null);

  // Clicked highlight state for showing remove option
  const [clickedHighlight, setClickedHighlight] = useState<Highlight | null>(null);

  // Track rendered highlight CFI ranges for proper cleanup
  const renderedHighlightsRef = useRef<Set<string>>(new Set());
  // Track rendered club member highlights separately
  const renderedClubHighlightsRef = useRef<Set<string>>(new Set());

  // Club book functionality
  const { clubBook } = useClubBook();
  const isClubBook = clubBook?.bookContentId === bookContentId;
  const { data: clubMemberProgress } = useClubMemberProgress(
    isClubBook ? bookContentId : null
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user ID for club features
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // Use persisted location if available, otherwise use local state
  const location = bookContentId && persistedLocation ? persistedLocation : localLocation;

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [bookName, setBookName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const [showControls, setShowControls] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // TOC state
  const [tocItems, setTocItems] = useState<Array<{label: string; href: string; depth: number}>>([]);

  // Detect desktop for always-visible controls
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Reader settings (persisted to localStorage)
  const [fontSize, setFontSize] = usePersistedState("reader-font-size", 100);
  const [fontFamily, setFontFamily] = usePersistedState<ReaderFontFamily>("reader-font-family", "default");
  const [theme, setTheme] = usePersistedState<ReaderTheme>("reader-theme", "light");

  // Hide iOS status bar and set safe area colors when reading
  useEffect(() => {
    if (isLoaded && epubUrl) {
      setStatusBarHidden(true);
      setSafeAreaColor(themeBackgrounds[theme]);
    }
    return () => {
      setStatusBarHidden(false);
      setSafeAreaColor("#000000"); // Reset to dark on exit
    };
  }, [isLoaded, epubUrl, theme]);

  // Apply font size to rendition
  useEffect(() => {
    if (rendition) {
      rendition.themes.fontSize(`${fontSize}%`);
    }
  }, [rendition, fontSize]);

  // Apply font family to rendition
  useEffect(() => {
    if (rendition) {
      const fontMap: Record<ReaderFontFamily, string> = {
        default: "inherit",
        serif: "Georgia, 'Times New Roman', serif",
        sans: "system-ui, -apple-system, sans-serif",
      };
      rendition.themes.font(fontMap[fontFamily]);
    }
  }, [rendition, fontFamily]);

  // Apply theme to rendition
  useEffect(() => {
    if (rendition) {
      const themes: Record<ReaderTheme, { body: { background: string; color: string } }> = {
        light: { body: { background: "#fff", color: "#1a1a1a" } },
        dark: { body: { background: "#1a1a1a", color: "#e5e5e5" } },
        sepia: { body: { background: "#f4ecd8", color: "#5b4636" } },
      };
      rendition.themes.register("current", themes[theme]);
      rendition.themes.select("current");
    }
  }, [rendition, theme]);

  // Theme background colors
  const themeBackgrounds: Record<ReaderTheme, string> = {
    light: "#fff",
    dark: "#1a1a1a",
    sepia: "#f4ecd8",
  };

  // Extract TOC from EPUB when rendition is ready
  useEffect(() => {
    if (rendition?.book?.navigation) {
      const toc = rendition.book.navigation.toc;
      const flattenToc = (items: typeof toc, depth = 0): Array<{label: string; href: string; depth: number}> => {
        const result: Array<{label: string; href: string; depth: number}> = [];
        for (const item of items) {
          result.push({ label: item.label, href: item.href, depth });
          if (item.subitems && item.subitems.length > 0) {
            result.push(...flattenToc(item.subitems, depth + 1));
          }
        }
        return result;
      };
      setTocItems(flattenToc(toc));
    }
  }, [rendition]);

  // Listen for text selection in EPUB
  useEffect(() => {
    if (!rendition) return;

    const handleSelected = (cfiRange: string, contents: Contents) => {
      const range = rendition.getRange(cfiRange);
      if (range) {
        const text = range.toString().trim();
        if (text.length > 0) {
          // Get selection bounding rect
          const domRect = range.getBoundingClientRect();
          // Get iframe offset to translate to page coordinates
          const iframe = document.querySelector('iframe');
          const iframeRect = iframe?.getBoundingClientRect();

          setCurrentSelection({
            text,
            cfiRange,
            rect: {
              x: domRect.left + (iframeRect?.left ?? 0),
              y: domRect.top + (iframeRect?.top ?? 0),
              width: domRect.width,
              height: domRect.height,
            },
          });
          // Notify iOS app if running in webview
          notifyIOSTextSelected(text, cfiRange);
        }
      }
    };

    rendition.on("selected", handleSelected);

    return () => {
      rendition.off("selected", handleSelected);
    };
  }, [rendition]);

  // Listen for clicks on highlights
  useEffect(() => {
    if (!rendition || !highlights) return;

    const handleMarkClicked = (cfiRange: string) => {
      const highlight = highlights.find(h => h.cfi_range === cfiRange);
      if (highlight) {
        setClickedHighlight(highlight);
      }
    };

    rendition.on("markClicked", handleMarkClicked);

    return () => {
      rendition.off("markClicked", handleMarkClicked);
    };
  }, [rendition, highlights]);

  // Expose bridge functions for iOS app to call back
  useEffect(() => {
    if (typeof window === "undefined") return;

    // iOS calls this to create a highlight from current selection
    (window as any).createHighlight = () => {
      if (currentSelection) {
        addHighlight(currentSelection.cfiRange, currentSelection.text, "yellow");
        setCurrentSelection(null);
      }
    };

    // iOS calls this to dismiss the selection without creating a highlight
    (window as any).dismissSelection = () => {
      setCurrentSelection(null);
    };

    return () => {
      delete (window as any).createHighlight;
      delete (window as any).dismissSelection;
    };
  }, [currentSelection, addHighlight]);

  // Listen for clicks inside EPUB iframe to toggle controls
  useEffect(() => {
    if (!rendition) return;

    const handleIframeClick = () => {
      // If controls are showing, clicking anywhere hides them
      if (showControls) {
        setShowControls(false);
      }
    };

    rendition.on("click", handleIframeClick);

    return () => {
      rendition.off("click", handleIframeClick);
    };
  }, [rendition, showControls]);

  // Render saved highlights visually in EPUB
  useEffect(() => {
    if (!rendition || !highlights) return;

    // Remove all previously rendered highlights
    renderedHighlightsRef.current.forEach((cfiRange) => {
      try {
        rendition.annotations.remove(cfiRange, "highlight");
      } catch {
        // Ignore errors when removing non-existent annotations
      }
    });

    // Clear the tracking set
    renderedHighlightsRef.current.clear();

    // Add all current highlights
    highlights.forEach((h) => {
      try {
        rendition.annotations.add(
          "highlight",
          h.cfi_range,
          {},
          undefined,
          "hl",
          {
            fill: "yellow",
            "fill-opacity": "0.3",
            "mix-blend-mode": "multiply",
          }
        );
        // Track this highlight as rendered
        renderedHighlightsRef.current.add(h.cfi_range);
      } catch (e) {
        console.warn("Failed to render highlight:", e);
      }
    });
  }, [rendition, highlights]);

  // Render club members' highlights visually in EPUB (different color)
  useEffect(() => {
    if (!rendition || !isClubBook || !clubMemberProgress || !currentUserId) return;

    // Remove all previously rendered club highlights
    renderedClubHighlightsRef.current.forEach((cfiRange) => {
      try {
        rendition.annotations.remove(cfiRange, "highlight");
      } catch {
        // Ignore errors when removing non-existent annotations
      }
    });
    renderedClubHighlightsRef.current.clear();

    // Collect all club members' highlights (except current user's - those are rendered separately)
    const otherMemberHighlights: Array<{ highlight: Highlight; userId: string }> = [];
    clubMemberProgress.forEach((member) => {
      if (member.user_id !== currentUserId && member.highlights) {
        member.highlights.forEach((h) => {
          otherMemberHighlights.push({ highlight: h, userId: member.user_id });
        });
      }
    });

    // Add all club member highlights with a different style (blue/cyan)
    otherMemberHighlights.forEach(({ highlight: h }) => {
      // Skip if this CFI is already rendered as user's own highlight
      if (renderedHighlightsRef.current.has(h.cfi_range)) return;

      try {
        rendition.annotations.add(
          "highlight",
          h.cfi_range,
          {},
          undefined,
          "club-hl",
          {
            fill: "#3b82f6", // blue-500
            "fill-opacity": "0.2",
            "mix-blend-mode": "multiply",
          }
        );
        renderedClubHighlightsRef.current.add(h.cfi_range);
      } catch (e) {
        console.warn("Failed to render club highlight:", e);
      }
    });
  }, [rendition, isClubBook, clubMemberProgress, currentUserId, highlights]);

  // Full-height touch zone styling with constrained text width
  const readerStyles = {
    ...ReactReaderStyle,
    readerArea: {
      ...ReactReaderStyle.readerArea,
      backgroundColor: themeBackgrounds[theme],
    },
    reader: {
      ...ReactReaderStyle.reader,
      // Default is: top: 50, left: 50, bottom: 20, right: 50
      // Use max() to center text with ~800px max width on desktop, 16px on mobile
      left: "max(16px, calc(50% - 400px))",
      right: "max(16px, calc(50% - 400px))",
    },
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

  // Tap to toggle controls overlay
  const handleTap = useCallback(() => {
    setShowControls(prev => !prev);
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
      // This is a tap, not a swipe
      if (showControls) {
        // If controls are showing, tapping anywhere hides them
        setShowControls(false);
      } else if (touchStartY.current <= TOP_ZONE_HEIGHT) {
        // Only show controls if tapped in top zone
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

  // Desktop click handler for showing/hiding controls
  const handleClick = (e: React.MouseEvent) => {
    // If controls are showing, tapping anywhere hides them
    if (showControls) {
      setShowControls(false);
      return;
    }
    // Only show controls if clicked in top zone (same as touch)
    if (e.clientY <= TOP_ZONE_HEIGHT) {
      handleTap();
    }
  };

  const handleClearBook = useCallback(() => {
    setPendingFileUrl(null);
    setLocalEpubUrl(null);
    setBookName(null);
    setLocalLocation(0);
    setRendition(undefined);
    setSelectedBookContentId(null);
    setSelectedGroupId(null);
  }, []);

  // Handle saving a highlight
  const handleSaveHighlight = useCallback(() => {
    if (!currentSelection) return;
    addHighlight(currentSelection.cfiRange, currentSelection.text, "yellow");
    setCurrentSelection(null);
  }, [currentSelection, addHighlight]);

  // Handle canceling/dismissing selection
  const handleCancelSelection = useCallback(() => {
    setCurrentSelection(null);
  }, []);

  // Handle removing clicked highlight
  const handleRemoveClickedHighlight = useCallback(() => {
    if (clickedHighlight) {
      removeHighlight(clickedHighlight.id);
      setClickedHighlight(null);
    }
  }, [clickedHighlight, removeHighlight]);

  // Handle dismissing clicked highlight popover
  const handleDismissClickedHighlight = useCallback(() => {
    setClickedHighlight(null);
  }, []);

  // Handle navigating to a highlight
  const handleNavigateToHighlight = useCallback(
    (cfiRange: string) => {
      rendition?.display(cfiRange);
    },
    [rendition]
  );

  // Handle navigating to a chapter (memoized to prevent infinite re-render loop)
  const handleNavigateToChapter = useCallback(
    (href: string) => {
      rendition?.display(href);
    },
    [rendition]
  );

  // Handle fileUrl query parameter (legacy fallback, no position tracking)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fileUrl = params.get("fileUrl");

    if (fileUrl && !params.get("contentId")) {
      // Direct file URL fallback (no position tracking)
      try {
        const urlPath = new URL(fileUrl).pathname;
        const fileName = urlPath.split("/").pop() || "Book";
        setBookName(decodeURIComponent(fileName));
      } catch {
        setBookName("Book");
      }
      setPendingFileUrl(fileUrl);
    }
  }, []);

  // Handle selecting a book from book list
  const handleSelectBook = useCallback((book: GroupBook) => {
    // Set the book's content ID and group ID for position tracking
    setSelectedBookContentId(book.bookContentId);
    setSelectedGroupId(book.groupId);
    // Reset local location (will be overridden by persisted location)
    setLocalLocation(0);
    // Set the book name
    setBookName(book.title);
    // Clear any local epub URL and trigger remote loading
    setLocalEpubUrl(null);
    // Only set pendingFileUrl if we have a valid URL
    // Otherwise, let useContentById fetch it via the fallback mechanism
    if (book.epubUrl) {
      setPendingFileUrl(book.epubUrl);
    } else {
      setPendingFileUrl(null);
    }
  }, []);

  // Handle location change - update persisted or local state
  const handleLocationChanged = useCallback(
    (epubcfi: string) => {
      if (bookContentId && groupId) {
        // Update persisted location (debounced in hook)
        updatePersistedLocation(epubcfi);
      } else {
        // Update local state
        setLocalLocation(epubcfi);
      }
    },
    [bookContentId, groupId, updatePersistedLocation]
  );

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
      // Clear any pending remote URL and set local URL
      setPendingFileUrl(null);
      setLocalEpubUrl(objectUrl);
      setBookName(file.name);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to load EPUB file");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  // Show skeleton when loading a remote EPUB (fast path for cached books)
  if (pendingFileUrl && isLoadingRemoteEpub) {
    return (
      <div className="flex flex-col h-screen" style={{ backgroundColor: themeBackgrounds[theme] }}>
        <ReaderSettingsPanel
          bookName={bookName}
          bookContentId={bookContentId}
          onClearBook={handleClearBook}
          onSelectBook={handleSelectBook}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          theme={theme}
          onThemeChange={setTheme}
        />
        <ReaderSkeleton theme={theme} />
      </div>
    );
  }

  // Show upload interface when no epub is loaded or selected
  if (!isLoaded || !epubUrl) {
    // Show error if EPUB loading failed
    const displayError = error || (epubError ? epubError.message : null);

    return (
      <div
        className="flex flex-col h-screen items-center justify-center bg-neutral-900"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {/* Register sidebar settings for recent books even when no book loaded */}
        <ReaderSettingsPanel
          bookName={null}
          bookContentId={null}
          onClearBook={handleClearBook}
          onSelectBook={handleSelectBook}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          theme={theme}
          onThemeChange={setTheme}
        />

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
          {displayError && (
            <div className="mt-4 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-sm text-red-400">
              {displayError}
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

          {/* Books from current group */}
          <div className="mt-8">
            <GroupBooksList onSelectBook={handleSelectBook} variant="landing" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: themeBackgrounds[theme] }}>
      {/* Register book info to sidebar settings panel */}
      <ReaderSettingsPanel
        bookName={bookName}
        bookContentId={bookContentId}
        onClearBook={handleClearBook}
        onSelectBook={handleSelectBook}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        fontFamily={fontFamily}
        onFontFamilyChange={setFontFamily}
        theme={theme}
        onThemeChange={setTheme}
        tocItems={tocItems}
        onNavigateToChapter={handleNavigateToChapter}
        highlights={highlights}
        onNavigateToHighlight={handleNavigateToHighlight}
        onRemoveHighlight={removeHighlight}
      />

      {/* Controls overlay - tap top zone to toggle */}
      {showControls && onToggleAppSwitcher && (
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-sm"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleAppSwitcher();
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Toggle app switcher"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
        </div>
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
        onClick={handleClick}
      >
        <div className="w-full h-full">
          <ReactReader
            url={epubUrl}
            readerStyles={readerStyles}
            showToc={false}
            epubInitOptions={{ openAs: "epub" }}
            epubOptions={{
              flow: "paginated",
              width: "100%",
              height: "100%",
              spread: "none",
            }}
            location={location}
            locationChanged={handleLocationChanged}
            getRendition={(_rendition: Rendition) => {
              setRendition(_rendition);
            }}
          />
        </div>
      </div>

      {/* Club book progress dots */}
      {isClubBook && clubMemberProgress && clubMemberProgress.length > 0 && !currentSelection && !clickedHighlight && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-900/80 backdrop-blur-sm border-t border-neutral-800"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="px-4 py-2">
            {/* Progress bar with member dots */}
            <div className="relative h-6 flex items-center">
              {/* Base progress track */}
              <div className="absolute inset-x-0 h-1 bg-neutral-700 rounded-full" />

              {/* Member progress dots */}
              {[...clubMemberProgress]
                .sort((a, b) => a.progress_percent - b.progress_percent)
                .map((member) => {
                  const isCurrentUser = member.user_id === currentUserId;
                  const progress = Math.min(Math.max(member.progress_percent * 100, 0), 100);
                  const name = member.display_name || member.email.split("@")[0] || "?";
                  const initial = name.charAt(0).toUpperCase();

                  return (
                    <div
                      key={member.user_id}
                      className="absolute transform -translate-x-1/2 flex flex-col items-center"
                      style={{ left: `${progress}%` }}
                    >
                      {/* Dot */}
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-medium border-2 ${
                          isCurrentUser
                            ? "bg-amber-500 border-amber-400 text-amber-900"
                            : "bg-neutral-600 border-neutral-500 text-neutral-300"
                        }`}
                        title={`${name}: ${Math.round(progress)}%`}
                      >
                        {initial}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Floating popup for highlight confirmation - positioned above/below selection */}
      {currentSelection && currentSelection.rect && (
        <div
          className="fixed z-50 bg-neutral-800 rounded-lg shadow-lg px-3 py-2 flex items-center gap-2"
          style={{
            left: Math.max(8, Math.min(currentSelection.rect.x + currentSelection.rect.width / 2 - 50, window.innerWidth - 108)),
            top: currentSelection.rect.y > 60
              ? currentSelection.rect.y - 48
              : currentSelection.rect.y + currentSelection.rect.height + 8,
          }}
        >
          <button
            onClick={handleSaveHighlight}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Highlighter className="w-4 h-4" />
            Highlight
          </button>
          <button
            onClick={handleCancelSelection}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 transition-colors"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Fixed bottom bar for clicked highlight with remove option */}
      {clickedHighlight && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-900/95 backdrop-blur-sm border-t border-neutral-700"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-neutral-300 line-clamp-2">
                "{clickedHighlight.text}"
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleRemoveClickedHighlight}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
              <button
                onClick={handleDismissClickedHighlight}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
