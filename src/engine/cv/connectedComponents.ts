import type { BinImage } from "./binarize";

/** A connected component (blob) of ink, with its bounding box and pixel count. */
export interface Component {
  /** inclusive bounds */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** number of ink pixels in the component */
  area: number;
}

export interface ComponentOptions {
  /** 4- or 8-connectivity (default 8). */
  connectivity?: 4 | 8;
}

/** width of a component bbox (px) */
export function compWidth(c: Component): number {
  return c.x1 - c.x0 + 1;
}
/** height of a component bbox (px) */
export function compHeight(c: Component): number {
  return c.y1 - c.y0 + 1;
}
/** fraction of the bbox that is ink (0..1) */
export function compFill(c: Component): number {
  const area = compWidth(c) * compHeight(c);
  return area > 0 ? c.area / area : 0;
}

/**
 * Label connected ink regions via a two-pass union-find scan.
 *
 * Single linear pass over pixels with union-find on already-seen neighbours
 * (W, N, NW, NE), then a second pass to accumulate per-label bounding boxes.
 * Linear in the number of pixels; no recursion (avoids stack overflow on
 * large blobs).
 */
export function connectedComponents(
  img: BinImage,
  opts: ComponentOptions = {}
): Component[] {
  const conn = opts.connectivity ?? 8;
  const { width, height, ink } = img;
  const n = width * height;
  // labels[i] = provisional label (1-based) or 0 for background
  const labels = new Int32Array(n);
  // union-find parent over provisional labels (index 0 unused)
  const parent: number[] = [0];

  const find = (a: number): number => {
    let root = a;
    while (parent[root] !== root) root = parent[root];
    // path compression
    while (parent[a] !== root) {
      const next = parent[a];
      parent[a] = root;
      a = next;
    }
    return root;
  };
  const union = (a: number, b: number): number => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return ra;
    const lo = ra < rb ? ra : rb;
    const hi = ra < rb ? rb : ra;
    parent[hi] = lo;
    return lo;
  };

  let next = 1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      if (ink[i] === 0) continue;

      let label = 0;
      // West
      if (x > 0 && ink[i - 1]) label = labels[i - 1];
      // North
      if (y > 0 && ink[i - width]) {
        const nl = labels[i - width];
        label = label === 0 ? nl : union(label, nl);
      }
      if (conn === 8) {
        // North-West
        if (x > 0 && y > 0 && ink[i - width - 1]) {
          const nl = labels[i - width - 1];
          label = label === 0 ? nl : union(label, nl);
        }
        // North-East
        if (x < width - 1 && y > 0 && ink[i - width + 1]) {
          const nl = labels[i - width + 1];
          label = label === 0 ? nl : union(label, nl);
        }
      }
      if (label === 0) {
        label = next++;
        parent[label] = label;
      }
      labels[i] = label;
    }
  }

  // Second pass: resolve labels to roots and accumulate bounding boxes.
  // Map root label -> dense component index.
  const rootIndex = new Int32Array(next).fill(-1);
  const comps: Component[] = [];
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const lbl = labels[i];
      if (lbl === 0) continue;
      const root = find(lbl);
      let idx = rootIndex[root];
      if (idx === -1) {
        idx = comps.length;
        rootIndex[root] = idx;
        comps.push({ x0: x, y0: y, x1: x, y1: y, area: 0 });
      }
      const c = comps[idx];
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      c.area++;
    }
  }

  return comps;
}
