import { FolderOpen } from 'lucide-react';

interface BranchInfo {
  id: string;
  label: string;
  color: string;
}

interface BranchTabsProps {
  branches: BranchInfo[];
  activeMessageId: string;
  onSelectBranch: (messageId: string) => void;
}

export function BranchTabs({ branches, activeMessageId, onSelectBranch }: BranchTabsProps) {
  if (branches.length <= 1) {
    return null;
  }

  // Estimate tab width (approximate) - each tab is roughly 120-140px
  const estimatedTabWidth = 130;
  const maxWidth = 800; // Approximate max container width
  const tabsPerRow = Math.floor(maxWidth / estimatedTabWidth);

  // Split tabs into visual "depths" - tabs wrap back to start with different depths
  const getTabPosition = (index: number) => {
    const row = Math.floor(index / tabsPerRow);
    const positionInRow = index % tabsPerRow;
    return { row, positionInRow };
  };

  return (
    <div className="mb-4">
      <div className="relative" style={{ height: '50px' }}>
        {/* The folder body - background for all tabs */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-[#D4C4A8] rounded-b-sm" />
        
        {/* Individual folder tabs with depth simulation */}
        <div className="absolute top-0 left-0 right-0">
          {branches.map((branch, index) => {
            const isActive = activeMessageId === branch.id;
            const { row, positionInRow } = getTabPosition(index);
            const horizontalOffset = positionInRow * 130; // Base horizontal offset
            const rowHorizontalOffset = row * 40; // Shift each row to the right
            const tabOffset = horizontalOffset + rowHorizontalOffset;
            const depthOffset = row * 3; // Vertical offset for depth (slightly more pronounced)
            
            return (
              <button
                key={branch.id}
                onClick={() => onSelectBranch(branch.id)}
                className={`absolute flex items-center gap-2 px-4 py-2 transition-all border-2 border-[#9a8a6a] border-b-0 rounded-t-md ${
                  isActive 
                    ? 'opacity-100 h-10 -mb-px' 
                    : 'opacity-60 hover:opacity-100 h-9 border-opacity-60'
                }`}
                style={{
                  backgroundColor: branch.color,
                  left: `${tabOffset}px`,
                  top: `${depthOffset}px`,
                  zIndex: isActive ? 50 : 30 - row * 5 - positionInRow,
                  boxShadow: isActive ? '0 -2px 8px rgba(0,0,0,0.1)' : 'none',
                }}
                title={`Switch to ${branch.label}`}
              >
                <span 
                  style={{ fontSize: '0.8rem' }}
                  className={isActive ? '' : 'opacity-80'}
                >
                  {branch.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}