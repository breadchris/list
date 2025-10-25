import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { KEY_ENTER_COMMAND, COMMAND_PRIORITY_LOW, $getRoot, CLEAR_EDITOR_COMMAND, LexicalNode } from 'lexical';
import { BeautifulMentionNode } from 'lexical-beautiful-mentions';
import { Tag } from './ContentRepository';

interface EnterKeySubmitPluginProps {
  onSubmit: (text: string, mentions: string[]) => void;
  disabled?: boolean;
  availableTags?: Tag[];
}

export const EnterKeySubmitPlugin: React.FC<EnterKeySubmitPluginProps> = ({
  onSubmit,
  disabled = false,
  availableTags = []
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Register Enter key handler
    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        if (disabled) return false;

        const { shiftKey } = event;

        if (!shiftKey) {
          event.preventDefault();

          editor.getEditorState().read(() => {
            const plainText = $getRoot().getTextContent().trim();

            // Extract mentions
            const mentions: string[] = [];
            const allNodes = $getRoot().getAllTextNodes();

            // Find all BeautifulMentionNode instances
            for (const node of allNodes) {
              const parent = node.getParent();
              if (parent && parent instanceof BeautifulMentionNode) {
                const mentionValue = parent.getValue();
                if (mentionValue && !mentions.includes(mentionValue)) {
                  mentions.push(mentionValue);
                }
              }
            }

            if (plainText) {
              onSubmit(plainText, mentions);
              editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
            }
          });

          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    // Register Clear Editor command handler
    const unregisterClear = editor.registerCommand(
      CLEAR_EDITOR_COMMAND,
      () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
        });
        return true;
      },
      COMMAND_PRIORITY_LOW
    );

    // Cleanup both handlers
    return () => {
      unregisterEnter();
      unregisterClear();
    };
  }, [editor, onSubmit, disabled, availableTags]);

  return null;
};