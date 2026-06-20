// End-to-end at the MODULE level (no browser): render synthetic documents to
// real PNG files, then run the actual ingestion + detection pipeline on those
// files — decode PNG → grayscale → binarize → buildTextMap — and assert the
// detected grid. The rendered PNGs (plain + detection overlay) are written to
// tests/engine/cv/__rendered__/ so they can be inspected by eye.
import { describe, it, expect, beforeAll } from "vitest";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { grayscaleCPU } from "../../../src/engine/cv/gpu";
import { binarize } from "../../../src/engine/cv/binarize";
import { buildTextMap } from "../../../src/engine/cv/textmap";
import type { LineBox } from "../../../src/engine/types";

import { article, type Script } from "./docgen";
import { binToRgba, encodePng, decodePng, overlayBoxes } from "./png";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "__rendered__");

/** Full ingestion pipeline starting from PNG file bytes (as the worker does). */
function detectFromPng(buf: Buffer): LineBox[] {
  const { rgba, width, height } = decodePng(buf);
  const gray = grayscaleCPU(rgba, width, height);
  const bin = binarize({ width, height, gray });
  return buildTextMap(bin);
}

const centerX = (l: LineBox) => l.x + l.w / 2;
const inCol = (lines: LineBox[], a: number, b: number) =>
  lines.filter((l) => centerX(l) >= a && centerX(l) <= b);

interface Case {
  name: string;
  script: Script;
  ruleWidth?: number;
  noise?: number;
}

const CASES: Case[] = [
  { name: "latin-article", script: "latin" },
  { name: "cjk-article", script: "cjk" },
  { name: "connected-article", script: "connected" },
  { name: "latin-newspaper-rule-noise", script: "latin", ruleWidth: 4, noise: 150 },
];

describe("ingestion + detection from real PNG files", () => {
  beforeAll(() => mkdirSync(OUT, { recursive: true }));

  const bodyLines = 15;

  it.each(CASES)("$name: decodes a PNG and detects the right grid", (c) => {
    const doc = article({
      script: c.script,
      seed: 11,
      bodyLines,
      withHeadline: true,
      withCaption: true,
      ruleWidth: c.ruleWidth,
      noise: c.noise,
    });

    // Render to a real PNG file and read it back (true round-trip).
    const rgba = binToRgba(doc.img);
    const pngBytes = encodePng(rgba, doc.img.width, doc.img.height);
    writeFileSync(join(OUT, `${c.name}.png`), pngBytes);

    const lines = detectFromPng(readFileSync(join(OUT, `${c.name}.png`)));

    // Write an overlay PNG for visual inspection.
    const overlay = overlayBoxes(
      rgba,
      doc.img.width,
      doc.img.height,
      lines.map((l) => ({ x0: l.x, y0: l.y, x1: l.x + l.w, y1: l.y + l.h }))
    );
    writeFileSync(
      join(OUT, `${c.name}.detected.png`),
      encodePng(overlay, doc.img.width, doc.img.height)
    );

    // Body y-range from ground truth, so headline/caption are excluded.
    const bodyGt = doc.gt.filter((g) => g.band === "body");
    const bodyTop = Math.min(...bodyGt.map((g) => g.y0)) - 6;
    const bodyBottom = Math.max(...bodyGt.map((g) => g.y1)) + 6;
    const body = lines.filter((l) => {
      const cy = l.y + l.h / 2;
      return cy >= bodyTop && cy <= bodyBottom;
    });

    const leftBody = inCol(body, doc.cols[0].x0, doc.cols[0].x1);
    const rightBody = inCol(body, doc.cols[1].x0, doc.cols[1].x1);

    expect(leftBody.length, "left column line count").toBe(bodyLines);
    expect(rightBody.length, "right column line count").toBe(bodyLines);

    const colW = doc.cols[0].x1 - doc.cols[0].x0;
    for (const l of body) expect(l.w).toBeLessThan(colW * 1.25);
  });
});
