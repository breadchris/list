import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

interface BranchInfo {
  id: string;
  label: string;
  color: string;
}

interface BranchListProps {
  branches: BranchInfo[];
  activeMessageId: string;
  onSelectBranch: (messageId: string) => void;
}

export function BranchList({ branches, activeMessageId, onSelectBranch }: BranchListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);

  if (branches.length <= 1) {
    return null;
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setHasMoved(false);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Multiply by 2 for faster scrolling
    
    // Only set hasMoved if we've moved more than 5 pixels (threshold for click vs drag)
    if (Math.abs(walk) > 5) {
      setHasMoved(true);
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // Reset hasMoved after a short delay to allow click events to process
    setTimeout(() => setHasMoved(false), 0);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHasMoved(false);
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setHasMoved(false);
    setStartX(e.touches[0].pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    const x = e.touches[0].pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    
    if (Math.abs(walk) > 5) {
      setHasMoved(true);
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTimeout(() => setHasMoved(false), 0);
  };

  const handleBranchClick = (branchId: string) => {
    // Only trigger branch change if we haven't dragged
    if (!hasMoved) {
      onSelectBranch(branchId);
    }
  };

  return (
    <div className="my-4 relative group">
      {/* Left scroll button */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-[#F4D03F] border-2 border-[#9a8a6a] p-1.5 sm:p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-[#e4c02f]"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
      </button>

      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 sm:gap-3 overflow-x-auto scrollbar-hide px-8 sm:px-10 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {branches.map((branch) => (
          <button
            key={branch.id}
            onClick={(e) => {
              if (!hasMoved) {
                onSelectBranch(branch.id);
              }
            }}
            className={`flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-[#9a8a6a] transition-all text-xs sm:text-sm ${ 
              branch.id === activeMessageId
                ? 'opacity-100 shadow-md'
                : 'opacity-60 hover:opacity-80'
            }`}
            style={{
              backgroundColor: branch.color,
              userSelect: 'none',
            }}
          >
            {branch.label}
          </button>
        ))}
      </div>

      {/* Right scroll button */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-[#F4D03F] border-2 border-[#9a8a6a] p-1.5 sm:p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-[#e4c02f]"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
}