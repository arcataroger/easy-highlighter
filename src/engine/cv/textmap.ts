import type { BinImage } from "./binarize";
import { findLineBands } from "./projection";
import { makeLineBox, type LineBox, type TextMap, type WordBox } from "../types";

export interface TextMapOptions {
  /** min blank-column run (px) that separates two words */
  wordGap?: number;
  minInkFraction?: number;
}

/** Column ink counts within a row band [top..bottom]. */
function bandColumnProjection(img: BinImage, top: number, bottom: number): Uint32Array {
  const proj = new Uint32Array(img.width);
  for (let y = top; y <= bottom; y++) {
    const base = y * img.width;
    for (let x = 0; x < img.width; x++) proj[x] += img.ink[base + x];
  }
  return proj;
}

/** Group consecutive ink columns into [x0,x1] runs, merging gaps < wordGap. */
function columnRuns(col: Uint32Array, wordGap: number): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  let lastInk = -1;
  for (let x = 0; x < col.length; x++) {
    if (col[x] > 0) {
      if (start === -1) start = x;
      else if (lastInk !== -1 && x - lastInk - 1 >= wordGap) {
        runs.push([start, lastInk]);
        start = x;
      }
      lastInk = x;
    }
  }
  if (start !== -1) runs.push([start, lastInk]);
  return runs;
}

export function buildTextMap(img: BinImage, opts: TextMapOptions = {}): TextMap {
  const wordGap = opts.wordGap ?? 4;
  const bands = findLineBands(img, opts.minInkFraction);
  const lines: LineBox[] = [];
  bands.forEach((band, id) => {
    const col = bandColumnProjection(img, band.top, band.bottom);
    const runs = columnRuns(col, wordGap);
    if (runs.length === 0) return;
    const left = runs[0][0];
    const right = runs[runs.length - 1][1];
    const words: WordBox[] = runs.map(([x0, x1]) => ({
      x: x0,
      y: band.top,
      w: x1 - x0 + 1,
      h: band.bottom - band.top + 1,
    }));
    lines.push(
      makeLineBox({
        id,
        x: left,
        y: band.top,
        w: right - left + 1,
        h: band.bottom - band.top + 1,
        words,
      })
    );
  });
  return lines;
}
