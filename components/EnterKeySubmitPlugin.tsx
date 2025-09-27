import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { KEY_ENTER_COMMAND, COMMAND_PRIORITY_LOW, $getRoot, CLEAR_EDITOR_COMMAND } from 'lexical';

interface EnterKeySubmitPluginProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export const EnterKeySubmitPlugin: React.FC<EnterKeySubmitPluginProps> = ({
  onSubmit,
  disabled = false
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        if (disabled) return false;

        const { shiftKey } = event;

        if (!shiftKey) {
          event.preventDefault();

          editor.getEditorState().read(() => {
            const plainText = $getRoot().getTextContent().trim();

            if (plainText) {
              onSubmit(plainText);
              editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
            }
          });

          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, onSubmit, disabled]);

  return null;
};