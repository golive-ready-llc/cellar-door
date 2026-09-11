#!/usr/bin/env node
/**
 * Re-compress label images already stored in the database to the same 800px
 * JPEG that new uploads use. Dry run by default: it reports what it would
 * change. Pass --apply to write.
 *
 *   DATABASE_URL=... node scripts/recompress-wine-images.mjs [--apply] [--min-kb=150]
 *
 * Only raster data URLs larger than --min-kb (default 150 KB) are considered,
 * and a row is updated only when the new image is smaller. The UPDATE also
 * matches the old value, so an image edited mid-run is never overwritten.
 * Uses sharp, which is already installed as a Next.js dependency.
 */
import pg from "pg";
import sharp from "sharp";

const apply = process.argv.includes("--apply");
const minKbArg = process.argv.find((a) => a.startsWith("--min-kb="));
const minBytes = (minKbArg ? Number(minKbArg.split("=")[1]) : 150) * 1024;
const MAX_DIM = 800;
const QUALITY = 80;
const RASTER = /^data:image\/(jpeg|jpg|png|webp|gif|avif);base64,/i;
const TABLES = ["Wine", "WineHistory", "WineMetadata", "BuyListItem"];

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
  let skipped = 0;
  let before = 0;
  let after = 0;
  for (const row of rows) {
    const stored = row.imageUrl;
    if (!RASTER.test(stored)) {
      skipped++;
      continue;
    }
    let output;
    try {
      output = await sharp(Buffer.from(stored.slice(stored.indexOf(",") + 1), "base64"))
        .rotate()
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toBuffer();
    } catch (err) {
      skipped++;
      console.warn(`  ${table} ${row.id}: could not decode (${err.message})`);
      continue;
    }
    const next = `data:image/jpeg;base64,${output.toString("base64")}`;
    if (next.length >= stored.length) {
      skipped++;
      continue;
    }
    changed++;
    before += stored.length;
    after += next.length;
    if (apply) {
      await client.query(`UPDATE "${table}" SET "imageUrl" = $1 WHERE id = $2 AND "imageUrl" = $3`, [
        next,
        row.id,
        stored,
      ]);
    }
  }
  const mb = (n) => (n / 1048576).toFixed(1);
  console.log(
    `${table}: ${rows.length} large images, ${changed} ${apply ? "recompressed" : "would shrink"}, ` +
      `${skipped} skipped, ${mb(before)} MB -> ${mb(after)} MB`
  );
}

try {
  for (const table of TABLES) await recompress(table);
  if (!apply) console.log("Dry run. Re-run with --apply to write the changes.");
} finally {
  await client.end();
}
