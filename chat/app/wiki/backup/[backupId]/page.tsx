"use client";

import { use, useState, useEffect, useCallback } from "react";
import { ArrowLeft, FileText, Code } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/list/SupabaseClient";
import type {
  WikiBackupData,
  WikiBackupMetadata,
  WikiBackupPage,
} from "@/types/wiki";

export default function WikiBackupViewerPage({
  params,
}: {
  params: Promise<{ backupId: string }>;
}) {
  const { backupId } = use(params);
  const [backupData, setBackupData] = useState<WikiBackupData | null>(null);
  const [metadata, setMetadata] = useState<WikiBackupMetadata | null>(null);
  const [selectedPagePath, setSelectedPagePath] = useState<string>("index");
  const [viewMode, setViewMode] = useState<"html" | "markdown">("html");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch backup on mount
  useEffect(() => {
    const fetchBackup = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("content")
          .select("data, metadata")
          .eq("id", backupId)
          .eq("type", "wiki-backup")
          .single();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          throw new Error("Backup not found");
        }

        const backupContent = JSON.parse(data.data) as WikiBackupData;
        setBackupData(backupContent);
        setMetadata(data.metadata as WikiBackupMetadata);

        // Select first page by default
        if (backupContent.pages.length > 0) {
          // Try to find index page first, otherwise use first page
          const indexPage = backupContent.pages.find((p) => p.path === "index");
          setSelectedPagePath(indexPage?.path || backupContent.pages[0].path);
        }
      } catch (err) {
        console.error("Failed to fetch backup:", err);
        setError(err instanceof Error ? err.message : "Failed to load backup");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBackup();
  }, [backupId]);

  // Get selected page
  const selectedPage = backupData?.pages.find(
    (p) => p.path === selectedPagePath
  );

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Handle click on wiki links - navigate within backup viewer instead of web root
  const handleContentClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const wikiLink = target.closest("[data-wiki-link]");
      if (wikiLink) {
        e.preventDefault();
        const pagePath = wikiLink.getAttribute("data-page-path");
        if (pagePath && backupData) {
          // Check if page exists in backup
          const pageExists = backupData.pages.some((p) => p.path === pagePath);
          if (pageExists) {
            setSelectedPagePath(pagePath);
          } else {
            console.warn(`Page "${pagePath}" not found in backup`);
          }
        }
      }
    },
    [backupData]
  );

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-950">
        <div className="text-neutral-500">Loading backup...</div>
      </div>
    );
  }

  if (error || !backupData) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-neutral-950 gap-4">
        <div className="text-red-400">{error || "Backup not found"}</div>
        <Link
          href="/"
          className="text-teal-400 hover:text-teal-300 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go back</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-neutral-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-3">
          <Link
            href={metadata?.wiki_id ? `/wiki/${metadata.wiki_id}` : "/"}
            className="text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-neutral-100 font-medium">
              {metadata?.wiki_title || "Wiki"} - Backup
            </h1>
            <p className="text-xs text-neutral-500">
              {metadata?.backup_date
                ? formatDate(metadata.backup_date)
                : "Unknown date"}{" "}
              - {metadata?.page_count || backupData.pages.length} pages
            </p>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode("html")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === "html"
                ? "bg-neutral-700 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>HTML</span>
          </button>
          <button
            onClick={() => setViewMode("markdown")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === "markdown"
                ? "bg-neutral-700 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Markdown</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Page list */}
        <aside className="w-64 border-r border-neutral-800 bg-neutral-900 overflow-y-auto flex-shrink-0">
          <div className="p-3">
            <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
              Pages
            </h2>
            <ul className="space-y-1">
              {backupData.pages.map((page) => (
                <li key={page.path}>
                  <button
                    onClick={() => setSelectedPagePath(page.path)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      page.path === selectedPagePath
                        ? "bg-teal-600/20 text-teal-400"
                        : "text-neutral-300 hover:bg-neutral-800"
                    }`}
                  >
                    <div className="font-medium truncate">{page.title}</div>
                    <div className="text-xs text-neutral-500 truncate">
                      {page.path}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-6">
          {selectedPage ? (
            <div className="max-w-4xl mx-auto">
              {/* Page title */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-neutral-100">
                  {selectedPage.title}
                </h2>
                <p className="text-sm text-neutral-500">{selectedPage.path}</p>
              </div>

              {/* Content */}
              {viewMode === "html" ? (
                <div
                  className="prose prose-invert prose-neutral max-w-none
                    [&_p]:text-neutral-200 [&_li]:text-neutral-200 [&_span]:text-neutral-200
                    [&_h1]:text-neutral-100 [&_h2]:text-neutral-100 [&_h3]:text-neutral-100
                    [&_a]:text-teal-400 [&_a]:no-underline [&_a:hover]:text-teal-300
                    [&_.wiki-link-missing]:text-red-400 [&_.wiki-link-missing]:opacity-70"
                  onClick={handleContentClick}
                  dangerouslySetInnerHTML={{ __html: selectedPage.html }}
                />
              ) : (
                <pre className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-sm text-neutral-300 whitespace-pre-wrap overflow-x-auto">
                  {selectedPage.markdown}
                </pre>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-500">
              Select a page to view
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
