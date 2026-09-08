import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Stub the AI server action so identify resolves to a known wine.
const { aiScanLabelMock } = vi.hoisted(() => ({
  aiScanLabelMock: vi.fn(),
}));
vi.mock("@/server/actions/ai", () => ({
  aiScanLabel: aiScanLabelMock,
}));

vi.mock("@/hooks/use-tier", () => ({
  useTier: () => ({
    userId: "user_1",
    tier: "PRO",
    isLoading: false,
    canUseAi: true,
    hasApiAccess: false,
    showAds: false,
  }),
}));

// Replace ImageCapture with a button — bypasses getUserMedia.
vi.mock("@/components/wine/image-capture", () => ({
  ImageCapture: ({
    onCapture,
  }: {
    onCapture: (b64: string, mime: string) => void;
  }) => (
    <button
      type="button"
      data-testid="stub-capture"
      onClick={() => onCapture("FAKE_B64", "image/jpeg")}
    >
      Stub Capture
    </button>
  ),
}));

import { LabelScanDialog } from "@/components/wine/label-scan-dialog";

beforeEach(() => {
  aiScanLabelMock.mockReset();
});

/** Walk the dialog into step="review" with a known identified wine. */
async function openAndIdentify() {
  fireEvent.click(screen.getByRole("button", { name: /label/i }));
  fireEvent.click(await screen.findByTestId("stub-capture"));
  fireEvent.click(
    await screen.findByRole("button", { name: /identify wine with ai/i })
  );
  await waitFor(() =>
    expect(screen.getByText(/wine identified/i)).toBeInTheDocument()
  );
}

describe("LabelScanDialog — handleSave", () => {
  it("awaits onAdd before closing — slow onAdd shows 'Saving...' and dialog stays open", async () => {
    aiScanLabelMock.mockResolvedValue({
      success: true,
      data: {
        name: "Slow Save Wine",
        winery: "X",
        vintage: 2018,
        type: "red",
        sparkling: false,
        grapeVariety: "",
        region: "",
        country: "",
        estimatedPrice: null,
        alcohol: "",
        description: "",
        drinkBy: "",
        drinkWindow: "",
        disposition: "",
      },
    });

    let resolveAdd: () => void = () => {};
    const onAdd = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolveAdd = res;
        })
    );

    render(<LabelScanDialog cabinets={[]} onAdd={onAdd} />);
    await openAndIdentify();

    fireEvent.click(screen.getByRole("button", { name: /save to cellar/i }));

    // While onAdd is pending, the button switches to "Saving..." — proof we
    // awaited rather than fired-and-forgot.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument();
    });
    // Dialog title still on review step
    expect(screen.getByText(/wine identified/i)).toBeInTheDocument();

    // Resolve and confirm dialog closes
    resolveAdd();
    await waitFor(() => {
      expect(screen.queryByText(/wine identified/i)).not.toBeInTheDocument();
    });
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("onAdd rejects → error shown, dialog stays open, saving state resets", async () => {
    aiScanLabelMock.mockResolvedValue({
      success: true,
      data: {
        name: "Reject Wine",
        winery: "X",
        vintage: 2018,
        type: "red",
        sparkling: false,
        grapeVariety: "",
        region: "",
        country: "",
        estimatedPrice: null,
        alcohol: "",
        description: "",
        drinkBy: "",
        drinkWindow: "",
        disposition: "",
      },
    });

    const onAdd = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error("server unreachable"));

    render(<LabelScanDialog cabinets={[]} onAdd={onAdd} />);
    await openAndIdentify();

    fireEvent.click(screen.getByRole("button", { name: /save to cellar/i }));

    // Error surfaces in the dialog
    await waitFor(() => {
      expect(screen.getByText(/server unreachable/i)).toBeInTheDocument();
    });
    // Still on review step
    expect(screen.getByText(/wine identified/i)).toBeInTheDocument();
    // Save button is back to its idle label (saving reset to false)
    expect(
      screen.getByRole("button", { name: /save to cellar/i })
    ).toBeInTheDocument();
  });

  it("falls back to a generic error message if the rejection is not an Error", async () => {
    aiScanLabelMock.mockResolvedValue({
      success: true,
      data: {
        name: "Plain Reject",
        winery: "X",
        vintage: 2018,
        type: "red",
        sparkling: false,
        grapeVariety: "",
        region: "",
        country: "",
        estimatedPrice: null,
        alcohol: "",
        description: "",
        drinkBy: "",
        drinkWindow: "",
        disposition: "",
      },
    });
    const onAdd = vi.fn().mockRejectedValue("plain string");

    render(<LabelScanDialog cabinets={[]} onAdd={onAdd} />);
    await openAndIdentify();
    fireEvent.click(screen.getByRole("button", { name: /save to cellar/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/failed to save wine/i)
      ).toBeInTheDocument();
    });
  });
});

describe("LabelScanDialog — Scan Again", () => {
  it("clears imageBase64, name, and error so capture step reopens fresh", async () => {
    aiScanLabelMock.mockResolvedValueOnce({
      success: true,
      data: {
        name: "Original",
        winery: "Y",
        vintage: 2017,
        type: "red",
        sparkling: false,
        grapeVariety: "",
        region: "",
        country: "",
        estimatedPrice: null,
        alcohol: "",
        description: "",
        drinkBy: "",
        drinkWindow: "",
        disposition: "",
      },
    });
    // The second identify (after Scan Again) returns a different wine —
    // confirms state was actually reset.
    aiScanLabelMock.mockResolvedValueOnce({
      success: true,
      data: {
        name: "After Scan Again",
        winery: "Z",
        vintage: 2019,
        type: "red",
        sparkling: false,
        grapeVariety: "",
        region: "",
        country: "",
        estimatedPrice: null,
        alcohol: "",
        description: "",
        drinkBy: "",
        drinkWindow: "",
        disposition: "",
      },
    });

    render(<LabelScanDialog cabinets={[]} onAdd={vi.fn()} />);
    await openAndIdentify();

    expect(screen.getByDisplayValue("Original")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /scan again/i }));

    // Back at capture; capture stub is mounted, save button is gone.
    await waitFor(() => {
      expect(screen.getByText(/scan wine label/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId("stub-capture")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save to cellar/i })
    ).not.toBeInTheDocument();
    // Identify button hidden again because imageBase64 was cleared.
    expect(
      screen.queryByRole("button", { name: /identify wine with ai/i })
    ).not.toBeInTheDocument();
  });

  it("identify failure ('not_a_wine_label') surfaces a friendly message and returns to capture", async () => {
    aiScanLabelMock.mockResolvedValue({
      success: false,
      error: "not_a_wine_label",
    });
    render(<LabelScanDialog cabinets={[]} onAdd={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /label/i }));
    fireEvent.click(await screen.findByTestId("stub-capture"));
    fireEvent.click(
      await screen.findByRole("button", { name: /identify wine with ai/i })
    );
    await waitFor(() => {
      expect(
        screen.getByText(/doesn't appear to be a wine label/i)
      ).toBeInTheDocument();
    });
    // Dropped back to capture step
    expect(screen.getByText(/scan wine label/i)).toBeInTheDocument();
  });

  it("identify thrown error surfaces a generic 'Failed to identify wine' message", async () => {
    aiScanLabelMock.mockRejectedValue(new Error("boom"));
    render(<LabelScanDialog cabinets={[]} onAdd={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /label/i }));
    fireEvent.click(await screen.findByTestId("stub-capture"));
    fireEvent.click(
      await screen.findByRole("button", { name: /identify wine with ai/i })
    );
    await waitFor(() => {
      expect(screen.getByText(/failed to identify wine/i)).toBeInTheDocument();
    });
  });
});
