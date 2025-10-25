import React, { forwardRef, useImperativeHandle } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { BeautifulMentionsPlugin, BeautifulMentionNode } from 'lexical-beautiful-mentions';
import { EnterKeySubmitPlugin } from './EnterKeySubmitPlugin';
import { EditorState, $getRoot, CLEAR_EDITOR_COMMAND } from 'lexical';
import { Tag } from './ContentRepository';
import { ContentAction } from './ContentActionsMenu';

interface LexicalContentInputProps {
  onSubmit: (text: string, mentions: string[]) => void;
  onChange?: (editorState: EditorState) => void;
  placeholder?: string;
  disabled?: boolean;
  parentContentId?: string | null;
  availableTags?: Tag[];
  activeAction?: ContentAction | null;
}

export interface LexicalContentInputRef {
  submit: () => void;
  clear: () => void;
}

// Internal component that has access to the editor context
const LexicalContentInputInternal: React.FC<LexicalContentInputProps & { innerRef: React.Ref<LexicalContentInputRef> }> = ({
  onSubmit,
  onChange,
  placeholder,
  disabled = false,
  parentContentId,
  availableTags = [],
  activeAction = null,
  innerRef
}) => {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(innerRef, () => ({
    submit: () => {
      editor.getEditorState().read(() => {
        const plainText = $getRoot().getTextContent().trim();
        // Extract mentions - will be handled by EnterKeySubmitPlugin
        if (plainText) {
          onSubmit(plainText, []);
        }
      });
    },
    clear: () => {
      editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
    }
  }), [editor, onSubmit]);

  const defaultPlaceholder = activeAction === 'ai-chat'
    ? "Ask AI a question..."
    : parentContentId
    ? "Add a sub-item..."
    : "Add a new item to the list...";

  // Convert tags to mention items
  const mentionItems = {
    '#': availableTags.map(tag => tag.name)
  };

  return (
    <div className="relative">
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            className={`lexical-content-editable w-full px-3 py-2 bg-transparent text-white border rounded-md focus:outline-none focus:ring-2 ${
              disabled ? 'opacity-50 cursor-not-allowed' :
              activeAction === 'ai-chat' ? 'border-blue-500 ring-1 ring-blue-400 focus:ring-blue-400 focus:border-blue-500' :
              'border-gray-600 focus:ring-blue-400 focus:border-blue-400'
            }`}
            ariaLabel="Content editor"
            aria-placeholder={placeholder || defaultPlaceholder}
            spellCheck={true}
          />
        }
        placeholder={
          <div className="lexical-placeholder absolute top-2 left-3 text-gray-500 pointer-events-none">
            {placeholder || defaultPlaceholder}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <BeautifulMentionsPlugin
        items={mentionItems}
        menuAnchorClassName="mentions-menu"
      />
      <EnterKeySubmitPlugin onSubmit={onSubmit} disabled={disabled} availableTags={availableTags} />
      {onChange && <OnChangePlugin onChange={onChange} />}
    </div>
  );
};

export const LexicalContentInput = forwardRef<LexicalContentInputRef, LexicalContentInputProps>(({
  onSubmit,
  onChange,
  placeholder,
  disabled = false,
  parentContentId,
  availableTags = [],
  activeAction = null
}, ref) => {
  const initialConfig = {
    namespace: 'ContentEditor',
    nodes: [BeautifulMentionNode],
    theme: {
      root: 'lexical-root',
      paragraph: 'lexical-paragraph',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        strikethrough: 'line-through',
        code: 'font-mono bg-gray-100 px-1 py-0.5 rounded text-sm'
      },
      link: 'text-blue-600 hover:text-blue-800 underline cursor-pointer',
      beautifulMentions: {
        '#': 'bg-blue-100 text-blue-800 px-1 rounded'
      }
    },
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    }
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <LexicalContentInputInternal
        onSubmit={onSubmit}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        parentContentId={parentContentId}
        availableTags={availableTags}
        activeAction={activeAction}
        innerRef={ref}
      />
    </LexicalComposer>
  );
});