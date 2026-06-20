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
  color: string;
}

/**
 * Draw the on-hover brush preview, visually distinct from a real highlight:
 * a simple dashed underline from the caret to the end of the line (showing
 * where the highlight would land if you kept dragging), plus a thin vertical
 * caret at the cursor in the actual selected size + color.
 */
export function drawHoverPreview(ctx: CanvasRenderingContext2D, hp: HoverPreview, isErase: boolean = false) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";



  // Caret: solid vertical brush tip at the cursor.
  const { x, y, h } = hp.caret;
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = hp.color;
  ctx.fillRect(x - 2, y - h / 2, 4, h);
  
  // 2px inverse-color border
  ctx.globalCompositeOperation = "difference";
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 3, y - h / 2 - 1, 6, h + 2);
  
  if (isErase) {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    // draw a tiny x offset to the bottom right
    const ex = x + 8;
    const ey = y + h / 2 + 4;
    ctx.moveTo(ex - 4, ey - 4);
    ctx.lineTo(ex + 4, ey + 4);
    ctx.moveTo(ex + 4, ey - 4);
    ctx.lineTo(ex - 4, ey + 4);
    ctx.stroke();
  }
  
  ctx.restore();
}

/** Draw all strokes onto a 2D context using multiply blend (marker look). */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";

  let smartGroups = new Map<string, Path2D>();

  const flushSmartGroups = () => {
    for (const [key, path] of smartGroups) {
      const lastColon = key.lastIndexOf(":");
      const color = key.slice(0, lastColon);
      const opacity = parseFloat(key.slice(lastColon + 1));
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.fill(path, "nonzero");
    }
    smartGroups.clear();
  };

  for (const stroke of strokes) {
    if (stroke.blendMode && stroke.blendMode !== "multiply") {
      flushSmartGroups();
      ctx.globalCompositeOperation = stroke.blendMode;
    }

    const key = `${stroke.color}:${stroke.opacity}`;
    for (const seg of stroke.segments) {
      if (seg.kind === "snapped" || seg.kind === "rect") {
        let path = smartGroups.get(key);
        if (!path) {
          path = new Path2D();
          smartGroups.set(key, path);
        }
        if (seg.kind === "snapped") {
          path.rect(
            seg.x0,
            seg.y - seg.thickness / 2,
            seg.x1 - seg.x0,
            seg.thickness
          );
        } else {
          path.rect(seg.x, seg.y, seg.w, seg.h);
        }
      } else if (seg.kind === "freeform") {
        ctx.globalAlpha = stroke.opacity;
        ctx.strokeStyle = stroke.color;
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

    if (stroke.blendMode && stroke.blendMode !== "multiply") {
      ctx.globalCompositeOperation = "multiply";
    }
  }

  flushSmartGroups();
  ctx.restore();
}
