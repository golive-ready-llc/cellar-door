#!/usr/bin/env bash
# Restore the production Postgres database from an Azure Blob backup
# produced by .github/workflows/db-backup.yml.
#
# Usage:
#   # Restore the LATEST backup into a fresh Neon recovery branch:
#   AZURE_STORAGE_CONNECTION_STRING=... \
#   AZURE_STORAGE_CONTAINER=cellar-door-db-backups \
#   TARGET_DATABASE_URL=postgresql://... \
#   ./scripts/restore-from-azure-backup.sh latest
#
#   # Restore a specific dated backup:
#   ./scripts/restore-from-azure-backup.sh cellar-door-2026-04-29T03-00-00Z.dump
#
# IMPORTANT: NEVER run this with TARGET_DATABASE_URL pointing at the
# live production database without first creating a Neon recovery branch
# and validating the dump there. The recommended flow is:
#   1. Create a recovery branch in Neon (Console → Branches → New branch from production)
#   2. Get the connection string for that branch
#   3. Run this script with TARGET_DATABASE_URL set to the recovery branch
#   4. Validate the data
#   5. If good, alias the recovery branch as the new production OR copy
#      data back via pg_dump → recovery → production swap.

set -euo pipefail

WHICH="${1:-}"
if [ -z "$WHICH" ]; then
  echo "Usage: $0 <backup-name | latest>"
  echo "  Examples:"
  echo "    $0 latest"
  echo "    $0 cellar-door-2026-04-29T03-00-00Z.dump"
  exit 1
fi

: "${AZURE_STORAGE_CONNECTION_STRING:?env var AZURE_STORAGE_CONNECTION_STRING is required}"
: "${AZURE_STORAGE_CONTAINER:?env var AZURE_STORAGE_CONTAINER is required}"
: "${TARGET_DATABASE_URL:?env var TARGET_DATABASE_URL is required (use a RECOVERY BRANCH, not live prod)}"

# Safety check — refuse to restore directly to anything that looks like
# the live production endpoint. Set PROD_DB_MARKER to a distinctive
# substring of YOUR production connection string (the hosted instance's
# marker lives in the private DR runbook, not in this public script).
# The user can override with FORCE=1 if they really know what they're doing.
if [ -z "${PROD_DB_MARKER:-}" ]; then
  echo "NOTE: PROD_DB_MARKER is not set — the production-endpoint guard is inactive."
fi
if [ -n "${PROD_DB_MARKER:-}" ] && [[ "$TARGET_DATABASE_URL" == *"$PROD_DB_MARKER"* ]] && [ "${FORCE:-}" != "1" ]; then
  echo "ERROR: TARGET_DATABASE_URL points at the live production endpoint."
  echo "Restore into a Neon recovery branch first. To override, set FORCE=1."
  exit 1
fi

if [ "$WHICH" = "latest" ]; then
  BLOB_PATH="latest/latest.dump"
  LOCAL_FILE="latest.dump"
else
  BLOB_PATH="daily/$WHICH"
  LOCAL_FILE="$WHICH"
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
cd "$TMP_DIR"

echo "==> Downloading $BLOB_PATH from container $AZURE_STORAGE_CONTAINER..."
az storage blob download \
  --container-name "$AZURE_STORAGE_CONTAINER" \
  --name "$BLOB_PATH" \
  --file "$LOCAL_FILE" \
  --no-progress
ls -lh "$LOCAL_FILE"

echo "==> Restoring into target database..."
echo "    (this DROPS ALL EXISTING DATA in the target — use a recovery branch!)"
sleep 3
# --clean drops objects before recreating; --if-exists makes drops idempotent.
# -j 4 = 4 parallel restore workers (custom format only).
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --jobs=4 \
  --verbose \
  --dbname="$TARGET_DATABASE_URL" \
  "$LOCAL_FILE" 2>&1 | tail -50

echo ""
echo "==> Restore complete. Quick smoke test:"
psql "$TARGET_DATABASE_URL" -c "SELECT count(*) AS users FROM \"User\";"
psql "$TARGET_DATABASE_URL" -c "SELECT count(*) AS wines FROM \"Wine\";"

echo ""
echo "==> Done. Verify data manually before promoting the recovery branch."
