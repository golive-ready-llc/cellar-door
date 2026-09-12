import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// While a Base UI modal is open, every direct <body> child outside its own
// popup gets aria-hidden + data-base-ui-inert. The full-screen camera overlay
// used to portal to <body>, which hid all of its buttons from screen readers
// (and from getByRole). The host dialog now renders edge-to-edge for camera
// views and the overlay renders inline inside the popup, so it must stay in
// the accessibility tree.

import { ImageCapture } from "@/components/wine/image-capture";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function noCamera() {
  const err = Object.assign(new Error("Requested device not found"), {
    name: "NotFoundError",
  });
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(() => Promise.reject(err)) },
  });
}

function overlay(): HTMLElement | null {
  return document.querySelector("[data-camera-overlay]");
}

beforeEach(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  noCamera();
});

describe("ImageCapture full-screen placement", () => {
  it("stays inside the dialog popup and visible to the accessibility tree", async () => {
    render(
      <Dialog open>
        <DialogContent fullscreen showCloseButton={false}>
          <DialogTitle>Scan wine</DialogTitle>
          <ImageCapture onCapture={vi.fn()} fullScreen autoStart />
        </DialogContent>
      </Dialog>
    );
    const upload = await screen.findByRole("button", { name: "Upload from Gallery" });
    const el = overlay();
    expect(el).toBeTruthy();
    // Inside the dialog's Base UI portal subtree (not a stray body child)…
    expect(el!.closest("[data-base-ui-portal]")).toBeTruthy();
    // …not marked hidden by the modal's hide-others pass…
    expect(el!.getAttribute("aria-hidden")).toBeNull();
    expect(el!.hasAttribute("inert")).toBe(false);
    // …and its controls resolve in the accessibility tree (getByRole itself
    // is the assertion: role locators exclude aria-hidden subtrees).
    expect(upload).toBeTruthy();
  });

  it("renders fixed to the viewport when used outside any dialog", async () => {
    render(<ImageCapture onCapture={vi.fn()} fullScreen autoStart />);
    const upload = await screen.findByRole("button", { name: "Upload from Gallery" });
    const el = overlay();
    expect(el).toBeTruthy();
    expect(el!.className).toContain("fixed");
    expect(el!.getAttribute("aria-hidden")).toBeNull();
    expect(upload).toBeTruthy();
  });
});
