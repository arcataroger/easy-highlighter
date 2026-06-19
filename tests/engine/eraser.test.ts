import { describe, it, expect } from "vitest";
import { hitTestStroke } from "../../src/engine/eraser";
import { makeStroke, type Stroke } from "../../src/engine/types";

function snappedStroke(): Stroke {
  return makeStroke({
    id: "a",
    color: "#ff0",
    segments: [{ kind: "snapped", lineId: 0, x0: 10, x1: 90, y: 50, thickness: 20 }],
  });
}

describe("hitTestStroke", () => {
  it("hits inside the snapped band rect", () => {
    expect(hitTestStroke(snappedStroke(), { x: 50, y: 50 })).toBe(true);
    expect(hitTestStroke(snappedStroke(), { x: 50, y: 58 })).toBe(true); // within thickness/2
  });
  it("misses outside the band", () => {
    expect(hitTestStroke(snappedStroke(), { x: 50, y: 70 })).toBe(false);
    expect(hitTestStroke(snappedStroke(), { x: 5, y: 50 })).toBe(false);
  });
  it("hits near a freeform polyline", () => {
    const s = makeStroke({
      id: "b",
      color: "#ff0",
      segments: [{ kind: "freeform", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], thickness: 10 }],
    });
    expect(hitTestStroke(s, { x: 50, y: 3 })).toBe(true);
    expect(hitTestStroke(s, { x: 50, y: 20 })).toBe(false);
  });
});
