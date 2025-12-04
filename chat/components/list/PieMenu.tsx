import React, { useEffect, useState } from 'react';

export interface PieMenuItem {
  id: string;
  icon: string;
  label: string;
  action: () => void;
  color?: string;
}

interface PieMenuProps {
  items: PieMenuItem[];
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
}

/**
 * Reusable pie menu component that displays items in an arc
 * Uses polar coordinates for positioning
 */
export const PieMenu: React.FC<PieMenuProps> = ({
  items,
  isOpen,
  onClose,
  triggerRef,
  radius = 120,
  startAngle = 180, // Left (9 o'clock)
  endAngle = 0, // Right (3 o'clock)
}) => {
  const [triggerPosition, setTriggerPosition] = useState({ x: 0, y: 0 });
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Calculate trigger button position when menu opens
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTriggerPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  // Calculate position for each item in the arc
  const getItemPosition = (index: number) => {
    const totalItems = items.length;
    const angleRange = startAngle - endAngle;
    const angleStep = angleRange / (totalItems - 1 || 1);
    const angle = startAngle - angleStep * index;
    const radians = (angle * Math.PI) / 180;

    return {
      x: triggerPosition.x + radius * Math.cos(radians),
      y: triggerPosition.y - radius * Math.sin(radians),
    };
  };

  const handleItemClick = (item: PieMenuItem) => {
    item.action();
    onClose();
  };

  return (
    <>
      {/* Backdrop to close menu */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        style={{ background: 'transparent' }}
      />

      {/* Pie menu items */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        {items.map((item, index) => {
          const position = getItemPosition(index);
          const isHovered = hoveredItem === item.id;

          return (
            <div
              key={item.id}
              className="absolute pointer-events-auto"
              style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                opacity: isOpen ? 1 : 0,
                scale: isOpen ? (isHovered ? 1.15 : 1) : 0,
                transitionDelay: `${index * 30}ms`,
              }}
            >
              <button
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`
                  relative flex items-center justify-center
                  w-14 h-14 rounded-full
                  bg-gray-700 hover:bg-gray-600
                  text-white text-2xl
                  shadow-lg hover:shadow-xl
                  transition-all duration-200
                  ${isHovered ? 'ring-2 ring-blue-400' : ''}
                  ${item.color || ''}
                `}
                aria-label={item.label}
              >
                {item.icon}

                {/* Label on hover */}
                {isHovered && (
                  <div
                    className="absolute bottom-full mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap shadow-lg"
                    style={{
                      animation: 'fadeIn 0.15s ease-out',
                    }}
                  >
                    {item.label}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};
