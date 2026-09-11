#!/bin/sh
# Cellar Door container entrypoint.
#
# Syncs the database schema, then hands off to the server.
# Safe on every start: `prisma db push` is idempotent — it creates the schema
# on first boot and is a no-op when the database already matches.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is not set." >&2
  echo "       Set it to your Postgres connection string (compose does this" >&2
  echo "       for you). See SELF-HOSTING.md." >&2
  exit 1
fi

if [ -z "$ENCRYPTION_KEY" ]; then
  echo "WARNING: ENCRYPTION_KEY is not set — you won't be able to save AI" >&2
  echo "         provider keys in /admin or Home Assistant tokens." >&2
  echo "         Generate one with: openssl rand -hex 32" >&2
fi

# Invoke the CLI entry point directly (not via node_modules/.bin/prisma —
# that is a symlink, and COPY dereferences it, after which the CLI cannot
# find its sibling .wasm files). The CLI lives in its own tree so its
# dependencies stay separate from the standalone bundle's.
PRISMA="node ./.prisma-cli/node_modules/prisma/build/index.js"

# A linked Postgres container is often still starting when the app is
# scheduled, so retry — but surface the real error rather than assuming
# every failure is "database not ready".
#
# NOTE: --accept-data-loss is deliberately NOT passed. If a push would drop
# data, this fails loudly instead of destroying the user's cellar.
echo "==> Syncing database schema..."
attempt=0
max=30
while :; do
  # Prisma 7 notes:
  #   * --skip-generate was removed (the client is already generated into
  #     the bundle at build time, so there is nothing to skip).
  #   * the datasource URL normally comes from prisma.config.ts. Passing
  #     --url instead means the runtime image needs neither that file nor
  #     its dotenv dependency.
  if out=$($PRISMA db push --schema=./prisma/schema.prisma --url="$DATABASE_URL" 2>&1); then
    echo "$out"
    break
  fi
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max" ]; then
    echo "" >&2
    echo "FATAL: schema sync failed after ${max} attempts. Last error:" >&2
    echo "$out" >&2
    echo "" >&2
    echo "       Common causes:" >&2
    echo "         * DATABASE_URL is wrong or the database is unreachable" >&2
    echo "         * the database user lacks CREATE privileges" >&2
    echo "         * a destructive change was refused (see the error above)" >&2
    exit 1
  fi
  echo "    schema sync not ready (attempt ${attempt}/${max}); retrying in 2s"
  # Show the reason immediately so a real bug isn't hidden behind 30 retries.
  if [ "$attempt" = "1" ]; then
    echo "    reason: $(echo "$out" | tr '\n' ' ' | cut -c1-300)"
  fi
  sleep 2
done
echo "==> Schema is current."

echo "==> Starting Cellar Door on port ${PORT:-3000}"
exec "$@"
