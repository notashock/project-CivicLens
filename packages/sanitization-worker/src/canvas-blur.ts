export interface BlurBoundingBox {
  x: number;      // 0.0 to 1.0 (normalized)
  y: number;      // 0.0 to 1.0 (normalized)
  width: number;  // 0.0 to 1.0 (normalized)
  height: number; // 0.0 to 1.0 (normalized)
}

/**
 * Applies pixelation/blur to specified normalized bounding box regions on an ImageData buffer.
 * Designed to run in browser Web Workers / OffscreenCanvas without DOM dependencies.
 */
export function pixelateRegions(
  pixelData: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  regions: BlurBoundingBox[],
  blockSize: number = 16
): void {
  for (const box of regions) {
    const startX = Math.floor(box.x * imageWidth);
    const startY = Math.floor(box.y * imageHeight);
    const endX = Math.min(imageWidth, Math.ceil((box.x + box.width) * imageWidth));
    const endY = Math.min(imageHeight, Math.ceil((box.y + box.height) * imageHeight));

    for (let y = startY; y < endY; y += blockSize) {
      for (let x = startX; x < endX; x += blockSize) {
        const blockW = Math.min(blockSize, endX - x);
        const blockH = Math.min(blockSize, endY - y);

        // Compute average RGB for block
        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let count = 0;

        for (let by = 0; by < blockH; by++) {
          for (let bx = 0; bx < blockW; bx++) {
            const idx = ((y + by) * imageWidth + (x + bx)) * 4;
            totalR += pixelData[idx]!;
            totalG += pixelData[idx + 1]!;
            totalB += pixelData[idx + 2]!;
            count++;
          }
        }

        const avgR = Math.round(totalR / count);
        const avgG = Math.round(totalG / count);
        const avgB = Math.round(totalB / count);

        // Fill block with average
        for (let by = 0; by < blockH; by++) {
          for (let bx = 0; bx < blockW; bx++) {
            const idx = ((y + by) * imageWidth + (x + bx)) * 4;
            pixelData[idx] = avgR;
            pixelData[idx + 1] = avgG;
            pixelData[idx + 2] = avgB;
          }
        }
      }
    }
  }
}
