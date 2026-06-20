import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as jpeg from "jpeg-js";

import { grayscaleCPU } from "../../../src/engine/cv/gpu";
import { binarize } from "../../../src/engine/cv/binarize";
import { buildTextMap } from "../../../src/engine/cv/textmap";

const IMG_DIR = join(__dirname, "../../../tests/fixtures/images");

describe("real images ingestion sanity check", () => {
  const files = readdirSync(IMG_DIR).filter((f) => f.endsWith(".jpg"));

  it("should have test images", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("can process %s without crashing and detect lines", (file) => {
    const buf = readFileSync(join(IMG_DIR, file));
    const rawImageData = jpeg.decode(buf, { useTArray: true });
    
    // jpeg-js returns RGBA by default
    const rgba = rawImageData.data;
    const width = rawImageData.width;
    const height = rawImageData.height;
    
    const gray = grayscaleCPU(rgba as unknown as Uint8ClampedArray, width, height);
    const bin = binarize({ width, height, gray });
    const textMap = buildTextMap(bin);

    // Assert that the pipeline found SOME lines of text
    expect(textMap.length).toBeGreaterThan(0);
    
    // Assert all lines have valid coordinates
    for (const line of textMap) {
      expect(line.w).toBeGreaterThan(0);
      expect(line.h).toBeGreaterThan(0);
      expect(line.words.length).toBeGreaterThan(0);
    }
  });
});
