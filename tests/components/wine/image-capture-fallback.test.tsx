import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Regression test for the gating bug where the native fallback buttons
 * ("Take Photo" / "Gallery") rendered ON TOP of the live web-camera
 * viewfinder on native devices when getUserMedia *succeeded*. The fix:
 * gate that block on `!cameraActive`. These tests verify both branches.
 */

// react-dom's createPortal is happy in jsdom but let's render inline so
// `screen` queries find the content without portal lookups.
vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

// `isNative` is a top-level const — to test the native gating path we
// need it to evaluate to `true`.
vi.mock("@/lib/capacitor", () => ({
  isNative: true,
  takeNativePhoto: vi.fn().mockResolvedValue({ ok: false, reason: "cancelled" }),
  pickNativePhoto: vi.fn().mockResolvedValue({ ok: false, reason: "cancelled" }),
  hapticTap: vi.fn(),
}));

import { ImageCapture } from "@/components/wine/image-capture";

function setGetUserMedia(impl: () => Promise<MediaStream>) {
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(impl) },
  });
}

describe("ImageCapture native fallback gating (fullScreen)", () => {
  beforeEach(() => {
    // jsdom video.play() isn't implemented — stub it.
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("does NOT render native 'Take Photo' / 'Gallery' fallback when getUserMedia succeeds", async () => {
    const fakeStream = {
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream;
    setGetUserMedia(() => Promise.resolve(fakeStream));

    render(<ImageCapture onCapture={vi.fn()} autoStart fullScreen />);

    // Wait for camera-active state. The web bottom-bar Gallery span will
    // render once active; that's our signal the camera path took over.
    await waitFor(() => {
      // The web shutter bottom bar renders a "Gallery" label span when
      // cameraActive=true. Once we see it, the native fallback should be
      // gone. ("Take Photo" is unique to the native fallback CTA.)
      expect(
        document.querySelector('span.text-white\\/70')
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/^Take Photo$/)).not.toBeInTheDocument();
  });

  it("DOES render native fallback when getUserMedia rejects", async () => {
    setGetUserMedia(() =>
      Promise.reject(new Error("NotAllowedError: Permission denied"))
    );

    render(<ImageCapture onCapture={vi.fn()} autoStart fullScreen />);

    // After getUserMedia rejects on native, the effect calls
    // handleNativeCamera() which (per our mock) resolves with
    // { ok: false, reason: "cancelled" } — leaving cameraActive=false,
    // cameraError=null. That's the state where the fallback CTA shows.
    await waitFor(() => {
      expect(screen.getByText(/^Take Photo$/)).toBeInTheDocument();
    });
    expect(screen.getByText(/^Gallery$/)).toBeInTheDocument();
  });
});
