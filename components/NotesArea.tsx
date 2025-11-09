import { useState, useEffect } from 'react';
import { FileText, Save, Download, Trash2, Bold, Italic, Underline, List, ListOrdered, GripVertical } from 'lucide-react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  FORMAT_TEXT_COMMAND,
  EditorState,
  $getSelection,
  $isRangeSelection,
  TextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';

interface NotesAreaProps {
  onSave?: (content: string) => void;
  activeVariant?: string;
  variants?: { id: string; name: string; description: string }[];
  onSelectVariant?: (variantId: string) => void;
}

// Toolbar component
function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();

  return (
    <div className="flex items-center gap-1 p-2 border-b-2 border-[#9a8a6a] bg-[#E8DCC8]">
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
        }}
        className="p-2 hover:bg-[#D4C4A8] border border-[#9a8a6a] bg-[#F5EFE3] transition-colors"
        title="Bold"
        type="button"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
        }}
        className="p-2 hover:bg-[#D4C4A8] border border-[#9a8a6a] bg-[#F5EFE3] transition-colors"
        title="Italic"
        type="button"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
        }}
        className="p-2 hover:bg-[#D4C4A8] border border-[#9a8a6a] bg-[#F5EFE3] transition-colors"
        title="Underline"
        type="button"
      >
        <Underline className="w-4 h-4" />
      </button>
      <div className="w-px h-6 bg-[#9a8a6a] mx-1" />
      <button
        onClick={() => {
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        }}
        className="p-2 hover:bg-[#D4C4A8] border border-[#9a8a6a] bg-[#F5EFE3] transition-colors"
        title="Bullet List"
        type="button"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        }}
        className="p-2 hover:bg-[#D4C4A8] border border-[#9a8a6a] bg-[#F5EFE3] transition-colors"
        title="Numbered List"
        type="button"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
    </div>
  );
}

// Plugin to convert "* " to bullet list
function AutoListPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        
        if (!$isRangeSelection(selection)) {
          return;
        }

        const anchorNode = selection.anchor.getNode();
        const textContent = anchorNode.getTextContent();
        
        // Check if user typed "* "
        if (textContent === '* ') {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            
            const node = selection.anchor.getNode();
            
            // Clear the "* " text
            if (node instanceof TextNode) {
              node.setTextContent('');
            }
            
            // Convert to list
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
          });
        }
      });
    });
  }, [editor]);

  return null;
}

export function NotesArea({ onSave, activeVariant, variants, onSelectVariant }: NotesAreaProps) {
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);

  const initialConfig = {
    namespace: 'NotesEditor',
    theme: {
      paragraph: 'mb-2 relative pl-8 group',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
      },
      list: {
        ul: 'list-disc mb-2 pl-8',
        ol: 'list-decimal mb-2 pl-8',
        listitem: 'ml-6 relative group',
      },
    },
    onError: (error: Error) => {
      console.error(error);
    },
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode],
  };

  const handleSave = () => {
    setSavedContent(content);
    setLastSaved(new Date().toLocaleTimeString());
    if (onSave) {
      onSave(content);
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all notes?')) {
      setContent('');
      setSavedContent('');
      setLastSaved(null);
      setWordCount(0);
      setCharacterCount(0);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEditorChange = (editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot();
      const textContent = root.getTextContent();
      setContent(textContent);
      setCharacterCount(textContent.length);
      const words = textContent.trim().split(/\s+/).filter(w => w.length > 0);
      setWordCount(words.length);
    });
  };

  const hasUnsavedChanges = content !== savedContent;

  return (
    <div className="h-full flex flex-col bg-[#E8DCC8] flex-1">
      {/* Header */}
      <div className="bg-[#F4D03F] border-b-2 border-[#9a8a6a] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5" />
          <h2 className="text-sm">Notes</h2>
          {lastSaved && (
            <span className="text-xs opacity-60">
              Last saved: {lastSaved}
            </span>
          )}
          {hasUnsavedChanges && (
            <span className="text-xs px-2 py-0.5 bg-[#E67E50] border border-[#9a8a6a]">
              Unsaved
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Variant selector */}
          {variants && onSelectVariant && (
            <select
              value={activeVariant}
              onChange={(e) => onSelectVariant(e.target.value)}
              className="bg-[#F5EFE3] border-2 border-[#9a8a6a] px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm focus:outline-none focus:border-[#E67E50]"
            >
              {variants.map(variant => (
                <option key={variant.id} value={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          )}
          
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={`px-3 py-1.5 border-2 border-[#9a8a6a] flex items-center gap-2 text-sm transition-colors ${ 
              hasUnsavedChanges
                ? 'bg-[#E67E50] hover:bg-[#d66e40] cursor-pointer'
                : 'bg-[#D4C4A8] opacity-50 cursor-not-allowed'
            }`}
            title="Save notes"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>

          <button
            onClick={handleDownload}
            disabled={!content}
            className={`px-3 py-1.5 border-2 border-[#9a8a6a] flex items-center gap-2 text-sm transition-colors ${
              content
                ? 'bg-[#F5EFE3] hover:bg-[#EDE5D8] cursor-pointer'
                : 'bg-[#D4C4A8] opacity-50 cursor-not-allowed'
            }`}
            title="Download notes"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClear}
            disabled={!content}
            className={`px-3 py-1.5 border-2 border-[#9a8a6a] flex items-center gap-2 text-sm transition-colors ${
              content
                ? 'bg-[#F5EFE3] hover:bg-[#EDE5D8] cursor-pointer'
                : 'bg-[#D4C4A8] opacity-50 cursor-not-allowed'
            }`}
            title="Clear all notes"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Lexical Editor */}
      <LexicalComposer initialConfig={initialConfig}>
        <ToolbarPlugin />
        <AutoListPlugin />
        <div className="flex-1 overflow-hidden flex flex-col relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="w-full h-full bg-[#F5EFE3] p-6 outline-none overflow-y-auto lexical-editor-with-drag-handles"
                style={{
                  lineHeight: '1.6',
                }}
              />
            }
            placeholder={
              <div className="absolute top-6 left-6 opacity-40 pointer-events-none" style={{ lineHeight: '1.6' }}>
                Start taking notes here...
                <br /><br />
                • Reference key points from the chat
                <br />
                • Organize your thoughts
                <br />
                • Save important insights
              </div>
            }
            ErrorBoundary={() => <div className="p-6 text-red-500">An error occurred in the editor</div>}
          />
          <HistoryPlugin />
          <ListPlugin />
          <OnChangePlugin onChange={handleEditorChange} />
        </div>
      </LexicalComposer>

      {/* Footer Stats */}
      <div className="border-t-2 border-[#9a8a6a] p-3 bg-[#E8DCC8] flex items-center justify-between">
        <div className="text-xs opacity-60 flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{characterCount} characters</span>
        </div>
        
        <div className="text-xs opacity-60">
          Press Ctrl+S or Cmd+S to save
        </div>
      </div>
    </div>
  );
}