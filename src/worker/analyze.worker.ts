/// <reference lib="webworker" />
import { grayscale } from "../engine/cv/gpu";
import { binarize } from "../engine/cv/binarize";
import { buildTextMap } from "../engine/cv/textmap";
import type { TextMap } from "../engine/types";

export interface AnalyzeRequest {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  /** scale factor mapping analysis coords back to original (1 = same) */
  scale: number;
}

export interface AnalyzeResponse {
  textMap: TextMap;
}

self.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  const { rgba, width, height, scale } = e.data;
  const gray = await grayscale(rgba, width, height);
  const bin = binarize({ width, height, gray });
  const mapAnalysis = buildTextMap(bin);
  // map coords back to original resolution
  const textMap: TextMap = mapAnalysis.map((l) => ({
    ...l,
    x: l.x / scale,
    y: l.y / scale,
    w: l.w / scale,
    h: l.h / scale,
    baseline: l.baseline / scale,
    cy: l.cy / scale,
    words: l.words.map((w) => ({
      x: w.x / scale,
      y: w.y / scale,
      w: w.w / scale,
      h: w.h / scale,
    })),
  }));
  const res: AnalyzeResponse = { textMap };
  (self as unknown as Worker).postMessage(res);
};
