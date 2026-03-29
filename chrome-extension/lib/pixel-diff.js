// Pixel-level image comparison engine.
// Compares two images (as canvas ImageData) and produces a diff heatmap.

const PixelDiff = (() => {
  /**
   * Compare two ImageData objects pixel-by-pixel.
   * Images must be the same dimensions (caller should resize first).
   *
   * @param {ImageData} imgA - First image (e.g. browser screenshot)
   * @param {ImageData} imgB - Second image (e.g. Figma design)
   * @param {object} opts
   * @param {number} opts.threshold - Per-channel difference threshold (0-255). Default 10.
   * @returns {{ diffImageData: ImageData, matchPercent: number, diffCount: number, totalPixels: number }}
   */
  function compare(imgA, imgB, opts = {}) {
    const threshold = opts.threshold ?? 10;
    const width = imgA.width;
    const height = imgA.height;
    const totalPixels = width * height;

    const diffCanvas = new OffscreenCanvas(width, height);
    const diffCtx = diffCanvas.getContext('2d');
    const diffImageData = diffCtx.createImageData(width, height);
    const diff = diffImageData.data;
    const a = imgA.data;
    const b = imgB.data;

    let diffCount = 0;

    for (let i = 0; i < a.length; i += 4) {
      const dr = Math.abs(a[i] - b[i]);
      const dg = Math.abs(a[i + 1] - b[i + 1]);
      const db = Math.abs(a[i + 2] - b[i + 2]);

      if (dr > threshold || dg > threshold || db > threshold) {
        // Pixel differs — paint it red with intensity proportional to diff
        const maxDiff = Math.max(dr, dg, db);
        const intensity = Math.min(255, maxDiff * 2);
        diff[i] = 255;                    // R
        diff[i + 1] = 0;                  // G
        diff[i + 2] = 0;                  // B
        diff[i + 3] = 80 + intensity * 0.7; // A (semi-transparent to fully opaque)
        diffCount++;
      } else {
        // Pixel matches — keep faded original
        diff[i] = a[i];
        diff[i + 1] = a[i + 1];
        diff[i + 2] = a[i + 2];
        diff[i + 3] = 40; // Very faded
      }
    }

    const matchPercent = totalPixels > 0
      ? Math.round(((totalPixels - diffCount) / totalPixels) * 10000) / 100
      : 100;

    return { diffImageData, matchPercent, diffCount, totalPixels };
  }

  /**
   * Load an image (URL or data URL) into ImageData at the given dimensions.
   * @param {string} src - Image source
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @returns {Promise<ImageData>}
   */
  async function loadImageData(src, width, height) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    return new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(ctx.getImageData(0, 0, width, height));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  }

  /**
   * Render ImageData to a data URL via OffscreenCanvas.
   * @param {ImageData} imageData
   * @returns {Promise<string>}
   */
  async function imageDataToURL(imageData) {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  return { compare, loadImageData, imageDataToURL };
})();
