> **Made with AI (Claude) under human supervision.**

# Easy Highlighter

A high-performance, 100% client-side web application for highlighting text in scanned documents, photos, and images of text — no OCR, no servers, no APIs.

Unlike traditional PDF highlighters that need embedded text layers, or modern solutions that depend on cloud-based OCR, Easy Highlighter uses a custom Computer Vision engine running entirely in the browser. It detects text lines and words on the fly, letting you highlight raw JPEGs and PNGs as naturally as a digital document.

https://github.com/user-attachments/assets/6021a5b5-42e2-44d8-bdc8-2e63c98947cf

## Features

### Highlighting Tools
- **Smart Mode** — Automatically snaps to text baselines and word boundaries. Click and drag across a paragraph to select words in reading order. Double-click to highlight a line; triple-click for a paragraph.
- **Manual Mode** — Freeform highlighter with adjustable thickness (4–80px) for images where the CV engine can't detect text.
- **Box Mode** — Drag to draw rectangular highlights.
- **Eraser** — Click any stroke to delete it. In Smart mode, hold Alt/Option and drag to precisely subtract a region from existing highlights.

### Editing & Export
- **Undo/Redo** — Full history stack with Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.
- **Color Picker** — 5 preset swatches, a full HSV picker with hex input, and a recent colors palette (up to 8).
- **Opacity & Size** — Adjustable opacity slider and thickness ramp (Manual mode).
- **Export** — Save highlighted images as PNG, JPEG, or WebP with marker blend modes baked in. Uses the File System Access API where available.

### Viewport
- **Figma-style Navigation** — Pinch or Ctrl+scroll to zoom toward cursor (rAF-smoothed easing, 10%–1600%). Scroll to pan. Space+drag or middle-mouse for hand tool. Press `0` to fit.
- **Drag & Drop / Paste** — Drop an image file onto the canvas or paste from clipboard.

### Quality of Life
- **Auto-Save** — Full session state (image, strokes, undo stack, brush settings, CV results) persisted to IndexedDB. Refresh and pick up exactly where you left off.
- **Unsaved Changes Warning** — Prompts before opening a new image if you have unexported highlights.
- **Light & Dark Mode** — Follows system preferences automatically via `prefers-color-scheme`.
- **Debug Grid** — Toggle with `.` to visualize the CV engine's detected lines (red) and words (blue).
- **Help Overlay** — Press `?` for a complete shortcut reference.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + S` | Export |
| `-` / `=` | Zoom out / in |
| `0` | Fit to screen |
| `.` | Toggle debug overlay |
| `?` | Toggle help |
| `Space` (hold) | Temporary pan mode |
| `Alt/Option` (hold) | Eraser mode (Smart tool) |

## Architecture

```
src/
├── engine/cv/        # Computer Vision pipeline (runs in Web Worker)
│   ├── binarize.ts       # Otsu's method thresholding
│   ├── gpu.ts            # Grayscale conversion (Rec. 601 luma)
│   ├── connectedComponents.ts  # Two-pass 8-way Union-Find on TypedArrays
│   ├── projection.ts     # Row projection profiles for band detection
│   ├── lineDetect.ts     # RXY-cut layout analysis, baseline grouping, word segmentation
│   └── textmap.ts        # Orchestrates the pipeline into TextMap
├── engine/           # Interaction tools
│   ├── strokeBuilder.ts  # Smart (snapped) and manual (freeform) stroke accumulation
│   ├── boxBuilder.ts     # Rectangle + paragraph selection builders
│   ├── eraser.ts         # Hit-testing and geometric interval subtraction
│   ├── snapping.ts       # Line-distance scoring with hysteresis
│   ├── select.ts         # Click/double-click/triple-click selection
│   ├── highlightModel.ts # Immutable snapshot undo/redo stack
│   └── types.ts          # Shared types (Point, Stroke, TextMap, etc.)
├── render/           # Canvas rendering
│   ├── overlay.ts        # Path2D union with nonzero winding (multiply blend)
│   └── exporter.ts       # Flatten + export (PNG/JPEG/WebP)
├── io/               # Persistence & I/O
│   ├── db.ts             # IndexedDB key-value wrapper
│   └── imageLoader.ts    # File → ImageBitmap + SHA-256 hashing
├── ui/               # React components & hooks
│   ├── App.tsx, Canvas.tsx, Toolbar.tsx, Help.tsx, ColorPicker.tsx
│   ├── useHighlighter.ts # Central state management hook
│   ├── useViewport.ts    # Figma-style zoom/pan viewport
│   ├── zoom.ts, color.ts, icons.tsx
└── worker/
    └── analyze.worker.ts # Web Worker entry point for CV pipeline
```

## Computer Vision Approach

Easy Highlighter intentionally avoids OCR neural networks. OCR is often too slow for real-time interaction and provides character identities ("A", "b", "c") that aren't needed for visual highlighting. Instead, we use a purely geometric approach:

1. **Grayscale** — Rec. 601 luma conversion
2. **Binarization** — Otsu's method (global threshold maximizing between-class variance)
3. **Connected Components** — Two-pass Union-Find with 8-way connectivity and path compression on `Int32Array`
4. **Typographic Filtering** — Reject blobs that are too large (images/figures), too elongated (horizontal rules), or too small (speckle) based on page-level median statistics
5. **Layout Analysis** — RXY-cut family algorithm: detect horizontal whitespace rivers (bands), then vertical gutters (columns)
6. **Word & Line Assembly** — Baseline grouping with running-mean alignment, then word segmentation via mathematical dilation (statistical gap analysis with kern/space threshold and fuzzy zone)

<img width="1806" height="1610" alt="2026-06-19-000234" src="https://github.com/user-attachments/assets/88948713-ed47-4b88-b17c-c15f6dd59a09" />

## Getting Started

### Prerequisites
- Node.js v18+
- npm

### Installation

```bash
git clone <repo-url>
cd easy-highlighter
npm install
npm run dev
```

### Testing

```bash
npm test              # Unit + integration tests (Vitest)
npm run test:e2e      # End-to-end tests (Playwright)
```

## Future Work

- **WebGPU Acceleration** — Porting binarization and connected components to WGSL compute shaders for instant processing of 4K+ scans.
- **Skew Correction** — Hough Transform to detect page rotation and de-skew text lines before bounding boxes are calculated.

## Acknowledgments

The word segmentation algorithm in `lineDetect.ts` combines ideas from two foundational open-source projects:

- **[Tesseract OCR](https://github.com/tesseract-ocr/tesseract)** (`textord` module, `tospace.cpp`, `wordseg.cpp`) — Statistical gap thresholding: building per-line histograms of small vs. large gaps to derive `kern_size` and `space_size`, using their midpoint as the word-break threshold, and contextual overrides in the "fuzzy zone" near the threshold (suppressing breaks next to narrow characters, promoting breaks next to wide characters).

- **[Leptonica](https://github.com/DanBloomberg/leptonica)** (`morphapp.c`, `pixWordMaskByDilation`) — The concept of horizontal dilation to merge intra-word characters into single blobs. We apply this principle mathematically (expanding bounding boxes by a gap threshold) rather than operating on pixel data, achieving the same robustness without the performance cost of image-level morphology.

The binarization step uses **Otsu's method** (Nobuyuki Otsu, "A Threshold Selection Method from Gray-Level Histograms", 1979). Connected component labeling uses a standard **two-pass Union-Find** algorithm with path compression. Layout analysis follows the **RXY-cut** family of recursive top-down document segmentation.

All algorithms are implemented from scratch in TypeScript — no external CV or math libraries are used at runtime.

## License

This project is released into the public domain under the [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) license.

To the extent possible under law, the author(s) have dedicated all copyright and related and neighboring rights to this software to the public domain worldwide. You can copy, modify, distribute, and perform the work, even for commercial purposes, all without asking permission.
