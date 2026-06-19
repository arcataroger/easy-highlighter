import { describe, it, expect } from "vitest";
import { otsuThreshold, binarize } from "../../../src/engine/cv/binarize";

describe("otsuThreshold", () => {
  it("separates a bimodal histogram", () => {
    // 8 dark (10) + 8 light (240) pixels
    const gray = new Uint8Array([
      10, 10, 10, 10, 10, 10, 10, 10, 240, 240, 240, 240, 240, 240, 240, 240,
    ]);
    const t = otsuThreshold(gray);
    expect(t).toBeGreaterThan(10);
    expect(t).toBeLessThan(240);
  });

  it("binarize marks ink as 1 (dark text on light bg)", () => {
    const gray = new Uint8Array([10, 240, 10, 240]);
    const bin = binarize({ width: 2, height: 2, gray });
    expect(Array.from(bin.ink)).toEqual([1, 0, 1, 0]);
  });
});
