import { useCallback, useMemo, useRef, useState } from "react";
import { HighlightModel } from "../engine/highlightModel";
import { StrokeBuilder } from "../engine/strokeBuilder";
import { pickStroke } from "../engine/eraser";
import {
  loadImage,
  getScaledRGBA,
  analysisScale,
  type LoadedImage,
} from "../io/imageLoader";
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
  const [analyzing, setAnalyzing] = useState(false);

  const modelRef = useRef(new HighlightModel());
  const builderRef = useRef<StrokeBuilder | null>(null);
  const textMapRef = useRef<TextMap>([]);

  const sync = useCallback(() => setStrokes([...modelRef.current.strokes]), []);

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
      builderRef.current = new StrokeBuilder(textMapRef.current, color, opacity, {
        maxDist: 24,
        hysteresis: 8,
        defaultThickness: 14,
      });
      builderRef.current.down(p);
      setPreview({ ...builderRef.current.preview() });
    },
    [tool, color, opacity, sync]
  );

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
    color,
    setColor,
    opacity,
    setOpacity,
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
