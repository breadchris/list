import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';

interface DraggablePaneWrapperProps {
  id: string;
  index: number;
  type: string;
  movePane: (dragIndex: number, hoverIndex: number) => void;
  children: React.ReactNode | ((dragHandle: any) => React.ReactNode);
  className?: string;
  isMobile?: boolean;
}

interface DragItem {
  index: number;
  id: string;
  type: string;
}

export const DraggablePaneWrapper: React.FC<DraggablePaneWrapperProps> = ({ id, index, type, movePane, children, className, isMobile }) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ handlerId }, drop] = useDrop<DragItem, void, { handlerId: string | symbol | null }>({
    accept: type,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    // ... hover logic remains same ...
    hover(item: DragItem, monitor) {
      if (isMobile) return;
      if (!ref.current) {
        return;
      }
      if (item.type !== type) return; // Prevent cross-list dragging if types differ

      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverBoundingRect.left;

      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) {
        return;
      }

      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) {
        return;
      }

      movePane(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    canDrop: () => !isMobile
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: type,
    item: () => {
      return { id, index, type };
    },
    canDrag: () => !isMobile,
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  if (!isMobile) {
      // If children is function, use preview on container
      if (typeof children === 'function') {
          preview(drop(ref));
      } else {
          // Backward compatibility: drag on container
          drag(drop(ref));
      }
  }

  return (
    <div id={`pane-${id}`} ref={ref} className={className} style={{ opacity: isDragging ? 0.4 : 1 }} data-handler-id={handlerId}>
      {typeof children === 'function' ? children(drag) : children}
    </div>
  );
};
