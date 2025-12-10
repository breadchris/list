export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
}

export interface StampPlacement {
  id: string;
  habitId: string;
  x: number;
  y: number;
  rotation: number;
  timestamp?: string;
}

export interface DayStamps {
  [date: string]: StampPlacement[];
}
