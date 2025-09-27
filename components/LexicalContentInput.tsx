import React, { forwardRef, useImperativeHandle } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { EnterKeySubmitPlugin } from './EnterKeySubmitPlugin';
import { EditorState, $getRoot } from 'lexical';

interface LexicalContentInputProps {
  onSubmit: (text: string) => void;
  onChange?: (editorState: EditorState) => void;
  placeholder?: string;
  disabled?: boolean;
  parentContentId?: string | null;
}

export interface LexicalContentInputRef {
  submit: () => void;
}

// Internal component that has access to the editor context
const LexicalContentInputInternal: React.FC<LexicalContentInputProps & { innerRef: React.Ref<LexicalContentInputRef> }> = ({
  onSubmit,
  onChange,
  placeholder,
  disabled = false,
  parentContentId,
  innerRef
}) => {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(innerRef, () => ({
    submit: () => {
      editor.getEditorState().read(() => {
        const plainText = $getRoot().getTextContent().trim();
        if (plainText) {
          onSubmit(plainText);
        }
      });
    }
  }), [editor, onSubmit]);

  const defaultPlaceholder = parentContentId
    ? "Add a sub-item..."
    : "Add a new item to the list...";

  return (
    <div className="relative">
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            className={`lexical-content-editable w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
            }`}
            ariaLabel="Content editor"
            aria-placeholder={placeholder || defaultPlaceholder}
            spellCheck={true}
          />
        }
        placeholder={
          <div className="lexical-placeholder absolute top-2 left-3 text-gray-400 pointer-events-none">
            {placeholder || defaultPlaceholder}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <EnterKeySubmitPlugin onSubmit={onSubmit} disabled={disabled} />
      {onChange && <OnChangePlugin onChange={onChange} />}
    </div>
  );
};

export const LexicalContentInput = forwardRef<LexicalContentInputRef, LexicalContentInputProps>(({
  onSubmit,
  onChange,
  placeholder,
  disabled = false,
  parentContentId
}, ref) => {
  const initialConfig = {
    namespace: 'ContentEditor',
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
      link: 'text-blue-600 hover:text-blue-800 underline cursor-pointer'
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
        innerRef={ref}
      />
    </LexicalComposer>
  );
});