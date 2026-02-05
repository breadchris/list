import { Square } from "lucide-react";

interface WikiAICancelFABProps {
  /** Whether the FAB is visible */
  isVisible: boolean;
  /** Callback when cancel is clicked */
  onCancel: () => void;
}

/**
 * Red floating action button to cancel in-progress AI operations
 * Positioned in the bottom-right of the wiki editor
 */
export function WikiAICancelFAB({ isVisible, onCancel }: WikiAICancelFABProps) {
  if (!isVisible) return null;

  return (
    <button
      onClick={onCancel}
      className="absolute bottom-6 right-6 w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-30 flex items-center justify-center animate-pulse"
      aria-label="Cancel AI"
    >
      <Square className="w-5 h-5 fill-current" />
    </button>
  );
}
