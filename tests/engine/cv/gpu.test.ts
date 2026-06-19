import { describe, it, expect } from "vitest";
import { grayscaleCPU } from "../../../src/engine/cv/gpu";

describe("grayscaleCPU", () => {
  it("converts RGBA to luminance", () => {
    // one white pixel, one black pixel
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    const gray = grayscaleCPU(rgba, 2, 1);
    expect(gray[0]).toBe(255);
    expect(gray[1]).toBe(0);
  });
});
