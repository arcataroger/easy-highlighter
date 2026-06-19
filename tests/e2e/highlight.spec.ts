import { test, expect } from "@playwright/test";

/**
 * Core flow smoke test for the image highlighter SPA:
 *   open image -> wait for text analysis -> drag the smart highlighter across
 *   the first text line -> verify a highlight was painted -> Save PNG downloads.
 *
 * On the fixture (tests/e2e/fixtures/lines.png) the smart highlighter snaps to
 * the detected text line and paints a band that covers the solid dark bar at
 * image rows y=40..57. The highlight uses multiply blend with #ffe14d, so the
 * neutral-gray bar (r==g==b) picks up the yellow marker signature: blue drops
 * below red. An untouched bar pixel stays neutral. We assert exactly that.
 */
test("smart highlighter paints a stroke and Save PNG downloads", async ({
  page,
}) => {
  await page.goto("/");

  // Load the fixture image into the hidden file input.
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("tests/e2e/fixtures/lines.png");

  // Canvas appears at the image's native resolution (600x240).
  const canvas = page.locator("canvas.hl-canvas");
  await expect(canvas).toBeVisible();

  // Wait for the analyzing overlay (Web Worker) to finish.
  await expect(page.locator(".analyzing")).toHaveCount(0, { timeout: 10_000 });

  // Drag horizontally across the first text line using the canvas box.
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas has no bounding box");

  const startX = box.x + box.width * 0.12;
  const endX = box.x + box.width * 0.7;
  const y = box.y + box.height * 0.2; // ~image row 48, the first text line

  await page.mouse.move(startX, y);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps;
    await page.mouse.move(x, y);
  }
  await page.mouse.up();

  // Read canvas pixels in image space. Sample several x positions along the
  // first text line (image row 49) plus one untouched control pixel further
  // right where the drag did not reach.
  const px = await canvas.evaluate((c) => {
    const ctx = (c as HTMLCanvasElement).getContext("2d", {
      willReadFrequently: true,
    })!;
    const read = (x: number, y: number) =>
      Array.from(ctx.getImageData(x, y, 1, 1).data);
    return {
      onLine: [150, 200, 250].map((x) => read(x, 49)),
      control: read(500, 49), // past the drag (endX ~= image x 420)
    };
  });

  // The untouched bar is neutral gray: red === blue.
  expect(px.control[0]).toBe(px.control[2]);

  // At least one highlighted sample shows the yellow marker signature:
  // multiply with #ffe14d (more red than blue) tints the gray bar so that
  // blue drops well below red. The neutral baseline has blue === red, so any
  // gap is unambiguous evidence the highlight was painted.
  const highlighted = px.onLine.some(
    (p) => p[0] - p[2] >= 4 && p[2] < p[0],
  );
  expect(
    highlighted,
    `expected a yellow-highlighted pixel (blue < red) among ${JSON.stringify(
      px.onLine,
    )}; control=${JSON.stringify(px.control)}`,
  ).toBe(true);

  // Saving works: clicking "Save PNG" triggers a .png download.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByText("Save PNG").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});
