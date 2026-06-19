import type { BinImage } from "./binarize";

export interface LineBand {
  top: number;
  bottom: number; // inclusive
}

/** Ink count per row (length = height). */
export function rowProjection(img: BinImage): Uint32Array {
  const proj = new Uint32Array(img.height);
  for (let y = 0; y < img.height; y++) {
    let count = 0;
    const base = y * img.width;
    for (let x = 0; x < img.width; x++) count += img.ink[base + x];
    proj[y] = count;
  }
  return proj;
}

/**
 * Group consecutive rows whose ink count exceeds `minInk` into bands.
 * minInk defaults to a small fraction of width to ignore speckle noise.
 */
export function findLineBands(img: BinImage, minInkFraction = 0.01): LineBand[] {
  const proj = rowProjection(img);
  const minInk = Math.max(1, Math.floor(img.width * minInkFraction));
  const bands: LineBand[] = [];
  let start = -1;
  for (let y = 0; y < img.height; y++) {
    const active = proj[y] >= minInk;
    if (active && start === -1) start = y;
    if (!active && start !== -1) {
      bands.push({ top: start, bottom: y - 1 });
      start = -1;
    }
  }
  if (start !== -1) bands.push({ top: start, bottom: img.height - 1 });
  return bands;
}
