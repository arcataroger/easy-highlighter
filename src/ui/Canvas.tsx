import { useEffect, useRef } from "react";
import { drawStrokes } from "../render/overlay";
import type { LoadedImage } from "../io/imageLoader";
import type { Point, Stroke, TextMap } from "../engine/types";

interface Props {
  image: LoadedImage;
  strokes: Stroke[];
  textMap: TextMap;
  debug?: boolean;
  cursor: "highlight" | "erase";
  onDown: (p: Point) => void;
  onMove: (p: Point) => void;
  onUp: () => void;
}

export function Canvas({
  image,
  strokes,
  textMap,
  debug,
  cursor,
  onDown,
  onMove,
  onUp,
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
  }, [image, strokes, textMap, debug]);

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
        drawing.current = true;
        ref.current!.setPointerCapture(e.pointerId);
        onDown(toImageCoords(e));
      }}
      onPointerMove={(e) => {
        if (drawing.current) onMove(toImageCoords(e));
      }}
      onPointerUp={() => {
        drawing.current = false;
        onUp();
      }}
    />
  );
}
