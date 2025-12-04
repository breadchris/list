import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LucideIcon, ChevronLeft } from 'lucide-react';

export interface PieMenuItem {
  id: string;
  icon: LucideIcon;
  label: string;
  color?: string;
  submenu?: PieMenuItem[];
  onClick?: () => void;
}

interface PieMenuProps {
  items: PieMenuItem[];
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  radius?: number;
  centerRadius?: number;
}

export function PieMenu({
  items,
  isOpen,
  position,
  onClose,
  radius = 120,
  centerRadius = 40
}: PieMenuProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<PieMenuItem[] | null>(null);
  const [submenuLabel, setSubmenuLabel] = useState<string>('');

  useEffect(() => {
    const handleClickOutside = () => {
      if (isOpen) {
        if (activeSubmenu) {
          setActiveSubmenu(null);
          setSubmenuLabel('');
        } else {
          onClose();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSubmenu) {
          setActiveSubmenu(null);
          setSubmenuLabel('');
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, activeSubmenu]);

  const getItemPosition = (index: number, total: number) => {
    const angle = (index * 2 * Math.PI) / total - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return { x, y };
  };

  const handleItemClick = (item: PieMenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If item has a submenu, open it
    if (item.submenu && item.submenu.length > 0) {
      setActiveSubmenu(item.submenu);
      setSubmenuLabel(item.label);
      setHoveredItem(null);
    } else if (item.onClick) {
      // Otherwise execute onClick and close menu
      item.onClick();
      onClose();
      setActiveSubmenu(null);
      setSubmenuLabel('');
    }
  };

  const handleBackClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSubmenu(null);
    setSubmenuLabel('');
    setHoveredItem(null);
  };

  if (!isOpen) return null;

  const currentItems = activeSubmenu || items;
  const isSubmenuActive = activeSubmenu !== null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ pointerEvents: 'none' }}
      >
        {/* Main Menu - Faded when submenu is active */}
        {!isSubmenuActive && (
          <>
            {/* Center circle */}
            <motion.div
              className="absolute bg-white/90 backdrop-blur-sm rounded-full border-2 border-gray-200 shadow-lg"
              style={{
                left: position.x - centerRadius,
                top: position.y - centerRadius,
                width: centerRadius * 2,
                height: centerRadius * 2,
                pointerEvents: 'auto'
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 800, damping: 25, duration: 0.1 }}
            />

            {/* Menu items */}
            {items.map((item, index) => {
              const itemPos = getItemPosition(index, items.length);
              const isHovered = hoveredItem === item.id;
              
              return (
                <motion.div
                  key={item.id}
                  className={`absolute cursor-pointer rounded-full shadow-lg border-2 transition-all duration-200 ${
                    isHovered 
                      ? 'bg-blue-500 border-blue-600 text-white scale-110' 
                      : 'bg-white/90 border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  style={{
                    left: position.x + itemPos.x - 30,
                    top: position.y + itemPos.y - 30,
                    width: 60,
                    height: 60,
                    pointerEvents: 'auto'
                  }}
                  initial={{ 
                    scale: 0, 
                    opacity: 0,
                    x: -itemPos.x * 0.3,
                    y: -itemPos.y * 0.3
                  }}
                  animate={{ 
                    scale: isHovered ? 1.1 : 1, 
                    opacity: 1,
                    x: 0,
                    y: 0
                  }}
                  exit={{ 
                    scale: 0, 
                    opacity: 0,
                    x: -itemPos.x * 0.3,
                    y: -itemPos.y * 0.3
                  }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: 800, 
                    damping: 25,
                    duration: 0.1
                  }}
                  onClick={(e) => handleItemClick(item, e)}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div className="w-full h-full flex items-center justify-center relative">
                    <item.icon size={24} />
                    {item.submenu && item.submenu.length > 0 && (
                      <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center text-white text-xs">
                        →
                      </div>
                    )}
                  </div>
                  
                  {/* Tooltip */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        className="absolute bg-gray-900 text-white text-sm px-2 py-1 rounded pointer-events-none whitespace-nowrap"
                        style={{
                          left: '50%',
                          top: '100%',
                          marginTop: '8px',
                          transform: 'translateX(-50%)'
                        }}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.1 }}
                      >
                        {item.label}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </>
        )}

        {/* Parent Menu - Faded when submenu is active */}
        {isSubmenuActive && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0.3 }}
            transition={{ duration: 0.15 }}
          >
            {/* Faded center circle */}
            <div
              className="absolute bg-white/90 backdrop-blur-sm rounded-full border-2 border-gray-200 shadow-lg"
              style={{
                left: position.x - centerRadius,
                top: position.y - centerRadius,
                width: centerRadius * 2,
                height: centerRadius * 2
              }}
            />

            {/* Faded menu items */}
            {items.map((item, index) => {
              const itemPos = getItemPosition(index, items.length);
              
              return (
                <div
                  key={item.id}
                  className="absolute rounded-full shadow-lg border-2 bg-white/90 border-gray-200 text-gray-700"
                  style={{
                    left: position.x + itemPos.x - 30,
                    top: position.y + itemPos.y - 30,
                    width: 60,
                    height: 60
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <item.icon size={24} />
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Submenu - Full opacity in foreground */}
        {isSubmenuActive && activeSubmenu && (
          <>
            {/* Submenu center circle with back button */}
            <motion.div
              className="absolute bg-gradient-to-br from-blue-500 to-blue-600 backdrop-blur-sm rounded-full border-2 border-blue-400 shadow-xl cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-colors"
              style={{
                left: position.x - centerRadius,
                top: position.y - centerRadius,
                width: centerRadius * 2,
                height: centerRadius * 2,
                pointerEvents: 'auto',
                zIndex: 60
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 800, damping: 25, duration: 0.1 }}
              onClick={handleBackClick}
            >
              <div className="w-full h-full flex items-center justify-center text-white">
                <ChevronLeft size={28} />
              </div>
            </motion.div>

            {/* Submenu items */}
            {activeSubmenu.map((item, index) => {
              const itemPos = getItemPosition(index, activeSubmenu.length);
              const isHovered = hoveredItem === item.id;
              
              return (
                <motion.div
                  key={item.id}
                  className={`absolute cursor-pointer rounded-full shadow-xl border-2 transition-all duration-200 ${
                    isHovered 
                      ? 'bg-blue-500 border-blue-600 text-white scale-110' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  style={{
                    left: position.x + itemPos.x - 30,
                    top: position.y + itemPos.y - 30,
                    width: 60,
                    height: 60,
                    pointerEvents: 'auto',
                    zIndex: 60
                  }}
                  initial={{ 
                    scale: 0, 
                    opacity: 0,
                    x: -itemPos.x * 0.3,
                    y: -itemPos.y * 0.3
                  }}
                  animate={{ 
                    scale: isHovered ? 1.1 : 1, 
                    opacity: 1,
                    x: 0,
                    y: 0
                  }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: 800, 
                    damping: 25,
                    duration: 0.1
                  }}
                  onClick={(e) => handleItemClick(item, e)}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <item.icon size={24} />
                  </div>
                  
                  {/* Tooltip */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        className="absolute bg-gray-900 text-white text-sm px-2 py-1 rounded pointer-events-none whitespace-nowrap"
                        style={{
                          left: '50%',
                          top: '100%',
                          marginTop: '8px',
                          transform: 'translateX(-50%)',
                          zIndex: 70
                        }}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.1 }}
                      >
                        {item.label}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {/* Submenu label */}
            <motion.div
              className="absolute bg-blue-600 text-white text-sm px-3 py-1.5 rounded-full shadow-lg pointer-events-none whitespace-nowrap"
              style={{
                left: position.x,
                top: position.y - centerRadius - 50,
                transform: 'translateX(-50%)',
                zIndex: 60
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.1 }}
            >
              {submenuLabel}
            </motion.div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}