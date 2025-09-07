import React, { useEffect, useRef, useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useUpdateContentMutation } from '../hooks/useContentQueries';
import { useToast } from './ToastProvider';

interface MonacoEditorProps {
  contentId: string;
  initialValue: string;
  onClose: () => void;
  className?: string;
  onRunCode?: (code: string) => void;
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  contentId,
  initialValue,
  onClose,
  className = '',
  onRunCode
}) => {
  const updateContentMutation = useUpdateContentMutation();
  const toast = useToast();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentValueRef = useRef(initialValue);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const saveContent = useCallback(async (value: string) => {
    if (!hasUnsavedChanges) return;
    
    setIsSaving(true);
    try {
      await updateContentMutation.mutateAsync({
        id: contentId,
        updates: { data: value }
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save content:', error);
      toast.error('Failed to save', 'Your changes could not be saved automatically.');
    } finally {
      setIsSaving(false);
    }
  }, [contentId, updateContentMutation, toast, hasUnsavedChanges]);

  const debouncedSave = useCallback((value: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      saveContent(value);
    }, 500); // 500ms debounce
  }, [saveContent]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value === undefined) return;
    
    if (value !== currentValueRef.current) {
      currentValueRef.current = value;
      setHasUnsavedChanges(true);
      debouncedSave(value);
    }
  }, [debouncedSave]);

  // Save on unmount if there are unsaved changes
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (hasUnsavedChanges) {
        saveContent(currentValueRef.current);
      }
    };
  }, [saveContent, hasUnsavedChanges]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Save on Ctrl+S
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      if (hasUnsavedChanges) {
        saveContent(currentValueRef.current);
      }
    }
    
    // Run code on Ctrl+Enter
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && onRunCode) {
      event.preventDefault();
      onRunCode(currentValueRef.current);
    }
  }, [saveContent, hasUnsavedChanges, onRunCode]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={`relative ${className}`}>
      {/* Top controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center space-x-2">
        {/* Run Code Button */}
        {onRunCode && (
          <button
            onClick={() => onRunCode(currentValueRef.current)}
            className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
            title="Run Code (Ctrl/Cmd + Enter)"
          >
            <span>▶</span>
            <span>Run</span>
          </button>
        )}
        
        {/* Save status indicator */}
        {(isSaving || hasUnsavedChanges) && (
          <div className="flex items-center space-x-2 bg-white/90 px-2 py-1 rounded shadow text-xs">
            {isSaving ? (
              <>
                <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span className="text-blue-600">Saving...</span>
              </>
            ) : hasUnsavedChanges ? (
              <span className="text-orange-600">Unsaved</span>
            ) : (
              <span className="text-green-600">Saved</span>
            )}
          </div>
        )}
      </div>
      
      <Editor
        defaultLanguage="javascript"
        value={initialValue}
        onChange={handleEditorChange}
        theme="vs"
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'on',
          lineNumbers: 'on',
          folding: true,
          bracketMatching: 'always',
          autoIndent: 'full',
          formatOnPaste: true,
          formatOnType: true,
        }}
      />
    </div>
  );
};