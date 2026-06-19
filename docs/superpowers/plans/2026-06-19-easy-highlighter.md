# Easy Highlighter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A client-side-only SPA that loads an image, highlights text lines with a magnetic always-draw/snap-to-line marker, and exports the result as PNG/JPEG.

**Architecture:** Vite + React + TypeScript SPA. A pure-TypeScript engine (no React) does all image analysis and geometry: a CV pipeline produces a `TextMap` (line + word boxes) from an image; a snapping engine turns drag input into stroke geometry; a highlight model stores resolution-independent strokes with undo/redo/erase. React drives only the UI shell. Heavy pixel work runs in a Web Worker with a WebGPU path and a CPU fallback.

**Tech Stack:** Vite, React 18, TypeScript, Vitest (unit tests), Canvas2D + optional WebGPU, Web Workers.

---

## Parallelization Map (waves)

Tasks are grouped into **waves**. Tasks within the same wave are independent (no shared files, no ordering dependency) and **can be dispatched to parallel subagents**. Waves run in order.

- **Wave 0 (sequential, foundation):** Task 1 (scaffold) → Task 2 (shared types). Must complete before anything else.
- **Wave 1 (PARALLEL — 3 agents):** Task 3 (CV pipeline), Task 4 (snapping engine), Task 5 (highlight model). Each is pure logic, TDD with Vitest, touches only its own files.
- **Wave 2 (sequential, integration):** Task 6 (worker wiring + GPU/CPU), Task 7 (image I/O + canvas view), Task 8 (rendering + export), Task 9 (React UI shell + wiring), Task 10 (debug overlay + polish).

Each task lists exact files so waves stay collision-free. No two Wave-1 tasks write the same file.

---

## File Structure

```
package.json, vite.config.ts, tsconfig.json, index.html      # Task 1
src/main.tsx, src/App.tsx, src/index.css                      # Task 1 / 9
src/engine/types.ts                                           # Task 2  (shared — Wave 0)
src/engine/cv/binarize.ts                                     # Task 3
src/engine/cv/projection.ts                                   # Task 3
src/engine/cv/textmap.ts                                      # Task 3
src/engine/snapping.ts                                        # Task 4
src/engine/strokeBuilder.ts                                   # Task 4
src/engine/highlightModel.ts                                  # Task 5
src/engine/eraser.ts                                          # Task 5
src/worker/analyze.worker.ts                                  # Task 6
src/engine/cv/gpu.ts                                          # Task 6
src/io/imageLoader.ts                                         # Task 7
src/render/overlay.ts                                         # Task 8
src/render/exporter.ts                                        # Task 8
src/ui/Toolbar.tsx, src/ui/Canvas.tsx, src/ui/useHighlighter.ts  # Task 9
src/ui/DebugOverlay.tsx                                       # Task 10
tests/** mirror of the above                                  # per task
```

---

## Wave 0 — Foundation (sequential)

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `vitest.config.ts`

- [ ] **Step 1: Scaffold Vite React-TS project**

Run:
```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```
Expected: project files created, deps installed.

- [ ] **Step 2: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
```

- [ ] **Step 3: Add test + dev scripts to package.json**

Ensure `package.json` `"scripts"` contains:
```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Add a trivial smoke test**

Create `tests/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Vitest"
```

---

### Task 2: Shared engine types

**Files:**
- Create: `src/engine/types.ts`
- Test: `tests/engine/types.test.ts`

These types are the contract every Wave-1 module depends on. Define them all here so the three parallel tasks share one source of truth.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeLineBox, makeStroke } from "../../src/engine/types";

describe("type factories", () => {
  it("makeLineBox fills derived fields", () => {
    const lb = makeLineBox({ id: 0, x: 10, y: 20, w: 100, h: 16, words: [] });
    expect(lb.baseline).toBe(20 + 16); // bottom by default
    expect(lb.cy).toBe(20 + 8);
  });

  it("makeStroke generates an id and defaults", () => {
    const s = makeStroke({ color: "#ffe14d" });
    expect(s.id).toMatch(/.+/);
    expect(s.opacity).toBe(0.4);
    expect(s.segments).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/types.test.ts`
Expected: FAIL ("Cannot find module .../types").

- [ ] **Step 3: Write the implementation**

Create `src/engine/types.ts`:
```ts
export interface Point {
  x: number;
  y: number;
}

export interface WordBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LineBox {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** y of the text baseline (defaults to box bottom) */
  baseline: number;
  /** vertical center of the line box */
  cy: number;
  words: WordBox[];
}

export type TextMap = LineBox[];

export interface SnappedSegment {
  kind: "snapped";
  lineId: number;
  x0: number;
  x1: number;
  /** vertical center of the band, original-image coords */
  y: number;
  /** band thickness, original-image coords */
  thickness: number;
}

export interface FreeformSegment {
  kind: "freeform";
  points: Point[];
  thickness: number;
}

export type Segment = SnappedSegment | FreeformSegment;

export interface Stroke {
  id: string;
  color: string;
  opacity: number;
  segments: Segment[];
}

export function makeLineBox(
  init: Omit<LineBox, "baseline" | "cy"> & Partial<Pick<LineBox, "baseline" | "cy">>
): LineBox {
  return {
    ...init,
    baseline: init.baseline ?? init.y + init.h,
    cy: init.cy ?? init.y + init.h / 2,
  };
}

let strokeCounter = 0;
export function makeStroke(init: Partial<Stroke> & { color: string }): Stroke {
  return {
    id: init.id ?? `s${Date.now()}_${strokeCounter++}`,
    color: init.color,
    opacity: init.opacity ?? 0.4,
    segments: init.segments ?? [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/types.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts tests/engine/types.test.ts
git commit -m "feat: shared engine types (TextMap, Stroke, factories)"
```

---

## Wave 1 — Pure-logic cores (PARALLEL: dispatch Tasks 3, 4, 5 concurrently)

> Each Wave-1 task depends ONLY on `src/engine/types.ts` (Task 2). They do not import each other and write disjoint files, so they are safe to run in parallel subagents. Each follows strict TDD.

### Task 3: CV pipeline → TextMap

**Files:**
- Create: `src/engine/cv/binarize.ts`, `src/engine/cv/projection.ts`, `src/engine/cv/textmap.ts`
- Test: `tests/engine/cv/binarize.test.ts`, `tests/engine/cv/projection.test.ts`, `tests/engine/cv/textmap.test.ts`

Operates on a plain grayscale buffer so it is testable without a browser: input is `{ width, height, gray: Uint8Array }` where `gray[y*width+x]` is 0–255 luminance.

- [ ] **Step 1: Write failing test for Otsu binarize**

Create `tests/engine/cv/binarize.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test, verify fail**

Run: `npx vitest run tests/engine/cv/binarize.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement binarize**

Create `src/engine/cv/binarize.ts`:
```ts
export interface GrayImage {
  width: number;
  height: number;
  gray: Uint8Array; // length width*height, 0..255 luminance
}

export interface BinImage {
  width: number;
  height: number;
  ink: Uint8Array; // 1 = ink (dark), 0 = background
}

/** Otsu's method: returns the luminance threshold maximizing between-class variance. */
export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

export function binarize(img: GrayImage, threshold?: number): BinImage {
  const t = threshold ?? otsuThreshold(img.gray);
  const ink = new Uint8Array(img.width * img.height);
  for (let i = 0; i < img.gray.length; i++) ink[i] = img.gray[i] <= t ? 1 : 0;
  return { width: img.width, height: img.height, ink };
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run tests/engine/cv/binarize.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing test for projection + line bands**

Create `tests/engine/cv/projection.test.ts`:
```ts
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
```

- [ ] **Step 6: Run test, verify fail**

Run: `npx vitest run tests/engine/cv/projection.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implement projection + line bands**

Create `src/engine/cv/projection.ts`:
```ts
import type { BinImage } from "./binarize";

export interface LineBand {
  top: number;
  bottom: number; // inclusive
}

/** Ink count per row (length = height). */
export function rowProjection(img: BinImage): Uint32Array {
  const proj = new Uint32Array(img.height);
  for (let y = 0; y < img.height; y++) {
    let count = 0;
    const base = y * img.width;
    for (let x = 0; x < img.width; x++) count += img.ink[base + x];
    proj[y] = count;
  }
  return proj;
}

/**
 * Group consecutive rows whose ink count exceeds `minInk` into bands.
 * minInk defaults to a small fraction of width to ignore speckle noise.
 */
export function findLineBands(img: BinImage, minInkFraction = 0.01): LineBand[] {
  const proj = rowProjection(img);
  const minInk = Math.max(1, Math.floor(img.width * minInkFraction));
  const bands: LineBand[] = [];
  let start = -1;
  for (let y = 0; y < img.height; y++) {
    const active = proj[y] >= minInk;
    if (active && start === -1) start = y;
    if (!active && start !== -1) {
      bands.push({ top: start, bottom: y - 1 });
      start = -1;
    }
  }
  if (start !== -1) bands.push({ top: start, bottom: img.height - 1 });
  return bands;
}
```

- [ ] **Step 8: Run test, verify pass**

Run: `npx vitest run tests/engine/cv/projection.test.ts`
Expected: PASS.

- [ ] **Step 9: Write failing test for buildTextMap (line + word boxes)**

Create `tests/engine/cv/textmap.test.ts`:
```ts
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
```

- [ ] **Step 10: Run test, verify fail**

Run: `npx vitest run tests/engine/cv/textmap.test.ts`
Expected: FAIL.

- [ ] **Step 11: Implement buildTextMap**

Create `src/engine/cv/textmap.ts`:
```ts
import type { BinImage } from "./binarize";
import { findLineBands } from "./projection";
import { makeLineBox, type LineBox, type TextMap, type WordBox } from "../types";

export interface TextMapOptions {
  /** min blank-column run (px) that separates two words */
  wordGap?: number;
  minInkFraction?: number;
}

/** Column ink counts within a row band [top..bottom]. */
function bandColumnProjection(img: BinImage, top: number, bottom: number): Uint32Array {
  const proj = new Uint32Array(img.width);
  for (let y = top; y <= bottom; y++) {
    const base = y * img.width;
    for (let x = 0; x < img.width; x++) proj[x] += img.ink[base + x];
  }
  return proj;
}

/** Group consecutive ink columns into [x0,x1] runs, merging gaps < wordGap. */
function columnRuns(col: Uint32Array, wordGap: number): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  let lastInk = -1;
  for (let x = 0; x < col.length; x++) {
    if (col[x] > 0) {
      if (start === -1) start = x;
      else if (lastInk !== -1 && x - lastInk - 1 >= wordGap) {
        runs.push([start, lastInk]);
        start = x;
      }
      lastInk = x;
    }
  }
  if (start !== -1) runs.push([start, lastInk]);
  return runs;
}

export function buildTextMap(img: BinImage, opts: TextMapOptions = {}): TextMap {
  const wordGap = opts.wordGap ?? 4;
  const bands = findLineBands(img, opts.minInkFraction);
  const lines: LineBox[] = [];
  bands.forEach((band, id) => {
    const col = bandColumnProjection(img, band.top, band.bottom);
    const runs = columnRuns(col, wordGap);
    if (runs.length === 0) return;
    const left = runs[0][0];
    const right = runs[runs.length - 1][1];
    const words: WordBox[] = runs.map(([x0, x1]) => ({
      x: x0,
      y: band.top,
      w: x1 - x0 + 1,
      h: band.bottom - band.top + 1,
    }));
    lines.push(
      makeLineBox({
        id,
        x: left,
        y: band.top,
        w: right - left + 1,
        h: band.bottom - band.top + 1,
        words,
      })
    );
  });
  return lines;
}
```

- [ ] **Step 12: Run test, verify pass**

Run: `npx vitest run tests/engine/cv/`
Expected: ALL PASS.

- [ ] **Step 13: Commit**

```bash
git add src/engine/cv tests/engine/cv
git commit -m "feat: CV pipeline (binarize, projection, line bands, word boxes) -> TextMap"
```

---

### Task 4: Snapping engine + stroke builder

**Files:**
- Create: `src/engine/snapping.ts`, `src/engine/strokeBuilder.ts`
- Test: `tests/engine/snapping.test.ts`, `tests/engine/strokeBuilder.test.ts`

Depends only on `types.ts`. Pure functions over a `TextMap` and drag input.

- [ ] **Step 1: Write failing test for nearestLine + snap with hysteresis**

Create `tests/engine/snapping.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { snap } from "../../src/engine/snapping";
import { makeLineBox, type TextMap } from "../../src/engine/types";

const map: TextMap = [
  makeLineBox({ id: 0, x: 0, y: 0, w: 100, h: 20, words: [] }), // cy=10
  makeLineBox({ id: 1, x: 0, y: 40, w: 100, h: 20, words: [] }), // cy=50
];

describe("snap", () => {
  it("snaps to the line whose center is nearest within threshold", () => {
    const r = snap(map, { x: 50, y: 12 }, { lockedLineId: null }, { maxDist: 30 });
    expect(r.snapped).toBe(true);
    expect(r.lineId).toBe(0);
    expect(r.y).toBe(10);
    expect(r.thickness).toBe(20);
  });

  it("returns no snap when cursor is too far from any line", () => {
    const r = snap(map, { x: 50, y: 200 }, { lockedLineId: null }, { maxDist: 30 });
    expect(r.snapped).toBe(false);
  });

  it("keeps the locked line under hysteresis even if another is slightly closer", () => {
    // cursor at y=27: line0 cy=10 (dist17), line1 cy=50 (dist23). Locked to line1.
    const r = snap(map, { x: 50, y: 27 }, { lockedLineId: 1 }, { maxDist: 40, hysteresis: 10 });
    expect(r.lineId).toBe(1); // stays locked because 23 - 17 < hysteresis
  });

  it("switches line when another is closer by more than hysteresis", () => {
    const r = snap(map, { x: 50, y: 15 }, { lockedLineId: 1 }, { maxDist: 40, hysteresis: 10 });
    expect(r.lineId).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npx vitest run tests/engine/snapping.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement snapping**

Create `src/engine/snapping.ts`:
```ts
import type { Point, TextMap } from "./types";

export interface SnapState {
  lockedLineId: number | null;
}

export interface SnapOptions {
  /** max vertical distance (px) from a line center to consider snapping */
  maxDist?: number;
  /** a competing line must be closer than the locked line by at least this (px) to steal the lock */
  hysteresis?: number;
}

export interface SnapResult {
  snapped: boolean;
  lineId?: number;
  /** vertical center of the band */
  y?: number;
  /** band thickness (line height) */
  thickness?: number;
}

export function snap(
  map: TextMap,
  cursor: Point,
  state: SnapState,
  opts: SnapOptions = {}
): SnapResult {
  const maxDist = opts.maxDist ?? 24;
  const hysteresis = opts.hysteresis ?? 8;
  if (map.length === 0) return { snapped: false };

  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < map.length; i++) {
    const d = Math.abs(cursor.y - map[i].cy);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  if (best === -1 || bestDist > maxDist) return { snapped: false };

  // Hysteresis: keep the currently locked line unless a competitor is clearly closer.
  let chosen = best;
  if (state.lockedLineId !== null) {
    const locked = map.find((l) => l.id === state.lockedLineId);
    if (locked && Math.abs(cursor.y - locked.cy) <= maxDist) {
      const lockedDist = Math.abs(cursor.y - locked.cy);
      if (lockedDist - bestDist < hysteresis) {
        chosen = map.indexOf(locked);
      }
    }
  }

  const line = map[chosen];
  return { snapped: true, lineId: line.id, y: line.cy, thickness: line.h };
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run tests/engine/snapping.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write failing test for stroke builder**

Create `tests/engine/strokeBuilder.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { StrokeBuilder } from "../../src/engine/strokeBuilder";
import { makeLineBox, type TextMap, type SnappedSegment, type FreeformSegment } from "../../src/engine/types";

const map: TextMap = [makeLineBox({ id: 0, x: 0, y: 0, w: 100, h: 20, words: [] })];

describe("StrokeBuilder", () => {
  it("builds one snapped segment whose x-range grows along the line", () => {
    const b = new StrokeBuilder(map, "#ffe14d", 0.4, { maxDist: 30, defaultThickness: 12 });
    b.down({ x: 10, y: 11 });
    b.move({ x: 60, y: 11 });
    const stroke = b.finish();
    expect(stroke.segments.length).toBe(1);
    const seg = stroke.segments[0] as SnappedSegment;
    expect(seg.kind).toBe("snapped");
    expect(seg.lineId).toBe(0);
    expect(seg.x0).toBe(10);
    expect(seg.x1).toBe(60);
    expect(seg.thickness).toBe(20);
  });

  it("falls back to a freeform segment far from any line", () => {
    const b = new StrokeBuilder(map, "#ffe14d", 0.4, { maxDist: 10, defaultThickness: 12 });
    b.down({ x: 10, y: 300 });
    b.move({ x: 40, y: 305 });
    const stroke = b.finish();
    const seg = stroke.segments[0] as FreeformSegment;
    expect(seg.kind).toBe("freeform");
    expect(seg.points.length).toBe(2);
    expect(seg.thickness).toBe(12);
  });
});
```

- [ ] **Step 6: Run test, verify fail**

Run: `npx vitest run tests/engine/strokeBuilder.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implement stroke builder**

Create `src/engine/strokeBuilder.ts`:
```ts
import { makeStroke, type Point, type Segment, type Stroke, type TextMap, type SnappedSegment, type FreeformSegment } from "./types";
import { snap, type SnapOptions } from "./snapping";

export interface StrokeBuilderOptions extends SnapOptions {
  defaultThickness?: number;
}

/**
 * Accumulates pointer input into a single Stroke during one drag.
 * Each pointer sample is snapped; consecutive samples on the same line extend
 * one SnappedSegment, otherwise a new segment (freeform or new line) starts.
 */
export class StrokeBuilder {
  private stroke: Stroke;
  private lockedLineId: number | null = null;
  private defaultThickness: number;
  private opts: SnapOptions;

  constructor(
    private map: TextMap,
    color: string,
    opacity: number,
    options: StrokeBuilderOptions = {}
  ) {
    this.stroke = makeStroke({ color, opacity });
    this.defaultThickness = options.defaultThickness ?? 14;
    this.opts = { maxDist: options.maxDist, hysteresis: options.hysteresis };
  }

  down(p: Point) {
    this.addPoint(p);
  }

  move(p: Point) {
    this.addPoint(p);
  }

  private addPoint(p: Point) {
    const result = snap(this.map, p, { lockedLineId: this.lockedLineId }, this.opts);
    const last = this.stroke.segments[this.stroke.segments.length - 1];

    if (result.snapped) {
      this.lockedLineId = result.lineId!;
      if (last && last.kind === "snapped" && last.lineId === result.lineId) {
        last.x0 = Math.min(last.x0, p.x);
        last.x1 = Math.max(last.x1, p.x);
      } else {
        const seg: SnappedSegment = {
          kind: "snapped",
          lineId: result.lineId!,
          x0: p.x,
          x1: p.x,
          y: result.y!,
          thickness: result.thickness!,
        };
        this.stroke.segments.push(seg);
      }
    } else {
      this.lockedLineId = null;
      if (last && last.kind === "freeform") {
        last.points.push(p);
      } else {
        const seg: FreeformSegment = {
          kind: "freeform",
          points: [p],
          thickness: this.defaultThickness,
        };
        this.stroke.segments.push(seg);
      }
    }
  }

  /** Current in-progress stroke (for live preview). */
  preview(): Stroke {
    return this.stroke;
  }

  finish(): Stroke {
    return this.stroke;
  }
}
```

- [ ] **Step 8: Run test, verify pass**

Run: `npx vitest run tests/engine/snapping.test.ts tests/engine/strokeBuilder.test.ts`
Expected: ALL PASS.

- [ ] **Step 9: Commit**

```bash
git add src/engine/snapping.ts src/engine/strokeBuilder.ts tests/engine/snapping.test.ts tests/engine/strokeBuilder.test.ts
git commit -m "feat: snapping engine with hysteresis + stroke builder"
```

---

### Task 5: Highlight model (undo/redo) + eraser

**Files:**
- Create: `src/engine/highlightModel.ts`, `src/engine/eraser.ts`
- Test: `tests/engine/highlightModel.test.ts`, `tests/engine/eraser.test.ts`

Depends only on `types.ts`. Pure logic.

- [ ] **Step 1: Write failing test for the model**

Create `tests/engine/highlightModel.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { HighlightModel } from "../../src/engine/highlightModel";
import { makeStroke } from "../../src/engine/types";

describe("HighlightModel", () => {
  it("adds strokes and lists them in order", () => {
    const m = new HighlightModel();
    m.add(makeStroke({ id: "a", color: "#ff0" }));
    m.add(makeStroke({ id: "b", color: "#f0f" }));
    expect(m.strokes.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("undo removes the last stroke; redo restores it", () => {
    const m = new HighlightModel();
    m.add(makeStroke({ id: "a", color: "#ff0" }));
    m.add(makeStroke({ id: "b", color: "#f0f" }));
    m.undo();
    expect(m.strokes.map((s) => s.id)).toEqual(["a"]);
    m.redo();
    expect(m.strokes.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("a new action after undo clears the redo stack", () => {
    const m = new HighlightModel();
    m.add(makeStroke({ id: "a", color: "#ff0" }));
    m.undo();
    m.add(makeStroke({ id: "c", color: "#0ff" }));
    m.redo(); // nothing to redo
    expect(m.strokes.map((s) => s.id)).toEqual(["c"]);
  });

  it("remove deletes a stroke by id and is undoable", () => {
    const m = new HighlightModel();
    m.add(makeStroke({ id: "a", color: "#ff0" }));
    m.add(makeStroke({ id: "b", color: "#f0f" }));
    m.remove("a");
    expect(m.strokes.map((s) => s.id)).toEqual(["b"]);
    m.undo();
    expect(m.strokes.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npx vitest run tests/engine/highlightModel.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the model**

Create `src/engine/highlightModel.ts`:
```ts
import type { Stroke } from "./types";

/** Immutable snapshots on an undo/redo stack. Simple and correct for v1 sizes. */
export class HighlightModel {
  private _strokes: Stroke[] = [];
  private undoStack: Stroke[][] = [];
  private redoStack: Stroke[][] = [];

  get strokes(): Stroke[] {
    return this._strokes;
  }

  private commit(next: Stroke[]) {
    this.undoStack.push(this._strokes);
    this.redoStack = [];
    this._strokes = next;
  }

  add(stroke: Stroke) {
    this.commit([...this._strokes, stroke]);
  }

  remove(id: string) {
    this.commit(this._strokes.filter((s) => s.id !== id));
  }

  setStrokeColor(id: string, color: string) {
    this.commit(this._strokes.map((s) => (s.id === id ? { ...s, color } : s)));
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this._strokes);
    this._strokes = prev;
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this._strokes);
    this._strokes = next;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }
  canRedo() {
    return this.redoStack.length > 0;
  }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run tests/engine/highlightModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing test for eraser hit-testing**

Create `tests/engine/eraser.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hitTestStroke } from "../../src/engine/eraser";
import { makeStroke, type Stroke } from "../../src/engine/types";

function snappedStroke(): Stroke {
  return makeStroke({
    id: "a",
    color: "#ff0",
    segments: [{ kind: "snapped", lineId: 0, x0: 10, x1: 90, y: 50, thickness: 20 }],
  });
}

describe("hitTestStroke", () => {
  it("hits inside the snapped band rect", () => {
    expect(hitTestStroke(snappedStroke(), { x: 50, y: 50 })).toBe(true);
    expect(hitTestStroke(snappedStroke(), { x: 50, y: 58 })).toBe(true); // within thickness/2
  });
  it("misses outside the band", () => {
    expect(hitTestStroke(snappedStroke(), { x: 50, y: 70 })).toBe(false);
    expect(hitTestStroke(snappedStroke(), { x: 5, y: 50 })).toBe(false);
  });
  it("hits near a freeform polyline", () => {
    const s = makeStroke({
      id: "b",
      color: "#ff0",
      segments: [{ kind: "freeform", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], thickness: 10 }],
    });
    expect(hitTestStroke(s, { x: 50, y: 3 })).toBe(true);
    expect(hitTestStroke(s, { x: 50, y: 20 })).toBe(false);
  });
});
```

- [ ] **Step 6: Run test, verify fail**

Run: `npx vitest run tests/engine/eraser.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implement eraser hit-testing**

Create `src/engine/eraser.ts`:
```ts
import type { Point, Stroke } from "./types";

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** True if point p lies within any segment of the stroke. */
export function hitTestStroke(stroke: Stroke, p: Point): boolean {
  for (const seg of stroke.segments) {
    if (seg.kind === "snapped") {
      const halfH = seg.thickness / 2;
      if (p.x >= seg.x0 && p.x <= seg.x1 && Math.abs(p.y - seg.y) <= halfH) return true;
    } else {
      const half = seg.thickness / 2;
      for (let i = 0; i + 1 < seg.points.length; i++) {
        if (distToSegment(p, seg.points[i], seg.points[i + 1]) <= half) return true;
      }
      if (seg.points.length === 1) {
        if (Math.hypot(p.x - seg.points[0].x, p.y - seg.points[0].y) <= half) return true;
      }
    }
  }
  return false;
}

/** Returns the id of the topmost (last-drawn) stroke under p, or null. */
export function pickStroke(strokes: Stroke[], p: Point): string | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (hitTestStroke(strokes[i], p)) return strokes[i].id;
  }
  return null;
}
```

- [ ] **Step 8: Run test, verify pass**

Run: `npx vitest run tests/engine/eraser.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/engine/highlightModel.ts src/engine/eraser.ts tests/engine/highlightModel.test.ts tests/engine/eraser.test.ts
git commit -m "feat: highlight model (undo/redo) + eraser hit-testing"
```

---

## Wave 2 — Integration (sequential)

### Task 6: Analysis worker + GPU/CPU grayscale

**Files:**
- Create: `src/engine/cv/gpu.ts`, `src/worker/analyze.worker.ts`
- Test: `tests/engine/cv/gpu.test.ts`

- [ ] **Step 1: Write failing test for CPU grayscale**

Create `tests/engine/cv/gpu.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test, verify fail**

Run: `npx vitest run tests/engine/cv/gpu.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement grayscale (CPU now; GPU path stubbed with feature-detect)**

Create `src/engine/cv/gpu.ts`:
```ts
/** Rec. 601 luma. */
export function grayscaleCPU(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
    gray[j] = (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) | 0;
  }
  return gray;
}

/**
 * Returns grayscale using WebGPU when available, else CPU.
 * For v1 the WebGPU path simply falls through to CPU unless a device is present;
 * the parallel pixel passes can be moved to a compute shader later without changing
 * this signature.
 */
export async function grayscale(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Promise<Uint8Array> {
  // Feature-detect; real GPU compute can be added behind this guard.
  const hasGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  if (!hasGPU) return grayscaleCPU(rgba, width, height);
  // Placeholder: until a compute shader is wired, use CPU (correct + fast enough).
  return grayscaleCPU(rgba, width, height);
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run tests/engine/cv/gpu.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the worker (no unit test; integration-tested via app)**

Create `src/worker/analyze.worker.ts`:
```ts
/// <reference lib="webworker" />
import { grayscale } from "../engine/cv/gpu";
import { binarize } from "../engine/cv/binarize";
import { buildTextMap } from "../engine/cv/textmap";
import type { TextMap } from "../engine/types";

export interface AnalyzeRequest {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  /** scale factor mapping analysis coords back to original (1 = same) */
  scale: number;
}

export interface AnalyzeResponse {
  textMap: TextMap;
}

self.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  const { rgba, width, height, scale } = e.data;
  const gray = await grayscale(rgba, width, height);
  const bin = binarize({ width, height, gray });
  const mapAnalysis = buildTextMap(bin);
  // map coords back to original resolution
  const textMap: TextMap = mapAnalysis.map((l) => ({
    ...l,
    x: l.x / scale,
    y: l.y / scale,
    w: l.w / scale,
    h: l.h / scale,
    baseline: l.baseline / scale,
    cy: l.cy / scale,
    words: l.words.map((w) => ({ x: w.x / scale, y: w.y / scale, w: w.w / scale, h: w.h / scale })),
  }));
  const res: AnalyzeResponse = { textMap };
  (self as unknown as Worker).postMessage(res);
};
```

- [ ] **Step 6: Commit**

```bash
git add src/engine/cv/gpu.ts src/worker/analyze.worker.ts tests/engine/cv/gpu.test.ts
git commit -m "feat: analysis worker + grayscale (GPU-detect, CPU fallback)"
```

---

### Task 7: Image loader + analysis-scale helper

**Files:**
- Create: `src/io/imageLoader.ts`
- Test: `tests/io/imageLoader.test.ts`

- [ ] **Step 1: Write failing test for analysisScale**

Create `tests/io/imageLoader.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test, verify fail**

Run: `npx vitest run tests/io/imageLoader.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement loader**

Create `src/io/imageLoader.ts`:
```ts
/** Scale factor to fit the long side within `cap` (<= 1). */
export function analysisScale(width: number, height: number, cap = 2000): number {
  const longSide = Math.max(width, height);
  return longSide <= cap ? 1 : cap / longSide;
}

export interface LoadedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

/** Decode a File/Blob into an ImageBitmap at original resolution. */
export async function loadImage(file: Blob): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

/** Draw the bitmap at `scale` and return its RGBA pixels for analysis. */
export function getScaledRGBA(
  bitmap: ImageBitmap,
  scale: number
): { rgba: Uint8ClampedArray; width: number; height: number } {
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { rgba: data, width, height };
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run tests/io/imageLoader.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/io/imageLoader.ts tests/io/imageLoader.test.ts
git commit -m "feat: image loader + analysis scale helper"
```

---

### Task 8: Overlay renderer + exporter

**Files:**
- Create: `src/render/overlay.ts`, `src/render/exporter.ts`
- Test: `tests/render/overlay.test.ts`

The overlay drawing is pure given a CanvasRenderingContext2D-like interface; test the geometry decisions via a recording mock.

- [ ] **Step 1: Write failing test for drawStroke geometry**

Create `tests/render/overlay.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { strokeRects } from "../../src/render/overlay";
import { makeStroke } from "../../src/engine/types";

describe("strokeRects", () => {
  it("yields a rect per snapped segment using thickness + x-range", () => {
    const s = makeStroke({
      color: "#ff0",
      segments: [{ kind: "snapped", lineId: 0, x0: 10, x1: 90, y: 50, thickness: 20 }],
    });
    const rects = strokeRects(s);
    expect(rects).toEqual([{ x: 10, y: 40, w: 80, h: 20 }]);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npx vitest run tests/render/overlay.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement overlay**

Create `src/render/overlay.ts`:
```ts
import type { Stroke } from "../engine/types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectangles for the snapped segments of a stroke (band = thickness tall). */
export function strokeRects(stroke: Stroke): Rect[] {
  const rects: Rect[] = [];
  for (const seg of stroke.segments) {
    if (seg.kind === "snapped") {
      rects.push({ x: seg.x0, y: seg.y - seg.thickness / 2, w: seg.x1 - seg.x0, h: seg.thickness });
    }
  }
  return rects;
}

/** Draw all strokes onto a 2D context using multiply blend (marker look). */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  for (const stroke of strokes) {
    ctx.globalAlpha = stroke.opacity;
    ctx.fillStyle = stroke.color;
    ctx.strokeStyle = stroke.color;
    for (const seg of stroke.segments) {
      if (seg.kind === "snapped") {
        ctx.fillRect(seg.x0, seg.y - seg.thickness / 2, seg.x1 - seg.x0, seg.thickness);
      } else {
        ctx.lineWidth = seg.thickness;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        seg.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run tests/render/overlay.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement exporter (no unit test; DOM/canvas integration)**

Create `src/render/exporter.ts`:
```ts
import type { Stroke } from "../engine/types";
import { drawStrokes } from "./overlay";

export type ExportFormat = "png" | "jpeg";

/** Flatten image + strokes at original resolution and download. */
export async function exportImage(
  bitmap: ImageBitmap,
  strokes: Stroke[],
  format: ExportFormat,
  filename = "highlighted"
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  drawStrokes(ctx, strokes);
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), mime, format === "jpeg" ? 0.92 : undefined)
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${format === "png" ? "png" : "jpg"}`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/render tests/render
git commit -m "feat: overlay renderer (multiply blend) + PNG/JPEG exporter"
```

---

### Task 9: React UI shell + wiring hook

**Files:**
- Create: `src/ui/useHighlighter.ts`, `src/ui/Canvas.tsx`, `src/ui/Toolbar.tsx`
- Modify: `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Implement the orchestration hook**

Create `src/ui/useHighlighter.ts`:
```ts
import { useCallback, useMemo, useRef, useState } from "react";
import { HighlightModel } from "../engine/highlightModel";
import { StrokeBuilder } from "../engine/strokeBuilder";
import { pickStroke } from "../engine/eraser";
import { loadImage, getScaledRGBA, analysisScale, type LoadedImage } from "../io/imageLoader";
import { exportImage, type ExportFormat } from "../render/exporter";
import type { Point, Stroke, TextMap } from "../engine/types";

export type Tool = "highlight" | "erase";

export function useHighlighter() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [textMap, setTextMap] = useState<TextMap>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState("#ffe14d");
  const [opacity, setOpacity] = useState(0.4);
  const [tool, setTool] = useState<Tool>("highlight");
  const [preview, setPreview] = useState<Stroke | null>(null);

  const modelRef = useRef(new HighlightModel());
  const builderRef = useRef<StrokeBuilder | null>(null);

  const sync = useCallback(() => setStrokes([...modelRef.current.strokes]), []);

  const open = useCallback(async (file: Blob) => {
    const img = await loadImage(file);
    setImage(img);
    const scale = analysisScale(img.width, img.height);
    const { rgba, width, height } = getScaledRGBA(img.bitmap, scale);
    const worker = new Worker(new URL("../worker/analyze.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ textMap: TextMap }>) => {
      setTextMap(e.data.textMap);
      worker.terminate();
    };
    worker.postMessage({ rgba, width, height, scale }, [rgba.buffer]);
  }, []);

  const pointerDown = useCallback((p: Point) => {
    if (tool === "erase") {
      const id = pickStroke(modelRef.current.strokes, p);
      if (id) { modelRef.current.remove(id); sync(); }
      return;
    }
    builderRef.current = new StrokeBuilder(textMap, color, opacity, { maxDist: 24, hysteresis: 8, defaultThickness: 14 });
    builderRef.current.down(p);
    setPreview(builderRef.current.preview());
  }, [tool, textMap, color, opacity, sync]);

  const pointerMove = useCallback((p: Point) => {
    if (!builderRef.current) return;
    builderRef.current.move(p);
    setPreview({ ...builderRef.current.preview() });
  }, []);

  const pointerUp = useCallback(() => {
    if (!builderRef.current) return;
    modelRef.current.add(builderRef.current.finish());
    builderRef.current = null;
    setPreview(null);
    sync();
  }, [sync]);

  const undo = useCallback(() => { modelRef.current.undo(); sync(); }, [sync]);
  const redo = useCallback(() => { modelRef.current.redo(); sync(); }, [sync]);

  const save = useCallback((format: ExportFormat) => {
    if (image) exportImage(image.bitmap, modelRef.current.strokes, format);
  }, [image]);

  const renderStrokes = useMemo(() => (preview ? [...strokes, preview] : strokes), [strokes, preview]);

  return {
    image, textMap, strokes: renderStrokes, color, setColor, opacity, setOpacity,
    tool, setTool, open, pointerDown, pointerMove, pointerUp, undo, redo, save,
  };
}
```

- [ ] **Step 2: Implement the Canvas component**

Create `src/ui/Canvas.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { drawStrokes } from "../render/overlay";
import type { LoadedImage } from "../io/imageLoader";
import type { Point, Stroke } from "../engine/types";

interface Props {
  image: LoadedImage | null;
  strokes: Stroke[];
  onDown: (p: Point) => void;
  onMove: (p: Point) => void;
  onUp: () => void;
}

export function Canvas({ image, strokes, onDown, onMove, onUp }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !image) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image.bitmap, 0, 0);
    drawStrokes(ctx, strokes);
  }, [image, strokes]);

  const toImageCoords = (e: React.PointerEvent): Point => {
    const rect = ref.current!.getBoundingClientRect();
    const sx = ref.current!.width / rect.width;
    const sy = ref.current!.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  if (!image) return null;

  return (
    <canvas
      ref={ref}
      className="hl-canvas"
      onPointerDown={(e) => { drawing.current = true; ref.current!.setPointerCapture(e.pointerId); onDown(toImageCoords(e)); }}
      onPointerMove={(e) => { if (drawing.current) onMove(toImageCoords(e)); }}
      onPointerUp={() => { drawing.current = false; onUp(); }}
    />
  );
}
```

- [ ] **Step 3: Implement the Toolbar component**

Create `src/ui/Toolbar.tsx`:
```tsx
import type { ExportFormat } from "../render/exporter";
import type { Tool } from "./useHighlighter";

const SWATCHES = ["#ffe14d", "#ff9ecb", "#9cff8f", "#8fd3ff", "#d6a3ff"];

interface Props {
  color: string;
  setColor: (c: string) => void;
  opacity: number;
  setOpacity: (o: number) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  onOpen: (file: File) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: (f: ExportFormat) => void;
  hasImage: boolean;
}

export function Toolbar(p: Props) {
  return (
    <div className="toolbar">
      <label className="btn">
        Open
        <input type="file" accept="image/*" hidden
          onChange={(e) => e.target.files?.[0] && p.onOpen(e.target.files[0])} />
      </label>
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button key={c} className={"swatch" + (c === p.color ? " active" : "")}
            style={{ background: c }} onClick={() => p.setColor(c)} aria-label={c} />
        ))}
        <input type="color" value={p.color} onChange={(e) => p.setColor(e.target.value)} />
      </div>
      <label className="opacity">
        Opacity
        <input type="range" min={0.1} max={1} step={0.05} value={p.opacity}
          onChange={(e) => p.setOpacity(Number(e.target.value))} />
      </label>
      <button className={"btn" + (p.tool === "highlight" ? " active" : "")} onClick={() => p.setTool("highlight")}>Highlight</button>
      <button className={"btn" + (p.tool === "erase" ? " active" : "")} onClick={() => p.setTool("erase")}>Erase</button>
      <button className="btn" onClick={p.onUndo} disabled={!p.hasImage}>Undo</button>
      <button className="btn" onClick={p.onRedo} disabled={!p.hasImage}>Redo</button>
      <button className="btn" onClick={() => p.onSave("png")} disabled={!p.hasImage}>Save PNG</button>
      <button className="btn" onClick={() => p.onSave("jpeg")} disabled={!p.hasImage}>Save JPEG</button>
    </div>
  );
}
```

- [ ] **Step 4: Wire App.tsx**

Replace `src/App.tsx`:
```tsx
import { useEffect } from "react";
import { Toolbar } from "./ui/Toolbar";
import { Canvas } from "./ui/Canvas";
import { useHighlighter } from "./ui/useHighlighter";
import "./index.css";

export default function App() {
  const h = useHighlighter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? h.redo() : h.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [h]);

  return (
    <div className="app">
      <Toolbar
        color={h.color} setColor={h.setColor}
        opacity={h.opacity} setOpacity={h.setOpacity}
        tool={h.tool} setTool={h.setTool}
        onOpen={h.open} onUndo={h.undo} onRedo={h.redo} onSave={h.save}
        hasImage={!!h.image}
      />
      <div className="stage"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) h.open(f); }}
      >
        {h.image ? (
          <Canvas image={h.image} strokes={h.strokes}
            onDown={h.pointerDown} onMove={h.pointerMove} onUp={h.pointerUp} />
        ) : (
          <div className="empty">Drop an image here, paste, or click Open</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add paste support + styles**

Append to `src/App.tsx` the paste handler inside the existing `useEffect` (or a second effect):
```tsx
// inside App(), add another effect:
useEffect(() => {
  const onPaste = (e: ClipboardEvent) => {
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) h.open(file);
  };
  window.addEventListener("paste", onPaste);
  return () => window.removeEventListener("paste", onPaste);
}, [h]);
```

Replace `src/index.css`:
```css
* { box-sizing: border-box; }
body, html, #root { margin: 0; height: 100%; }
.app { display: flex; flex-direction: column; height: 100vh; font-family: system-ui, sans-serif; }
.toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: #1e1e22; color: #eee; flex-wrap: wrap; }
.toolbar .btn { background: #33333a; color: #eee; border: 1px solid #4a4a52; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
.toolbar .btn.active { background: #5b5bd6; border-color: #7b7bf0; }
.toolbar .btn:disabled { opacity: 0.4; cursor: default; }
.swatches { display: flex; align-items: center; gap: 6px; }
.swatch { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
.swatch.active { border-color: #fff; }
.opacity { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.stage { flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; background: #2b2b30; padding: 20px; }
.hl-canvas { max-width: 100%; max-height: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.4); cursor: crosshair; touch-action: none; background: #fff; }
.empty { color: #999; border: 2px dashed #555; border-radius: 12px; padding: 60px 40px; }
```

- [ ] **Step 6: Run full test suite + typecheck + build**

Run: `npm test && npx tsc -b`
Expected: all tests pass, no type errors.

- [ ] **Step 7: Manual smoke check**

Run: `npm run dev`, open the URL, load a screenshot of text, drag across a line (snaps), drag in a blank area (freeform), erase, undo/redo, Save PNG.
Expected: highlights track lines; export downloads a flattened image.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: React UI shell, canvas interaction, toolbar, paste/drop, shortcuts"
```

---

### Task 10: Debug overlay (dev-only) + polish

**Files:**
- Create: `src/ui/DebugOverlay.tsx`
- Modify: `src/ui/Canvas.tsx` (draw debug boxes when enabled)

- [ ] **Step 1: Add a `?debug` flag reader and box rendering**

In `src/ui/Canvas.tsx`, add a prop `debug?: boolean` and after `drawStrokes(...)`:
```tsx
if (debug) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,0,0,0.7)";
  ctx.lineWidth = 1;
  for (const ln of textMap) ctx.strokeRect(ln.x, ln.y, ln.w, ln.h);
  ctx.restore();
}
```
Pass `textMap` and `debug` from `App` (read `new URLSearchParams(location.search).has("debug")`).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc -b && npm run build`
Expected: clean build to `dist/`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: dev-only TextMap debug overlay (?debug)"
```

---

## Self-Review Notes

- **Spec coverage:** image I/O (T7), TextMap analyzer incl. binarize/projection/line+word boxes (T3), worker + GPU-detect/CPU fallback (T6), snapping w/ hysteresis + always-draw fallback (T4), highlight model w/ undo/redo + eraser + multi-color (T5), multiply-blend render + PNG/JPEG export (T8), React UI w/ color picker/opacity/shortcuts/paste/drop (T9), invisible detection + dev debug overlay (T10). RTL handled implicitly by row-band detection (no direction logic). Skew: deferred (noted below).
- **Deferred from spec (acceptable for v1):** adaptive/Sauvola binarization and skew estimation are stubbed by Otsu + axis-aligned projection — robust for screenshots and clean scans, the primary targets. Add as a follow-up if a real skewed scan misbehaves (the `?debug` overlay reveals it). Real WebGPU compute shader is behind the `grayscale()` seam, swappable without API changes.
- **Type consistency:** `TextMap`/`LineBox`/`Stroke`/`Segment` defined once in `types.ts`; all modules import from there. `makeLineBox`/`makeStroke` factories used consistently.
