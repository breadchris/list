import type { ReaderTheme } from "../reader-app-interface";

interface ReaderSkeletonProps {
  theme: ReaderTheme;
}

const themeBackgrounds: Record<ReaderTheme, string> = {
  light: "#fff",
  dark: "#1a1a1a",
  sepia: "#f4ecd8",
};

const themeTextColors: Record<ReaderTheme, string> = {
  light: "#1a1a1a",
  dark: "#e5e5e5",
  sepia: "#5b4636",
};

/**
 * Skeleton loading placeholder for the EPUB reader.
 * Matches the reader's theme and shows animated placeholder lines.
 */
export function ReaderSkeleton({ theme }: ReaderSkeletonProps) {
  // Generate deterministic widths to avoid hydration mismatch
  const lineWidths = [85, 92, 78, 95, 88, 72, 90, 82, 96, 75, 89, 80];

  return (
    <div
      className="flex-1 animate-pulse"
      style={{ backgroundColor: themeBackgrounds[theme] }}
    >
      {/* Skeleton content area - matches reader padding */}
      <div
        className="h-full py-12"
        style={{
          paddingLeft: "max(16px, calc(50% - 400px))",
          paddingRight: "max(16px, calc(50% - 400px))",
        }}
      >
        <div className="space-y-4">
          {lineWidths.map((width, i) => (
            <div
              key={i}
              className="h-4 rounded"
              style={{
                width: `${width}%`,
                backgroundColor: themeTextColors[theme],
                opacity: 0.08,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
