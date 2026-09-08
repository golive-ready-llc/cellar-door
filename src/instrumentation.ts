import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation hook. Two jobs:
 *
 * 1. Load the Sentry server/edge config in the right runtime (the
 *    sentry.*.config.ts files are no-ops without a DSN, so this is safe
 *    when Sentry isn't configured).
 *
 * 2. `onRequestError` — capture every server-side request error, INCLUDING
 *    errors thrown in Server Actions and RSC renders. In production those
 *    are masked to the client ("An error occurred in the Server Components
 *    render… digest"), so without this hook the real message exists nowhere
 *    we can see. We log it with its digest (correlates with what the user
 *    screenshots) and forward to Sentry when a DSN is configured.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Same signature Next.js calls the hook with — reuse Sentry's typing.
export const onRequestError: typeof Sentry.captureRequestError = async (err, request, context) => {
  const digest = (err as { digest?: string })?.digest;
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  // One structured line in the server (Vercel) logs per masked client error.
  console.error(
    `[request-error]${digest ? ` digest=${digest}` : ""} ${context.routeType} ${request.method} ${request.path} (${context.routePath}) — ${message}`
  );
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureRequestError(err, request, context);
  }
};
