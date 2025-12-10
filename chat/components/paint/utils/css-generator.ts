import type { Frame, CssGenerationData } from "../types";

// Generate CSS box-shadow string from a grid
export function generateBoxShadow(
  grid: string[],
  columns: number,
  rows: number,
  cellSize: number
): string {
  const shadows: string[] = [];

  for (let i = 0; i < grid.length; i++) {
    const color = grid[i];
    if (color && color !== "") {
      const x = (i % columns) + 1;
      const y = Math.floor(i / columns) + 1;
      shadows.push(`${x * cellSize}px ${y * cellSize}px 0 ${color}`);
    }
  }

  return shadows.join(",\n");
}

// Generate CSS for a single frame
export function generateFrameCss(
  grid: string[],
  columns: number,
  rows: number,
  cellSize: number,
  className: string = "pixel-art"
): string {
  const boxShadow = generateBoxShadow(grid, columns, rows, cellSize);
  const width = columns * cellSize;
  const height = rows * cellSize;

  return `.${className} {
  width: ${cellSize}px;
  height: ${cellSize}px;
  background: transparent;
  box-shadow:
${boxShadow
  .split(",\n")
  .map((s) => `    ${s}`)
  .join(",\n")};
}

.${className}-container {
  width: ${width}px;
  height: ${height}px;
  position: relative;
}`;
}

// Generate CSS animation keyframes for multiple frames
export function generateAnimationCss(
  frames: Frame[],
  columns: number,
  rows: number,
  cellSize: number,
  duration: number,
  className: string = "pixel-art"
): string {
  if (frames.length <= 1) {
    return generateFrameCss(frames[0]?.grid || [], columns, rows, cellSize, className);
  }

  const width = columns * cellSize;
  const height = rows * cellSize;

  // Generate keyframes
  const keyframeSteps: string[] = [];
  const totalDuration = duration * 1000; // Convert to milliseconds

  // Calculate cumulative percentages based on frame intervals
  const totalInterval = frames.reduce((sum, f) => sum + f.interval, 0);
  let cumulativePercent = 0;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const boxShadow = generateBoxShadow(frame.grid, columns, rows, cellSize);
    const percent = Math.round(cumulativePercent);

    keyframeSteps.push(`  ${percent}% {
    box-shadow:
${boxShadow
      .split(",\n")
      .map((s) => `      ${s}`)
      .join(",\n")};
  }`);

    cumulativePercent += (frame.interval / totalInterval) * 100;
  }

  // Close the loop
  const lastFrame = frames[frames.length - 1];
  const lastBoxShadow = generateBoxShadow(lastFrame.grid, columns, rows, cellSize);
  keyframeSteps.push(`  100% {
    box-shadow:
${lastBoxShadow
      .split(",\n")
      .map((s) => `      ${s}`)
      .join(",\n")};
  }`);

  return `.${className} {
  width: ${cellSize}px;
  height: ${cellSize}px;
  background: transparent;
  animation: ${className}-animation ${duration}s infinite step-end;
}

.${className}-container {
  width: ${width}px;
  height: ${height}px;
  position: relative;
}

@keyframes ${className}-animation {
${keyframeSteps.join("\n")}
}`;
}

// Main function to generate full CSS from generation data
export function generateCss(data: CssGenerationData): string {
  const { frames, columns, rows, cell_size, duration } = data;

  if (frames.length > 1) {
    return generateAnimationCss(frames, columns, rows, cell_size, duration);
  }

  return generateFrameCss(frames[0]?.grid || [], columns, rows, cell_size);
}

// Generate inline style for preview (single frame)
export function generateInlineBoxShadow(
  grid: string[],
  columns: number,
  cellSize: number
): string {
  const shadows: string[] = [];

  for (let i = 0; i < grid.length; i++) {
    const color = grid[i];
    if (color && color !== "") {
      const x = (i % columns) + 1;
      const y = Math.floor(i / columns) + 1;
      shadows.push(`${x * cellSize}px ${y * cellSize}px 0 ${color}`);
    }
  }

  return shadows.join(", ");
}
