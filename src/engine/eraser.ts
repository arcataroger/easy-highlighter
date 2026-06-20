import type { Point, Stroke } from "./types";

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** True if point p lies within any segment of the stroke. */
export function hitTestStroke(stroke: Stroke, p: Point): boolean {
  for (const seg of stroke.segments) {
    if (seg.kind === "snapped") {
      const halfH = seg.thickness / 2;
      if (p.x >= seg.x0 && p.x <= seg.x1 && Math.abs(p.y - seg.y) <= halfH) return true;
    } else if (seg.kind === "rect") {
      if (p.x >= seg.x && p.x <= seg.x + seg.w && p.y >= seg.y && p.y <= seg.y + seg.h)
        return true;
    } else {
      const half = seg.thickness / 2;
      for (let i = 0; i + 1 < seg.points.length; i++) {
        if (distToSegment(p, seg.points[i], seg.points[i + 1]) <= half) return true;
      }
      if (seg.points.length === 1) {
        if (Math.hypot(p.x - seg.points[0].x, p.y - seg.points[0].y) <= half) return true;
      }
    }
  }
  return false;
}

/** Returns the id of the topmost (last-drawn) stroke under p, or null. */
export function pickStroke(strokes: Stroke[], p: Point): string | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (hitTestStroke(strokes[i], p)) return strokes[i].id;
  }
  return null;
}

/** 
 * Takes an eraser stroke (containing snapped segments) and geometrically subtracts it 
 * from all snapped segments in the existing strokes. Returns the new modified list of strokes.
 */
export function subtractSmartStrokes(strokes: Stroke[], eraser: Stroke): Stroke[] {
  const result: Stroke[] = [];

  for (const s of strokes) {
    let newSegments: typeof s.segments = [];

    for (const seg of s.segments) {
      if (seg.kind === "snapped") {
        let pieces = [seg];

        for (const eSeg of eraser.segments) {
          if (eSeg.kind !== "snapped") continue;
          if (eSeg.lineId !== seg.lineId) continue;

          const nextPieces: typeof pieces = [];
          for (const p of pieces) {
            // Overlap check
            if (Math.max(p.x0, eSeg.x0) < Math.min(p.x1, eSeg.x1)) {
              // Left remainder
              if (p.x0 < eSeg.x0) {
                nextPieces.push({ ...p, x1: eSeg.x0 });
              }
              // Right remainder
              if (p.x1 > eSeg.x1) {
                nextPieces.push({ ...p, x0: eSeg.x1 });
              }
            } else {
              // No overlap, keep piece
              nextPieces.push(p);
            }
          }
          pieces = nextPieces;
        }
        newSegments.push(...pieces);
      } else {
        newSegments.push(seg);
      }
    }

    if (newSegments.length > 0) {
      result.push({ ...s, segments: newSegments });
    }
  }

  return result;
}
