import type { Point, TextMap } from "./types";

export interface SnapState {
  lockedLineId: number | null;
}

export interface SnapOptions {
  /** max vertical distance (px) from a line center to consider snapping */
  maxDist?: number;
  /** a competing line must be closer than the locked line by at least this (px) to steal the lock */
  hysteresis?: number;
}

export interface SnapResult {
  snapped: boolean;
  lineId?: number;
  /** vertical center of the band */
  y?: number;
  /** band thickness (line height) */
  thickness?: number;
}

export function snap(
  map: TextMap,
  cursor: Point,
  state: SnapState,
  opts: SnapOptions = {}
): SnapResult {
  const maxDist = opts.maxDist ?? 24;
  const hysteresis = opts.hysteresis ?? 8;
  if (map.length === 0) return { snapped: false };

  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < map.length; i++) {
    const d = Math.abs(cursor.y - map[i].cy);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  if (best === -1 || bestDist > maxDist) return { snapped: false };

  // Hysteresis: keep the currently locked line unless a competitor is clearly closer.
  let chosen = best;
  if (state.lockedLineId !== null) {
    const locked = map.find((l) => l.id === state.lockedLineId);
    if (locked && Math.abs(cursor.y - locked.cy) <= maxDist) {
      const lockedDist = Math.abs(cursor.y - locked.cy);
      if (lockedDist - bestDist < hysteresis) {
        chosen = map.indexOf(locked);
      }
    }
  }

  const line = map[chosen];
  return { snapped: true, lineId: line.id, y: line.cy, thickness: line.h };
}
