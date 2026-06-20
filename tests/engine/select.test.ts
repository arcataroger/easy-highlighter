import { describe, it, expect } from "vitest";
import {
  lineAt,
  paragraphLines,
  lineStroke,
  paragraphStroke,
} from "../../src/engine/select";
import { makeLineBox, type TextMap } from "../../src/engine/types";

// Two paragraphs: lines 0-1 (tight), a big gap, then lines 2-3 (tight).
const doc: TextMap = [
  makeLineBox({ id: 0, x: 10, y: 0, w: 180, h: 20, words: [] }), // cy 10
  makeLineBox({ id: 1, x: 10, y: 26, w: 180, h: 20, words: [] }), // gap 6
  makeLineBox({ id: 2, x: 10, y: 120, w: 180, h: 20, words: [] }), // gap 74 -> new paragraph
  makeLineBox({ id: 3, x: 10, y: 146, w: 180, h: 20, words: [] }), // gap 6
];

describe("lineAt", () => {
  it("returns the nearest line within maxDist", () => {
    expect(lineAt(doc, { x: 50, y: 30 }, 40)?.id).toBe(1);
  });
  it("returns null when far from any line", () => {
    expect(lineAt(doc, { x: 50, y: 300 }, 20)).toBeNull();
  });
});

describe("paragraphLines", () => {
  it("groups the tight lines and stops at the big gap", () => {
    expect(paragraphLines(doc, 0).map((l) => l.id)).toEqual([0, 1]);
    expect(paragraphLines(doc, 3).map((l) => l.id)).toEqual([2, 3]);
  });

  it("stays within the seed column and ignores lines in other columns", () => {
    const twoCol = [
      makeLineBox({ id: 0, x: 0, y: 0, w: 90, h: 20, words: [] }), // left col
      makeLineBox({ id: 1, x: 200, y: 0, w: 90, h: 20, words: [] }), // right col, same row
      makeLineBox({ id: 2, x: 0, y: 26, w: 90, h: 20, words: [] }), // left col, next line
    ];
    // Seeding from the left column groups only the left-column lines.
    expect(paragraphLines(twoCol, 0).map((l) => l.id)).toEqual([0, 2]);
  });
});

describe("stroke builders", () => {
  it("lineStroke spans the line extent plus a small organic overhang", () => {
    const s = lineStroke(doc[0], "#ff0", 0.4); // x10 w180 h20 → pad = round(20*0.18)=4
    expect(s.segments).toEqual([
      { kind: "snapped", lineId: 0, x0: 6, x1: 194, y: 10, thickness: 20 },
    ]);
  });
  it("paragraphStroke has one segment per line", () => {
    const s = paragraphStroke([doc[2], doc[3]], "#ff0", 0.4);
    expect(s.segments.map((seg) => (seg.kind === "snapped" ? seg.lineId : -1))).toEqual([
      2, 3,
    ]);
  });

  it("paragraphStroke uses one uniform thickness for varied line heights", () => {
    const varied = [
      makeLineBox({ id: 0, x: 0, y: 0, w: 100, h: 30, words: [] }), // big first line
      makeLineBox({ id: 1, x: 0, y: 40, w: 100, h: 20, words: [] }),
      makeLineBox({ id: 2, x: 0, y: 70, w: 100, h: 20, words: [] }),
    ];
    const s = paragraphStroke(varied, "#ff0", 0.4);
    const thicknesses = s.segments.map((seg) =>
      seg.kind === "snapped" ? seg.thickness : -1
    );
    expect(new Set(thicknesses).size).toBe(1); // all identical
    expect(thicknesses[0]).toBe(20); // median of [30,20,20]
  });
});
