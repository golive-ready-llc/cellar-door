-- One-time backfill: propagate metadata from WineHistory → matching Wine rows
-- still in inventory (same user + name + winery + vintage, case-insensitive).
-- Only fills EMPTY fields on the inventory row — never overwrites user edits.
--
-- Safe to run multiple times (idempotent: empty-field guards).
--
-- Run with:
--   npx prisma db execute --file scripts/backfill-history-to-inventory.sql --schema prisma/schema.prisma

-- Rating: prefer consumeRating, else rating. Only fills NULL userRating.
UPDATE "Wine" w
SET "userRating" = COALESCE(h."consumeRating", h."rating")
FROM "WineHistory" h
WHERE w."userId" = h."userId"
  AND w."userRating" IS NULL
  AND COALESCE(h."consumeRating", h."rating") IS NOT NULL
  AND LOWER(w."name") = LOWER(h."name")
  AND LOWER(w."winery") = LOWER(h."winery")
  AND (w."vintage" IS NOT DISTINCT FROM h."vintage");

-- aiRatings (JSON)
UPDATE "Wine" w
SET "aiRatings" = h."aiRatings"
FROM "WineHistory" h
WHERE w."userId" = h."userId"
  AND w."aiRatings" IS NULL
  AND h."aiRatings" IS NOT NULL
  AND LOWER(w."name") = LOWER(h."name")
  AND LOWER(w."winery") = LOWER(h."winery")
  AND (w."vintage" IS NOT DISTINCT FROM h."vintage");

-- foodPairings (string, default "")
UPDATE "Wine" w
SET "foodPairings" = h."foodPairings"
FROM "WineHistory" h
WHERE w."userId" = h."userId"
  AND w."foodPairings" = ''
  AND h."foodPairings" <> ''
  AND LOWER(w."name") = LOWER(h."name")
  AND LOWER(w."winery") = LOWER(h."winery")
  AND (w."vintage" IS NOT DISTINCT FROM h."vintage");

-- description
UPDATE "Wine" w
SET "description" = h."description"
FROM "WineHistory" h
WHERE w."userId" = h."userId"
  AND w."description" = ''
  AND h."description" <> ''
  AND LOWER(w."name") = LOWER(h."name")
  AND LOWER(w."winery") = LOWER(h."winery")
  AND (w."vintage" IS NOT DISTINCT FROM h."vintage");

-- drinkWindow
UPDATE "Wine" w
SET "drinkWindow" = h."drinkWindow"
FROM "WineHistory" h
WHERE w."userId" = h."userId"
  AND w."drinkWindow" = ''
  AND h."drinkWindow" <> ''
  AND LOWER(w."name") = LOWER(h."name")
  AND LOWER(w."winery") = LOWER(h."winery")
  AND (w."vintage" IS NOT DISTINCT FROM h."vintage");

-- alcohol
UPDATE "Wine" w
SET "alcohol" = h."alcohol"
FROM "WineHistory" h
WHERE w."userId" = h."userId"
  AND w."alcohol" = ''
  AND h."alcohol" <> ''
  AND LOWER(w."name") = LOWER(h."name")
  AND LOWER(w."winery") = LOWER(h."winery")
  AND (w."vintage" IS NOT DISTINCT FROM h."vintage");

-- retailPrice
UPDATE "Wine" w
SET "retailPrice" = h."retailPrice"
FROM "WineHistory" h
WHERE w."userId" = h."userId"
  AND w."retailPrice" IS NULL
  AND h."retailPrice" IS NOT NULL
  AND LOWER(w."name") = LOWER(h."name")
  AND LOWER(w."winery") = LOWER(h."winery")
  AND (w."vintage" IS NOT DISTINCT FROM h."vintage");

-- Stamp aiEnrichedAt so bulk-enrich doesn't re-run on these.
-- Uses the history row's removedAt as a reasonable "was enriched by this date"
-- approximation. Only sets when NULL to respect any already-set value.
UPDATE "Wine" w
SET "aiEnrichedAt" = h."removedAt"
FROM "WineHistory" h
WHERE w."userId" = h."userId"
  AND w."aiEnrichedAt" IS NULL
  AND h."aiRatings" IS NOT NULL
  AND LOWER(w."name") = LOWER(h."name")
  AND LOWER(w."winery") = LOWER(h."winery")
  AND (w."vintage" IS NOT DISTINCT FROM h."vintage");
