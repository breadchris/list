import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalEditor } from 'lexical';
import { useEffect, useRef, useState } from 'react';

const DRAGGABLE_BLOCK_MENU_CLASSNAME = 'draggable-block-menu';

function isOnMenu(element: HTMLElement): boolean {
  return !!element.closest(`.${DRAGGABLE_BLOCK_MENU_CLASSNAME}`);
}

function getCurrentIndex(keysLength: number): number {
  const menu = document.getElementById('draggable-block-menu');
  if (!menu) return 0;
  const blockKeys = menu.getAttribute('data-block-key')?.split(',') || [];
  return blockKeys.length - 1;
}

function setMenuPosition(
  targetElem: HTMLElement | null,
  floatingElem: HTMLElement,
  anchorElem: HTMLElement,
) {
  if (!targetElem) {
    // Just position at default location, don't hide
    floatingElem.style.transform = 'translate(-40px, 0px)';
    return;
  }

  const targetRect = targetElem.getBoundingClientRect();
  const floatingElemRect = floatingElem.getBoundingClientRect();
  const anchorElementRect = anchorElem.getBoundingClientRect();

  const top = targetRect.top - anchorElementRect.top;
  const left = -40; // Position 40px to the left of the editor

  floatingElem.style.transform = `translate(${left}px, ${top}px)`;
}

function DraggableBlockMenu({
  anchorElem = document.body,
  editor,
  onInsertBlock,
}: {
  anchorElem?: HTMLElement;
  editor: LexicalEditor;
  onInsertBlock?: (type: 'paragraph' | 'bullet-list' | 'numbered-list') => void;
}): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);
  const targetLineRef = useRef<HTMLDivElement | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      const target = event.target;
      if (!anchorElem.contains(target as Node)) {
        setTargetLine(null);
        return;
      }

      if (target && menuRef.current && isOnMenu(target as HTMLElement)) {
        return;
      }

      const _target = target as HTMLElement;
      setTargetLine(_target);
    }

    function setTargetLine(targetElem: HTMLElement | null) {
      targetLineRef.current = targetElem;
      if (menuRef.current) {
        setMenuPosition(targetElem, menuRef.current, anchorElem);
      }
    }

    document.addEventListener('mousemove', onMouseMove);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, [anchorElem, editor]);

  const handleAddClick = () => {
    setShowMenu(!showMenu);
  };

  const handleInsertBlock = (type: 'paragraph' | 'bullet-list' | 'numbered-list') => {
    setShowMenu(false);
    if (onInsertBlock) {
      onInsertBlock(type);
    }
  };

  return (
    <div
      className={DRAGGABLE_BLOCK_MENU_CLASSNAME}
      ref={menuRef}
      id="draggable-block-menu"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        willChange: 'transform',
      }}
    >
      <div className="flex items-center gap-1">
        {/* Drag Handle */}
        <button
          className="draggable-block-handle transition-opacity cursor-grab active:cursor-grabbing text-gray-400 hover:text-white"
          type="button"
          draggable={true}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="4" cy="4" r="1.5" />
            <circle cx="12" cy="4" r="1.5" />
            <circle cx="4" cy="8" r="1.5" />
            <circle cx="12" cy="8" r="1.5" />
            <circle cx="4" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
          </svg>
        </button>

        {/* Add Button */}
        <div className="relative">
          <button
            className="draggable-block-add transition-opacity text-gray-400 hover:text-white font-bold"
            type="button"
            onClick={handleAddClick}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Insert Menu */}
          {showMenu && (
            <div className="absolute left-0 top-8 bg-white border border-gray-200 rounded shadow-lg py-1 z-50 min-w-[160px]">
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => handleInsertBlock('paragraph')}
              >
                <span>¶</span> Paragraph
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => handleInsertBlock('bullet-list')}
              >
                <span>•</span> Bullet List
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => handleInsertBlock('numbered-list')}
              >
                <span>1.</span> Numbered List
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DraggableBlockPlugin({
  anchorElem = document.body,
  onInsertBlock,
}: {
  anchorElem?: HTMLElement;
  onInsertBlock?: (type: 'paragraph' | 'bullet-list' | 'numbered-list') => void;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();

  return <DraggableBlockMenu anchorElem={anchorElem} editor={editor} onInsertBlock={onInsertBlock} />;
}
