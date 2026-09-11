/**
 * Case-insensitive lookup keys for the shared WineMetadata cache. Matching
 * winery/name case-insensitively can't use an index, and the table grows with
 * every user's scans, so rows also store lower-cased, trimmed keys and
 * lookups match those exactly (indexed on wineryKey, nameKey, vintage).
 * Existing rows are filled by scripts/backfill-wine-metadata-keys.sql.
 */
export function metadataKey(value: string): string {
  return value.trim().toLowerCase();
}

export function metadataWhere(winery: string, name: string, vintage: number | null) {
  return { wineryKey: metadataKey(winery), nameKey: metadataKey(name), vintage };
}
