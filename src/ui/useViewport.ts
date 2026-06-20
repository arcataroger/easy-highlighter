import { useCallback, useEffect, useRef, useState } from "react";
import { wheelToZoomFactor } from "./zoom";

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/**
 * Figma-style viewport: pinch / Ctrl+Cmd-wheel zooms toward the cursor, plain
 * wheel pans, and Space-drag / middle-drag pans. Returns the transform pieces
 * plus imperative zoom/fit helpers.
 */
export function useViewport(containerRef: React.RefObject<HTMLElement>) {
  const [vp, setVp] = useState<ViewportState>({ zoom: 1, panX: 0, panY: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [altHeld, setAltHeld] = useState(false);
  const panningRef = useRef(false);

  // Zoom toward a point (in container/viewport pixels).
  const zoomAt = useCallback((nextZoom: number, cx: number, cy: number) => {
    setVp((v) => {
      const z2 = clampZoom(nextZoom);
      const k = z2 / v.zoom;
      return { zoom: z2, panX: cx - (cx - v.panX) * k, panY: cy - (cy - v.panY) * k };
    });
  }, []);

  // rAF-smoothed zoom: wheel/pinch events accumulate into a *target* zoom that
  // we ease the actual zoom toward each frame. This polishes the ramp (no
  // per-event step jitter) while keeping a fixed cursor anchor so the world
  // point under the pointer never drifts.
  const animRef = useRef<{
    raf: number;
    target: number; // target zoom level
    cx: number; // anchor in container px
    cy: number;
  } | null>(null);

  // Latest viewport, kept in a ref so the rAF loop reads fresh values without
  // re-subscribing.
  const vpRef = useRef(vp);
  vpRef.current = vp;

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current.raf);
    };
  }, []);

  // Non-passive wheel listener so we can preventDefault the browser page-zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const step = () => {
      const a = animRef.current;
      if (!a) return;
      setVp((v) => {
        // Ease toward the target; snap when close enough to avoid endless rAF.
        const next = v.zoom + (a.target - v.zoom) * 0.25;
        const z2 = clampZoom(Math.abs(a.target - next) < 0.001 ? a.target : next);
        const k = z2 / v.zoom;
        // Anchor: keep (a.cx, a.cy) fixed in world space.
        return {
          zoom: z2,
          panX: a.cx - (a.cx - v.panX) * k,
          panY: a.cy - (a.cy - v.panY) * k,
        };
      });
      // Read post-update zoom via ref on the next tick; decide whether to keep
      // animating based on remaining distance to target.
      if (Math.abs(a.target - vpRef.current.zoom) < 0.001) {
        animRef.current = null;
        return;
      }
      a.raf = requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = wheelToZoomFactor(
          { deltaY: e.deltaY, deltaMode: e.deltaMode, ctrlKey: e.ctrlKey },
          { pageHeight: rect.height || 800 }
        );
        // Base the new target on the current animation target (if any) so rapid
        // event bursts compound smoothly instead of fighting each other.
        const base = animRef.current ? animRef.current.target : vpRef.current.zoom;
        const target = clampZoom(base * factor);
        if (animRef.current) {
          animRef.current.target = target;
          animRef.current.cx = cx;
          animRef.current.cy = cy;
        } else {
          animRef.current = { raf: 0, target, cx, cy };
          animRef.current.raf = requestAnimationFrame(step);
        }
      } else {
        e.preventDefault();
        setVp((v) => ({ ...v, panX: v.panX - e.deltaX, panY: v.panY - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (animRef.current) {
        cancelAnimationFrame(animRef.current.raf);
        animRef.current = null;
      }
    };
  }, [containerRef]);

  // Track Space for pan mode.
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.key === "Alt") setAltHeld(true);
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
      if (e.key === "Alt") setAltHeld(false);
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  /** Begin a drag-pan from a pointer at (clientX, clientY). */
  const startPan = useCallback((clientX: number, clientY: number) => {
    panningRef.current = true;
    let lastX = clientX;
    let lastY = clientY;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      setVp((v) => ({ ...v, panX: v.panX + dx, panY: v.panY + dy }));
    };
    const up = () => {
      panningRef.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      zoomAt(vp.zoom * factor, rect.width / 2, rect.height / 2);
    },
    [containerRef, vp.zoom, zoomAt]
  );

  /** Fit content of size (w,h) centered in the container at 100% or smaller. */
  const fit = useCallback(
    (contentW: number, contentH: number) => {
      const el = containerRef.current;
      if (!el || contentW === 0 || contentH === 0) return;
      const rect = el.getBoundingClientRect();
      const pad = 24;
      const zoom = clampZoom(
        Math.min(
          1,
          (rect.width - pad * 2) / contentW,
          (rect.height - pad * 2) / contentH
        )
      );
      setVp({
        zoom,
        panX: (rect.width - contentW * zoom) / 2,
        panY: (rect.height - contentH * zoom) / 2,
      });
    },
    [containerRef]
  );

  const reset = useCallback(() => setVp({ zoom: 1, panX: 0, panY: 0 }), []);

  return {
    zoom: vp.zoom,
    panX: vp.panX,
    panY: vp.panY,
    spaceHeld,
    altHeld,
    isPanning: () => panningRef.current,
    startPan,
    zoomIn: () => zoomBy(1.25),
    zoomOut: () => zoomBy(1 / 1.25),
    fit,
    reset,
  };
}
