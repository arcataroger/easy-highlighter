import type { Stroke } from "../engine/types";
import { drawStrokes } from "./overlay";

export type ExportFormat = "png" | "jpeg" | "webp";

/** Flatten image + strokes at original resolution and download. */
export async function exportImage(
  bitmap: ImageBitmap,
  strokes: Stroke[],
  format: ExportFormat,
  defaultFilename = "highlighted"
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  drawStrokes(ctx, strokes);

  try {
    const showPicker = (window as any).showSaveFilePicker;
    if (showPicker) {
      const handle = await showPicker({
        suggestedName: defaultFilename,
        types: [
          format === "png" ? { description: "PNG Image", accept: { "image/png": [".png"] } } :
          format === "jpeg" ? { description: "JPEG Image", accept: { "image/jpeg": [".jpg", ".jpeg"] } } :
          { description: "WebP Image", accept: { "image/webp": [".webp"] } }
        ],
      });
      // Determine the final mime from the handle name in case they changed it in the OS dialog
      let mime = format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp";
      if (handle.name.endsWith(".jpg") || handle.name.endsWith(".jpeg")) mime = "image/jpeg";
      if (handle.name.endsWith(".png")) mime = "image/png";
      if (handle.name.endsWith(".webp")) mime = "image/webp";

      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), mime, mime === "image/jpeg" || mime === "image/webp" ? 0.92 : undefined)
      );
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      const mime = format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp";
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), mime, format === "jpeg" || format === "webp" ? 0.92 : undefined)
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "jpeg" ? "jpg" : format;
      a.download = `${defaultFilename}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name !== "AbortError") {
      console.error("Export failed:", err);
    }
  }
}
