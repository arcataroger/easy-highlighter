import type { BinImage } from "./binarize";
import { detectTextLines, median, type DetectedLine } from "./lineDetect";
import { compWidth, type Component } from "./connectedComponents";
import { makeLineBox, type LineBox, type TextMap, type WordBox } from "../types";

export interface TextMapOptions {
  /**
   * Min blank-column run (px) that separates two words. When omitted it is
   * derived adaptively from the median glyph width of the line.
   */
  wordGap?: number;
  /** @deprecated kept for back-compat; no longer used by CC detection. */
  minInkFraction?: number;
  /** Connectivity for connected-component labelling (default 8). */
  connectivity?: 4 | 8;
}

/**
 * Group a line's components into words by clustering left-to-right and
 * splitting on horizontal gaps wider than `wordGap` (RLSA-style smoothing).
 */
function groupWords(line: DetectedLine, wordGap: number): WordBox[] {
  const comps = line.comps; // already sorted left-to-right
  const words: WordBox[] = [];
  let cur: Component[] = [];
  let lastX1 = -Infinity;

  const flush = () => {
    if (cur.length === 0) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const c of cur) {
      if (c.x0 < x0) x0 = c.x0;
      if (c.y0 < y0) y0 = c.y0;
      if (c.x1 > x1) x1 = c.x1;
      if (c.y1 > y1) y1 = c.y1;
    }
    words.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
    cur = [];
  };

  for (const c of comps) {
    if (cur.length > 0 && c.x0 - lastX1 - 1 >= wordGap) flush();
    cur.push(c);
    lastX1 = Math.max(lastX1, c.x1);
  }
  flush();
  return words;
}

export function buildTextMap(img: BinImage, opts: TextMapOptions = {}): TextMap {
  const lines = detectTextLines(img, { connectivity: opts.connectivity });
  const result: LineBox[] = [];

  let id = 0;
  for (const line of lines) {
    // Adaptive word gap: roughly the width of a typical glyph in this line.
    // Real inter-word spaces are wider than inter-glyph spacing.
    const medGlyphW = median(line.comps.map(compWidth));
    const wordGap =
      opts.wordGap ?? Math.max(2, Math.round(medGlyphW * 0.8));

    const words = groupWords(line, wordGap);
    if (words.length === 0) continue;

    const x = line.x0;
    const y = line.y0;
    const w = line.x1 - line.x0 + 1;
    const h = line.y1 - line.y0 + 1;

    result.push(
      makeLineBox({
        id,
        x,
        y,
        w,
        h,
        words,
      })
    );
    id++;
  }

  return result;
}
