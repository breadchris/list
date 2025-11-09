import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface Variant {
  id: string;
  name: string;
  description?: string;
}

interface VariantSidebarProps {
  variants: Variant[];
  activeVariant: string;
  onSelectVariant: (variantId: string) => void;
}

export function VariantSidebar({ variants, activeVariant, onSelectVariant }: VariantSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div 
      className={`h-full bg-[#F5EFE3] border-r-2 border-[#9a8a6a] transition-all duration-300 flex flex-col ${
        isCollapsed ? 'w-12' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="bg-[#F4D03F] border-b-2 border-[#9a8a6a] p-4 flex items-center justify-between">
        {!isCollapsed && <h2 className="text-sm">Variants</h2>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-[#e4c02f] border border-[#9a8a6a] transition-colors ml-auto"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Variant List */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {variants.map((variant) => {
              const isActive = activeVariant === variant.id;
              
              return (
                <button
                  key={variant.id}
                  onClick={() => onSelectVariant(variant.id)}
                  className={`w-full text-left p-3 border-2 transition-all ${
                    isActive
                      ? 'bg-[#E67E50] border-[#9a8a6a] shadow-md'
                      : 'bg-[#E8DCC8] border-[#9a8a6a]/40 hover:border-[#9a8a6a] hover:bg-[#E0D4BE]'
                  }`}
                >
                  <div className="text-sm">{variant.name}</div>
                  {variant.description && (
                    <div 
                      className={`text-xs mt-1 ${
                        isActive ? 'opacity-90' : 'opacity-60'
                      }`}
                    >
                      {variant.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="border-t-2 border-[#9a8a6a] p-3 bg-[#E8DCC8]">
          <div className="text-xs opacity-60">
            Select a variant to preview different UI configurations
          </div>
        </div>
      )}
    </div>
  );
}
