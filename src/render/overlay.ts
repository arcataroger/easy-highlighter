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
      rects.push({
        x: seg.x0,
        y: seg.y - seg.thickness / 2,
        w: seg.x1 - seg.x0,
        h: seg.thickness,
      });
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
        ctx.fillRect(
          seg.x0,
          seg.y - seg.thickness / 2,
          seg.x1 - seg.x0,
          seg.thickness
        );
      } else {
        ctx.lineWidth = seg.thickness;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        seg.points.forEach((p, i) =>
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
        );
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
