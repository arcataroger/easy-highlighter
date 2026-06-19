import { describe, it, expect } from "vitest";
import {
  wheelToZoomFactor,
  normalizeWheelDeltaToPixels,
  isPinch,
  clampFactor,
} from "../../src/ui/zoom";

describe("normalizeWheelDeltaToPixels", () => {
  it("leaves pixel-mode (0) deltas unchanged", () => {
    expect(normalizeWheelDeltaToPixels(30, 0)).toBe(30);
    expect(normalizeWheelDeltaToPixels(30, undefined)).toBe(30);
  });

  it("scales line-mode (1) deltas by lineHeight", () => {
    expect(normalizeWheelDeltaToPixels(3, 1, { lineHeight: 16 })).toBe(48);
  });

  it("scales page-mode (2) deltas by pageHeight", () => {
    expect(normalizeWheelDeltaToPixels(1, 2, { pageHeight: 800 })).toBe(800);
  });
});

describe("isPinch", () => {
  it("treats small/fractional pixel-mode ctrl-wheel as a pinch", () => {
    expect(isPinch({ deltaY: 2, deltaMode: 0, ctrlKey: true })).toBe(true);
    expect(isPinch({ deltaY: 0.5, deltaMode: 0, ctrlKey: true })).toBe(true);
  });

  it("treats line/page-mode events as a mouse wheel, not a pinch", () => {
    expect(isPinch({ deltaY: 1, deltaMode: 1 })).toBe(false);
    expect(isPinch({ deltaY: 1, deltaMode: 2 })).toBe(false);
  });

  it("treats large whole pixel deltas as a mouse wheel", () => {
    expect(isPinch({ deltaY: 100, deltaMode: 0 })).toBe(false);
  });
});

describe("clampFactor", () => {
  it("clamps to the given range", () => {
    expect(clampFactor(2, 0.8, 1.25)).toBe(1.25);
    expect(clampFactor(0.1, 0.8, 1.25)).toBe(0.8);
    expect(clampFactor(1.1, 0.8, 1.25)).toBe(1.1);
  });
});

describe("wheelToZoomFactor", () => {
  it("returns a bounded factor for a line-mode mouse wheel delta", () => {
    // A single notch up: deltaY -3 in line mode -> sizable but clamped zoom-in.
    const f = wheelToZoomFactor({ deltaY: -3, deltaMode: 1 });
    expect(f).toBeGreaterThan(1);
    expect(f).toBeLessThanOrEqual(1.25);
    expect(f).toBeGreaterThanOrEqual(0.8);
  });

  it("returns a near-1 factor for a small trackpad pinch delta", () => {
    const f = wheelToZoomFactor({ deltaY: 2, deltaMode: 0, ctrlKey: true });
    expect(Math.abs(f - 1)).toBeLessThan(0.05);
  });

  it("clamps a single huge delta to the allowed range", () => {
    expect(wheelToZoomFactor({ deltaY: -10000, deltaMode: 0 })).toBe(1.25);
    expect(wheelToZoomFactor({ deltaY: 10000, deltaMode: 0 })).toBe(0.8);
  });

  it("never escapes the clamp range for any input", () => {
    for (const deltaY of [-5000, -50, -1, 1, 50, 5000]) {
      for (const deltaMode of [0, 1, 2]) {
        const f = wheelToZoomFactor({ deltaY, deltaMode });
        expect(f).toBeGreaterThanOrEqual(0.8);
        expect(f).toBeLessThanOrEqual(1.25);
      }
    }
  });

  it("zooms in on scroll-up (negative deltaY) and out on scroll-down", () => {
    const inFactor = wheelToZoomFactor({ deltaY: -50, deltaMode: 0 });
    const outFactor = wheelToZoomFactor({ deltaY: 50, deltaMode: 0 });
    expect(inFactor).toBeGreaterThan(1);
    expect(outFactor).toBeLessThan(1);
  });

  it("respects custom clamp options", () => {
    const f = wheelToZoomFactor(
      { deltaY: -10000, deltaMode: 0 },
      { minFactor: 0.5, maxFactor: 2 }
    );
    expect(f).toBe(2);
  });
});
