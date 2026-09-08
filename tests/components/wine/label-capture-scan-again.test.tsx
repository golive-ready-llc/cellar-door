import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Stub the AI server action so handleIdentify resolves to a known wine
// and pushes the dialog into step="review".
const { aiScanLabelMock } = vi.hoisted(() => ({
  aiScanLabelMock: vi.fn().mockResolvedValue({
    success: true,
    data: {
      name: "Mock Wine",
      winery: "Mock Winery",
      vintage: 2018,
      type: "red",
      sparkling: false,
      grapeVariety: "Pinot",
      region: "Burgundy",
      country: "France",
      estimatedPrice: 50,
      alcohol: "13%",
      description: "",
      drinkBy: "",
      drinkWindow: "2024-2030",
      disposition: "D",
    },
  }),
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

// Replace the heavy ImageCapture with a stub button that invokes
// onCapture directly — we don't want to deal with getUserMedia here.
vi.mock("@/components/wine/image-capture", () => ({
  ImageCapture: ({
    onCapture,
  }: {
    onCapture: (b64: string, mime: string) => void;
  }) => (
    <button
      type="button"
      data-testid="stub-capture"
      onClick={() => onCapture("FAKE_BASE64", "image/jpeg")}
    >
      Stub Capture
    </button>
  ),
}));

import { LabelScanDialog } from "@/components/wine/label-scan-dialog";

describe("LabelScanDialog — Scan Again", () => {
  it("clicking 'Scan Again' returns the flow to capture step (clears the captured image)", async () => {
    render(<LabelScanDialog cabinets={[]} onAdd={vi.fn()} />);

    // Open the dialog via its default trigger.
    fireEvent.click(screen.getByRole("button", { name: /label/i }));

    // We're now in step="capture". Simulate ImageCapture handing back a
    // base64 image — that enables the "Identify Wine with AI" button.
    fireEvent.click(await screen.findByTestId("stub-capture"));

    // Click identify → triggers the mocked aiScanLabel → step="review".
    const identifyBtn = await screen.findByRole("button", {
      name: /identify wine with ai/i,
    });
    fireEvent.click(identifyBtn);

    // Wait for the review step (title changes to "Wine Identified").
    await waitFor(() => {
      expect(screen.getByText(/wine identified/i)).toBeInTheDocument();
    });
    expect(aiScanLabelMock).toHaveBeenCalledTimes(1);

    // The "Save to Cellar" button confirms we're on review step.
    expect(
      screen.getByRole("button", { name: /save to cellar/i })
    ).toBeInTheDocument();

    // Click "Scan Again" — this should reset step to "capture" and clear
    // imageBase64 (the parent state machine).
    fireEvent.click(screen.getByRole("button", { name: /scan again/i }));

    // Back at capture step — title flips and ImageCapture stub re-renders.
    await waitFor(() => {
      expect(screen.getByText(/scan wine label/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId("stub-capture")).toBeInTheDocument();
    // Save button is gone (no review step) and no Identify button (image
    // cleared, button is conditional on imageBase64).
    expect(
      screen.queryByRole("button", { name: /save to cellar/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /identify wine with ai/i })
    ).not.toBeInTheDocument();
  });
});
