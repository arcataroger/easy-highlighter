import { useCallback, useMemo, useRef, useState } from "react";
import { HighlightModel } from "../engine/highlightModel";
import { StrokeBuilder } from "../engine/strokeBuilder";
import { BoxBuilder, ParagraphBuilder } from "../engine/boxBuilder";
import { pickStroke } from "../engine/eraser";
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
  const [analyzing, setAnalyzing] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  const modelRef = useRef(new HighlightModel());
  const builderRef = useRef<ToolBuilder | null>(null);
  const textMapRef = useRef<TextMap>([]);

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
      b.down(p);
      setPreview({ ...b.preview() });
      setMarquee(builderBox(b));
    },
    [tool, color, opacity, thickness, sync]
  );

  const pointerMove = useCallback((p: Point) => {
    const b = builderRef.current;
    if (!b) return;
    b.move(p);
    setPreview({ ...b.preview() });
    setMarquee(builderBox(b));
  }, []);

  const pointerUp = useCallback(() => {
    const b = builderRef.current;
    if (!b) return;
    const stroke = b.finish();
    if (stroke.segments.length > 0) {
      modelRef.current.add(stroke);
      pushRecent(stroke.color);
    }
    builderRef.current = null;
    setPreview(null);
    setMarquee(null);
    sync();
  }, [sync, pushRecent]);

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

  const renderStrokes = useMemo(
    () => (preview ? [...strokes, preview] : strokes),
    [strokes, preview]
  );

  return {
    image,
    textMap,
    analyzing,
    strokes: renderStrokes,
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
