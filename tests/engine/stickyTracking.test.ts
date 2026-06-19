import { describe, it, expect } from "vitest";
import { StrokeBuilder } from "../../src/engine/strokeBuilder";
import { makeLineBox, type TextMap, type SnappedSegment } from "../../src/engine/types";

const twoLines: TextMap = [
  makeLineBox({ id: 0, x: 0, y: 0, w: 200, h: 20, words: [] }), // cy=10
  makeLineBox({ id: 1, x: 0, y: 40, w: 200, h: 20, words: [] }), // cy=50
];

describe("StrokeBuilder sticky confidence", () => {
  it("hard-locks to a line once the band grows past stickDistance, ignoring later vertical wander", () => {
    const b = new StrokeBuilder(twoLines, "#ff0", 0.4, {
      maxDist: 40,
      hysteresis: 8,
      stickDistance: 20,
    });
    b.down({ x: 10, y: 10 });
    b.move({ x: 40, y: 10 }); // band now 30px wide on line 0 -> confident, hard lock
    b.move({ x: 80, y: 50 }); // cursor wanders down to line 1's center, but we stay on 0
    const stroke = b.finish();
    expect(stroke.segments.length).toBe(1);
    const seg = stroke.segments[0] as SnappedSegment;
    expect(seg.lineId).toBe(0);
    expect(seg.x1).toBe(80); // kept extending line 0
  });

  it("dumb mode (tracking:false) never snaps; emits a freeform band at the given thickness", () => {
    const b = new StrokeBuilder(twoLines, "#ff0", 0.4, {
      tracking: false,
      defaultThickness: 22,
    });
    b.down({ x: 10, y: 10 });
    b.move({ x: 60, y: 12 });
    const stroke = b.finish();
    expect(stroke.segments[0].kind).toBe("freeform");
    expect(stroke.segments[0]).toMatchObject({ thickness: 22 });
  });

  it("clamps a snapped band to the line's text extent", () => {
    const b = new StrokeBuilder(twoLines, "#ff0", 0.4, { maxDist: 40, stickDistance: 1000 });
    b.down({ x: -50, y: 10 }); // left of text
    b.move({ x: 999, y: 10 }); // right of text
    const seg = b.finish().segments[0] as SnappedSegment;
    expect(seg.x0).toBe(0);
    expect(seg.x1).toBe(200);
  });
});
