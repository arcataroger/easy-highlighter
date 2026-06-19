import {
  makeStroke,
  type Point,
  type Stroke,
  type TextMap,
  type ToolBuilder,
  type SnappedSegment,
  type FreeformSegment,
} from "./types";
import { snap, type SnapOptions } from "./snapping";

export interface StrokeBuilderOptions extends SnapOptions {
  defaultThickness?: number;
  /** when false, never snaps — always freeform (the "dumb" highlighter) */
  tracking?: boolean;
  /**
   * Once a snapped band has grown this many px along a line, we are confident
   * we are tracking it and hard-lock to it until the drag ends.
   */
  stickDistance?: number;
  /** Or once this many consecutive samples land on the same line, hard-lock. */
  stickSamples?: number;
}

/**
 * Accumulates pointer input into a single Stroke during one drag.
 *
 * Smart mode: each sample is snapped (with hysteresis); consecutive samples on
 * the same line extend one SnappedSegment, clamped to the line's text extent.
 * Once we are confident we are tracking a line (the band has grown past
 * `stickDistance`, or `stickSamples` samples landed on it) we HARD-LOCK to that
 * line until mouseup, so a wandering cursor never jumps to a neighbouring line.
 *
 * Dumb mode (`tracking: false`): never snaps; emits one freeform band at
 * `defaultThickness`.
 */
export class StrokeBuilder implements ToolBuilder {
  private stroke: Stroke;
  private lockedLineId: number | null = null;
  private hardLockedLineId: number | null = null;
  private samplesOnLine = 0;
  private defaultThickness: number;
  private tracking: boolean;
  private stickDistance: number;
  private stickSamples: number;
  private opts: SnapOptions;

  constructor(
    private map: TextMap,
    color: string,
    opacity: number,
    options: StrokeBuilderOptions = {}
  ) {
    this.stroke = makeStroke({ color, opacity });
    this.defaultThickness = options.defaultThickness ?? 14;
    this.tracking = options.tracking ?? true;
    this.stickDistance = options.stickDistance ?? 24;
    this.stickSamples = options.stickSamples ?? 4;
    this.opts = { maxDist: options.maxDist, hysteresis: options.hysteresis };
  }

  down(p: Point) {
    this.addPoint(p);
  }

  move(p: Point) {
    this.addPoint(p);
  }

  private lineById(id: number) {
    return this.map.find((l) => l.id === id);
  }

  /** Extend (or start) the snapped segment for `lineId`, clamping x to the line. */
  private extendSnapped(lineId: number, x: number, y: number, thickness: number) {
    const line = this.lineById(lineId);
    const cx = line ? Math.max(line.x, Math.min(line.x + line.w, x)) : x;
    const last = this.stroke.segments[this.stroke.segments.length - 1];
    if (last && last.kind === "snapped" && last.lineId === lineId) {
      last.x0 = Math.min(last.x0, cx);
      last.x1 = Math.max(last.x1, cx);
    } else {
      const seg: SnappedSegment = {
        kind: "snapped",
        lineId,
        x0: cx,
        x1: cx,
        y,
        thickness,
      };
      this.stroke.segments.push(seg);
    }
  }

  private addPoint(p: Point) {
    // Hard lock: stay on the chosen line for the rest of the drag.
    if (this.hardLockedLineId !== null) {
      const line = this.lineById(this.hardLockedLineId);
      if (line) {
        this.extendSnapped(this.hardLockedLineId, p.x, line.cy, line.h);
        return;
      }
    }

    const result = this.tracking
      ? snap(this.map, p, { lockedLineId: this.lockedLineId }, this.opts)
      : { snapped: false as const };

    if (result.snapped) {
      const prev = this.stroke.segments[this.stroke.segments.length - 1];
      const sameLine =
        prev && prev.kind === "snapped" && prev.lineId === result.lineId;
      this.samplesOnLine = sameLine ? this.samplesOnLine + 1 : 1;
      this.lockedLineId = result.lineId!;
      this.extendSnapped(result.lineId!, p.x, result.y!, result.thickness!);

      // Confidence check → hard lock.
      const seg = this.stroke.segments[this.stroke.segments.length - 1];
      const width = seg.kind === "snapped" ? seg.x1 - seg.x0 : 0;
      if (width >= this.stickDistance || this.samplesOnLine >= this.stickSamples) {
        this.hardLockedLineId = result.lineId!;
      }
    } else {
      this.lockedLineId = null;
      this.samplesOnLine = 0;
      const last = this.stroke.segments[this.stroke.segments.length - 1];
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
