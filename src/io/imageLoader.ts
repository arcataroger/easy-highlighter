/** Scale factor to fit the long side within `cap` (<= 1). */
export function analysisScale(width: number, height: number, cap = 2000): number {
  const longSide = Math.max(width, height);
  return longSide <= cap ? 1 : cap / longSide;
}

export interface LoadedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

/** Decode a File/Blob into an ImageBitmap at original resolution. */
export async function loadImage(file: Blob): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

/** Draw the bitmap at `scale` and return its RGBA pixels for analysis. */
export function getScaledRGBA(
  bitmap: ImageBitmap,
  scale: number
): { rgba: Uint8ClampedArray; width: number; height: number } {
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { rgba: data, width, height };
}
