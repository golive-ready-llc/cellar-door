-- Fill WineMetadata.wineryKey / nameKey for rows created before the key
-- columns existed. Run once, right after `prisma db push` adds the columns
-- and before deploying the code that looks rows up by key. Safe to re-run.
UPDATE "WineMetadata"
SET "wineryKey" = lower(btrim("winery")),
    "nameKey"   = lower(btrim("name"))
WHERE "wineryKey" = '' OR "nameKey" = '';
