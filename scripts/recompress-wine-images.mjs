#!/usr/bin/env node
/**
 * Re-compress label images already stored in the database to the same 800px
 * JPEG that new uploads use. Dry run by default: it reports what it would
 * change. Pass --apply to write.
 *
 *   DATABASE_URL=... node scripts/recompress-wine-images.mjs [--apply] [--min-kb=150] [--min-savings=10]
 *
 * Only raster data URLs larger than --min-kb (default 150 KB) are considered.
 * A row is updated only when the new image is at least --min-savings percent
 * smaller (default 10). Re-encoding a JPEG always shaves a few bytes, so
 * without that margin every rerun would re-encode already-compressed images
 * again and lose a little quality each time for no real saving. With it, a
 * second run finds nothing to do. The UPDATE also matches the old value, so
 * an image edited mid-run is never overwritten.
 * Uses sharp, which is already installed as a Next.js dependency.
 */
import pg from "pg";
import sharp from "sharp";
import { pathToFileURL } from "node:url";

export const MAX_DIM = 800;
export const QUALITY = 80;
export const DEFAULT_MIN_SAVINGS = 10;
const RASTER = /^data:image\/(jpeg|jpg|png|webp|gif|avif);base64,/i;
const TABLES = ["Wine", "WineHistory", "WineMetadata", "BuyListItem"];

/**
 * Decide what to do with one stored data URL.
 * Resolves to { next } when the image should be replaced, or { skip } with a
 * reason when it should be left alone. Rejects if the image cannot be decoded.
 */
export async function recompressDataUrl(stored, { minSavingsPercent = DEFAULT_MIN_SAVINGS } = {}) {
  if (!RASTER.test(stored)) return { skip: "not a supported raster image" };
  const output = await sharp(Buffer.from(stored.slice(stored.indexOf(",") + 1), "base64"))
    .rotate()
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer();
  const next = `data:image/jpeg;base64,${output.toString("base64")}`;
  if (next.length > stored.length * (1 - minSavingsPercent / 100)) {
    return { skip: `saves less than ${minSavingsPercent}%` };
  }
  return { next };
}

function numberArg(name, fallback) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  const value = arg ? Number(arg.split("=")[1]) : fallback;
  if (!Number.isFinite(value) || value < 0) {
    console.error(`--${name} must be a non-negative number`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const minBytes = numberArg("min-kb", 150) * 1024;
  const minSavingsPercent = numberArg("min-savings", DEFAULT_MIN_SAVINGS);
  if (minSavingsPercent >= 100) {
    console.error("--min-savings must be below 100");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  async function recompress(table) {
    // A data URL's base64 payload is about 4/3 of the image bytes.
    const { rows } = await client.query(
      `SELECT id, "imageUrl" FROM "${table}" WHERE "imageUrl" LIKE 'data:image/%' AND length("imageUrl") > $1`,
      [Math.floor((minBytes * 4) / 3)]
    );
    let changed = 0;
    let before = 0;
    let after = 0;
    const skipped = {};
    for (const row of rows) {
      const stored = row.imageUrl;
      let result;
      try {
        result = await recompressDataUrl(stored, { minSavingsPercent });
      } catch (err) {
        result = { skip: "could not decode" };
        console.warn(`  ${table} ${row.id}: could not decode (${err.message})`);
      }
      if (result.skip) {
        skipped[result.skip] = (skipped[result.skip] || 0) + 1;
        continue;
      }
      changed++;
      before += stored.length;
      after += result.next.length;
      if (apply) {
        await client.query(`UPDATE "${table}" SET "imageUrl" = $1 WHERE id = $2 AND "imageUrl" = $3`, [
          result.next,
          row.id,
          stored,
        ]);
      }
    }
    const mb = (n) => (n / 1048576).toFixed(1);
    const skipNote = Object.entries(skipped)
      .map(([reason, n]) => `${n} ${reason}`)
      .join(", ");
    console.log(
      `${table}: ${rows.length} large images, ${changed} ${apply ? "recompressed" : "would shrink"}` +
        `${changed ? ` (${mb(before)} MB -> ${mb(after)} MB)` : ""}` +
        `${skipNote ? `; skipped: ${skipNote}` : ""}`
    );
  }

  try {
    for (const table of TABLES) await recompress(table);
    if (!apply) console.log("Dry run. Re-run with --apply to write the changes.");
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
