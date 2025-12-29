"use client";

import { useState, useCallback } from "react";
import { X, Plus, Search, Sparkles } from "lucide-react";
import type { WikiTemplate } from "@/types/wiki";

interface WikiTemplatesSidebarProps {
  /** All templates */
  templates: WikiTemplate[];
  /** Currently active template ID */
  activeTemplateId?: string;
  /** Callback when a template is selected */
  onSelectTemplate: (template: WikiTemplate) => void;
  /** Callback to create a new template */
  onCreateTemplate: (name: string) => void;
  /** Close the sidebar */
  onClose: () => void;
  /** Check if template name exists */
  templateExists?: (name: string) => boolean;
}

export function WikiTemplatesSidebar({
  templates,
  activeTemplateId,
  onSelectTemplate,
  onCreateTemplate,
  onClose,
  templateExists,
}: WikiTemplatesSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Handle new template creation
  const handleCreateTemplate = useCallback(() => {
    if (!newTemplateName.trim()) return;

    // Check if template already exists
    if (templateExists?.(newTemplateName)) {
      setCreateError(`A template named "${newTemplateName}" already exists`);
      return;
    }

    setCreateError(null);
    onCreateTemplate(newTemplateName.trim());
    setNewTemplateName("");
    setShowNewTemplate(false);
  }, [newTemplateName, onCreateTemplate, templateExists]);

  // Filter templates by search query
  const filteredTemplates = searchQuery.trim()
    ? templates.filter((template) => {
        const query = searchQuery.toLowerCase();
        return (
          template.name.toLowerCase().includes(query) ||
          template.description?.toLowerCase().includes(query) ||
          template.aliases?.some((alias) =>
            alias.toLowerCase().includes(query)
          )
        );
      })
    : templates;

  return (
    <div className="w-64 h-full flex flex-col bg-neutral-900 border-r border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h2 className="text-neutral-200 font-medium">Templates</h2>
        <button
          onClick={onClose}
          className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
          title="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-neutral-800">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* New template form */}
      {showNewTemplate && (
        <div className="px-3 py-2 border-b border-neutral-800">
          <input
            type="text"
            placeholder="Template name..."
            value={newTemplateName}
            onChange={(e) => {
              setNewTemplateName(e.target.value);
              setCreateError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreateTemplate();
              } else if (e.key === "Escape") {
                setShowNewTemplate(false);
                setNewTemplateName("");
                setCreateError(null);
              }
            }}
            autoFocus
            className={`w-full px-3 py-1.5 bg-neutral-800 border rounded-md text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none ${
              createError
                ? "border-red-500"
                : "border-neutral-700 focus:border-blue-500"
            }`}
          />
          {createError && (
            <div className="mt-1 text-xs text-red-400">{createError}</div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setShowNewTemplate(false);
                setNewTemplateName("");
                setCreateError(null);
              }}
              className="px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTemplate}
              disabled={!newTemplateName.trim()}
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      <div className="flex-1 overflow-y-auto py-2">
        {filteredTemplates.length === 0 ? (
          <div className="px-4 py-8 text-center text-neutral-500 text-sm">
            {searchQuery ? "No templates found" : "No templates yet"}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filteredTemplates.map((template) => {
              const isActive = template.id === activeTemplateId;

              return (
                <li key={template.id}>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 mx-2 rounded cursor-pointer transition-colors ${
                      isActive
                        ? "bg-blue-600/20 text-blue-400"
                        : "hover:bg-neutral-800 text-neutral-300"
                    }`}
                    onClick={() => onSelectTemplate(template)}
                  >
                    <Sparkles className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block">
                        {template.name}
                      </span>
                      {template.description && (
                        <span className="text-xs text-neutral-500 truncate block">
                          {template.description}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer with new template button */}
      <div className="px-3 py-2 border-t border-neutral-800">
        <button
          onClick={() => setShowNewTemplate(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">New Template</span>
        </button>
      </div>
    </div>
  );
}
