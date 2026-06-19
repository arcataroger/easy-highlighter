import { makeStroke, type Point, type Stroke, type TextMap, type SnappedSegment, type FreeformSegment } from "./types";
import { snap, type SnapOptions } from "./snapping";

export interface StrokeBuilderOptions extends SnapOptions {
  defaultThickness?: number;
}

/**
 * Accumulates pointer input into a single Stroke during one drag.
 * Each pointer sample is snapped; consecutive samples on the same line extend
 * one SnappedSegment, otherwise a new segment (freeform or new line) starts.
 */
export class StrokeBuilder {
  private stroke: Stroke;
  private lockedLineId: number | null = null;
  private defaultThickness: number;
  private opts: SnapOptions;

  constructor(
    private map: TextMap,
    color: string,
    opacity: number,
    options: StrokeBuilderOptions = {}
  ) {
    this.stroke = makeStroke({ color, opacity });
    this.defaultThickness = options.defaultThickness ?? 14;
    this.opts = { maxDist: options.maxDist, hysteresis: options.hysteresis };
  }

  down(p: Point) {
    this.addPoint(p);
  }

  move(p: Point) {
    this.addPoint(p);
  }

  private addPoint(p: Point) {
    const result = snap(this.map, p, { lockedLineId: this.lockedLineId }, this.opts);
    const last = this.stroke.segments[this.stroke.segments.length - 1];

    if (result.snapped) {
      this.lockedLineId = result.lineId!;
      if (last && last.kind === "snapped" && last.lineId === result.lineId) {
        last.x0 = Math.min(last.x0, p.x);
        last.x1 = Math.max(last.x1, p.x);
      } else {
        const seg: SnappedSegment = {
          kind: "snapped",
          lineId: result.lineId!,
          x0: p.x,
          x1: p.x,
          y: result.y!,
          thickness: result.thickness!,
        };
        this.stroke.segments.push(seg);
      }
    } else {
      this.lockedLineId = null;
      if (last && last.kind === "freeform") {
        last.points.push(p);
      } else {
        const seg: FreeformSegment = {
          kind: "freeform",
          points: [p],
          thickness: this.defaultThickness,
        };
        this.stroke.segments.push(seg);
      }
    }
  }

  /** Current in-progress stroke (for live preview). */
  preview(): Stroke {
    return this.stroke;
  }

  finish(): Stroke {
    return this.stroke;
  }
}
