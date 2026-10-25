// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * /logo.png is 379 KB of source pixels, but every screen that shows it renders
 * it 64–160 px tall (app splash, welcome, landing hero, sidebar). A plain
 * <img src="/logo.png"> ships the full file; next/image serves a
 * display-sized variant instead (measured from production: 42 KB at w=384,
 * 79 KB at w=640 — the splash alone drops ~89% of its bytes). The optimizer
 * only kicks in when the element goes through next/image, so this test fails
 * on any JSX <img> that points at the raw asset. Metadata references
 * (og:image in blog posts) and the file itself are untouched.
 */

const SRC = path.resolve(process.cwd(), "src");

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

describe("the raw logo asset is never rendered by a plain <img>", () => {
  it("no JSX <img> points at /logo.png", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = fs.readFileSync(file, "utf8");
      // Match <img ... src="/logo.png" ...> (attribute order may vary).
      const imgMatches = text.match(/<img\b[^>]*>/g) ?? [];
      for (const tag of imgMatches) {
        if (/src=["']\/logo\.png["']/.test(tag)) {
          offenders.push(path.relative(process.cwd(), file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it.each([
    ["src/app/landing-client.tsx", "h-32 sm:h-40"],
    ["src/components/app-loading.tsx", "h-16"],
    ["src/app/(auth)/welcome/page.tsx", "h-20"],
  ])("%s renders the logo through next/image at display size", (rel, heightClass) => {
    const text = fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
    const usage = text.match(/<Image\b[^>]*src=["']\/logo\.png["'][^>]*>/);
    expect(usage, "expected a next/image usage of /logo.png").not.toBeNull();
    expect(usage![0]).toContain("sizes=");
    expect(usage![0]).toContain("priority");
    expect(usage![0]).toContain(heightClass);
  });
});
