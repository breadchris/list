import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { LexicalRichEditor, LexicalRichEditorRef } from './LexicalRichEditor';
import { EditorState } from 'lexical';

interface NotesEditorSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  editorState?: any; // Serialized Lexical state from metadata
  onEditorChange: (serializedState: any) => void;
}

export interface NotesEditorSidebarRef {
  clear: () => void;
  submit: () => void;
}

export const NotesEditorSidebar = forwardRef<NotesEditorSidebarRef, NotesEditorSidebarProps>(
  ({ isCollapsed, onToggleCollapse, editorState, onEditorChange }, ref) => {
    const editorRef = useRef<LexicalRichEditorRef>(null);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      clear: () => {
        editorRef.current?.clear();
      },
      submit: () => {
        editorRef.current?.submit();
      }
    }));

    // Handle editor state changes
    const handleEditorChange = (state: EditorState) => {
      const serialized = state.toJSON();
      onEditorChange(serialized);
    };

    // Collapsed view
    if (isCollapsed) {
      return (
        <div className="flex flex-col items-center h-full w-12 border-l border-gray-200 bg-white">
          {/* Expand button */}
          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-gray-100 transition-colors rounded-md mt-2"
            title="Expand notes editor"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Vertical text label */}
          <div
            className="flex-1 flex items-center justify-center"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            <span className="text-sm font-medium text-gray-600 select-none">
              Notes
            </span>
          </div>
        </div>
      );
    }

    // Expanded view
    return (
      <div className="flex flex-col h-full w-1/3 min-w-[350px] border-l border-gray-200 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            {/* Pen/Document icon */}
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-700">Notes</h3>
          </div>

          {/* Collapse button */}
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-gray-200 transition-colors rounded"
            title="Collapse notes editor"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-4">
          <LexicalRichEditor
            ref={editorRef}
            onSubmit={() => {
              // No-op: notes don't have explicit submit action
            }}
            onChange={handleEditorChange}
            placeholder="Take notes..."
            showSubmitButton={false}
          />
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            Auto-saves to chat metadata
          </p>
        </div>
      </div>
    );
  }
);

NotesEditorSidebar.displayName = 'NotesEditorSidebar';
