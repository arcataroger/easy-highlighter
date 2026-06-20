import { useCallback, useMemo, useRef, useState } from "react";
import { HighlightModel } from "../engine/highlightModel";
import { StrokeBuilder } from "../engine/strokeBuilder";
import { BoxBuilder, ParagraphBuilder } from "../engine/boxBuilder";
import { pickStroke } from "../engine/eraser";
import { snap } from "../engine/snapping";
import { lineAt, paragraphLines, lineStroke, paragraphStroke } from "../engine/select";
import type { HoverPreview } from "../render/overlay";
import {
  loadImage,
  getScaledRGBA,
  analysisScale,
  type LoadedImage,
} from "../io/imageLoader";
import { exportImage, type ExportFormat } from "../render/exporter";
import type { Point, Rect, Stroke, TextMap, ToolBuilder } from "../engine/types";

export type Tool = "smart" | "manual" | "smart-box" | "box" | "erase";

const MAX_RECENT = 8;

function createBuilder(
  tool: Tool,
  map: TextMap,
  color: string,
  opacity: number,
  thickness: number
): ToolBuilder | null {
  switch (tool) {
    case "smart":
      return new StrokeBuilder(map, color, opacity, {
        maxDist: 24,
        hysteresis: 8,
        defaultThickness: 14,
        stickDistance: 28,
        stickSamples: 5,
      });
    case "manual":
      return new StrokeBuilder(map, color, opacity, {
        tracking: false,
        defaultThickness: thickness,
      });
    case "box":
      return new BoxBuilder(color, opacity);
    case "smart-box":
      return new ParagraphBuilder(map, color, opacity);
    default:
      return null;
  }
}

/** Builders that expose a drag rectangle (box / paragraph) for the marquee. */
function builderBox(b: ToolBuilder): Rect | null {
  const maybe = b as { currentBox?: () => Rect };
  return typeof maybe.currentBox === "function" ? maybe.currentBox() : null;
}

export function useHighlighter() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [textMap, setTextMap] = useState<TextMap>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColorState] = useState("#ffe14d");
  const [opacity, setOpacity] = useState(0.4);
  const [thickness, setThickness] = useState(16);
  const [tool, setTool] = useState<Tool>("smart");
  const [preview, setPreview] = useState<Stroke | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  const modelRef = useRef(new HighlightModel());
  const builderRef = useRef<ToolBuilder | null>(null);
  const textMapRef = useRef<TextMap>([]);
  const downRef = useRef<Point | null>(null);
  const movedRef = useRef(false);
  const clickRef = useRef<{ count: number; time: number; x: number; y: number }>({
    count: 0,
    time: 0,
    x: 0,
    y: 0,
  });
  const autoSelectIdRef = useRef<string | null>(null);

  const sync = useCallback(() => setStrokes([...modelRef.current.strokes]), []);

  const pushRecent = useCallback((c: string) => {
    setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, MAX_RECENT));
  }, []);

  const setColor = useCallback(
    (c: string) => {
      setColorState(c);
      pushRecent(c);
    },
    [pushRecent]
  );

  const open = useCallback(async (file: Blob) => {
    const img = await loadImage(file);
    setImage(img);
    modelRef.current = new HighlightModel();
    setStrokes([]);
    setTextMap([]);
    textMapRef.current = [];
    setAnalyzing(true);
    const scale = analysisScale(img.width, img.height);
    const { rgba, width, height } = getScaledRGBA(img.bitmap, scale);
    const worker = new Worker(
      new URL("../worker/analyze.worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = (e: MessageEvent<{ textMap: TextMap }>) => {
      setTextMap(e.data.textMap);
      textMapRef.current = e.data.textMap;
      setAnalyzing(false);
      worker.terminate();
    };
    worker.postMessage({ rgba, width, height, scale }, [rgba.buffer]);
  }, []);

  const pointerDown = useCallback(
    (p: Point) => {
      if (tool === "erase") {
        const id = pickStroke(modelRef.current.strokes, p);
        if (id) {
          modelRef.current.remove(id);
          sync();
        }
        return;
      }
      const b = createBuilder(tool, textMapRef.current, color, opacity, thickness);
      if (!b) return;
      builderRef.current = b;
      downRef.current = p;
      movedRef.current = false;
      b.down(p);
      setPreview({ ...b.preview() });
      setMarquee(builderBox(b));
      setHover(null);
    },
    [tool, color, opacity, thickness, sync]
  );

  const pointerMove = useCallback((p: Point) => {
    const b = builderRef.current;
    if (!b) return;
    const d = downRef.current;
    if (!movedRef.current && d && Math.hypot(p.x - d.x, p.y - d.y) > 4) {
      movedRef.current = true;
    }
    b.move(p);
    setPreview({ ...b.preview() });
    setMarquee(builderBox(b));
  }, []);

  // Double-click selects the current line, triple-click the paragraph (smart only).
  const handleClick = useCallback(
    (p: Point) => {
      if (tool !== "smart") return;
      const now = performance.now();
      const c = clickRef.current;
      const near = Math.hypot(p.x - c.x, p.y - c.y) < 14;
      if (c.count > 0 && now - c.time < 450 && near) {
        c.count += 1;
      } else {
        c.count = 1;
        autoSelectIdRef.current = null;
      }
      c.time = now;
      c.x = p.x;
      c.y = p.y;

      const map = textMapRef.current;
      if (c.count === 2) {
        const line = lineAt(map, p, 40);
        if (line) {
          const s = lineStroke(line, color, opacity);
          modelRef.current.add(s);
          autoSelectIdRef.current = s.id;
          pushRecent(color);
          sync();
        }
      } else if (c.count >= 3) {
        const line = lineAt(map, p, 40);
        const lines = line ? paragraphLines(map, line.id) : [];
        if (lines.length) {
          if (autoSelectIdRef.current) modelRef.current.remove(autoSelectIdRef.current);
          const s = paragraphStroke(lines, color, opacity);
          modelRef.current.add(s);
          autoSelectIdRef.current = s.id;
          pushRecent(color);
          sync();
        }
      }
    },
    [tool, color, opacity, pushRecent, sync]
  );

  const pointerUp = useCallback(() => {
    const b = builderRef.current;
    if (!b) return;
    builderRef.current = null;
    if (movedRef.current) {
      const stroke = b.finish();
      if (stroke.segments.length > 0) {
        modelRef.current.add(stroke);
        pushRecent(stroke.color);
      }
      sync();
    } else if (downRef.current) {
      handleClick(downRef.current);
    }
    setPreview(null);
    setMarquee(null);
  }, [sync, pushRecent, handleClick]);

  const undo = useCallback(() => {
    modelRef.current.undo();
    sync();
  }, [sync]);
  const redo = useCallback(() => {
    modelRef.current.redo();
    sync();
  }, [sync]);

  const save = useCallback(
    (format: ExportFormat) => {
      if (image) exportImage(image.bitmap, modelRef.current.strokes, format);
    },
    [image]
  );

  // Where the highlight would land if the user pressed and dragged from here.
  const hoverPreview = useMemo<HoverPreview | null>(() => {
    if (!hover || (tool !== "smart" && tool !== "manual")) return null;
    if (tool === "manual") {
      return { caret: { x: hover.x, y: hover.y, h: thickness }, band: null, color };
    }
    const r = snap(textMap, hover, { lockedLineId: null }, { maxDist: 24, hysteresis: 8 });
    if (r.snapped) {
      const line = textMap.find((l) => l.id === r.lineId);
      const lineRight = line ? line.x + line.w : hover.x;
      // The underline (preview) snaps to the line; the caret does NOT — it stays
      // at the true cursor position so the pointer is never hijacked. The caret
      // height still reflects the brush size that would be applied.
      const ux = line ? Math.max(line.x, Math.min(lineRight, hover.x)) : hover.x;
      return {
        caret: { x: hover.x, y: hover.y, h: r.thickness! },
        band: { x0: ux, x1: lineRight, y: r.y!, h: r.thickness! },
        color,
      };
    }
    return { caret: { x: hover.x, y: hover.y, h: 14 }, band: null, color };
  }, [hover, tool, textMap, color, thickness]);

  return {
    image,
    textMap,
    analyzing,
    strokes,
    preview,
    hoverPreview,
    setHover,
    marquee,
    color,
    setColor,
    opacity,
    setOpacity,
    thickness,
    setThickness,
    recent,
    tool,
    setTool,
    open,
    pointerDown,
    pointerMove,
    pointerUp,
    undo,
    redo,
    save,
  };
}
