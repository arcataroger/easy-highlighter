import type { BinImage } from "./binarize";
import {
  connectedComponents,
  compWidth,
  compHeight,
  compFill,
  type Component,
} from "./connectedComponents";

export interface DetectedLine {
  /** inclusive bounds of the whole line */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** the text components that make up this line, left-to-right */
  comps: Component[];
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

  // --- Median-relative rejection (catches half-tone figures / photos that are
  //     not solidly filled but are far taller than the body text). ---
  if (h > medH * opt.maxHeightFactor) return false;

  return true;
}

/**
 * Detect lines of text in a binary image using connected-component analysis.
 *
 * Pipeline (bottom-up, Docstrum/RXY-cut family):
 *   1. label connected ink blobs,
 *   2. compute the median glyph height/width/area,
 *   3. drop non-text blobs (figures, rules, speckle) by size/shape statistics,
 *   4. group surviving blobs into lines by vertical overlap (nearest-neighbour
 *      on the y axis with a median-height tolerance).
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

  // Group by vertical overlap. Sort by vertical center, then greedily assign
  // each component to an existing line whose vertical span overlaps, else open
  // a new line.
  const tol = Math.max(1, medH * opt.overlapTolerance);
  const byCy = [...text].sort((a, b) => {
    const ca = (a.y0 + a.y1) / 2;
    const cb = (b.y0 + b.y1) / 2;
    return ca - cb;
  });

  interface Acc {
    y0: number;
    y1: number;
    cySum: number;
    cyCount: number;
    comps: Component[];
  }
  const lines: Acc[] = [];
  for (const c of byCy) {
    const cy = (c.y0 + c.y1) / 2;
    const compH = c.y1 - c.y0 + 1;
    let best: Acc | null = null;
    let bestOverlap = -Infinity;
    for (const ln of lines) {
      const lnH = ln.y1 - ln.y0 + 1;
      // Vertical overlap measured against the SHORTER side: a tall initial
      // letter that shares the baseline overlaps the body line's full span, so
      // it joins instead of forming its own line.
      const overlap = Math.min(c.y1, ln.y1) - Math.max(c.y0, ln.y0);
      const minH = Math.max(1, Math.min(compH, lnH));
      const touches = c.y0 <= ln.y1 + tol && c.y1 >= ln.y0 - tol;
      if (touches && overlap >= minH * opt.joinOverlapFrac && overlap > bestOverlap) {
        best = ln;
        bestOverlap = overlap;
      }
    }
    if (best) {
      best.y0 = Math.min(best.y0, c.y0);
      best.y1 = Math.max(best.y1, c.y1);
      best.cySum += cy;
      best.cyCount++;
      best.comps.push(c);
    } else {
      lines.push({
        y0: c.y0,
        y1: c.y1,
        cySum: cy,
        cyCount: 1,
        comps: [c],
      });
    }
  }

  // Build output lines, sorted top-to-bottom, comps within each line L→R.
  const out: DetectedLine[] = lines
    .map((ln) => {
      const comps = [...ln.comps].sort((a, b) => a.x0 - b.x0);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const c of comps) {
        if (c.x0 < x0) x0 = c.x0;
        if (c.y0 < y0) y0 = c.y0;
        if (c.x1 > x1) x1 = c.x1;
        if (c.y1 > y1) y1 = c.y1;
      }
      return { x0, y0, x1, y1, comps };
    })
    .sort((a, b) => a.y0 - b.y0);

  return out;
}

export { median };
