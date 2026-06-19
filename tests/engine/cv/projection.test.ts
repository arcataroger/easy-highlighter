import { describe, it, expect } from "vitest";
import { rowProjection, findLineBands } from "../../../src/engine/cv/projection";
import type { BinImage } from "../../../src/engine/cv/binarize";

/** Build a 10-wide image with ink only on the given row indices. */
function imageWithInkRows(height: number, inkRows: number[]): BinImage {
  const width = 10;
  const ink = new Uint8Array(width * height);
  for (const r of inkRows) for (let x = 0; x < width; x++) ink[r * width + x] = 1;
  return { width, height, ink };
}

describe("rowProjection", () => {
  it("counts ink per row", () => {
    const img = imageWithInkRows(3, [1]);
    expect(Array.from(rowProjection(img))).toEqual([0, 10, 0]);
  });
});

describe("findLineBands", () => {
  it("finds two bands separated by a blank gap", () => {
    // rows 1-2 ink, row 3 blank, rows 4-5 ink
    const img = imageWithInkRows(7, [1, 2, 4, 5]);
    const bands = findLineBands(img);
    expect(bands.length).toBe(2);
    expect(bands[0]).toMatchObject({ top: 1, bottom: 2 });
    expect(bands[1]).toMatchObject({ top: 4, bottom: 5 });
  });
});
