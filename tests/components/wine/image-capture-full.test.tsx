import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// Render portal contents inline so screen.* finds them.
vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

// Hoisted mock state so we can flip isNative per test.
const capacitorMock = vi.hoisted(() => ({
  isNative: false,
  takeNativePhoto: vi.fn(),
  pickNativePhoto: vi.fn(),
  hapticTap: vi.fn(),
}));
vi.mock("@/lib/capacitor", () => capacitorMock);

import { ImageCapture } from "@/components/wine/image-capture";

function setGetUserMedia(impl: () => Promise<MediaStream>) {
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(impl) },
  });
}

function fakeStream(): MediaStream {
  return {
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream;
}

describe("ImageCapture (fullScreen)", () => {
  beforeEach(() => {
    capacitorMock.isNative = false;
    capacitorMock.takeNativePhoto.mockReset();
    capacitorMock.pickNativePhoto.mockReset();
    capacitorMock.hapticTap.mockReset();

    // jsdom doesn't implement HTMLMediaElement.play
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("renders the full-screen viewport when fullScreen=true (Scan Wine label)", () => {
    setGetUserMedia(() => new Promise(() => {})); // never resolves
    render(<ImageCapture onCapture={vi.fn()} fullScreen />);
    expect(screen.getByText(/Scan Wine/i)).toBeInTheDocument();
  });

  it("calls onClose when the X button is clicked", () => {
    const onClose = vi.fn();
    setGetUserMedia(() => new Promise(() => {}));
    render(<ImageCapture onCapture={vi.fn()} fullScreen onClose={onClose} />);
    // The X button is the only button in the top bar; find by lucide icon
    const xBtn = document.querySelector("svg.lucide-x")?.closest("button") as HTMLElement;
    expect(xBtn).toBeTruthy();
    fireEvent.click(xBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("autoStart triggers getUserMedia on mount", async () => {
    const gum = vi.fn(() => Promise.resolve(fakeStream()));
    Object.defineProperty(global.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: gum },
    });
    render(<ImageCapture onCapture={vi.fn()} autoStart fullScreen />);
    await waitFor(() => expect(gum).toHaveBeenCalledTimes(1));
  });

  it("on getUserMedia success: camera goes active, native fallback hidden, web shutter visible", async () => {
    setGetUserMedia(() => Promise.resolve(fakeStream()));
    render(<ImageCapture onCapture={vi.fn()} autoStart fullScreen />);

    // The web shutter renders the "Gallery" label span when cameraActive
    await waitFor(() => {
      const galleryLabel = screen.queryByText(/^Gallery$/);
      expect(galleryLabel).toBeInTheDocument();
    });
    // No "Take Photo" CTA — that's only for the native fallback
    expect(screen.queryByText(/^Take Photo$/)).not.toBeInTheDocument();
  });

  it("on getUserMedia rejection on web: shows the upload-fallback CTA", async () => {
    setGetUserMedia(() => Promise.reject(new Error("NotAllowedError")));
    render(<ImageCapture onCapture={vi.fn()} autoStart fullScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Upload from Gallery/i)).toBeInTheDocument();
    });
  });

  it("on getUserMedia rejection on native: falls back to handleNativeCamera (Take Photo button visible)", async () => {
    capacitorMock.isNative = true;
    capacitorMock.takeNativePhoto.mockResolvedValue({ ok: false, reason: "cancelled" });
    setGetUserMedia(() => Promise.reject(new Error("NotAllowed")));

    render(<ImageCapture onCapture={vi.fn()} autoStart fullScreen />);

    await waitFor(() => {
      expect(capacitorMock.takeNativePhoto).toHaveBeenCalled();
    });
    // After native cancel, the retry CTA renders
    await waitFor(() => {
      expect(screen.getByText(/^Take Photo$/)).toBeInTheDocument();
    });
  });

  it("capturePhoto calls onCapture with base64 + mime when shutter is clicked", async () => {
    setGetUserMedia(() => Promise.resolve(fakeStream()));
    const onCapture = vi.fn();

    // Stub canvas getContext + toDataURL to return a known data URL.
    const ctxStub = { drawImage: vi.fn() };
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ctxStub
    ) as unknown as HTMLCanvasElement["getContext"];
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => "data:image/jpeg;base64,AAAA"
    ) as unknown as HTMLCanvasElement["toDataURL"];

    // Stub Image so compressImage's "load → toDataURL" path resolves.
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 800;
      height = 600;
      set src(_v: string) {
        // Trigger load synchronously next tick
        queueMicrotask(() => this.onload?.());
      }
    }
    (global as unknown as { Image: typeof Image }).Image =
      FakeImage as unknown as typeof Image;

    render(<ImageCapture onCapture={onCapture} autoStart fullScreen />);

    // Wait for the web shutter (camera active)
    await waitFor(() =>
      expect(screen.queryByText(/^Gallery$/)).toBeInTheDocument()
    );

    // Find shutter — the big rounded-full button with size 16x16
    const shutter = document.querySelector(
      "button.w-16.h-16.rounded-full"
    ) as HTMLElement;
    expect(shutter).toBeTruthy();

    await act(async () => {
      fireEvent.click(shutter);
      // Allow microtasks to flush so the FakeImage onload fires
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(onCapture).toHaveBeenCalled());
    const [base64, mime] = onCapture.mock.calls[0];
    expect(typeof base64).toBe("string");
    expect(mime).toMatch(/^image\//);
  });

  it("switch camera flips facingMode (next getUserMedia call uses 'user')", async () => {
    const gum = vi.fn((c: MediaStreamConstraints) => {
      void c;
      return Promise.resolve(fakeStream());
    });
    Object.defineProperty(global.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: gum },
    });

    render(<ImageCapture onCapture={vi.fn()} autoStart fullScreen />);
    await waitFor(() => expect(gum).toHaveBeenCalledTimes(1));
    // First call uses default "environment"
    const firstCall = gum.mock.calls[0]?.[0] as MediaStreamConstraints | undefined;
    const firstVideo = firstCall?.video as { facingMode?: string } | undefined;
    expect(firstVideo?.facingMode).toBe("environment");

    // Click the Flip button — the SwitchCamera lucide icon's button. It only
    // mounts once startCamera resolves and the camera controls render, which is
    // a tick or two after the first getUserMedia CALL — so wait for it rather
    // than querying immediately (intermittently null under parallel load).
    let flipBtn: HTMLElement | null = null;
    await waitFor(() => {
      flipBtn = document
        .querySelector("svg.lucide-switch-camera")
        ?.closest("button") as HTMLElement | null;
      expect(flipBtn).toBeTruthy();
    });
    fireEvent.click(flipBtn!);

    await waitFor(() => expect(gum).toHaveBeenCalledTimes(2));
    const secondCall = gum.mock.calls[1]?.[0] as MediaStreamConstraints | undefined;
    const secondVideo = secondCall?.video as { facingMode?: string } | undefined;
    expect(secondVideo?.facingMode).toBe("user");
  });
});
