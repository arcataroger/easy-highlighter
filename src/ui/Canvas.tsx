import { useEffect, useRef } from "react";
import { drawStrokes } from "../render/overlay";
import type { LoadedImage } from "../io/imageLoader";
import type { Point, Rect, Stroke, TextMap } from "../engine/types";

export type CursorKind = "smart" | "manual" | "smart-box" | "box" | "erase" | "pan";

interface Props {
  image: LoadedImage;
  strokes: Stroke[];
  textMap: TextMap;
  marquee: Rect | null;
  debug?: boolean;
  cursor: CursorKind;
  panMode: boolean;
  onDown: (p: Point) => void;
  onMove: (p: Point) => void;
  onUp: () => void;
  onPanStart: (clientX: number, clientY: number) => void;
}

export function Canvas({
  image,
  strokes,
  textMap,
  marquee,
  debug,
  cursor,
  panMode,
  onDown,
  onMove,
  onUp,
  onPanStart,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image.bitmap, 0, 0);
    drawStrokes(ctx, strokes);

    if (debug) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,0,0,0.7)";
      ctx.lineWidth = 1;
      for (const ln of textMap) ctx.strokeRect(ln.x, ln.y, ln.w, ln.h);
      ctx.restore();
    }

    if (marquee) {
      ctx.save();
      ctx.strokeStyle = "rgba(40,40,60,0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h);
      ctx.restore();
    }
  }, [image, strokes, textMap, marquee, debug]);

  const toImageCoords = (e: React.PointerEvent): Point => {
    const rect = ref.current!.getBoundingClientRect();
    const sx = ref.current!.width / rect.width;
    const sy = ref.current!.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  return (
    <canvas
      ref={ref}
      className="hl-canvas"
      data-cursor={cursor}
      onPointerDown={(e) => {
        if (e.button === 1 || panMode) {
          onPanStart(e.clientX, e.clientY);
          return;
        }
        if (e.button !== 0) return;
        drawing.current = true;
        ref.current!.setPointerCapture(e.pointerId);
        onDown(toImageCoords(e));
      }}
      onPointerMove={(e) => {
        if (drawing.current) onMove(toImageCoords(e));
      }}
      onPointerUp={() => {
        if (drawing.current) {
          drawing.current = false;
          onUp();
        }
      }}
    />
  );
}
