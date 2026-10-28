import { describe, it, expect } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * The gate page sends the user to ?next= once the site password checks out.
 * These tests pin the same-origin allow-list, including the backslash form:
 * `new URL("/\\evil.com", "https://app.com").href` is "https://evil.com/",
 * so a leading slash alone is not a safe check.
 */
describe("safeNextPath", () => {
  it("allows same-origin paths", () => {
    expect(safeNextPath("/cellar")).toBe("/cellar");
    expect(safeNextPath("/stats?metric=price")).toBe("/stats?metric=price");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("///evil.com")).toBe("/");
  });

  it("rejects the backslash form browsers normalize to //evil.com", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/\\/\\evil.com")).toBe("/");
  });

  it("falls back on missing, bare, or relative values", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("cellar")).toBe("/");
  });

  it("honors a custom fallback", () => {
    expect(safeNextPath("//evil.com", "/welcome")).toBe("/welcome");
  });
});
