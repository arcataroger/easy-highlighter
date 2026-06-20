// PNG helpers for tests: turn a BinImage into RGBA / a real PNG, and decode a
// PNG back to RGBA. This lets tests exercise the REAL ingestion path (PNG bytes
// → RGBA → grayscale → binarize → detect) at the module level, no browser.
import { PNG } from "pngjs";
import type { BinImage } from "../../../src/engine/cv/binarize";

/** Render a BinImage as RGBA: black ink on a white background. */
export function binToRgba(img: BinImage): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(img.width * img.height * 4);
  for (let i = 0; i < img.width * img.height; i++) {
    const v = img.ink[i] ? 0 : 255;
    rgba[i * 4] = v;
    rgba[i * 4 + 1] = v;
    rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/** Encode RGBA pixels to PNG file bytes. */
export function encodePng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Buffer {
  const png = new PNG({ width, height });
  png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  return PNG.sync.write(png);
}

export interface DecodedImage {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Draw red rectangle outlines (detected line boxes) onto an RGBA buffer. */
export function overlayBoxes(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  boxes: Array<{ x0: number; y0: number; x1: number; y1: number }>
): Uint8ClampedArray {
  const out = rgba.slice();
  const px = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    out[i] = 230;
    out[i + 1] = 40;
    out[i + 2] = 40;
    out[i + 3] = 255;
  };
  for (const b of boxes) {
    for (let x = b.x0; x <= b.x1; x++) {
      px(x, b.y0);
      px(x, b.y1);
    }
    for (let y = b.y0; y <= b.y1; y++) {
      px(b.x0, y);
      px(b.x1, y);
    }
  }
  return out;
}

/** Decode PNG file bytes back to RGBA. */
export function decodePng(buf: Buffer): DecodedImage {
  const png = PNG.sync.read(buf);
  return {
    rgba: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength),
    width: png.width,
    height: png.height,
  };
}
