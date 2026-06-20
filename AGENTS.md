# Agent Instructions

This repository (Easy Highlighter) is a client-side Computer Vision engine paired with a React frontend for highlighting text in scanned images. This document is a guide for AI agents (and human developers) on architecture, conventions, and maintenance strategy.

## 🧠 Architectural Overview

### 1. CV Engine (`src/engine/cv/`)

The core of the application. Processes raw JPEGs/PNGs in a Web Worker without OCR.

| File | Purpose |
|------|---------|
| `gpu.ts` | Grayscale conversion (Rec. 601 luma). Contains a WebGPU feature-detect stub that currently falls through to CPU. |
| `binarize.ts` | Otsu's method global thresholding. Produces a binary ink mask. |
| `connectedComponents.ts` | Two-pass 8-way Union-Find on `Int32Array`. Path compression, no recursion. |
| `projection.ts` | Row projection profiles (ink count per row) and horizontal band detection. |
| `lineDetect.ts` | The heuristic engine: RXY-cut layout analysis → horizontal bands → vertical columns → baseline grouping → word segmentation via mathematical dilation. This is the most complex file (~500 lines). |
| `textmap.ts` | Orchestrates the pipeline into `LineBox[]` (the `TextMap` type). |

**Performance rules**: The CV engine relies on single-pass loops and TypedArrays. Do not add O(N²) loops or allocate large dynamic arrays inside hot paths like `baselineGroup` or `segmentWords`.

### 2. Interaction Engine (`src/engine/`)

| File | Purpose |
|------|---------|
| `types.ts` | Shared types: `Point`, `WordBox`, `LineBox`, `TextMap`, `Segment` (Snapped/Freeform/Rect), `Stroke`, `ToolBuilder` interface. |
| `strokeBuilder.ts` | Accumulates pointer input into strokes. Smart mode snaps to lines with hysteresis and hard-lock after a confidence threshold. Manual mode produces freeform polylines. |
| `boxBuilder.ts` | `BoxBuilder` (rectangle) and `ParagraphBuilder` (smart text selector — maps mouse to closest words, selects reading-order range). |
| `eraser.ts` | `pickStroke` (click-to-delete), `subtractSmartStrokes` (geometric interval subtraction for Alt-drag erasing). |
| `snapping.ts` | Distance scoring with vertical reach, horizontal penalty, and hysteresis to prevent cursor jitter. |
| `select.ts` | `lineAt`, `paragraphLines`, `lineStroke`, `paragraphStroke` — factories for click/double-click/triple-click selection. |
| `highlightModel.ts` | Immutable snapshot undo/redo stack. `serialize()`/`deserialize()` for IndexedDB persistence. |

### 3. Rendering (`src/render/`)

| File | Purpose |
|------|---------|
| `overlay.ts` | Groups same-color snapped/rect segments into a single `Path2D`, fills with nonzero winding rule to prevent `multiply` blend from darkening at segment intersections. Freeform segments use round caps/joins. |
| `exporter.ts` | Flattens image + strokes at original resolution. Exports via File System Access API (`showSaveFilePicker`) with fallback to blob download. PNG, JPEG (0.92), WebP (0.92). |

**Rendering invariant**: A single continuous highlight must not visually darken itself at segment intersections. Any changes to `overlay.ts` must preserve this.

### 4. Persistence (`src/io/`)

| File | Purpose |
|------|---------|
| `db.ts` | IndexedDB wrapper (`easy_highlighter_db`). Simple `get`/`set` key-value store. |
| `imageLoader.ts` | `loadImage` (File → ImageBitmap), `analysisScale` (cap long side at 2000px), `getScaledRGBA` (off-screen canvas), `hashFile` (SHA-256). |

State is persisted under key `app_state` with a `version` field (currently `"0.0.1"`). Includes: brush settings, tool, recent colors, highlight model (with full undo stack), the CV textMap, and the original image blob.

### 5. UI (`src/ui/`)

| File | Purpose |
|------|---------|
| `useHighlighter.ts` | Central state hook. Manages all app state, pointer event routing to tool builders, auto-save, dirty tracking, double/triple-click logic. |
| `useViewport.ts` | Figma-style viewport: pinch/Ctrl-wheel zoom toward cursor (rAF-smoothed easing, 10%–1600%), scroll-to-pan, Space-drag, fit-to-view. |
| `Canvas.tsx` | Three-layer canvas stack: base (committed strokes), preview (in-progress), overlay (hover/debug). |
| `Toolbar.tsx` | Tool buttons, color swatches, sliders, zoom controls, export dropdown. |
| `ColorPicker.tsx` | HSV color picker popover with SV plane, hue slider, hex input, recent colors. |
| `Help.tsx` | Keyboard shortcut reference overlay (toggled with `?`). |
| `zoom.ts` | Pure zoom math: pinch-vs-wheel detection, deltaMode normalization, sensitivity tuning. |
| `color.ts` | HSV ↔ RGB ↔ Hex conversions (pure functions). |
| `icons.tsx` | SVG icon components for toolbar. |

### 6. Theming

CSS custom properties are defined in `index.css` on `:root` with dark-mode defaults and a `@media (prefers-color-scheme: light)` override block. The app follows system preferences automatically. All UI surfaces, including inline-styled modals in `App.tsx`, reference `var(--*)` tokens.

## 🛠 Maintenance & Future Improvements

### 1. Computer Vision Enhancements
- **WebGPU Porting**: `binarize.ts` runs on the CPU. The next milestone is migrating thresholding and connected components to WebGPU (`gpu.ts`) for instant processing of 4K+ scans.
- **Skew Correction**: Hough Transform to detect page rotation and de-skew text lines.
- **Handling Edge Cases**: If the algorithm fractures lines or columns, tune heuristic thresholds in `lineDetect.ts` (e.g., `gutterMinFactor`, `bandGapFactor`). Avoid excessive complexity; rely on geometric statistics.

### 2. Testing (Vitest + Playwright)
- Before committing any changes to the CV engine, you **must** run `npm test`.
- Mock `TextMap` and mock line bounding boxes in `tests/engine/` test intersection and snapping logic.
- Real PNG integration tests live in `tests/engine/cv/ingestion.test.ts`.
- E2E tests via Playwright: `npm run test:e2e`.
- If you modify `ParagraphBuilder`, `StrokeBuilder`, or snapping logic, update corresponding tests.

### 3. Agent Sub-Tasking Strategy
- The CV engine is strictly mathematical; the React frontend is visual. Use `invoke_subagent` to split work across these domains.
- E.g., one subagent fixes React state bugs while another optimizes the Union-Find algorithm.

## 📜 Coding Rules

<RULE[easy_highlighter]>
- **Types**: Maintain strict TypeScript typing. Do not use `any`. Add TSDocs to any newly created heuristic functions in the CV engine to explain the mathematical rationale.
- **Performance**: In the `cv` directory, prioritize `Int32Array` or `Float32Array` over standard JS arrays for pixel or bounding-box manipulation to prevent GC spikes.
- **Rendering**: Any changes to marker overlapping logic in `overlay.ts` must maintain the invariant that a single continuous highlight does not visually darken itself at segment intersections.
- **Imports**: Use standard ES module syntax. Avoid adding external dependencies for math or computer vision; keep the bundle lean and dependency-free.
- **Persistence**: When changing the shape of persisted state, bump the `version` field in the `app_state` object and add a migration path or graceful fallback for older versions.
- **Theming**: All new UI colors must use CSS custom properties from `index.css`. Do not introduce hardcoded color values. Inline styles in React components should reference `var(--*)` tokens.
</RULE[easy_highlighter]>
