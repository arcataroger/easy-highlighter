import { describe, it, expect } from "vitest";
import { analysisScale } from "../../src/io/imageLoader";

describe("analysisScale", () => {
  it("is 1 when image is within the cap", () => {
    expect(analysisScale(1000, 800, 2000)).toBe(1);
  });
  it("downscales so the long side equals the cap", () => {
    expect(analysisScale(4000, 2000, 2000)).toBe(0.5);
  });
});
