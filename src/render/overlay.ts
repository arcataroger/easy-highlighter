import type { Stroke } from "../engine/types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectangles for the snapped + rect segments of a stroke. */
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
    } else if (seg.kind === "rect") {
      rects.push({ x: seg.x, y: seg.y, w: seg.w, h: seg.h });
    }
  }
  return rects;
}

export interface HoverPreview {
  /** thin brush caret at the cursor, in the selected color/size */
  caret: { x: number; y: number; h: number };
  /** faint band showing where the highlight would land if you continued */
  band: { x0: number; x1: number; y: number; h: number } | null;
  color: string;
}

/**
 * Draw the on-hover brush preview: a faint band where the highlight would go,
 * plus a thin vertical caret at the cursor showing the actual size + color.
 */
export function drawHoverPreview(ctx: CanvasRenderingContext2D, hp: HoverPreview) {
  ctx.save();
  if (hp.band) {
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = hp.color;
    const { x0, x1, y, h } = hp.band;
    ctx.fillRect(x0, y - h / 2, x1 - x0, h);
  }
  // Caret on top, solid, so it reads as a brush tip.
  ctx.globalCompositeOperation = "source-over";
  const { x, y, h } = hp.caret;
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = hp.color;
  ctx.fillRect(x - 1, y - h / 2, 2, h);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - 1, y - h / 2, 2, h);
  ctx.restore();
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
      } else if (seg.kind === "rect") {
        ctx.fillRect(seg.x, seg.y, seg.w, seg.h);
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
