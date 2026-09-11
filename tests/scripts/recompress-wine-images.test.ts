// @vitest-environment node
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { recompressDataUrl, MAX_DIM } from "../../scripts/recompress-wine-images.mjs";

/**
 * The recompression script rewrites label images in production. Re-encoding a
 * JPEG always shaves a few bytes, so without a minimum saving every rerun
 * would re-encode the same images again and lose quality for nothing. These
 * tests pin that a second pass over the script's own output is a no-op.
 */

async function noisyImage(width: number, height: number, format: "png" | "jpeg") {
  // Random pixels compress badly, like a real photo, so sizes are realistic.
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  const img = sharp(raw, { raw: { width, height, channels: 3 } });
  const buf = format === "png" ? await img.png().toBuffer() : await img.jpeg({ quality: 95 }).toBuffer();
  return `data:image/${format};base64,${buf.toString("base64")}`;
}

describe("recompressDataUrl", () => {
  it("shrinks a large image to an 800px JPEG", async () => {
    const stored = await noisyImage(2000, 1500, "png");
    const result = await recompressDataUrl(stored);
    expect(result.next).toMatch(/^data:image\/jpeg;base64,/);
    expect(result.next!.length).toBeLessThan(stored.length);
    const meta = await sharp(Buffer.from(result.next!.split(",")[1], "base64")).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBe(MAX_DIM);
  });

  it("leaves its own output alone, so a rerun changes nothing", async () => {
    const first = await recompressDataUrl(await noisyImage(2000, 1500, "jpeg"));
    expect(first.next).toBeDefined();
    const second = await recompressDataUrl(first.next!);
    expect(second.next).toBeUndefined();
    expect(second.skip).toMatch(/saves less than 10%/);
  });

  it("skips a re-encode that only saves a little", async () => {
    const stored = await noisyImage(700, 500, "jpeg");
    const result = await recompressDataUrl(stored, { minSavingsPercent: 99 });
    expect(result.next).toBeUndefined();
  });

  it("skips data URLs that are not a supported raster format", async () => {
    const result = await recompressDataUrl("data:image/svg+xml;base64,PHN2Zy8+");
    expect(result.skip).toMatch(/not a supported raster image/);
  });

  it("rejects an image it cannot decode", async () => {
    await expect(recompressDataUrl("data:image/jpeg;base64,bm90IGFuIGltYWdl")).rejects.toThrow();
  });
});
