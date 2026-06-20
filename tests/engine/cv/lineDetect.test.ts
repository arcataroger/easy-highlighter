import { describe, it, expect } from "vitest";
import { detectTextLines } from "../../../src/engine/cv/lineDetect";
import { buildTextMap } from "../../../src/engine/cv/textmap";
import type { BinImage } from "../../../src/engine/cv/binarize";

function blank(width: number, height: number): BinImage {
  return { width, height, ink: new Uint8Array(width * height) };
}
function set(img: BinImage, x: number, y: number) {
  if (x >= 0 && y >= 0 && x < img.width && y < img.height)
    img.ink[y * img.width + x] = 1;
}
function fillRect(img: BinImage, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(img, x, y);
}

/** Draw a hollow rectangle of arbitrary size (reads as a glyph, not a blob). */
function tallBox(img: BinImage, x: number, y: number, w: number, h: number) {
  for (let dx = 0; dx < w; dx++) {
    set(img, x + dx, y);
    set(img, x + dx, y + h - 1);
  }
  for (let dy = 0; dy < h; dy++) {
    set(img, x, y + dy);
    set(img, x + w - 1, y + dy);
  }
}

/** Draw a glyph-like 5x7 ring (hollow box) so it reads as a letter, not a blob. */
function glyph(img: BinImage, x: number, y: number) {
  const w = 5;
  const h = 7;
  for (let dx = 0; dx < w; dx++) {
    set(img, x + dx, y);
    set(img, x + dx, y + h - 1);
  }
  for (let dy = 0; dy < h; dy++) {
    set(img, x, y + dy);
    set(img, x + w - 1, y + dy);
  }
}

/**
 * Draw a "word" of `n` glyphs starting at (x,y); 2px between glyphs.
 * Returns the x just past the word.
 */
function word(img: BinImage, x: number, y: number, n: number): number {
  let cx = x;
  for (let i = 0; i < n; i++) {
    glyph(img, cx, y);
    cx += 5 + 2;
  }
  return cx;
}

/**
 * A 200x120 page:
 *  - line A at y=10: "word word" (two clusters of 3 glyphs, big space between)
 *  - line B at y=30: one cluster of 4 glyphs
 *  - a big solid filled FIGURE rectangle around y=55..95
 *  - a thin 1px horizontal RULE at y=110 spanning the page
 */
function pageWithFigureAndRule(): BinImage {
  const img = blank(200, 120);

  // Line A: two words separated by an inter-word space (smaller than a column
  // gutter, so they stay one line but segment into two words).
  let x = word(img, 5, 10, 3); // first word, 3 glyphs
  x += 4; // inter-word gap
  word(img, x, 10, 3); // second word, 3 glyphs

  // Line B: a single word of 4 glyphs.
  word(img, 5, 30, 4);

  // Big solid figure (filled rectangle) — clearly not text.
  fillRect(img, 20, 55, 160, 95);

  // Thin horizontal rule across most of the page.
  fillRect(img, 5, 110, 195, 110);

  return img;
}

describe("detectTextLines (CC-based)", () => {
  it("returns the two text lines and rejects the figure and the rule", () => {
    const lines = detectTextLines(pageWithFigureAndRule());
    expect(lines.length).toBe(2);

    // Both lines live in the top third of the page (text rows), never the
    // figure band (y 55..95) or the rule (y 110).
    for (const ln of lines) {
      expect(ln.y0).toBeLessThan(45);
      expect(ln.y1).toBeLessThan(45);
    }
    // Top line first.
    expect(lines[0].y0).toBeLessThan(lines[1].y0);
  });

  it("groups spaced word-clusters into a single line", () => {
    const map = buildTextMap(pageWithFigureAndRule());
    expect(map.length).toBe(2);

    // Line 0 (top) had two visually-separated words.
    const top = map[0];
    expect(top.words.length).toBe(2);

    // Line 1 is a single word.
    const bottom = map[1];
    expect(bottom.words.length).toBe(1);

    // Sequential, top-to-bottom ids.
    expect(map.map((l) => l.id)).toEqual([0, 1]);
    expect(map[0].y).toBeLessThan(map[1].y);
  });

  it("each line box has the required populated fields", () => {
    const map = buildTextMap(pageWithFigureAndRule());
    for (const l of map) {
      for (const k of ["id", "x", "y", "w", "h", "baseline", "cy", "words"]) {
        expect(l).toHaveProperty(k);
      }
      expect(l.words.length).toBeGreaterThan(0);
      expect(l.cy).toBeCloseTo(l.y + l.h / 2);
      expect(l.baseline).toBe(l.y + l.h);
    }
  });

  it("does not return the figure even when no text is present", () => {
    const img = blank(200, 120);
    fillRect(img, 20, 20, 160, 100); // lone figure
    fillRect(img, 5, 110, 195, 110); // lone rule
    const lines = detectTextLines(img);
    expect(lines.length).toBe(0);
  });

  it("rejects a vertical rule (table/figure border)", () => {
    const img = blank(60, 60);
    word(img, 5, 5, 3); // a real text line
    fillRect(img, 40, 0, 40, 59); // tall thin vertical rule
    const lines = detectTextLines(img);
    expect(lines.length).toBe(1);
    // The vertical rule (x=40, full height) must not be part of the line box.
    expect(lines[0].y1 - lines[0].y0 + 1).toBeLessThan(20);
  });

  it("attaches an over-sized initial letter to its text line", () => {
    const img = blank(90, 120);
    // A tall initial letter (h=23, ~3x body) sharing the baseline at y1=26.
    // Its vertical center is far from the body line's center, so the old
    // center-distance grouping split it into its own line.
    tallBox(img, 5, 4, 5, 23);
    // Body text on the same baseline (glyph h=7 → y 20..26).
    word(img, 14, 20, 3);
    const lines = detectTextLines(img);
    expect(lines.length).toBe(1);
    expect(lines[0].x0).toBeLessThanOrEqual(5); // the big initial is included
    expect(lines[0].comps.length).toBe(4); // initial + 3 body glyphs
  });

  it("splits one row into separate lines at a column-sized gap", () => {
    const img = blank(220, 40);
    word(img, 5, 12, 3); // left column word
    word(img, 140, 12, 3); // right column word, wide gutter between
    const lines = detectTextLines(img);
    expect(lines.length).toBe(2);
    expect(lines[0].x1).toBeLessThan(lines[1].x0); // a real gap between them
  });

  it("drops single-pixel speckle noise", () => {
    const img = blank(60, 40);
    word(img, 5, 5, 3);
    set(img, 50, 30); // lone speckle
    set(img, 55, 35); // lone speckle
    const lines = detectTextLines(img);
    expect(lines.length).toBe(1);
  });
});
