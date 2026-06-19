import type { Stroke } from "../engine/types";
import { drawStrokes } from "./overlay";

export type ExportFormat = "png" | "jpeg";

/** Flatten image + strokes at original resolution and download. */
export async function exportImage(
  bitmap: ImageBitmap,
  strokes: Stroke[],
  format: ExportFormat,
  filename = "highlighted"
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  drawStrokes(ctx, strokes);
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), mime, format === "jpeg" ? 0.92 : undefined)
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${format === "png" ? "png" : "jpg"}`;
  a.click();
  URL.revokeObjectURL(url);
}
