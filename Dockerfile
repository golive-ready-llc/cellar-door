# =========================================================================
# Cellar Door — production container
#
# Runs the whole app from `node server.js`. No Vercel required.
# Prisma 7 here uses the pg DRIVER ADAPTER (@prisma/adapter-pg), so there is
# no Rust query engine to match to a platform — which is why Alpine is safe
# and no `binaryTargets` juggling is needed.
#
#   docker build -t cellardoor .
#   docker run -p 3000:3000 --env-file .env.local cellardoor
#
# Most people want `docker compose up` instead — see compose.yaml.
# =========================================================================

# ---- deps: install node_modules once, cached on lockfile changes ----------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# The schema must be present before `npm ci`, because the postinstall hook
# runs `prisma generate`.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# --ignore-scripts skips native postinstall builds. The only package that
# needs one is `canvas`, a devDependency that nothing imports — it exists
# purely so jsdom can back <canvas> in vitest. The app itself uses the
# browser's native canvas, so compiling Cairo into this image would cost
# build time and weight for nothing.
# Prisma's own postinstall is skipped too, but `npm run build` runs
# `prisma generate` explicitly in the builder stage, so nothing is lost.
RUN npm ci --ignore-scripts


# ---- builder: compile the Next.js standalone bundle ----------------------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Emits .next/standalone (see next.config.ts — this flag is what enables it).
ENV DOCKER_BUILD=true
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so
# anything the browser needs must be passed as a build arg, not just at run
# time. Supply them with `--build-arg`, or use compose.yaml which wires the
# common ones up for you.
ARG NEXT_PUBLIC_FIREBASE_API_KEY=""
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=""
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
ARG NEXT_PUBLIC_FIREBASE_APP_ID=""
ARG NEXT_PUBLIC_DEFAULT_TIER=""
ARG NEXT_PUBLIC_SINGLE_USER_MODE=""
ARG NEXT_PUBLIC_SITE_URL=""
ARG NEXT_PUBLIC_USE_MOCK=""
ARG NEXT_PUBLIC_ADMIN_EMAIL=""
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_DEFAULT_TIER=$NEXT_PUBLIC_DEFAULT_TIER \
    NEXT_PUBLIC_SINGLE_USER_MODE=$NEXT_PUBLIC_SINGLE_USER_MODE \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_USE_MOCK=$NEXT_PUBLIC_USE_MOCK \
    NEXT_PUBLIC_ADMIN_EMAIL=$NEXT_PUBLIC_ADMIN_EMAIL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

# A DATABASE_URL must parse at build time (some routes are statically
# analyzed); it is never connected to during the build.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN npm run build


# ---- prisma-cli: the migration tool, with its own complete dep tree -------
# Cherry-picking node_modules/prisma out of the builder does not work: the CLI
# has transitive deps (valibot, @prisma/dev, ...) that live elsewhere in the
# tree, so it crashes with "Cannot find module". Installing it standalone here
# keeps the runtime image small while guaranteeing a working CLI.
FROM node:22-alpine AS prisma-cli
WORKDIR /pcli
ARG PRISMA_VERSION
RUN npm init -y > /dev/null  && npm install --no-audit --no-fund "prisma@${PRISMA_VERSION}"


# ---- runner: minimal runtime image ---------------------------------------
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next's standalone output already contains a minimal traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# The schema + a working Prisma CLI are needed at STARTUP to create/patch the
# database on first boot (`prisma db push`). The CLI lives in its own
# directory so it never collides with the standalone bundle's node_modules.
COPY --from=builder    --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=prisma-cli --chown=nextjs:nodejs /pcli/node_modules ./.prisma-cli/node_modules

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
# Normalize line endings in case the repo was checked out on Windows.
# A CRLF shebang makes Docker fail with the very unhelpful
#   exec ./docker-entrypoint.sh: no such file or directory
RUN sed -i 's/\r$//' ./docker-entrypoint.sh \
 && chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
