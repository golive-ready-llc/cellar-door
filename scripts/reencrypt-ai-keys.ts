/**
 * One-shot: encrypt any AI provider API keys that are currently stored as
 * PLAINTEXT in the AIConfig row, using AES-256-GCM via @/lib/encryption.
 *
 * Run with (loads ENCRYPTION_KEY + DATABASE_URL before imports):
 *   npx tsx --env-file=.env.production.local scripts/reencrypt-ai-keys.ts
 *
 * ── READ THIS FIRST ─────────────────────────────────────────────────────────
 * ENCRYPTION_KEY must already be set in EVERY environment that reads this
 * database — including Vercel production — BEFORE you run this. Encryption is
 * symmetric: once a key column is encrypted, an environment without the matching
 * ENCRYPTION_KEY can no longer decrypt it. getAIConfig() would then hand the raw
 * ciphertext to the provider as if it were the API key, and AI calls would fail.
 *
 * Correct order of operations:
 *   1. Set ENCRYPTION_KEY (64-char hex) in Vercel prod env (same value as local).
 *   2. Redeploy so prod picks it up.
 *   3. Run this script against the prod DB.
 *
 * Idempotent: keys that already decrypt cleanly are left untouched, so it is
 * safe to re-run. Never logs key material.
 */
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

const KEY_COLUMNS = [
  "textApiKey",
  "textFailoverApiKey",
  "visionApiKey",
  "visionFailoverApiKey",
] as const;

if (!process.env.DATABASE_URL) {
  console.error(
    "[reencrypt] DATABASE_URL not set. Run with:\n" +
      "  npx tsx --env-file=.env.production.local scripts/reencrypt-ai-keys.ts"
  );
  process.exit(1);
}

// Fail fast if ENCRYPTION_KEY is missing/invalid — otherwise encrypt() would
// throw per-column and we'd do nothing useful.
try {
  encrypt("probe");
} catch {
  console.error(
    "[reencrypt] ENCRYPTION_KEY is not set or not a 64-char hex string.\n" +
      "  Generate one with: openssl rand -hex 32\n" +
      "  Then set it in this env (and in Vercel prod) and re-run."
  );
  process.exit(1);
}

/** A value is "already encrypted" iff it decrypts cleanly with the current key. */
function isEncrypted(value: string): boolean {
  try {
    decrypt(value);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const row = await prisma.aIConfig.findUnique({ where: { id: "default" } });
  if (!row) {
    console.log("[reencrypt] No AIConfig row (id=default) — nothing to do.");
    return;
  }

  const update: Record<string, string> = {};
  const rowAsRecord = row as unknown as Record<string, string | null>;

  for (const col of KEY_COLUMNS) {
    const val = rowAsRecord[col];
    if (!val) {
      console.log(`  ${col}: empty — skip`);
      continue;
    }
    if (isEncrypted(val)) {
      console.log(`  ${col}: already encrypted — skip`);
      continue;
    }
    update[col] = encrypt(val);
    console.log(`  ${col}: plaintext (len ${val.length}) → encrypting`);
  }

  if (Object.keys(update).length === 0) {
    console.log("[reencrypt] All keys already encrypted — nothing changed.");
    return;
  }

  await prisma.aIConfig.update({ where: { id: "default" }, data: update });
  console.log(
    `[reencrypt] Encrypted ${Object.keys(update).length} key column(s): ${Object.keys(
      update
    ).join(", ")}`
  );
}

main()
  .catch((err) => {
    console.error("[reencrypt] Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
