/**
 * Vitest global setup — runs once before any test file.
 *
 * Imports the jest-dom matcher extension so component tests can use
 * `toBeInTheDocument`, `toHaveTextContent`, etc. against the jsdom DOM.
 * Per-test mocks for `next/navigation` belong inside individual test
 * files via vi.mock — keeping them out of global setup avoids leaking
 * router state across unrelated tests.
 *
 * `cleanup()` runs after each test because @testing-library/react does
 * NOT auto-cleanup under Vitest unless globals are enabled. Without
 * this, multiple component tests in the same file leak DOM into each
 * other and cause flaky failures.
 *
 * Radix shims (matchMedia / scrollIntoView / ResizeObserver) are
 * required for any test that mounts Radix dialogs / popovers / sheets;
 * jsdom doesn't implement them.
 */
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (q: string) => ({
        matches: false,
        media: q,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
  if (!(window as unknown as { ResizeObserver?: unknown }).ResizeObserver) {
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
  }
}
