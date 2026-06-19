import { describe, it, expect } from "vitest";
import {
  BoxBuilder,
  ParagraphBuilder,
  linesInRect,
  rectFromPoints,
} from "../../src/engine/boxBuilder";
import { makeLineBox, type TextMap, type RectSegment } from "../../src/engine/types";

const threeLines: TextMap = [
  makeLineBox({ id: 0, x: 10, y: 0, w: 180, h: 20, words: [] }), // cy=10
  makeLineBox({ id: 1, x: 10, y: 40, w: 180, h: 20, words: [] }), // cy=50
  makeLineBox({ id: 2, x: 10, y: 80, w: 180, h: 20, words: [] }), // cy=90
];

describe("rectFromPoints", () => {
  it("normalizes regardless of drag direction", () => {
    expect(rectFromPoints({ x: 90, y: 70 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      w: 80,
      h: 50,
    });
  });
});

describe("BoxBuilder (dumb box)", () => {
  it("emits one rect segment covering the dragged rectangle", () => {
    const b = new BoxBuilder("#ff0", 0.4);
    b.down({ x: 20, y: 20 });
    b.move({ x: 120, y: 70 });
    const seg = b.finish().segments[0] as RectSegment;
    expect(seg).toEqual({ kind: "rect", x: 20, y: 20, w: 100, h: 50 });
  });
});

describe("linesInRect / ParagraphBuilder (smart paragraph)", () => {
  it("selects only the lines whose center is inside the box", () => {
    // box spans y 30..70 -> only line 1 (cy=50)
    const segs = linesInRect(threeLines, { x: 0, y: 30, w: 200, h: 40 });
    expect(segs.map((s) => s.lineId)).toEqual([1]);
  });

  it("clamps each selected line to the intersection of its extent and the box", () => {
    // box spans x 50..150, covering lines 0 and 1 vertically (y 0..60)
    const segs = linesInRect(threeLines, { x: 50, y: 0, w: 100, h: 60 });
    expect(segs.map((s) => s.lineId)).toEqual([0, 1]);
    expect(segs[0]).toMatchObject({ x0: 50, x1: 150 });
  });

  it("ParagraphBuilder highlights every covered line as the box grows", () => {
    const b = new ParagraphBuilder(threeLines, "#ff0", 0.4);
    b.down({ x: 0, y: 5 });
    b.move({ x: 200, y: 95 }); // covers all three line centers
    const stroke = b.finish();
    expect(stroke.segments.map((s) => (s.kind === "snapped" ? s.lineId : -1))).toEqual([
      0, 1, 2,
    ]);
  });
});
