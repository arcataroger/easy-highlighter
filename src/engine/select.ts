import { snap } from "./snapping";
import {
  makeStroke,
  type LineBox,
  type Point,
  type Stroke,
  type TextMap,
} from "./types";

/** The line nearest to point p within maxDist (vertical), or null. */
export function lineAt(map: TextMap, p: Point, maxDist = 40): LineBox | null {
  const r = snap(map, p, { lockedLineId: null }, { maxDist });
  if (!r.snapped) return null;
  return map.find((l) => l.id === r.lineId) ?? null;
}

export function medianLineHeight(map: TextMap): number {
  if (map.length === 0) return 0;
  const hs = map.map((l) => l.h).sort((a, b) => a - b);
  return hs[Math.floor(hs.length / 2)];
}

export interface ParagraphOptions {
  /** vertical gap (px) between two lines above which a paragraph break occurs */
  maxGap?: number;
}

/**
 * The contiguous run of lines forming the paragraph that contains `lineId`.
 * Lines are treated top-to-bottom; a gap larger than `maxGap` (default ~0.9×
 * the median line height) ends the paragraph.
 */
export function paragraphLines(
  map: TextMap,
  lineId: number,
  opts: ParagraphOptions = {}
): LineBox[] {
  const sorted = [...map].sort((a, b) => a.y - b.y);
  const si = sorted.findIndex((l) => l.id === lineId);
  if (si === -1) return [];
  const maxGap = opts.maxGap ?? medianLineHeight(sorted) * 0.9;
  const gap = (a: LineBox, b: LineBox) => b.y - (a.y + a.h); // a above b
  let lo = si;
  let hi = si;
  while (lo > 0 && gap(sorted[lo - 1], sorted[lo]) <= maxGap) lo--;
  while (hi < sorted.length - 1 && gap(sorted[hi], sorted[hi + 1]) <= maxGap) hi++;
  return sorted.slice(lo, hi + 1);
}

/** A stroke that highlights one full line across its text extent. */
export function lineStroke(line: LineBox, color: string, opacity: number): Stroke {
  return makeStroke({
    color,
    opacity,
    segments: [
      {
        kind: "snapped",
        lineId: line.id,
        x0: line.x,
        x1: line.x + line.w,
        y: line.cy,
        thickness: line.h,
      },
    ],
  });
}

/** A stroke that highlights every line in a paragraph (one segment per line). */
export function paragraphStroke(
  lines: LineBox[],
  color: string,
  opacity: number
): Stroke {
  return makeStroke({
    color,
    opacity,
    segments: lines.map((line) => ({
      kind: "snapped" as const,
      lineId: line.id,
      x0: line.x,
      x1: line.x + line.w,
      y: line.cy,
      thickness: line.h,
    })),
  });
}
