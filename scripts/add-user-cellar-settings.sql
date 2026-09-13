-- Adds per-account cellar settings: the first-run setup flag and the cellar name.
-- Both used to live only in browser localStorage, so "Name Your Cellar" came back
-- on every new device and the name never followed the owner.
--
-- Run this BEFORE deploying the code that reads these columns: queries that
-- select every User column would fail until they exist.
-- Safe to re-run: both columns use ADD COLUMN IF NOT EXISTS.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "cellarName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMP(3);
