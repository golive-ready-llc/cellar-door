// @vitest-environment node
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";

/**
 * Next.js leaves some packages (firebase-admin, pg, Prisma) as external
 * modules that are loaded with Node's own require() at runtime. Vercel's
 * function runtime does not allow require() of an ES module, so a CommonJS
 * external that pulls in an ESM-only dependency builds fine, works locally,
 * and then 500s every route that touches it in production.
 *
 * That is exactly what firebase-admin 14 did: jwks-rsa 4 requires jose 6,
 * which is ESM-only. This test loads each external with require(esm)
 * disabled, the same way Vercel does, so a dependency bump that
 * reintroduces the problem fails here instead of in production.
 */
const EXTERNALS = ["firebase-admin/app", "firebase-admin/auth", "pg", "@prisma/client/runtime/client"];

describe("server externals load on Vercel's runtime", () => {
  it.each(EXTERNALS)("%s loads without require() of ES modules", (spec) => {
    const run = spawnSync(
      process.execPath,
      ["--no-experimental-require-module", "-e", `require(${JSON.stringify(spec)})`],
      { encoding: "utf8", cwd: process.cwd() },
    );
    if (/bad option/i.test(run.stderr)) return; // Node without the flag: nothing to check
    expect(run.stderr).not.toMatch(/ERR_REQUIRE_ESM/);
    expect(run.status).toBe(0);
  });
});
