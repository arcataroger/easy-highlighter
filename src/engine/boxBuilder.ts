import {
  makeStroke,
  type Point,
  type Rect,
  type Stroke,
  type TextMap,
  type ToolBuilder,
  type RectSegment,
  type SnappedSegment,
} from "./types";

/** Normalize two corner points into an x/y/w/h rect. */
export function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/**
 * Dumb box tool: drag a rectangle, highlight the whole rectangle.
 * Emits a single RectSegment.
 */
export class BoxBuilder implements ToolBuilder {
  private stroke: Stroke;
  private start: Point | null = null;
  private box: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(color: string, opacity: number) {
    this.stroke = makeStroke({ color, opacity });
  }

  down(p: Point) {
    this.start = p;
    this.update(p);
  }

  move(p: Point) {
    if (this.start) this.update(p);
  }

  private update(p: Point) {
    this.box = rectFromPoints(this.start!, p);
    const seg: RectSegment = { kind: "rect", ...this.box };
    this.stroke.segments = [seg];
  }

  currentBox(): Rect {
    return this.box;
  }

  preview(): Stroke {
    return this.stroke;
  }

  finish(): Stroke {
    return this.stroke;
  }
}

/** Line boxes whose vertical center falls inside the rect's y-range. */
export function linesInRect(map: TextMap, rect: Rect): SnappedSegment[] {
  const top = rect.y;
  const bottom = rect.y + rect.h;
  const left = rect.x;
  const right = rect.x + rect.w;
  const out: SnappedSegment[] = [];
  for (const line of map) {
    if (line.cy < top || line.cy > bottom) continue;
    const x0 = Math.max(left, line.x);
    const x1 = Math.min(right, line.x + line.w);
    if (x1 <= x0) continue; // no horizontal overlap with the line's text
    out.push({
      kind: "snapped",
      lineId: line.id,
      x0,
      x1,
      y: line.cy,
      thickness: line.h,
    });
  }
  return out;
}

/**
 * Smart-paragraph tool: drag a box, auto-highlight every detected text LINE
 * inside it (each clamped to its own text extent). Emits one SnappedSegment
 * per covered line, updated live as the box is dragged.
 */
export class ParagraphBuilder implements ToolBuilder {
  private stroke: Stroke;
  private start: Point | null = null;
  private box: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private map: TextMap, color: string, opacity: number) {
    this.stroke = makeStroke({ color, opacity });
  }

  down(p: Point) {
    this.start = p;
    this.update(p);
  }

  move(p: Point) {
    if (this.start) this.update(p);
  }

  private update(p: Point) {
    this.box = rectFromPoints(this.start!, p);
    this.stroke.segments = linesInRect(this.map, this.box);
  }

  currentBox(): Rect {
    return this.box;
  }

  preview(): Stroke {
    return this.stroke;
  }

  finish(): Stroke {
    return this.stroke;
  }
}
