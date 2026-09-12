import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Web camera-denied path: the error overlay must offer a one-tap escape to
// manual entry (2026-09-12). A denied camera is a dead end on desktops and
// embedded browsers — the manual form can't live only in the tab row.

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

import { ImageCapture } from "@/components/wine/image-capture";

function denyCamera() {
  const denied = Object.assign(new Error("Permission denied"), {
    name: "NotAllowedError",
  });
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(() => Promise.reject(denied)) },
  });
}

describe("ImageCapture camera-denied escape hatch", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    denyCamera();
  });

  it("shows 'Add manually instead' on denial and calls onManualEntry", async () => {
    const onManualEntry = vi.fn();
    render(
      <ImageCapture onCapture={vi.fn()} autoStart fullScreen onManualEntry={onManualEntry} />
    );
    const manual = await screen.findByRole("button", { name: /add manually instead/i });
    expect(await screen.findByText(/camera access denied/i)).toBeInTheDocument();
    manual.click();
    expect(onManualEntry).toHaveBeenCalledTimes(1);
  });

  it("omits the manual button when no onManualEntry is given", async () => {
    render(<ImageCapture onCapture={vi.fn()} autoStart fullScreen />);
    await screen.findByText(/camera access denied/i);
    expect(
      screen.queryByRole("button", { name: /add manually instead/i })
    ).not.toBeInTheDocument();
  });
});

describe("ImageCapture denied-permission messaging", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    denyCamera();
  });

  function setPermissionState(state: string) {
    Object.defineProperty(global.navigator, "permissions", {
      configurable: true,
      value: { query: vi.fn(() => Promise.resolve({ state })) },
    });
  }

  it("says the site is BLOCKED when the Permissions API reports denied", async () => {
    setPermissionState("denied");
    render(<ImageCapture onCapture={vi.fn()} autoStart fullScreen />);
    expect(
      await screen.findByText(/blocked for this site/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/camera access denied\. allow/i)).not.toBeInTheDocument();
  });

  it("keeps the standard guidance when permission is still 'prompt' (a transient denial)", async () => {
    setPermissionState("prompt");
    render(<ImageCapture onCapture={vi.fn()} autoStart fullScreen />);
    expect(
      await screen.findByText(/allow camera access in your browser/i)
    ).toBeInTheDocument();
  });
});
