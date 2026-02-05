"use client";

import { memo, useMemo } from "react";
import { ChevronRight, Circle, CheckCircle2 } from "lucide-react";
import type { RabbitHolePage, RabbitHoleTreeNode } from "@/types/rabbit-hole";

interface RabbitHoleSidebarProps {
  pages: Record<string, RabbitHolePage>;
  rootPageId: string | null;
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
}

// Build tree structure from flat pages
function buildTree(
  pages: Record<string, RabbitHolePage>,
  rootPageId: string | null
): RabbitHoleTreeNode[] {
  if (!rootPageId || !pages[rootPageId]) return [];

  const buildSubtree = (pageId: string): RabbitHoleTreeNode => {
    const page = pages[pageId];
    const children = Object.values(pages)
      .filter((p) => p.parent_page_id === pageId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((childPage) => buildSubtree(childPage.id));

    return { page, children };
  };

  return [buildSubtree(rootPageId)];
}

interface TreeNodeComponentProps {
  node: RabbitHoleTreeNode;
  depth: number;
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
}

const TreeNodeComponent = memo(function TreeNodeComponent({
  node,
  depth,
  activePageId,
  onSelectPage,
}: TreeNodeComponentProps) {
  const { page, children } = node;
  const isActive = page.id === activePageId;
  const isComplete = page.status === "complete";
  const isStreaming = page.status === "streaming";

  return (
    <div>
      <button
        onClick={() => onSelectPage(page.id)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
          isActive
            ? "bg-purple-500/20 text-purple-300"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {isStreaming ? (
          <Circle className="w-3 h-3 text-yellow-400 animate-pulse shrink-0" />
        ) : isComplete ? (
          <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
        ) : (
          <Circle className="w-3 h-3 text-muted-foreground/50 shrink-0" />
        )}
        <span className="truncate text-sm">{page.query}</span>
        {children.length > 0 && (
          <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0 ml-auto" />
        )}
      </button>
      {children.length > 0 && (
        <div className="mt-0.5">
          {children.map((child) => (
            <TreeNodeComponent
              key={child.page.id}
              node={child}
              depth={depth + 1}
              activePageId={activePageId}
              onSelectPage={onSelectPage}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export const RabbitHoleSidebar = memo(function RabbitHoleSidebar({
  pages,
  rootPageId,
  activePageId,
  onSelectPage,
}: RabbitHoleSidebarProps) {
  const tree = useMemo(
    () => buildTree(pages, rootPageId),
    [pages, rootPageId]
  );

  const pageCount = Object.keys(pages).length;

  return (
    <div className="h-full flex flex-col bg-background border-r border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">Exploration</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {pageCount} page{pageCount !== 1 ? "s" : ""} explored
        </p>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto p-2">
        {tree.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No pages yet
          </p>
        ) : (
          tree.map((node) => (
            <TreeNodeComponent
              key={node.page.id}
              node={node}
              depth={0}
              activePageId={activePageId}
              onSelectPage={onSelectPage}
            />
          ))
        )}
      </div>
    </div>
  );
});
