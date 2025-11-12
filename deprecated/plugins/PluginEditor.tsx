/**
 * Plugin Editor Component
 *
 * Monaco-based editor for writing and testing plugins.
 * Provides default template, auto-save, and live preview.
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Editor from '@monaco-editor/react';
import { PluginLoader } from './PluginLoader';
import { PluginRenderer } from './PluginRenderer';
import { contentRepository } from './ContentRepository';

export interface PluginEditorProps {
  contentId: string;
  groupId: string;
  initialValue?: string;
  onClose: () => void;
}

/**
 * PluginEditor - Monaco editor for plugin development
 */
export function PluginEditor({
  contentId,
  groupId,
  initialValue,
  onClose
}: PluginEditorProps) {
  const [code, setCode] = useState(initialValue || PluginLoader.getDefaultTemplate());
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentValueRef = useRef(code);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save functionality
  useEffect(() => {
    currentValueRef.current = code;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(code);
    }, 2000); // 2 second debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [code]);

  const handleSave = async (codeToSave: string) => {
    try {
      setSaving(true);
      setError(null);

      await contentRepository.updateContent(contentId, {
        data: codeToSave
      });

      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save plugin:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  };

  const handleRunPlugin = () => {
    setError(null);
    setPreviewCode(currentValueRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave(currentValueRef.current);
    }

    // Ctrl/Cmd + Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunPlugin();
    }

    // Escape to close
    if (e.key === 'Escape' && !previewCode) {
      e.preventDefault();
      onClose();
    }
  };

  const editorContent = (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !previewCode) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900">Plugin Editor</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {saving ? (
                <span className="flex items-center gap-1">
                  <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  Saving...
                </span>
              ) : lastSaved ? (
                <span>Saved {lastSaved.toLocaleTimeString()}</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunPlugin}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2"
              title="Run Plugin (Ctrl+Enter)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Plugin
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              title="Close (Escape)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Content area - split view or full editor */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor */}
          <div className={previewCode ? 'w-1/2 border-r border-gray-200' : 'w-full'}>
            <Editor
              defaultLanguage="typescript"
              value={code}
              onChange={handleEditorChange}
              theme="vs"
              options={{
                minimap: { enabled: true },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                quickSuggestions: true,
                suggestOnTriggerCharacters: true
              }}
            />
          </div>

          {/* Preview pane */}
          {previewCode && (
            <div className="w-1/2 flex flex-col bg-gray-50">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Preview</h3>
                <button
                  onClick={() => setPreviewCode(null)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  title="Close preview"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <PluginRenderer
                  pluginCode={previewCode}
                  contentId={contentId}
                  groupId={groupId}
                  onError={(err) => setError(err.message)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer with keyboard shortcuts */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Shortcuts:</span> Ctrl+Enter to run • Ctrl+S to save • Esc to close
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(editorContent, document.body);
}
