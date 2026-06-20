// Synthetic document generator for testing the line detector.
//
// It renders believable newspaper/magazine STRUCTURE (headline band, multi-
// column justified body, caption) into a BinImage, across script families that
// stress the detector differently:
//   - "latin": words are clusters of separate letter blobs with ascenders /
//     descenders and variable (justified) inter-word spacing.
//   - "cjk": uniform square glyphs, one component each, no word spaces.
//   - "connected": each word is a single elongated component (Arabic-like).
//
// Every drawn line is recorded as ground truth so tests can assert the detector
// reproduces the same line partition (right count, right column, no merges, no
// fragmentation).
import type { BinImage } from "../../../src/engine/cv/binarize";

export type Script = "latin" | "cjk" | "connected";

export interface GTLine {
  band: "headline" | "body" | "caption";
  col: number; // 0-based column index within the body (0 for non-body)
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface GenDoc {
  img: BinImage;
  gt: GTLine[];
  cols: Array<{ x0: number; x1: number }>; // body column x-extents
}

function makeRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function blank(w: number, h: number): BinImage {
  return { width: w, height: h, ink: new Uint8Array(w * h) };
}

function fill(img: BinImage, x0: number, y0: number, x1: number, y1: number) {
  const yA = Math.max(0, y0);
  const yB = Math.min(img.height - 1, y1);
  const xA = Math.max(0, x0);
  const xB = Math.min(img.width - 1, x1);
  for (let y = yA; y <= yB; y++) {
    const base = y * img.width;
    for (let x = xA; x <= xB; x++) img.ink[base + x] = 1;
  }
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Draw a hollow rectangle outline (low fill, like a real glyph — not a solid blob). */
function outline(img: BinImage, x0: number, y0: number, x1: number, y1: number) {
  fill(img, x0, y0, x1, y0); // top
  fill(img, x0, y1, x1, y1); // bottom
  fill(img, x0, y0, x0, y1); // left
  fill(img, x1, y0, x1, y1); // right
}

/**
 * Draw one line of text from `left`, baseline at `base`, not exceeding `right`.
 * Returns the inked bounding box. Letters/words are separate components.
 */
function drawLine(
  img: BinImage,
  left: number,
  right: number,
  base: number,
  size: number,
  script: Script,
  rnd: () => number
): Box {
  let x = left;
  let minY = base;
  let maxY = base;
  let firstX = -1;
  let lastX = left;

  // Mark a glyph's extent (used to track the line bbox) and draw it low-fill.
  const glyph = (x0: number, y0: number, x1: number, y1: number) => {
    outline(img, x0, y0, x1, y1);
    if (firstX < 0) firstX = x0;
    lastX = Math.max(lastX, x1);
    minY = Math.min(minY, y0);
    maxY = Math.max(maxY, y1);
  };

  if (script === "cjk") {
    const cw = size;
    const gap = Math.max(2, Math.round(size * 0.22));
    while (x + cw <= right) {
      glyph(x, base - size + 1, x + cw - 1, base);
      x += cw + gap;
    }
    return { x0: firstX, y0: minY, x1: lastX, y1: maxY };
  }

  if (script === "connected") {
    // Each word is one connected, LOW-FILL component: a baseline stroke plus a
    // few vertical ticks (ascenders/descenders) — like joined script.
    while (x < right - size * 2) {
      const wlen = Math.min(Math.round(size * (2 + rnd() * 4)), right - x);
      const bandH = Math.max(2, Math.round(size * 0.3));
      fill(img, x, base - bandH + 1, x + wlen, base); // connecting stroke
      let top = base - bandH + 1;
      let bot = base;
      const ticks = 2 + Math.floor(rnd() * 4);
      for (let t = 0; t < ticks; t++) {
        const tx = x + Math.round(rnd() * wlen);
        const up = rnd() < 0.6;
        const ty0 = up ? base - size + 1 : base - bandH + 1;
        const ty1 = up ? base : base + Math.round(size * 0.3);
        fill(img, tx, ty0, tx + 1, ty1);
        top = Math.min(top, ty0);
        bot = Math.max(bot, ty1);
      }
      if (firstX < 0) firstX = x;
      lastX = Math.max(lastX, x + wlen);
      minY = Math.min(minY, top);
      maxY = Math.max(maxY, bot);
      x += wlen + Math.round(size * (0.7 + rnd() * 0.8));
    }
    return { x0: firstX, y0: minY, x1: lastX, y1: maxY };
  }

  // latin
  while (x < right - size) {
    const nLetters = 2 + Math.floor(rnd() * 6);
    for (let i = 0; i < nLetters; i++) {
      const lw = Math.max(3, Math.round(size * 0.6));
      let top = base - size + 1;
      let bot = base;
      const r = rnd();
      if (r < 0.25) top = base - Math.round(size * 1.3) + 1; // cap / ascender
      else if (r < 0.4) bot = base + Math.round(size * 0.3); // descender
      glyph(x, top, x + lw - 1, bot);
      x += lw + 2; // intra-word gap
      if (x >= right - size) break;
    }
    x += Math.round(size * (0.4 + rnd() * 1.0)); // variable (justified) word space
  }
  return { x0: firstX < 0 ? left : firstX, y0: minY, x1: lastX, y1: maxY };
}

export interface DocOptions {
  script?: Script;
  seed?: number;
  width?: number;
  bodyLines?: number;
  withHeadline?: boolean;
  withCaption?: boolean;
}

/** A two-column article with an optional full-width headline and a caption. */
export function article(opts: DocOptions = {}): GenDoc {
  const script = opts.script ?? "latin";
  const rnd = makeRng(opts.seed ?? 1);
  const W = opts.width ?? 1000;
  const H = 1200;
  const bodyLines = opts.bodyLines ?? 16;
  const margin = 60;
  const img = blank(W, H);
  const gt: GTLine[] = [];

  let y = 60;

  if (opts.withHeadline ?? true) {
    const hsize = 40;
    const hbase = y + hsize;
    const hb = drawLine(img, margin, W - margin, hbase, hsize, script, rnd);
    gt.push({ band: "headline", col: 0, ...hb });
    y = hbase + Math.round(hsize * 0.8);
  }

  // body: two columns
  const size = script === "cjk" ? 16 : 12;
  const pitch = Math.round(size * (script === "cjk" ? 1.6 : 2.0));
  const gutter = Math.max(34, Math.round(size * 2.6));
  const colW = Math.floor((W - margin * 2 - gutter) / 2);
  const cols = [
    { x0: margin, x1: margin + colW },
    { x0: margin + colW + gutter, x1: margin + colW + gutter + colW },
  ];
  const bodyTop = y + size + 20;
  for (let c = 0; c < 2; c++) {
    let base = bodyTop;
    for (let li = 0; li < bodyLines; li++) {
      const lb = drawLine(img, cols[c].x0, cols[c].x1, base, size, script, rnd);
      gt.push({ band: "body", col: c, ...lb });
      base += pitch;
    }
  }

  if (opts.withCaption ?? true) {
    const capBase = bodyTop + bodyLines * pitch + 40;
    const cb = drawLine(img, margin, margin + colW, capBase, 9, "latin", rnd);
    gt.push({ band: "caption", col: 0, ...cb });
  }

  return { img, gt, cols };
}
