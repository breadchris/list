import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from "react";
import { TailwindExtension } from "@lexical/tailwind";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  BeautifulMentionsPlugin,
  BeautifulMentionNode,
} from "lexical-beautiful-mentions";
import { ListNode, ListItemNode } from "@lexical/list";
import {
  EditorState,
  $getRoot,
  CLEAR_EDITOR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
} from "lexical";
import { Tag } from "@/lib/list/ContentRepository";
import DraggableBlockPlugin from "./DraggableBlockPlugin";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";

interface LexicalRichEditorProps {
  onSubmit: (text: string, mentions: string[]) => void;
  onChange?: (editorState: EditorState) => void;
  placeholder?: string;
  disabled?: boolean;
  availableTags?: Tag[];
  showSubmitButton?: boolean;
  submitButtonText?: string;
}

export interface LexicalRichEditorRef {
  submit: () => void;
  clear: () => void;
}

// Plugin to handle Cmd/Ctrl+Enter for submission
const KeyboardSubmitPlugin: React.FC<{
  onSubmit: (text: string, mentions: string[]) => void;
  disabled: boolean;
  availableTags: Tag[];
}> = ({ onSubmit, disabled, availableTags }) => {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        const { ctrlKey, metaKey } = event;

        // Only handle Cmd/Ctrl+Enter for submission
        if ((ctrlKey || metaKey) && !disabled) {
          event.preventDefault();

          editor.getEditorState().read(() => {
            const root = $getRoot();
            const plainText = root.getTextContent().trim();

            // Extract tag mentions from the text
            const mentionMatches = plainText.match(/#[\w-]+/g) || [];
            const mentions = mentionMatches
              .map((match) => match.slice(1))
              .filter((tagName) =>
                availableTags.some(
                  (tag) => tag.name.toLowerCase() === tagName.toLowerCase(),
                ),
              );

            if (plainText) {
              onSubmit(plainText, mentions);
              editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
            }
          });

          return true;
        }

        // Let normal Enter key work for line breaks
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, onSubmit, disabled, availableTags]);

  return null;
};

// Plugin to expose imperative handle methods
const ImperativeHandlePlugin: React.FC<{
  innerRef: React.Ref<LexicalRichEditorRef>;
  onSubmit: (text: string, mentions: string[]) => void;
  availableTags: Tag[];
}> = ({ innerRef, onSubmit, availableTags }) => {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(
    innerRef,
    () => ({
      submit: () => {
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const plainText = root.getTextContent().trim();

          // Extract tag mentions
          const mentionMatches = plainText.match(/#[\w-]+/g) || [];
          const mentions = mentionMatches
            .map((match) => match.slice(1))
            .filter((tagName) =>
              availableTags.some(
                (tag) => tag.name.toLowerCase() === tagName.toLowerCase(),
              ),
            );

          if (plainText) {
            onSubmit(plainText, mentions);
            editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
          }
        });
      },
      clear: () => {
        editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
      },
    }),
    [editor, onSubmit, availableTags],
  );

  return null;
};

// Editor content component with proper context access
const EditorContent: React.FC<
  LexicalRichEditorProps & { innerRef: React.Ref<LexicalRichEditorRef> }
> = ({
  onSubmit,
  onChange,
  placeholder = "Start typing...",
  disabled = false,
  availableTags = [],
  showSubmitButton = true,
  submitButtonText = "Submit",
  innerRef,
}) => {
  const [editor] = useLexicalComposerContext();
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [anchorElem, setAnchorElem] = useState<HTMLElement | null>(null);

  // Fix ref timing issue - set anchor element after mount
  useEffect(() => {
    if (editorContainerRef.current) {
      setAnchorElem(editorContainerRef.current);
    }
  }, []);

  // Convert tags to mention items
  const mentionItems = {
    "#": availableTags.map((tag) => tag.name),
  };

  const handleInsertBlock = (
    type: "paragraph" | "bullet-list" | "numbered-list",
  ) => {
    if (type === "bullet-list") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else if (type === "numbered-list") {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
    // For paragraph, just focus the editor (default behavior)
    editor.focus();
  };

  const handleSubmitClick = () => {
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const plainText = root.getTextContent().trim();

      const mentionMatches = plainText.match(/#[\w-]+/g) || [];
      const mentions = mentionMatches
        .map((match) => match.slice(1))
        .filter((tagName) =>
          availableTags.some(
            (tag) => tag.name.toLowerCase() === tagName.toLowerCase(),
          ),
        );

      if (plainText) {
        onSubmit(plainText, mentions);
        editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
      }
    });
  };

  return (
    <div
      className="lexical-rich-editor-wrapper relative"
      ref={editorContainerRef}
    >
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            className="lexical-rich-content-editable w-full px-3 py-3 bg-gray-800 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-blue-400 focus:border-blue-400 min-h-[200px]"
            ariaLabel="Rich text editor"
            aria-placeholder={placeholder}
            spellCheck={true}
          />
        }
        placeholder={
          <div className="lexical-placeholder absolute top-3 left-3 text-gray-500 pointer-events-none">
            {placeholder}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <ListPlugin />
      <BeautifulMentionsPlugin
        items={mentionItems}
        menuAnchorClassName="mentions-menu"
      />
      <KeyboardSubmitPlugin
        onSubmit={onSubmit}
        disabled={disabled}
        availableTags={availableTags}
      />
      {onChange && <OnChangePlugin onChange={onChange} />}
      {anchorElem && (
        <DraggableBlockPlugin
          anchorElem={anchorElem}
          onInsertBlock={handleInsertBlock}
        />
      )}
      <ImperativeHandlePlugin
        innerRef={innerRef}
        onSubmit={onSubmit}
        availableTags={availableTags}
      />

      {showSubmitButton && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={disabled}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {submitButtonText}
          </button>
          <span className="ml-2 text-xs text-gray-500 self-center">
            or press Cmd/Ctrl+Enter
          </span>
        </div>
      )}
    </div>
  );
};

export const LexicalRichEditor = forwardRef<
  LexicalRichEditorRef,
  LexicalRichEditorProps
>(
  (
    {
      onSubmit,
      onChange,
      placeholder,
      disabled = false,
      availableTags = [],
      showSubmitButton = true,
      submitButtonText = "Submit",
    },
    ref,
  ) => {
    const initialConfig = {
      namespace: "RichEditor",
      nodes: [BeautifulMentionNode, ListNode, ListItemNode],
      theme: {
        root: "lexical-root",
        paragraph: "lexical-paragraph mb-2",
        text: {
          bold: "font-bold",
          italic: "italic",
          underline: "underline",
          strikethrough: "line-through",
          code: "font-mono bg-gray-700 px-1 py-0.5 rounded text-sm",
        },
        link: "text-blue-400 hover:text-blue-300 underline cursor-pointer",
        list: {
          ul: "lexical-list-ul list-disc pl-6 mb-2",
          ol: "lexical-list-ol list-decimal pl-6 mb-2",
          listitem: "lexical-list-item mb-1",
          nested: {
            listitem: "lexical-nested-list-item",
          },
        },
        beautifulMentions: {
          "#": "bg-blue-100 text-blue-800 px-1 rounded",
        },
      },
      onError: (error: Error) => {
        console.error("Lexical Rich Editor error:", error);
      },
    };

    return (
      <LexicalComposer initialConfig={initialConfig}>
        <EditorContent
          onSubmit={onSubmit}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          availableTags={availableTags}
          showSubmitButton={showSubmitButton}
          submitButtonText={submitButtonText}
          innerRef={ref}
        />
      </LexicalComposer>
    );
  },
);

LexicalRichEditor.displayName = "LexicalRichEditor";
