import { useEffect, useRef } from "react";
import { drawStrokes, drawHoverPreview, type HoverPreview } from "../render/overlay";
import type { LoadedImage } from "../io/imageLoader";
import type { Point, Rect, Stroke, TextMap } from "../engine/types";

export type CursorKind = "smart" | "manual" | "smart-box" | "box" | "erase" | "pan";

interface Props {
  image: LoadedImage;
  strokes: Stroke[];
  preview: Stroke | null;
  hoverPreview: HoverPreview | null;
  textMap: TextMap;
  marquee: Rect | null;
  debug?: boolean;
  cursor: CursorKind;
  panMode: boolean;
  onDown: (p: Point) => void;
  onMove: (p: Point) => void;
  onUp: () => void;
  onHover: (p: Point | null) => void;
  onPanStart: (clientX: number, clientY: number) => void;
}

export function Canvas({
  image,
  strokes,
  preview,
  hoverPreview,
  textMap,
  marquee,
  debug,
  cursor,
  panMode,
  onDown,
  onMove,
  onUp,
  onHover,
  onPanStart,
}: Props) {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  // Base layer: image + committed strokes. Only redraws on commit / image change.
  useEffect(() => {
    const canvas = baseRef.current;
    if (!canvas) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image.bitmap, 0, 0);
    drawStrokes(ctx, strokes);
  }, [image, strokes]);

  // Overlay layer: live preview, hover brush, marquee, debug. Cheap to redraw.
  // When the hover preview has an underline it animates ("marching ants"), so
  // we loop on rAF; otherwise we paint a single frame.
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;

    const paint = (phase: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (preview) drawStrokes(ctx, [preview]);
      if (hoverPreview) drawHoverPreview(ctx, hoverPreview, phase);
      if (marquee) {
        ctx.save();
        ctx.strokeStyle = "rgba(40,40,60,0.9)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h);
        ctx.restore();
      }
      if (debug) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,0,0,0.7)";
        ctx.lineWidth = 1;
        for (const ln of textMap) ctx.strokeRect(ln.x, ln.y, ln.w, ln.h);
        ctx.restore();
      }
    };

    const animated = !!hoverPreview?.band;
    if (!animated) {
      paint(0);
      return;
    }
    let raf = 0;
    let phase = 0;
    const tick = () => {
      phase = (phase + 0.6) % 1000;
      paint(phase);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [image, preview, hoverPreview, marquee, debug, textMap]);

  const toImageCoords = (e: React.PointerEvent): Point => {
    const el = overlayRef.current!;
    const rect = el.getBoundingClientRect();
    const sx = el.width / rect.width;
    const sy = el.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  return (
    <div className="canvas-stack" style={{ width: image.width, height: image.height }}>
      <canvas ref={baseRef} className="hl-canvas" />
      <canvas
        ref={overlayRef}
        className="hl-overlay"
        data-cursor={cursor}
        onPointerDown={(e) => {
          if (e.button === 1 || panMode) {
            onPanStart(e.clientX, e.clientY);
            return;
          }
          if (e.button !== 0) return;
          drawing.current = true;
          overlayRef.current!.setPointerCapture(e.pointerId);
          onDown(toImageCoords(e));
        }}
        onPointerMove={(e) => {
          if (drawing.current) onMove(toImageCoords(e));
          else onHover(toImageCoords(e));
        }}
        onPointerUp={() => {
          if (drawing.current) {
            drawing.current = false;
            onUp();
          }
        }}
        onPointerLeave={() => {
          if (!drawing.current) onHover(null);
        }}
      />
    </div>
  );
}
