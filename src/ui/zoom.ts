/**
 * Pure wheel-delta -> zoom-factor logic, extracted so it can be unit-tested
 * without a DOM. The hook (`useViewport`) consumes `wheelToZoomFactor` and
 * applies the resulting factor to the current zoom, anchored to the cursor.
 *
 * The tricky part is making zoom feel good across very different input devices:
 *
 *  - A physical mouse wheel fires *few* events with *large* deltas, often in
 *    "line" (deltaMode 1) or "page" (deltaMode 2) units. If we treat those raw
 *    numbers as pixels the zoom jumps wildly.
 *  - A macOS trackpad pinch is delivered (by the browser) as many ctrl+wheel
 *    events with small, often fractional, pixel deltas. Those want a gentle,
 *    near-1 factor per event so the ramp is smooth.
 *
 * So we (1) normalize deltas to pixels via `deltaMode`, (2) detect "pinch vs
 * mouse wheel" by event shape, (3) apply a per-device sensitivity, and
 * (4) clamp the resulting factor so a single huge delta can't teleport the
 * zoom.
 */

export interface WheelLike {
  /** Vertical wheel delta (sign: positive = scroll down / zoom out). */
  deltaY: number;
  /** 0 = pixel, 1 = line, 2 = page. Defaults to pixel when omitted. */
  deltaMode?: number;
  /** Pinch / ctrl-wheel zoom gesture flag. */
  ctrlKey?: boolean;
}

export interface ZoomFactorOptions {
  /** Pixels per "line" for deltaMode 1 (mouse wheel notch). */
  lineHeight?: number;
  /** Pixels per "page" for deltaMode 2. Usually the viewport height. */
  pageHeight?: number;
  /** Exponent sensitivity for trackpad pinch (small per-event factor). */
  pinchSensitivity?: number;
  /** Exponent sensitivity for a physical mouse wheel (bigger steps). */
  wheelSensitivity?: number;
  /** Lower clamp on the per-event multiplicative zoom factor. */
  minFactor?: number;
  /** Upper clamp on the per-event multiplicative zoom factor. */
  maxFactor?: number;
}

const DEFAULTS: Required<ZoomFactorOptions> = {
  lineHeight: 16,
  pageHeight: 800,
  // Pinch: many small events -> keep each one gentle and near 1.
  pinchSensitivity: 0.01,
  // Mouse wheel: few large events -> a noticeably bigger step, but capped.
  wheelSensitivity: 0.0025,
  minFactor: 0.8,
  maxFactor: 1.25,
};

/**
 * Convert a wheel delta into pixels using the event's `deltaMode`.
 * Line-mode is multiplied by `lineHeight`, page-mode by `pageHeight`.
 */
export function normalizeWheelDeltaToPixels(
  deltaY: number,
  deltaMode: number | undefined,
  opts: ZoomFactorOptions = {}
): number {
  const { lineHeight, pageHeight } = { ...DEFAULTS, ...opts };
  switch (deltaMode) {
    case 1: // DOM_DELTA_LINE
      return deltaY * lineHeight;
    case 2: // DOM_DELTA_PAGE
      return deltaY * pageHeight;
    default: // DOM_DELTA_PIXEL (0) / undefined
      return deltaY;
  }
}

/**
 * Heuristic: is this wheel event a trackpad pinch rather than a mouse wheel?
 *
 * The browser delivers macOS trackpad pinches as ctrl+wheel with small,
 * frequently fractional pixel deltas (deltaMode 0). A physical wheel uses
 * line/page mode, or pixel mode with large integer deltas. We treat
 * non-pixel deltaModes as a definite mouse wheel, and within pixel mode use a
 * magnitude threshold (fractional or small => pinch).
 */
export function isPinch(e: WheelLike): boolean {
  if (e.deltaMode !== undefined && e.deltaMode !== 0) return false;
  const ay = Math.abs(e.deltaY);
  // Fractional deltas only ever come from a trackpad.
  if (ay !== Math.trunc(ay)) return true;
  // Small whole pixel deltas are also pinch territory; large ones are wheels.
  return ay < 40;
}

/**
 * Map a wheel event to a multiplicative zoom factor (> 1 zooms in, < 1 zooms
 * out). The factor is clamped to [minFactor, maxFactor] so one big delta can
 * never cause a huge jump. Pure: no DOM, no side effects.
 */
export function wheelToZoomFactor(
  e: WheelLike,
  opts: ZoomFactorOptions = {}
): number {
  const o = { ...DEFAULTS, ...opts };
  const pinch = isPinch(e);
  const px = normalizeWheelDeltaToPixels(e.deltaY, e.deltaMode, o);
  const sensitivity = pinch ? o.pinchSensitivity : o.wheelSensitivity;
  // Scrolling down (positive deltaY) should zoom out, so negate.
  const factor = Math.exp(-px * sensitivity);
  return clampFactor(factor, o.minFactor, o.maxFactor);
}

/** Clamp a multiplicative factor to [min, max]. */
export function clampFactor(factor: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, factor));
}
