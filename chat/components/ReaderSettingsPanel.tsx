"use client";

import { useEffect, useState, useMemo } from "react";
import { BookOpen, X, Minus, Plus, Sun, Moon, Type, List, Settings, Highlighter, Trash2, Users } from "lucide-react";
import { useSetAppSettings, useCloseAppSwitcher } from "./AppSettingsContext";
import { GroupBooksList } from "./reader/GroupBooksList";
import { GlobalGroupSelector } from "./GlobalGroupSelector";
import { useGlobalGroup } from "./GlobalGroupContext";
import type { GroupBook } from "@/hooks/reader/useGroupBooks";
import type { ReaderTheme, ReaderFontFamily } from "./reader-app-interface";
import type { Highlight } from "@/types/reading-position";

// Stable empty arrays to prevent infinite re-renders from default prop values
const EMPTY_TOC: TocItem[] = [];
const EMPTY_HIGHLIGHTS: Highlight[] = [];

interface TocItem {
  label: string;
  href: string;
  depth: number;
}

interface ReaderSettingsPanelProps {
  bookName: string | null;
  bookContentId?: string | null;
  onClearBook: () => void;
  onSelectBook?: (book: GroupBook) => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  fontFamily?: ReaderFontFamily;
  onFontFamilyChange?: (family: ReaderFontFamily) => void;
  theme?: ReaderTheme;
  onThemeChange?: (theme: ReaderTheme) => void;
  tocItems?: TocItem[];
  onNavigateToChapter?: (href: string) => void;
  highlights?: Highlight[];
  onNavigateToHighlight?: (cfiRange: string) => void;
  onRemoveHighlight?: (id: string) => void;
}

export function ReaderSettingsPanel({
  bookName,
  bookContentId,
  onClearBook,
  onSelectBook,
  fontSize = 100,
  onFontSizeChange,
  fontFamily = "default",
  onFontFamilyChange,
  theme = "light",
  onThemeChange,
  tocItems = EMPTY_TOC,
  onNavigateToChapter,
  highlights = EMPTY_HIGHLIGHTS,
  onNavigateToHighlight,
  onRemoveHighlight,
}: ReaderSettingsPanelProps) {
  const setAppSettings = useSetAppSettings();
  const closeAppSwitcher = useCloseAppSwitcher();
  const [activeTab, setActiveTab] = useState<'contents' | 'settings' | 'highlights'>('settings');
  const { selectedGroup, isLoading: isGroupLoading } = useGlobalGroup();

  const handleNavigate = (href: string) => {
    onNavigateToChapter?.(href);
    closeAppSwitcher();
  };

  const handleNavigateToHighlight = (cfiRange: string) => {
    onNavigateToHighlight?.(cfiRange);
    closeAppSwitcher();
  };

  // Stable key for highlights to prevent infinite re-renders
  const highlightsKey = useMemo(() => JSON.stringify(highlights), [highlights]);

  useEffect(() => {
    const hasSettings = onFontSizeChange || onFontFamilyChange || onThemeChange;
    const hasToc = tocItems.length > 0;

    const settingsContent = (
      <>
        {/* Book name header */}
        {bookName && (
          <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-800">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-sm text-neutral-300 truncate">
                {bookName}
              </span>
            </div>
            <button
              onClick={onClearBook}
              className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          </div>
        )}

        {/* Reader settings */}
        {hasSettings && (
          <div className="px-4 py-3 space-y-4 border-b border-neutral-800">
            {/* Font Size */}
            {onFontSizeChange && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Size</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onFontSizeChange(Math.max(60, fontSize - 10))}
                    className="w-7 h-7 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    disabled={fontSize <= 60}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm text-neutral-300 w-10 text-center">
                    {fontSize}%
                  </span>
                  <button
                    onClick={() => onFontSizeChange(Math.min(200, fontSize + 10))}
                    className="w-7 h-7 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    disabled={fontSize >= 200}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Font Family */}
            {onFontFamilyChange && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Font</span>
                <div className="flex items-center gap-1">
                  {(["default", "serif", "sans"] as const).map((family) => (
                    <button
                      key={family}
                      onClick={() => onFontFamilyChange(family)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        fontFamily === family
                          ? "bg-amber-600 text-white"
                          : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300"
                      }`}
                    >
                      {family === "default" ? "Default" : family === "serif" ? "Serif" : "Sans"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Theme */}
            {onThemeChange && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Theme</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onThemeChange("light")}
                    className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                      theme === "light"
                        ? "bg-amber-600 text-white"
                        : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                    }`}
                    title="Light"
                  >
                    <Sun className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onThemeChange("dark")}
                    className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                      theme === "dark"
                        ? "bg-amber-600 text-white"
                        : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                    }`}
                    title="Dark"
                  >
                    <Moon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onThemeChange("sepia")}
                    className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                      theme === "sepia"
                        ? "bg-amber-600 text-white"
                        : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                    }`}
                    title="Sepia"
                  >
                    <Type className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Group Selector */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">Group</span>
              <GlobalGroupSelector
                trigger={
                  <button
                    disabled={isGroupLoading}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-200 transition-colors"
                  >
                    <Users className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">
                      {isGroupLoading ? "..." : selectedGroup?.name || "Select"}
                    </span>
                  </button>
                }
              />
            </div>
          </div>
        )}

        {/* Group books list */}
        {onSelectBook && (
          <GroupBooksList onSelectBook={onSelectBook} variant="sidebar" />
        )}
      </>
    );

    const tocContent = (
      <div className="overflow-auto max-h-[60vh]">
        {tocItems.map((item, i) => (
          <button
            key={i}
            onClick={() => handleNavigate(item.href)}
            className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors truncate"
            style={{ paddingLeft: `${16 + item.depth * 16}px` }}
          >
            {item.label}
          </button>
        ))}
      </div>
    );

    const highlightsContent = (
      <div className="overflow-auto max-h-[60vh]">
        {highlights.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Highlighter className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">No highlights yet</p>
            <p className="text-xs text-neutral-600 mt-1">Select text in the book to highlight</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {highlights.map((h) => (
              <div
                key={h.id}
                className="group px-4 py-3 hover:bg-neutral-800/50 transition-colors"
              >
                <button
                  onClick={() => handleNavigateToHighlight(h.cfi_range)}
                  className="w-full text-left"
                >
                  <p className="text-sm text-neutral-300 line-clamp-3 leading-relaxed">
                    "{h.text}"
                  </p>
                </button>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-neutral-500">
                    {new Date(h.created_at).toLocaleDateString()}
                  </span>
                  {onRemoveHighlight && (
                    <button
                      onClick={() => onRemoveHighlight(h.id)}
                      className="p-1 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Delete highlight"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    const hasHighlights = highlights.length > 0;

    const showTabs = hasToc || hasHighlights || bookName;

    setAppSettings(
      <div>
        {/* Tab bar - show if we have TOC or highlights */}
        {showTabs && (
          <div className="flex border-b border-neutral-800">
            {hasToc && (
              <button
                onClick={() => setActiveTab('contents')}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'contents'
                    ? "text-amber-400 border-b-2 border-amber-400 -mb-px"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Contents
              </button>
            )}
            <button
              onClick={() => setActiveTab('highlights')}
              className={`flex-1 px-4 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'highlights'
                  ? "text-amber-400 border-b-2 border-amber-400 -mb-px"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <Highlighter className="w-3.5 h-3.5" />
              Highlights
              {highlights.length > 0 && (
                <span className="ml-1 text-xs text-neutral-500">({highlights.length})</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 px-4 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'settings'
                  ? "text-amber-400 border-b-2 border-amber-400 -mb-px"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
          </div>
        )}

        {/* Tab content */}
        {showTabs && activeTab === 'contents' && hasToc
          ? tocContent
          : showTabs && activeTab === 'highlights'
          ? highlightsContent
          : settingsContent}
      </div>
    );

    return () => {
      setAppSettings(null);
    };
  // Dependencies only include values that affect the rendered output.
  // Callbacks (onClearBook, onSelectBook, etc.) are captured via closure
  // in the JSX event handlers and don't need to trigger effect re-runs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bookName,
    bookContentId,
    setAppSettings,
    fontSize,
    fontFamily,
    theme,
    tocItems,
    activeTab,
    closeAppSwitcher,
    highlightsKey,
    selectedGroup,
    isGroupLoading,
  ]);

  return null;
}
