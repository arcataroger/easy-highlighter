import type { BinImage } from "./binarize";
import {
  connectedComponents,
  compWidth,
  compHeight,
  compFill,
  type Component,
} from "./connectedComponents";

export interface DetectedWord {
  /** inclusive bounds of the word */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** the text components that make up this word */
  comps: Component[];
}

export interface DetectedLine {
  /** inclusive bounds of the whole line */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** the words that make up this line, left-to-right */
  words: DetectedWord[];
}

export interface LineDetectOptions {
  connectivity?: 4 | 8;
  /**
   * Max component height as a multiple of the median glyph height before it is
   * treated as a figure/graphic rather than text. Default 3.5 (covers tall
   * ascender/descender glyphs and small drop-caps but rejects figures).
   */
  maxHeightFactor?: number;
  /**
   * A component is treated as a horizontal rule if it is at least this many
   * times wider than the median glyph width AND no taller than `ruleMaxHeight`.
   */
  ruleWidthFactor?: number;
  /**
   * Intrinsic aspect ratio (long-side / short-side) above which a thin
   * component is treated as a rule line, regardless of page statistics.
   * Default 12 (rules are extremely elongated; glyphs are not).
   */
  ruleAspect?: number;
  /** Max height (px) for a wide component to count as a rule line. Default 3. */
  ruleMaxHeight?: number;
  /**
   * Components whose bounding-box fill exceeds this AND whose area is large
   * (a multiple of the median glyph area) are treated as solid figures.
   */
  figureFill?: number;
  /** Vertical-overlap tolerance for grouping, as a fraction of median height. */
  overlapTolerance?: number;
  /**
   * Min vertical-overlap (as a fraction of the SHORTER of the component/line
   * heights) for a component to join a line. Measuring against the shorter side
   * lets an over-sized initial letter or drop-cap — which shares the baseline
   * but towers above the body text — still attach to its line. Default 0.5.
   */
  joinOverlapFrac?: number;
  /**
   * A single component taller than this fraction of the page is treated as a
   * figure/photo, not a glyph. This replaces median-relative height rejection,
   * which wrongly dropped large headline caps on pages that mix font sizes
   * (the global median is dominated by small body text). Default 0.33.
   */
  figureMaxHeightFrac?: number;
  /** @deprecated superseded by top-down banding; no longer used. */
  columnGapFactor?: number;
  /** Absolute floor (px) for the column-gutter width. Default 10. */
  minColumnGapPx?: number;
  /**
   * Vertical whitespace gap (× median glyph height) above which the page is cut
   * into separate horizontal bands — isolating headlines/captions from the body
   * before columns are found. Default 0.9.
   */
  bandGapFactor?: number;
  /**
   * Empty x-gutter width (× a band's median glyph height) above which the band
   * is cut into separate columns. Default 0.9.
   */
  gutterMinFactor?: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Decide whether a component is plausibly a glyph (part of a text line) given
 * the median glyph metrics of the page. Filters out figures, rules and speckle.
 */
function isTextComponent(
  c: Component,
  medH: number,
  medW: number,
  medArea: number,
  imgW: number,
  imgH: number,
  opt: Required<Omit<LineDetectOptions, "connectivity">>
): boolean {
  const w = compWidth(c);
  const h = compHeight(c);

  // Speckle: a single isolated pixel is noise. (Thin marks like '.' or the
  // dot of an 'i' survive because real glyphs cluster into lines later, but a
  // lone 1px blob carries no line evidence.)
  if (c.area <= 1) return false;

  // --- Intrinsic shape rejections (independent of page statistics, so they
  //     still fire when the page is ALL non-text and the median is useless). ---

  // Horizontal rule: long-and-thin. Rejected by its own aspect ratio AND by
  // being far wider than a typical glyph. No Latin glyph is this elongated.
  const aspect = w / Math.max(1, h);
  if (h <= opt.ruleMaxHeight && w >= 8 && aspect >= opt.ruleAspect) {
    return false;
  }
  if (h <= opt.ruleMaxHeight && w >= medW * opt.ruleWidthFactor && w >= 8) {
    return false;
  }
  // Vertical rule: tall-and-thin.
  const invAspect = h / Math.max(1, w);
  if (w <= opt.ruleMaxHeight && h >= 8 && invAspect >= opt.ruleAspect) {
    return false;
  }
  if (w <= opt.ruleMaxHeight && h >= medH * opt.ruleWidthFactor && h >= 8) {
    return false;
  }

  // Solid filled block (filled rectangle figure / swatch / photo): a densely
  // filled bbox that is large in absolute terms (a meaningful fraction of the
  // page, or far bigger than a glyph). Real glyphs leave plenty of background
  // inside their bbox.
  const filled = compFill(c) >= opt.figureFill;
  const absLarge = w >= imgW * 0.2 && h >= imgH * 0.15;
  if (filled && (absLarge || c.area >= medArea * 8)) return false;

  // Absolute figure cutoff: a single blob taller than a third of the page is a
  // figure/photo, not a glyph. We deliberately do NOT reject by a multiple of
  // the GLOBAL median height here — pages mix font sizes, so a headline cap is
  // many× the body median yet still text.
  if (h > imgH * opt.figureMaxHeightFrac) return false;

  return true;
}

interface LineAcc {
  y0: number;
  y1: number;
  baseline: number; // running mean of member bottom edges
  comps: Component[];
}

/**
 * Group components into lines by BASELINE (shared bottom edge). Baseline is
 * robust where center/overlap are not: ascenders and big initial letters sit ON
 * the baseline (so they join their line), descenders dip only slightly below it
 * (still join), but the next line's baseline is a full line-pitch away (so it
 * never merges). Each component joins the NEAREST line baseline within a
 * size-aware tolerance.
 */
function baselineGroup(comps: Component[], medH: number): LineAcc[] {
  const byBaseline = [...comps].sort((a, b) => a.y1 - b.y1 || a.y0 - b.y0);
  const lines: LineAcc[] = [];
  const globalTol = Math.max(1, medH * 0.6);
  for (const c of byBaseline) {
    let best: LineAcc | null = null;
    let bestDist = Infinity;
    for (const ln of lines) {
      const lnH = ln.y1 - ln.y0 + 1;
      const tol = Math.max(globalTol, lnH * 0.4);
      const d = Math.abs(c.y1 - ln.baseline);
      if (d <= tol && d < bestDist) {
        best = ln;
        bestDist = d;
      }
    }
    if (best) {
      best.y0 = Math.min(best.y0, c.y0);
      best.y1 = Math.max(best.y1, c.y1);
      best.baseline = best.baseline + (c.y1 - best.baseline) / (best.comps.length + 1);
      best.comps.push(c);
    } else {
      lines.push({ y0: c.y0, y1: c.y1, baseline: c.y1, comps: [c] });
    }
  }

  // Merge tiny floating fragments (quotes, apostrophes) into their real line
  const merged: LineAcc[] = [];
  for (const ln of lines) {
    const isFragment = ln.y1 - ln.y0 + 1 < medH * 0.5 && ln.comps.length < 5;
    if (isFragment) {
      let bestTgt: LineAcc | null = null;
      let minDy = Infinity;
      for (const tgt of lines) {
        if (tgt === ln) continue;
        if (tgt.y1 - tgt.y0 + 1 < medH * 0.5) continue; // skip other fragments
        
        // Must overlap horizontally to be considered!
        const lnX0 = Math.min(...ln.comps.map(c => c.x0));
        const lnX1 = Math.max(...ln.comps.map(c => c.x1));
        const tgtX0 = Math.min(...tgt.comps.map(c => c.x0));
        const tgtX1 = Math.max(...tgt.comps.map(c => c.x1));
        if (lnX1 < tgtX0 - medH * 2 || lnX0 > tgtX1 + medH * 2) continue;

        // Must be vertically above or within the line's span
        if (ln.y1 <= tgt.y1 + medH * 0.2 && ln.y0 >= tgt.y0 - medH * 0.6) {
          const dy = Math.abs((ln.y0 + ln.y1)/2 - (tgt.y0 + tgt.y1)/2);
          if (dy < minDy) {
            minDy = dy;
            bestTgt = tgt;
          }
        }
      }
      if (bestTgt) {
        bestTgt.y0 = Math.min(bestTgt.y0, ln.y0);
        bestTgt.y1 = Math.max(bestTgt.y1, ln.y1);
        bestTgt.comps.push(...ln.comps);
        continue;
      }
    }
    merged.push(ln);
  }

  return merged;
}

/**
 * Horizontal bands: cluster components on the Y axis, splitting wherever the
 * vertical whitespace gap between consecutive (merged) y-intervals exceeds
 * `bandGap`. This separates a full-width headline / caption band from the body
 * block FIRST, so a headline never bridges the column gutter below it.
 */
function horizontalBands(comps: Component[], bandGap: number): Component[][] {
  const sorted = [...comps].sort((a, b) => a.y0 - b.y0);
  const bands: Component[][] = [];
  let cur: Component[] = [];
  let curMaxY1 = -Infinity;
  for (const c of sorted) {
    if (cur.length > 0 && c.y0 - curMaxY1 - 1 > bandGap) {
      bands.push(cur);
      cur = [];
    }
    cur.push(c);
    curMaxY1 = Math.max(curMaxY1, c.y1);
  }
  if (cur.length) bands.push(cur);
  return bands;
}

/**
 * Vertical columns within a band: find low-ink x-gutters wider than `gutterMin`
 * and split the band's components into columns at them.
 *
 * Robustness on real scans:
 *  - Occupancy is computed only from GLYPH-sized components, so scan speckle in
 *    the gutter does not fill it.
 *  - A gutter is a run where occupancy stays at/below a small threshold (not
 *    strictly zero), so a printed vertical rule down the gutter is tolerated.
 *  - Because we work inside one horizontal band, a justified line's wide
 *    inter-word space is NOT a gutter (other lines fill that x), so lines never
 *    fragment — only true column gutters split.
 */
function verticalColumns(
  comps: Component[],
  gutterMin: number,
  medH: number
): Component[][] {
  if (comps.length <= 1) return [comps];
  let minX = Infinity;
  let maxX = -Infinity;
  for (const c of comps) {
    if (c.x0 < minX) minX = c.x0;
    if (c.x1 > maxX) maxX = c.x1;
  }
  const W = maxX - minX + 1;
  const occ = new Uint32Array(W);
  const minGlyphH = medH * 0.35; // ignore sub-glyph speckle when profiling
  let maxOcc = 0;
  for (const c of comps) {
    if (c.y1 - c.y0 + 1 < minGlyphH) continue;
    for (let x = c.x0; x <= c.x1; x++) {
      const v = ++occ[x - minX];
      if (v > maxOcc) maxOcc = v;
    }
  }
  // A gutter column is far emptier than the column interiors. Tolerate a single
  // spanning rule / a little intrusion.
  const gutterThresh = Math.max(1, Math.floor(maxOcc * 0.15));

  const cols: Array<[number, number]> = [];
  let colStart = 0;
  let runStart = -1;
  for (let i = 0; i < W; i++) {
    const empty = occ[i] <= gutterThresh;
    if (empty) {
      if (runStart === -1) runStart = i;
    } else {
      if (runStart !== -1) {
        if (i - runStart >= gutterMin && runStart - 1 >= colStart) {
          cols.push([minX + colStart, minX + runStart - 1]);
          colStart = i;
        }
        runStart = -1;
      }
    }
  }
  cols.push([minX + colStart, maxX]);
  if (cols.length === 1) return [comps];
  const groups: Component[][] = cols.map(() => []);
  for (const c of comps) {
    const cx = (c.x0 + c.x1) / 2;
    let idx = cols.findIndex(([a, b]) => cx >= a && cx <= b);
    if (idx === -1) {
      let minDist = Infinity;
      for (let i = 0; i < cols.length; i++) {
        const [a, b] = cols[i];
        const dist = cx < a ? a - cx : cx - b;
        if (dist < minDist) {
          minDist = dist;
          idx = i;
        }
      }
    }
    groups[idx].push(c);
  }
  return groups.filter((g) => g.length > 0);
}

/**
 * Detect lines of text in a binary image using connected-component analysis,
 * top-down (RXY-cut family):
 *   1. label connected ink blobs, compute median glyph metrics,
 *   2. drop non-text blobs (figures, rules, speckle),
 *   3. cut into horizontal BANDS (isolating headlines/captions from the body),
 *   4. within each band cut into COLUMNS at true empty gutters,
 *   5. within each column group blobs into lines by BASELINE,
 *   6. keep only runs made of glyph-sized pieces.
 */
export function detectTextLines(
  img: BinImage,
  opts: LineDetectOptions = {}
): DetectedLine[] {
  const opt: Required<Omit<LineDetectOptions, "connectivity">> = {
    maxHeightFactor: opts.maxHeightFactor ?? 3.5,
    ruleWidthFactor: opts.ruleWidthFactor ?? 6,
    ruleAspect: opts.ruleAspect ?? 12,
    ruleMaxHeight: opts.ruleMaxHeight ?? 3,
    figureFill: opts.figureFill ?? 0.9,
    overlapTolerance: opts.overlapTolerance ?? 0.4,
    joinOverlapFrac: opts.joinOverlapFrac ?? 0.5,
    figureMaxHeightFrac: opts.figureMaxHeightFrac ?? 0.33,
    columnGapFactor: opts.columnGapFactor ?? 1.0,
    minColumnGapPx: opts.minColumnGapPx ?? 10,
    bandGapFactor: opts.bandGapFactor ?? 0.9,
    gutterMinFactor: opts.gutterMinFactor ?? 1.5,
  };

  const comps = connectedComponents(img, { connectivity: opts.connectivity });
  if (comps.length === 0) return [];

  // Median glyph metrics. Use ALL components for a robust estimate; outliers
  // (figures) barely move the median.
  const medH = median(comps.map(compHeight));
  const medW = median(comps.map(compWidth));
  const medArea = median(comps.map((c) => c.area));

  const text = comps.filter((c) =>
    isTextComponent(c, medH, medW, medArea, img.width, img.height, opt)
  );
  if (text.length === 0) return [];

  // Decide whether a run of components is a real text line. A horizontal row of
  // 3+ baseline-aligned blobs is text at ANY size (so large headlines are kept
  // without comparing to the body's median). Lone or paired blobs are only text
  // if they are glyph-sized — this drops stray rectangles, figure frames and
  // other non-text blobs that survived component filtering.
  const isTextLine = (comps: Component[]): boolean => {
    // Reject rows made of sub-glyph blobs (scan speckle): a real line's typical
    // component is a meaningful fraction of the page's glyph height.
    const lineMedH = median(comps.map(compHeight));
    if (lineMedH < medH * 0.35) return false;
    if (comps.length >= 3) return true;
    return comps.every(
      (c) =>
        compHeight(c) <= medH * 2.5 &&
        compWidth(c) <= Math.max(medW * 8, medH * 4)
    );
  };

  const bbox = (words: DetectedWord[]): DetectedLine => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const w of words) {
      if (w.x0 < x0) x0 = w.x0;
      if (w.y0 < y0) y0 = w.y0;
      if (w.x1 > x1) x1 = w.x1;
      if (w.y1 > y1) y1 = w.y1;
    }
    return { x0, y0, x1, y1, words };
  };

  // Top-down: band (Y) → column (X) → line (baseline).
  const bandGap = Math.max(1, medH * opt.bandGapFactor);
  const out: DetectedLine[] = [];
  for (const band of horizontalBands(text, bandGap)) {
    // Gutter width threshold scales with THIS band's text size, so a headline's
    // own word-spaces never read as a gutter while a body gutter still does.
    const bandMedH = median(band.map(compHeight));
    const gutterMin = Math.max(opt.minColumnGapPx, bandMedH * opt.gutterMinFactor);
    // Only split into columns when the band is tall enough to hold multiple
    // stacked lines. A single-line band (headline/caption/page-number row) has
    // an empty strip at every word space, which must NOT be read as a gutter.
    let bandY0 = Infinity;
    let bandY1 = -Infinity;
    for (const c of band) {
      if (c.y0 < bandY0) bandY0 = c.y0;
      if (c.y1 > bandY1) bandY1 = c.y1;
    }
    const multiLine = bandY1 - bandY0 + 1 > bandMedH * 1.8;
    const columns = multiLine ? verticalColumns(band, gutterMin, medH) : [band];
    for (const col of columns) {
      const colLines: DetectedLine[] = [];
      for (const ln of baselineGroup(col, medH)) {
        if (isTextLine(ln.comps)) {
          const words = segmentWords(ln.comps, medW, medH);
          colLines.push(bbox(words));
        }
      }
      // Sort lines WITHIN the column by reading order
      colLines.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
      out.push(...colLines);
    }
  }


  return out;
}

export function segmentWords(lineComps: Component[], globalMedW: number, globalMedH: number): DetectedWord[] {
  const sorted = [...lineComps].sort((a, b) => a.x0 - b.x0);
  if (sorted.length === 0) return [];

  const lineMedH = median(sorted.map(compHeight));
  const lineMedW = sorted.length > 5 ? median(sorted.map(compWidth)) : globalMedW * (lineMedH / (globalMedH || 1));
  const isPunctuation = (c: Component) => compHeight(c) < lineMedH * 0.5;

  const validCompsForStats = sorted.filter((c) => !isPunctuation(c));
  const gaps: number[] = [];
  let statLastX1 = -Infinity;
  for (const curr of validCompsForStats) {
    if (statLastX1 !== -Infinity) {
      gaps.push(Math.max(0, curr.x0 - statLastX1 - 1));
    }
    statLastX1 = Math.max(statLastX1, curr.x1);
  }

  const kernGaps = gaps.filter((g) => g < lineMedW * 0.3);
  const spaceGaps = gaps.filter((g) => g >= lineMedW * 0.3);

  const kern_size = kernGaps.length > 0 ? median(kernGaps) : 0;
  const space_size = spaceGaps.length > 0 ? median(spaceGaps) : Math.max(lineMedW * 0.5, kern_size + lineMedW * 0.3);

  const threshold = (kern_size + space_size) / 2;

  const words: DetectedWord[] = [];
  let currentWordComps: Component[] = [];
  let lastX1 = -Infinity;
  let lastW = 0;

  const makeWord = (comps: Component[]): DetectedWord => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of comps) {
      if (c.x0 < x0) x0 = c.x0;
      if (c.y0 < y0) y0 = c.y0;
      if (c.x1 > x1) x1 = c.x1;
      if (c.y1 > y1) y1 = c.y1;
    }
    return { x0, y0, x1, y1, comps };
  };

  for (const curr of sorted) {
    if (currentWordComps.length === 0) {
      currentWordComps.push(curr);
      lastX1 = curr.x1;
      lastW = compWidth(curr);
      continue;
    }

    const gap = Math.max(0, curr.x0 - lastX1 - 1);
    let isBreak = gap >= threshold;

    const fuzzyZone = lineMedW * 0.15;
    if (Math.abs(gap - threshold) <= fuzzyZone) {
      const currW = compWidth(curr);
      const isNarrow = lastW < lineMedW * 0.5 || currW < lineMedW * 0.5;
      const isWide = lastW > lineMedW * 1.5 || currW > lineMedW * 1.5;

      if (isNarrow) {
        isBreak = false;
      } else if (isWide) {
        isBreak = true;
      }
    }

    if (isBreak) {
      words.push(makeWord(currentWordComps));
      currentWordComps = [curr];
      lastX1 = curr.x1;
      lastW = compWidth(curr);
    } else {
      currentWordComps.push(curr);
      lastX1 = Math.max(lastX1, curr.x1);
      lastW = compWidth(curr);
    }
  }

  if (currentWordComps.length > 0) {
    words.push(makeWord(currentWordComps));
  }

  return words;
}

export { median };
