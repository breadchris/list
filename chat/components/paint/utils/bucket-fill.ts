import { GRID_BACKGROUND_COLOR } from "../constants";

// Check if two colors are the same
function isSameColor(colorA: string, colorB: string): boolean {
  const a = colorA || GRID_BACKGROUND_COLOR;
  const b = colorB || GRID_BACKGROUND_COLOR;
  return a === b;
}

// Get adjacent cells of the same color
function getSameColorAdjacentCells(
  gridArray: string[],
  columns: number,
  rows: number,
  id: number,
  color: string
): number[] {
  const adjacentCollection: number[] = [];
  const gridSize = columns * rows;

  // Right
  if ((id + 1) % columns !== 0 && id + 1 < gridSize) {
    if (isSameColor(gridArray[id + 1], color)) {
      adjacentCollection.push(id + 1);
    }
  }
  // Left
  if (id % columns !== 0 && id - 1 >= 0) {
    if (isSameColor(gridArray[id - 1], color)) {
      adjacentCollection.push(id - 1);
    }
  }
  // Top
  if (id >= columns) {
    if (isSameColor(gridArray[id - columns], color)) {
      adjacentCollection.push(id - columns);
    }
  }
  // Bottom
  if (id < gridSize - columns) {
    if (isSameColor(gridArray[id + columns], color)) {
      adjacentCollection.push(id + columns);
    }
  }

  return adjacentCollection;
}

export interface BucketFillChange {
  id: number;
  color: string;
}

// Apply bucket fill algorithm and return changes
export function applyBucketFill(
  gridArray: string[],
  id: number,
  paletteColor: string,
  columns: number,
  rows: number
): BucketFillChange[] {
  const cellColor = gridArray[id] || "";
  const changes: BucketFillChange[] = [];

  // Don't fill if same color
  if (isSameColor(cellColor, paletteColor)) {
    return changes;
  }

  const queue: number[] = [id];
  const visited = new Set<number>();

  // Create a mutable copy for neighbor checking
  const gridCopy = [...gridArray];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentColor = gridCopy[currentId];
    if (!isSameColor(currentColor, cellColor)) continue;

    changes.push({ id: currentId, color: paletteColor });
    gridCopy[currentId] = paletteColor; // Update local copy for neighbor checking

    const adjacents = getSameColorAdjacentCells(
      gridCopy,
      columns,
      rows,
      currentId,
      cellColor
    );
    for (const adjId of adjacents) {
      if (!visited.has(adjId)) {
        queue.push(adjId);
      }
    }
  }

  return changes;
}

// Shift pixels in different directions
export function shiftPixelsUp(grid: string[], columns: number): string[] {
  return [...grid.slice(columns), ...grid.slice(0, columns)];
}

export function shiftPixelsDown(grid: string[], columns: number): string[] {
  return [...grid.slice(-columns), ...grid.slice(0, -columns)];
}

export function shiftPixelsLeft(grid: string[], columns: number): string[] {
  const rows = grid.length / columns;
  const newGrid: string[] = [];

  for (let row = 0; row < rows; row++) {
    const start = row * columns;
    const rowData = grid.slice(start, start + columns);
    newGrid.push(...rowData.slice(1), rowData[0]);
  }

  return newGrid;
}

export function shiftPixelsRight(grid: string[], columns: number): string[] {
  const rows = grid.length / columns;
  const newGrid: string[] = [];

  for (let row = 0; row < rows; row++) {
    const start = row * columns;
    const rowData = grid.slice(start, start + columns);
    newGrid.push(rowData[rowData.length - 1], ...rowData.slice(0, -1));
  }

  return newGrid;
}
