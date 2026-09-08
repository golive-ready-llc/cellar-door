import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest config — jsdom environment for component tests, with the same
 * "@/..." path alias Next.js uses. `tests/setup.ts` registers jest-dom
 * matchers globally, runs RTL cleanup after each test, and shims
 * matchMedia / scrollIntoView / ResizeObserver for Radix.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules", "dist", ".next"],
    // jsdom component renders (transform + import + React) get CPU-starved when
    // many test files run in parallel, so individual tests occasionally blow
    // past the 5s default and time out under load (verified: the same tests
    // finish in <1s in isolation). 20s gives headroom without masking a real
    // hang — a genuinely stuck test still fails.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
