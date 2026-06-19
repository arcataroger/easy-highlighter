export interface Point {
  x: number;
  y: number;
}

export interface WordBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LineBox {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** y of the text baseline (defaults to box bottom) */
  baseline: number;
  /** vertical center of the line box */
  cy: number;
  words: WordBox[];
}

export type TextMap = LineBox[];

export interface SnappedSegment {
  kind: "snapped";
  lineId: number;
  x0: number;
  x1: number;
  /** vertical center of the band, original-image coords */
  y: number;
  /** band thickness, original-image coords */
  thickness: number;
}

export interface FreeformSegment {
  kind: "freeform";
  points: Point[];
  thickness: number;
}

/** An axis-aligned rectangle fill (dumb box tool). */
export interface RectSegment {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Segment = SnappedSegment | FreeformSegment | RectSegment;

export interface Stroke {
  id: string;
  color: string;
  opacity: number;
  segments: Segment[];
}

/** A drag-driven tool that accumulates pointer input into one Stroke. */
export interface ToolBuilder {
  down(p: Point): void;
  move(p: Point): void;
  /** In-progress stroke for live preview. */
  preview(): Stroke;
  finish(): Stroke;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function makeLineBox(
  init: Omit<LineBox, "baseline" | "cy"> &
    Partial<Pick<LineBox, "baseline" | "cy">>
): LineBox {
  return {
    ...init,
    baseline: init.baseline ?? init.y + init.h,
    cy: init.cy ?? init.y + init.h / 2,
  };
}

let strokeCounter = 0;
export function makeStroke(init: Partial<Stroke> & { color: string }): Stroke {
  return {
    id: init.id ?? `s${Date.now()}_${strokeCounter++}`,
    color: init.color,
    opacity: init.opacity ?? 0.4,
    segments: init.segments ?? [],
  };
}
