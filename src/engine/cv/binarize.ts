export interface GrayImage {
  width: number;
  height: number;
  gray: Uint8Array; // length width*height, 0..255 luminance
}

export interface BinImage {
  width: number;
  height: number;
  ink: Uint8Array; // 1 = ink (dark), 0 = background
}

/** Otsu's method: returns the luminance threshold maximizing between-class variance. */
export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between >= maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

export function binarize(img: GrayImage, threshold?: number): BinImage {
  const t = threshold ?? otsuThreshold(img.gray);
  const ink = new Uint8Array(img.width * img.height);
  for (let i = 0; i < img.gray.length; i++) ink[i] = img.gray[i] <= t ? 1 : 0;
  return { width: img.width, height: img.height, ink };
}
