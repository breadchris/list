"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { X, Sparkles, Trash2, MoreHorizontal, Info } from "lucide-react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import {
  FormattingToolbar,
  FormattingToolbarController,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  BasicTextStyleButton,
  BlockTypeSelect,
  ColorStyleButton,
  NestBlockButton,
  UnnestBlockButton,
  CreateLinkButton,
} from "@blocknote/react";
import {
  AIExtension,
  AIMenuController,
  AIToolbarButton,
  getAISlashMenuItems,
  aiDocumentFormats,
} from "@blocknote/xl-ai";
import { DefaultChatTransport } from "ai";
import { en } from "@blocknote/core/locales";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import type { WikiTemplate } from "@/types/wiki";
import { WIKI_TEMPLATE_MODELS, DEFAULT_TEMPLATE_MODEL } from "@/types/wiki";

import "@blocknote/shadcn/style.css";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/xl-ai/style.css";

interface WikiTemplatePanelProps {
  /** Template data */
  template: WikiTemplate;
  /** Whether this panel is active */
  isActive: boolean;
  /** Panel index */
  index: number;
  /** Close this panel */
  onClose: () => void;
  /** Set this panel as active */
  onActivate: () => void;
  /** Update the template */
  onUpdate: (updates: {
    name?: string;
    prompt?: string;
    prompt_format?: 'text' | 'blocknote';
    model?: string;
    description?: string;
    aliases?: string[];
    include_selection?: boolean;
  }) => void;
  /** Delete the template */
  onDelete?: () => void;
  /** Panel width (desktop only) */
  width?: number;
  /** Callback for resize */
  onResize?: (width: number) => void;
  /** Whether to show resize handle */
  showResizeHandle?: boolean;
}

/**
 * Convert plain text to BlockNote blocks
 */
function textToBlocks(text: string): unknown[] {
  if (!text.trim()) {
    return [
      {
        id: crypto.randomUUID(),
        type: "paragraph",
        props: {},
        content: [],
        children: [],
      },
    ];
  }

  // Split by newlines and create paragraph blocks
  const lines = text.split('\n');
  return lines.map((line) => ({
    id: crypto.randomUUID(),
    type: "paragraph",
    props: {},
    content: line ? [{ type: "text", text: line, styles: {} }] : [],
    children: [],
  }));
}

/**
 * Parse template prompt based on format
 */
function parsePromptToBlocks(prompt: string, format?: 'text' | 'blocknote'): unknown[] {
  if (format === 'blocknote') {
    try {
      return JSON.parse(prompt);
    } catch {
      // Fallback to text conversion if JSON parsing fails
      return textToBlocks(prompt);
    }
  }
  // Legacy text format
  return textToBlocks(prompt);
}

export function WikiTemplatePanel({
  template,
  isActive,
  index,
  onClose,
  onActivate,
  onUpdate,
  onDelete,
  width,
  onResize,
  showResizeHandle = false,
}: WikiTemplatePanelProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [localName, setLocalName] = useState(template.name);
  const [localDescription, setLocalDescription] = useState(
    template.description || ""
  );
  const [localAliases, setLocalAliases] = useState(
    template.aliases?.join(", ") || ""
  );
  const [localIncludeSelection, setLocalIncludeSelection] = useState(
    template.include_selection || false
  );
  const [showVariableHint, setShowVariableHint] = useState(false);
  const [isEditorMounted, setIsEditorMounted] = useState(false);
  const isEditorMountedRef = useRef(false);

  // Track current model selection
  const [localModel, setLocalModel] = useState(template.model || DEFAULT_TEMPLATE_MODEL);

  // Parse initial content from template
  const initialContent = useMemo(() => {
    return parsePromptToBlocks(template.prompt, template.prompt_format);
  }, [template.id]); // Only recalculate on template change, not prompt changes

  // Update local state when template changes (except editor content)
  useEffect(() => {
    setLocalName(template.name);
    setLocalDescription(template.description || "");
    setLocalAliases(template.aliases?.join(", ") || "");
    setLocalModel(template.model || DEFAULT_TEMPLATE_MODEL);
    setLocalIncludeSelection(template.include_selection || false);
  }, [template.id, template.name, template.description, template.aliases, template.model, template.include_selection]);

  // Create transport with model header for AI
  const aiTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/blocknote-ai",
        headers: {
          "X-AI-Model": localModel,
        },
      }),
    [localModel]
  );

  // Create BlockNote editor (no collaboration - templates are simple docs)
  const editor = useCreateBlockNote(
    {
      initialContent: initialContent as any,
      extensions: [
        AIExtension({
          transport: aiTransport,
          streamToolsProvider: aiDocumentFormats.html.getStreamToolsProvider({
            withDelays: false,
          }),
        }),
      ],
      dictionary: {
        ...en,
        ai: aiEn,
      },
    },
    [template.id, aiTransport] // Recreate editor when template or model changes
  );

  // Track when editor view is ready
  useEffect(() => {
    if (!editor) {
      isEditorMountedRef.current = false;
      setIsEditorMounted(false);
      return;
    }

    // Check if view is already available
    const tiptapEditor = (editor as unknown as { _tiptapEditor?: { view?: unknown } })._tiptapEditor;
    if (tiptapEditor?.view) {
      isEditorMountedRef.current = true;
      setIsEditorMounted(true);
      return;
    }

    // Poll for view availability (TipTap mounts async)
    const checkMount = setInterval(() => {
      const editor_internal = (editor as unknown as { _tiptapEditor?: { view?: unknown } })._tiptapEditor;
      if (editor_internal?.view) {
        isEditorMountedRef.current = true;
        setIsEditorMounted(true);
        clearInterval(checkMount);
      }
    }, 10);

    return () => {
      clearInterval(checkMount);
      isEditorMountedRef.current = false;
      setIsEditorMounted(false);
    };
  }, [editor]);

  // Debounced save for editor content
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!editor || !isEditorMounted) return;

    const handleChange = () => {
      // Debounce save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        const blocks = editor.document;
        const jsonContent = JSON.stringify(blocks);
        onUpdate({
          prompt: jsonContent,
          prompt_format: 'blocknote'
        });
      }, 500);
    };

    editor.onChange(handleChange);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editor, isEditorMounted, onUpdate]);

  // Save on blur for text fields
  const handleNameBlur = useCallback(() => {
    if (localName.trim() && localName !== template.name) {
      onUpdate({ name: localName.trim() });
    }
  }, [localName, template.name, onUpdate]);

  const handleDescriptionBlur = useCallback(() => {
    if (localDescription !== (template.description || "")) {
      onUpdate({ description: localDescription || undefined });
    }
  }, [localDescription, template.description, onUpdate]);

  const handleAliasesBlur = useCallback(() => {
    const newAliases = localAliases
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    const currentAliases = template.aliases || [];

    // Check if changed
    if (JSON.stringify(newAliases) !== JSON.stringify(currentAliases)) {
      onUpdate({ aliases: newAliases.length > 0 ? newAliases : undefined });
    }
  }, [localAliases, template.aliases, onUpdate]);

  // Handle model change
  const handleModelChange = useCallback((newModel: string) => {
    setLocalModel(newModel);
    onUpdate({ model: newModel });
  }, [onUpdate]);

  // Handle include selection toggle
  const handleIncludeSelectionChange = useCallback((checked: boolean) => {
    setLocalIncludeSelection(checked);
    onUpdate({ include_selection: checked });
  }, [onUpdate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`relative h-full flex flex-col bg-neutral-950 ${
        isActive ? "ring-1 ring-blue-500/30" : ""
      }`}
      style={{ width: width ? `${width}px` : undefined }}
      onClick={onActivate}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-neutral-300 text-sm font-medium truncate max-w-[200px]">
            {template.name}
          </span>
          <span className="text-neutral-600 text-xs">template</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg py-1 min-w-[120px]">
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onDelete();
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-neutral-700 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
        {/* Name field */}
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Name</label>
          <input
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Template name..."
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Description field */}
        <div>
          <label className="block text-xs text-neutral-500 mb-1">
            Description (shown in slash menu)
          </label>
          <input
            type="text"
            value={localDescription}
            onChange={(e) => setLocalDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Brief description..."
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Aliases field */}
        <div>
          <label className="block text-xs text-neutral-500 mb-1">
            Aliases (comma-separated)
          </label>
          <input
            type="text"
            value={localAliases}
            onChange={(e) => setLocalAliases(e.target.value)}
            onBlur={handleAliasesBlur}
            placeholder="e.g., summary, summarize, tldr"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Model selection */}
        <div>
          <label className="block text-xs text-neutral-500 mb-1">AI Model</label>
          <select
            value={localModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
          >
            {WIKI_TEMPLATE_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.provider})
              </option>
            ))}
          </select>
        </div>

        {/* Include selection toggle */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id={`include-selection-${template.id}`}
            checked={localIncludeSelection}
            onChange={(e) => handleIncludeSelectionChange(e.target.checked)}
            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-neutral-900"
          />
          <label
            htmlFor={`include-selection-${template.id}`}
            className="text-sm text-neutral-300 cursor-pointer"
          >
            Include selected text as{" "}
            <code className="text-amber-400 bg-neutral-800 px-1 rounded">{"{{selection}}"}</code>
          </label>
        </div>

        {/* Prompt field - BlockNote editor */}
        <div className="flex-1 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-neutral-500">
              AI Prompt / Instructions
            </label>
            <button
              onClick={() => setShowVariableHint(!showVariableHint)}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300"
            >
              <Info className="w-3 h-3" />
              Variables
            </button>
          </div>

          {showVariableHint && (
            <div className="mb-2 p-2 bg-neutral-800/50 border border-neutral-700 rounded text-xs text-neutral-400">
              <p className="mb-1">Available variables (replaced at runtime):</p>
              <ul className="space-y-0.5 ml-2">
                <li>
                  <code className="text-amber-400">{"{{page_title}}"}</code> -
                  Current page title
                </li>
                <li>
                  <code className="text-amber-400">{"{{page_path}}"}</code> -
                  Current page path
                </li>
                <li>
                  <code className="text-amber-400">{"{{selection}}"}</code> -
                  Selected text (requires toggle above)
                </li>
              </ul>
            </div>
          )}

          {/* BlockNote Editor */}
          <div
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-md overflow-hidden"
            style={{ pointerEvents: isEditorMounted ? 'auto' : 'none' }}
          >
            {editor && (
              <BlockNoteView
                editor={editor}
                theme="dark"
                className="h-full"
                formattingToolbar={false}
                slashMenu={false}
              >
                <FormattingToolbarController
                  formattingToolbar={() => (
                    <FormattingToolbar>
                      <BlockTypeSelect key="blockTypeSelect" />
                      <BasicTextStyleButton basicTextStyle="bold" key="boldStyleButton" />
                      <BasicTextStyleButton basicTextStyle="italic" key="italicStyleButton" />
                      <BasicTextStyleButton basicTextStyle="underline" key="underlineStyleButton" />
                      <BasicTextStyleButton basicTextStyle="strike" key="strikeStyleButton" />
                      <BasicTextStyleButton basicTextStyle="code" key="codeStyleButton" />
                      <ColorStyleButton key="colorStyleButton" />
                      <NestBlockButton key="nestBlockButton" />
                      <UnnestBlockButton key="unnestBlockButton" />
                      <CreateLinkButton key="createLinkButton" />
                      <AIToolbarButton key="aiToolbarButton" />
                    </FormattingToolbar>
                  )}
                />
                <SuggestionMenuController
                  triggerCharacter="/"
                  getItems={async (query) => {
                    return [
                      ...getDefaultReactSlashMenuItems(editor),
                      ...getAISlashMenuItems(editor),
                    ].filter((item) =>
                      item.title.toLowerCase().includes(query.toLowerCase())
                    );
                  }}
                />
                <AIMenuController />
              </BlockNoteView>
            )}
          </div>
        </div>
      </div>

      {/* Resize handle (desktop only) */}
      {showResizeHandle && onResize && (
        <ResizeHandle currentWidth={width || 400} onResize={onResize} />
      )}
    </div>
  );
}

interface ResizeHandleProps {
  currentWidth: number;
  onResize: (width: number) => void;
}

function ResizeHandle({ currentWidth, onResize }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startWidth = currentWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.max(200, Math.min(800, startWidth + delta));
        onResize(newWidth);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [currentWidth, onResize]
  );

  return (
    <div
      className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors ${
        isDragging ? "bg-blue-500" : "bg-transparent"
      }`}
      onMouseDown={handleMouseDown}
    />
  );
}
