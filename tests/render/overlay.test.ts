import { describe, it, expect } from "vitest";
import { strokeRects } from "../../src/render/overlay";
import { makeStroke } from "../../src/engine/types";

describe("strokeRects", () => {
  it("yields a rect per snapped segment using thickness + x-range", () => {
    const s = makeStroke({
      color: "#ff0",
      segments: [
        { kind: "snapped", lineId: 0, x0: 10, x1: 90, y: 50, thickness: 20 },
      ],
    });
    const rects = strokeRects(s);
    expect(rects).toEqual([{ x: 10, y: 40, w: 80, h: 20 }]);
  });
});
