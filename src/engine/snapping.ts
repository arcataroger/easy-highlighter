import type { LineBox, Point, TextMap } from "./types";

export interface SnapState {
  lockedLineId: number | null;
}

export interface SnapOptions {
  /** vertical reach (px) BEYOND a line's own box within which it can snap */
  maxDist?: number;
  /** a competing line must beat the locked line's score by at least this to steal the lock */
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

/**
 * Score how well the cursor matches a line. A line is a candidate only if the
 * cursor is within the line's vertical box (so tall headline lines are snappable
 * across their whole height), expanded by `maxDist`. Horizontal offset is
 * weighted heavily so the cursor snaps to the line in ITS column, not a
 * different column that happens to share the same row. Lower is better;
 * `Infinity` means "not a candidate".
 */
function lineScore(line: LineBox, cursor: Point, maxDist: number): number {
  const top = line.y - maxDist;
  const bot = line.y + line.h + maxDist;
  if (cursor.y < top || cursor.y > bot) return Infinity;
  const right = line.x + line.w;
  const dx =
    cursor.x < line.x
      ? line.x - cursor.x
      : cursor.x > right
        ? cursor.x - right
        : 0;
  const dy = Math.abs(cursor.y - line.cy);
  return dy + dx * 2;
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
  let bestScore = Infinity;
  for (let i = 0; i < map.length; i++) {
    const s = lineScore(map[i], cursor, maxDist);
    if (s < bestScore) {
      bestScore = s;
      best = i;
    }
  }
  if (best === -1 || bestScore === Infinity) return { snapped: false };

  // Hysteresis: keep the currently locked line unless a competitor clearly wins.
  let chosen = best;
  if (state.lockedLineId !== null) {
    const locked = map.find((l) => l.id === state.lockedLineId);
    if (locked) {
      const lockedScore = lineScore(locked, cursor, maxDist);
      if (lockedScore !== Infinity && lockedScore - bestScore < hysteresis) {
        chosen = map.indexOf(locked);
      }
    }
  }

  const line = map[chosen];
  return { snapped: true, lineId: line.id, y: line.cy, thickness: line.h };
}
