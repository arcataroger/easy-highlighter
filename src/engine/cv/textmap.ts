import type { BinImage } from "./binarize";
import { detectTextLines } from "./lineDetect";
import { makeLineBox, type LineBox, type TextMap, type WordBox } from "../types";

export interface TextMapOptions {
  /**
   * @deprecated word gaps are now handled in line detection.
   */
  wordGap?: number;
  /** @deprecated kept for back-compat; no longer used by CC detection. */
  minInkFraction?: number;
  /** Connectivity for connected-component labelling (default 8). */
  connectivity?: 4 | 8;
}

export function buildTextMap(img: BinImage, opts: TextMapOptions = {}): TextMap {
  const lines = detectTextLines(img, { connectivity: opts.connectivity });
  const result: LineBox[] = [];

  let id = 0;
  for (const line of lines) {
    const words: WordBox[] = line.words.map((w) => ({
      x: w.x0,
      y: w.y0,
      w: w.x1 - w.x0 + 1,
      h: w.y1 - w.y0 + 1,
    }));

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
