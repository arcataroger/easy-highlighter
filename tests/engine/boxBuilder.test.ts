import { describe, it, expect } from "vitest";
import {
  BoxBuilder,
  ParagraphBuilder,
  rectFromPoints,
} from "../../src/engine/boxBuilder";
import { makeLineBox, type TextMap, type RectSegment } from "../../src/engine/types";

const threeLines: TextMap = [
  makeLineBox({
    id: 0, x: 10, y: 0, w: 180, h: 20, words: [
      { x: 10, y: 0, w: 50, h: 20 },
      { x: 70, y: 0, w: 50, h: 20 },
    ]
  }),
  makeLineBox({
    id: 1, x: 10, y: 40, w: 180, h: 20, words: [
      { x: 10, y: 40, w: 50, h: 20 },
      { x: 70, y: 40, w: 50, h: 20 },
      { x: 130, y: 40, w: 50, h: 20 },
    ]
  }),
  makeLineBox({
    id: 2, x: 10, y: 80, w: 180, h: 20, words: [
      { x: 10, y: 80, w: 50, h: 20 },
    ]
  }),
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

describe("ParagraphBuilder (smart paragraph text selection)", () => {
  it("selects all words from start word to current word in reading order", () => {
    const b = new ParagraphBuilder(threeLines, "#ff0", 0.4);
    // start at line 0, second word (x=80, y=10)
    b.down({ x: 80, y: 10 });
    // move to line 1, second word (x=80, y=50)
    b.move({ x: 80, y: 50 });
    const stroke = b.finish();
    
    // Should select:
    // line 0: word 2 (x=70, w=50) -> x0=70, x1=120
    // line 1: word 1 (x=10, w=50), word 2 (x=70, w=50) -> x0=10, x1=120
    expect(stroke.segments).toHaveLength(2);
    expect(stroke.segments[0]).toMatchObject({ lineId: 0, x0: 70, x1: 120 });
    expect(stroke.segments[1]).toMatchObject({ lineId: 1, x0: 10, x1: 120 });
  });

  it("works in reverse direction", () => {
    const b = new ParagraphBuilder(threeLines, "#ff0", 0.4);
    // start at line 2
    b.down({ x: 20, y: 90 });
    // move back up to line 1, second word
    b.move({ x: 80, y: 50 });
    const stroke = b.finish();

    // Should select line 1 (word 2 and 3) and line 2 (word 1)
    expect(stroke.segments).toHaveLength(2);
    expect(stroke.segments[0]).toMatchObject({ lineId: 1, x0: 70, x1: 180 });
    expect(stroke.segments[1]).toMatchObject({ lineId: 2, x0: 10, x1: 60 });
  });
});
