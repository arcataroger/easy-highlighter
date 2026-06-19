# Easy Highlighter — Design Spec

**Date:** 2026-06-19
**Status:** Approved (pending implementation plan)

## Summary

A client-side-only single-page web app that lets a user load an image, highlight
lines of text with a marker that **intelligently snaps to and follows text lines**,
and re-save the result as an image. All processing happens in the browser using the
GPU where it helps and the CPU otherwise. No server, no uploads, no OCR.

The killer feature is the **always-draw, opportunistically-snap** marker: the moment
the user presses the mouse, a highlight begins regardless of content. As they drag,
the app continuously looks for a snappable text line along the drag trajectory. If it
finds one, the stroke snaps to that line's height and baseline and tracks it. If it
doesn't, the freeform stroke is drawn under the cursor anyway. Snapping is always an
enhancement, never a gate.

## Goals

- Load an image (file picker, drag-drop, or paste).
- Highlight text lines with a magnetic, line-tracking marker.
- Handle left-to-right and right-to-left horizontal text identically (line-band
  detection is direction-agnostic).
- Edit: undo/redo, eraser/delete stroke, color picker, multiple colors per image.
- Save the flattened result as PNG or JPEG at original resolution.
- Fast and real-time (60fps interaction) and simple to use.

## Non-Goals (out of scope for v1)

- OCR / text recognition (we detect *structure*, not characters).
- Heavy perspective correction for phone photos of paper/signs (target is digital
  screenshots and flatbed scans, which are axis-aligned or only slightly skewed).
- Vertical scripts (e.g. traditional vertical CJK) — horizontal text only.
- Accounts, cloud storage, collaboration, server-side anything.
- tesseract.js / OCR fallback (may be revisited later as an optional hybrid).

## Target Inputs

- **Screenshots / digital documents** — crisp, high-contrast, axis-aligned text.
- **Scanned documents** — mostly straight, possible slight skew, noise, off-white
  backgrounds.

## Interaction Model (the core feel)

**Magnetic drag, forgiving.** Behaves almost like a text-selection cursor but tolerant:

1. `mousedown` → begin a highlight stroke immediately, no matter what is under the cursor.
2. During drag → continuously scan for a snappable line band along the cursor's
   trajectory, within a vertical distance threshold.
3. Snap found → set stroke thickness = detected line height (with small padding),
   center y on the line, clamp the horizontal range to the drawn extent intersected
   with the line's actual text extent. Track the line as the drag continues.
4. No snap → draw a freeform band under the raw cursor path at a default thickness.
5. **Hysteresis** → once locked to a line, stay locked until the trajectory clearly
   leaves it, to avoid flickering between adjacent lines.
6. `mouseup` → commit the stroke to the highlight model.

Detection is **invisible** to the end user (no guide lines). A hidden developer debug
overlay can visualize the detected TextMap during development; it does not ship enabled.

## Architecture

**Stack:** Vite + React + TypeScript. The canvas/analysis engine is plain TypeScript;
React drives only the UI shell (toolbar, pickers, modals, shortcuts).

**GPU strategy:** Pragmatic. WebGPU/WebGL for the embarrassingly-parallel pixel passes
(grayscale, threshold, row/column projection reductions). The lightweight sequential
structural grouping runs on CPU (it is cheap for document-sized images). Feature-detect
WebGPU and **fall back to a pure-CPU path** (typed arrays) when unavailable, so the app
works in every modern browser.

### Modules

1. **Image I/O**
   - Input via file picker, drag-and-drop, and clipboard paste.
   - Decode to `ImageBitmap`. Display fit-to-viewport on a canvas, but retain the
     original full-resolution bitmap for analysis and export.

2. **TextMap analyzer** (runs once per loaded image, inside a **Web Worker** with
   OffscreenCanvas / WebGPU so the main thread never blocks)
   - Optionally downscale for analysis (cap long side ~2000px); record the scale factor
     to map results back to original coordinates.
   - Grayscale + binarize: Otsu global threshold for clean docs; adaptive (Sauvola-style)
     option for unevenly lit scans.
   - Light skew estimate for scans: compute projection-profile variance over a small
     range of candidate angles, pick the angle of maximum variance; deskew analysis
     coordinates accordingly. Keep the displayed/exported image untouched.
   - **Horizontal projection profile**: sum ink per row → runs of high-ink rows
     separated by gaps become **line bands**. Each band yields top, bottom, height, and
     estimated baseline.
   - Per-band **horizontal projection + run-length smoothing (RLSA)** → word boxes and
     the line's left/right text extent.
   - Output a cached `LineBox[]`, each `{ x, y, w, h, baseline, words: WordBox[] }`,
     in **original-image coordinates**.

3. **Snapping engine** (pure function over TextMap + drag state)
   - Given the current cursor position and recent trajectory, find the nearest line band
     within a vertical threshold along that trajectory.
   - Produce stroke geometry: snapped (lineId + x-range clamped to text extent) or
     freeform (polyline at default thickness).
   - Apply hysteresis to keep a locked line stable.

4. **Highlight model**
   - Ordered list of strokes: `{ id, color, opacity, segments }`.
   - A segment is either a **snapped line-range** (`lineId`, `x0`, `x1`) or a
     **freeform polyline**, all in original-image coordinates → resolution-independent,
     re-renderable at any scale.
   - Undo/redo via a command stack. Eraser via hit-test against stroke geometry, then
     remove. Multiple colors supported per image.

5. **Rendering**
   - Display: canvas draws the image plus the highlight overlay using `multiply`
     composite blend so the underlying text shows through like a real highlighter.
   - Export: re-render the original full-resolution image + all strokes to an offscreen
     canvas, `toBlob` as PNG or JPEG (user choice), trigger download.

6. **UI (React)**
   - Toolbar: color swatches + custom color picker, opacity control, eraser toggle,
     undo/redo, save (PNG/JPEG choice).
   - Canvas area with drop zone and empty state.
   - Keyboard shortcuts (e.g. Cmd/Ctrl+Z undo, Shift+Cmd/Ctrl+Z redo).
   - Hidden debug overlay toggle to visualize the TextMap during development.

## Data Flow

1. User provides image → decoded to `ImageBitmap`, shown on canvas.
2. Worker runs the TextMap analyzer → returns `LineBox[]`, cached in app state.
3. User presses and drags → snapping engine consumes TextMap + drag state → live stroke
   preview rendered each frame.
4. User releases → stroke committed to the highlight model; overlay re-rendered.
5. User edits (undo/redo/erase/recolor) → model mutated → overlay re-rendered.
6. User saves → full-res re-render → PNG/JPEG blob → download.

## Error Handling

- Unsupported / undecodable file → friendly inline message; no crash.
- Very large image → downscale the analysis pass; if extreme, warn but still function.
- WebGPU unavailable → automatic CPU fallback for all pixel passes.
- No text detected → highlighter still works fully in freeform mode.

## Testing Strategy

- **Vitest unit tests** for the CV pipeline against fixture images with known line
  counts and positions (deterministic assertions on `LineBox[]`).
- **Vitest unit tests** for the snapping engine: given a TextMap + a synthetic drag
  trajectory, assert the resulting stroke geometry (snapped range or freeform).
- Engine logic is deliberately extracted from React/canvas so it is testable as pure
  functions. Visual/interaction smoke testing (e.g. Playwright) is optional and out of
  scope for v1.

## Performance Targets

- TextMap analysis: tens of milliseconds for typical document-sized images; never blocks
  the main thread (runs in a worker).
- Interaction: 60fps during drag; snapping is an O(log n)/small-linear lookup over line
  bands.

## Open Questions / Future

- Optional hybrid OCR fallback (tesseract.js) for difficult images.
- Touch / stylus input support.
- Perspective correction for phone photos.
