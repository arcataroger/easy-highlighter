import { describe, it, expect } from "vitest";
import {
  connectedComponents,
  compWidth,
  compHeight,
  compFill,
} from "../../../src/engine/cv/connectedComponents";
import type { BinImage } from "../../../src/engine/cv/binarize";

function blank(width: number, height: number): BinImage {
  return { width, height, ink: new Uint8Array(width * height) };
}
function set(img: BinImage, x: number, y: number) {
  img.ink[y * img.width + x] = 1;
}
function fillRect(img: BinImage, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(img, x, y);
}

describe("connectedComponents", () => {
  it("labels two separated blobs as distinct components", () => {
    const img = blank(10, 5);
    fillRect(img, 0, 0, 1, 1); // 2x2 blob, area 4
    fillRect(img, 5, 3, 7, 4); // 3x2 blob, area 6
    const comps = connectedComponents(img);
    expect(comps.length).toBe(2);
    const areas = comps.map((c) => c.area).sort((a, b) => a - b);
    expect(areas).toEqual([4, 6]);
  });

  it("merges diagonally-touching pixels under 8-connectivity but not 4", () => {
    const img = blank(4, 4);
    set(img, 0, 0);
    set(img, 1, 1); // diagonal neighbour
    expect(connectedComponents(img, { connectivity: 8 }).length).toBe(1);
    expect(connectedComponents(img, { connectivity: 4 }).length).toBe(2);
  });

  it("reports bbox geometry and fill fraction", () => {
    const img = blank(8, 8);
    fillRect(img, 2, 2, 5, 5); // fully filled 4x4
    const [c] = connectedComponents(img);
    expect(compWidth(c)).toBe(4);
    expect(compHeight(c)).toBe(4);
    expect(compFill(c)).toBe(1);
  });

  it("handles a large blob without recursion overflow", () => {
    const img = blank(200, 200);
    fillRect(img, 0, 0, 199, 199);
    const comps = connectedComponents(img);
    expect(comps.length).toBe(1);
    expect(comps[0].area).toBe(200 * 200);
  });
});
