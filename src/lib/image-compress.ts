/**
 * Browser-only image downscaling for images we persist as data URLs (label
 * photos, AI-fetched label images). Stored images come back with every
 * cellar list query, so an unbounded phone photo (often several MB) would
 * ride along with every page load. 800px JPEG is plenty for a label.
 */
export const STORED_IMAGE_MAX_DIM = 800;
export const STORED_IMAGE_QUALITY = 0.8;
const LOAD_TIMEOUT_MS = 10_000;

export function compressDataUrl(
  src: string,
  maxDim: number = STORED_IMAGE_MAX_DIM,
  quality: number = STORED_IMAGE_QUALITY
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error("Image load timed out")), LOAD_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      // JPEG has no alpha: paint white first so transparent PNGs don't turn black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const out = canvas.toDataURL("image/jpeg", quality);
      // An already-small image can grow when re-encoded; keep the smaller one.
      resolve(out.length < src.length ? out : src);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Failed to load image"));
    };
    img.src = src;
  });
}

/**
 * Compress a data-URL image before storing it. Remote URLs pass through
 * untouched (a cross-origin image can't be read back from a canvas), and a
 * failure falls back to the original rather than losing the image.
 */
export async function compressForStorage(url: string): Promise<string> {
  if (!url.startsWith("data:image/")) return url;
  try {
    return await compressDataUrl(url);
  } catch {
    return url;
  }
}
