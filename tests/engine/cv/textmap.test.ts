import { describe, it, expect } from "vitest";
import { buildTextMap } from "../../../src/engine/cv/textmap";
import type { BinImage } from "../../../src/engine/cv/binarize";

/**
 * 20x7 image. Row band rows 1-2 has two ink clusters:
 * x 1-3 (a word) and x 6-8 (another word), separated by a blank gap at x4-5.
 */
function twoWordImage(): BinImage {
  const width = 20;
  const height = 7;
  const ink = new Uint8Array(width * height);
  const set = (x: number, y: number) => (ink[y * width + x] = 1);
  for (const y of [1, 2]) {
    for (const x of [1, 2, 3]) set(x, y);
    for (const x of [6, 7, 8]) set(x, y);
  }
  return { width, height, ink };
}

describe("buildTextMap", () => {
  it("produces one line with a bounding box spanning the text extent", () => {
    const map = buildTextMap(twoWordImage());
    expect(map.length).toBe(1);
    const line = map[0];
    expect(line.x).toBe(1); // leftmost ink
    expect(line.x + line.w).toBe(9); // rightmost ink + 1 (exclusive width)
    expect(line.y).toBe(1);
    expect(line.h).toBe(2);
  });

  it("splits the line into two word boxes across the gap", () => {
    const map = buildTextMap(twoWordImage(), { wordGap: 2 });
    expect(map[0].words.length).toBe(2);
    expect(map[0].words[0]).toMatchObject({ x: 1, w: 3 }); // x1..3
    expect(map[0].words[1]).toMatchObject({ x: 6, w: 3 }); // x6..8
  });
});
