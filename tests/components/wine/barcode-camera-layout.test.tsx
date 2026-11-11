import { expect, it, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const camera = vi.hoisted(() => ({ displayAtStart: null as string | null }));
vi.mock("html5-qrcode", () => ({
  Html5Qrcode: class {
    constructor(private id: string) {}
    async start() {
      const host = document.getElementById(this.id)!;
      // html5-qrcode measures this element while acquiring the camera.
      camera.displayAtStart = getComputedStyle(host).display;
    }
    getState() { return 2; }
    async stop() {}
  },
}));
import { BarcodeScanner } from "@/components/wine/barcode-scanner";

afterEach(() => vi.unstubAllGlobals());

it("starts the fallback in a layout-visible container before camera readiness", async () => {
  vi.stubGlobal("BarcodeDetector", undefined);
  camera.displayAtStart = null;
  render(<BarcodeScanner active onDetected={vi.fn()} />);
  await waitFor(() => expect(camera.displayAtStart).not.toBeNull());
  expect(camera.displayAtStart).not.toBe("none");
});
