import React, { useState, useCallback } from 'react';
import { Content, Tag } from './ContentRepository';
import { MonacoEditor } from './MonacoEditor';
import { ContentList } from './ContentList';
import { ContentInput } from './ContentInput';
import { ContentSelectionState } from '../hooks/useContentSelection';
import { JsConsole, ConsoleEntry } from './JsConsole';
import { JsExecutor } from './JsExecutor';

interface JsEditorViewProps {
  jsContent: Content;
  groupId: string;
  onClose: () => void;
  onNavigate: (parentId: string | null) => void;
  searchQuery: string;
  isSearching: boolean;
  selection: ContentSelectionState;
  newContent?: Content;
  onContentAdded: (content: Content) => void;
  showInput: boolean;
  onInputClose: () => void;
  viewMode?: 'chronological' | 'random' | 'alphabetical' | 'oldest';
  availableTags?: Tag[];
}

export const JsEditorView: React.FC<JsEditorViewProps> = ({
  jsContent,
  groupId,
  onClose,
  onNavigate,
  searchQuery,
  isSearching,
  selection,
  newContent,
  onContentAdded,
  showInput,
  onInputClose,
  viewMode = 'chronological',
  availableTags = []
}) => {
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [executor] = useState(() => new JsExecutor(setConsoleEntries));

  const handleRunCode = useCallback(async (code: string) => {
    await executor.executeCode(code);
  }, [executor]);

  const handleClearConsole = useCallback(() => {
    executor.clearConsole();
  }, [executor]);

  return (
    <div className="flex flex-col h-full">
      {/* Monaco Editor - Top */}
      <div className="h-80 border rounded-lg mb-4 overflow-hidden">
        <MonacoEditor
          contentId={jsContent.id}
          initialValue={jsContent.data}
          onClose={() => {}} // Handled by parent
          className="h-full"
          onRunCode={handleRunCode}
        />
      </div>

      {/* JavaScript Console */}
      <div className="mb-4">
        <JsConsole
          entries={consoleEntries}
          onClear={handleClearConsole}
          className="h-48"
        />
      </div>

      {/* Content Input */}
      <ContentInput
        groupId={groupId}
        parentContentId={jsContent.id}
        onContentAdded={(content) => {
          onContentAdded(content);
          onInputClose();
        }}
        isVisible={showInput}
        onClose={onInputClose}
        availableTags={availableTags}
      />
      
      {/* Content List - Below Editor */}
      <div className="flex-1">
        <ContentList
          groupId={groupId}
          parentContentId={jsContent.id}
          onNavigate={onNavigate}
          searchQuery={searchQuery}
          isSearching={isSearching}
          selection={selection}
          newContent={newContent}
          viewMode={viewMode}
        />
      </div>
    </div>
  );
};