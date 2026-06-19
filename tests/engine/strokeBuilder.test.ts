import { describe, it, expect } from "vitest";
import { StrokeBuilder } from "../../src/engine/strokeBuilder";
import { makeLineBox, type TextMap, type SnappedSegment, type FreeformSegment } from "../../src/engine/types";

const map: TextMap = [makeLineBox({ id: 0, x: 0, y: 0, w: 100, h: 20, words: [] })];

describe("StrokeBuilder", () => {
  it("builds one snapped segment whose x-range grows along the line", () => {
    const b = new StrokeBuilder(map, "#ffe14d", 0.4, { maxDist: 30, defaultThickness: 12 });
    b.down({ x: 10, y: 11 });
    b.move({ x: 60, y: 11 });
    const stroke = b.finish();
    expect(stroke.segments.length).toBe(1);
    const seg = stroke.segments[0] as SnappedSegment;
    expect(seg.kind).toBe("snapped");
    expect(seg.lineId).toBe(0);
    expect(seg.x0).toBe(10);
    expect(seg.x1).toBe(60);
    expect(seg.thickness).toBe(20);
  });

  it("falls back to a freeform segment far from any line", () => {
    const b = new StrokeBuilder(map, "#ffe14d", 0.4, { maxDist: 10, defaultThickness: 12 });
    b.down({ x: 10, y: 300 });
    b.move({ x: 40, y: 305 });
    const stroke = b.finish();
    const seg = stroke.segments[0] as FreeformSegment;
    expect(seg.kind).toBe("freeform");
    expect(seg.points.length).toBe(2);
    expect(seg.thickness).toBe(12);
  });
});
