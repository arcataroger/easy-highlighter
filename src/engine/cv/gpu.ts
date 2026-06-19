/** Rec. 601 luma. */
export function grayscaleCPU(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
    gray[j] = (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) | 0;
  }
  return gray;
}

/**
 * Returns grayscale using WebGPU when available, else CPU.
 * For v1 the WebGPU path simply falls through to CPU unless a device is present;
 * the parallel pixel passes can be moved to a compute shader later without changing
 * this signature.
 */
export async function grayscale(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Promise<Uint8Array> {
  // Feature-detect; real GPU compute can be added behind this guard.
  const hasGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  if (!hasGPU) return grayscaleCPU(rgba, width, height);
  // Placeholder: until a compute shader is wired, use CPU (correct + fast enough).
  return grayscaleCPU(rgba, width, height);
}
