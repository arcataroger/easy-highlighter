import { describe, it, expect } from "vitest";
import { detectTextLines, type DetectedLine } from "../../../src/engine/cv/lineDetect";
import { article, type Script } from "./docgen";

const centerX = (l: DetectedLine) => (l.x0 + l.x1) / 2;
const centerY = (l: DetectedLine) => (l.y0 + l.y1) / 2;

/** Lines whose center falls inside [a,b] horizontally. */
function inCol(lines: DetectedLine[], a: number, b: number) {
  return lines.filter((l) => centerX(l) >= a && centerX(l) <= b);
}

describe.each<[Script]>([["latin"], ["cjk"], ["connected"]])(
  "two-column article — %s script",
  (script) => {
    const bodyLines = 16;
    const doc = article({ script, seed: 7, bodyLines });
    const lines = detectTextLines(doc.img);

    const bodyTop = Math.min(...doc.gt.filter((g) => g.band === "body").map((g) => g.y0)) - 4;
    const bodyBottom = Math.max(...doc.gt.filter((g) => g.band === "body").map((g) => g.y1)) + 4;
    const body = lines.filter((l) => centerY(l) >= bodyTop && centerY(l) <= bodyBottom);

    it("detects each body column as exactly the right number of lines", () => {
      const left = inCol(body, doc.cols[0].x0, doc.cols[0].x1);
      const right = inCol(body, doc.cols[1].x0, doc.cols[1].x1);
      // Exact: catches BOTH over-fragmentation (>n) and merges (<n).
      expect(left.length).toBe(bodyLines);
      expect(right.length).toBe(bodyLines);
    });

    it("never lets a body line bridge the column gutter", () => {
      const colW = doc.cols[0].x1 - doc.cols[0].x0;
      for (const l of body) {
        expect(l.x1 - l.x0).toBeLessThan(colW * 1.25);
        // A line lives in one column: it doesn't start left-col and end right-col.
        const startsLeft = l.x0 <= doc.cols[0].x1;
        const endsRight = l.x1 >= doc.cols[1].x0;
        expect(startsLeft && endsRight).toBe(false);
      }
    });

    it("detects the headline as a single full-width line", () => {
      const head = lines.filter((l) => centerY(l) < bodyTop);
      expect(head.length).toBe(1);
      const colW = doc.cols[0].x1 - doc.cols[0].x0;
      expect(head[0].x1 - head[0].x0).toBeGreaterThan(colW * 1.5);
    });
  }
);

describe("article variations", () => {
  it("handles a headline-less, caption-less plain two-column body", () => {
    const doc = article({ script: "latin", seed: 3, bodyLines: 12, withHeadline: false, withCaption: false });
    const lines = detectTextLines(doc.img);
    const left = inCol(lines, doc.cols[0].x0, doc.cols[0].x1);
    const right = inCol(lines, doc.cols[1].x0, doc.cols[1].x1);
    expect(left.length).toBe(12);
    expect(right.length).toBe(12);
  });

  it("splits columns even with a printed gutter rule and scan speckle", () => {
    const doc = article({
      script: "latin",
      seed: 5,
      bodyLines: 14,
      withHeadline: false,
      withCaption: false,
      ruleWidth: 4,
      noise: 120,
    });
    const lines = detectTextLines(doc.img);
    const left = inCol(lines, doc.cols[0].x0, doc.cols[0].x1);
    const right = inCol(lines, doc.cols[1].x0, doc.cols[1].x1);
    expect(left.length).toBe(14);
    expect(right.length).toBe(14);
    // and nothing bridges the gutter
    const colW = doc.cols[0].x1 - doc.cols[0].x0;
    for (const l of [...left, ...right]) expect(l.x1 - l.x0).toBeLessThan(colW * 1.25);
  });

  it("is stable across seeds (no fragmentation/merge variance)", () => {
    for (const seed of [1, 2, 42, 99]) {
      const doc = article({ script: "latin", seed, bodyLines: 14, withHeadline: false, withCaption: false });
      const lines = detectTextLines(doc.img);
      const left = inCol(lines, doc.cols[0].x0, doc.cols[0].x1);
      const right = inCol(lines, doc.cols[1].x0, doc.cols[1].x1);
      expect(left.length, `left col seed ${seed}`).toBe(14);
      expect(right.length, `right col seed ${seed}`).toBe(14);
    }
  });
});
