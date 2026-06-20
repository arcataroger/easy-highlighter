import { describe, it, expect } from "vitest";
import { snap } from "../../src/engine/snapping";
import { makeLineBox, type TextMap } from "../../src/engine/types";

const map: TextMap = [
  makeLineBox({ id: 0, x: 0, y: 0, w: 100, h: 20, words: [] }), // cy=10
  makeLineBox({ id: 1, x: 0, y: 40, w: 100, h: 20, words: [] }), // cy=50
];

describe("snap", () => {
  it("snaps to the line whose center is nearest within threshold", () => {
    const r = snap(map, { x: 50, y: 12 }, { lockedLineId: null }, { maxDist: 30 });
    expect(r.snapped).toBe(true);
    expect(r.lineId).toBe(0);
    expect(r.y).toBe(10);
    expect(r.thickness).toBe(20);
  });

  it("returns no snap when cursor is too far from any line", () => {
    const r = snap(map, { x: 50, y: 200 }, { lockedLineId: null }, { maxDist: 30 });
    expect(r.snapped).toBe(false);
  });

  it("keeps the locked line under hysteresis even if another is slightly closer", () => {
    // cursor at y=27: line0 cy=10 (dist17), line1 cy=50 (dist23). Locked to line1.
    const r = snap(map, { x: 50, y: 27 }, { lockedLineId: 1 }, { maxDist: 40, hysteresis: 10 });
    expect(r.lineId).toBe(1); // stays locked because 23 - 17 < hysteresis
  });

  it("switches line when another is closer by more than hysteresis", () => {
    const r = snap(map, { x: 50, y: 15 }, { lockedLineId: 1 }, { maxDist: 40, hysteresis: 10 });
    expect(r.lineId).toBe(0);
  });

  it("snaps to the line in the cursor's column, not another column on the same row", () => {
    const cols: TextMap = [
      makeLineBox({ id: 0, x: 0, y: 0, w: 100, h: 20, words: [] }), // left column
      makeLineBox({ id: 1, x: 200, y: 0, w: 100, h: 20, words: [] }), // right column, same row
    ];
    expect(snap(cols, { x: 240, y: 10 }, { lockedLineId: null }).lineId).toBe(1);
    expect(snap(cols, { x: 40, y: 10 }, { lockedLineId: null }).lineId).toBe(0);
  });

  it("is snappable across the full height of a tall (headline) line", () => {
    const tall: TextMap = [makeLineBox({ id: 0, x: 0, y: 0, w: 300, h: 80, words: [] })];
    // Near the top of the 80px-tall line — far from its center, but inside the box.
    const r = snap(tall, { x: 150, y: 6 }, { lockedLineId: null }, { maxDist: 24 });
    expect(r.snapped).toBe(true);
    expect(r.lineId).toBe(0);
  });
});
