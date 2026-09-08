import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/** BarcodeScanView uses DialogHeader/DialogTitle which require a Dialog
 *  root context — wrap every render in an open Dialog so base-ui has the
 *  context it needs. */
function renderInDialog(node: React.ReactElement) {
  return render(
    <Dialog open onOpenChange={() => {}}>
      <DialogContent>{node}</DialogContent>
    </Dialog>
  );
}

// Stub BarcodeScanner — the real one calls navigator.mediaDevices.getUserMedia
// and BarcodeDetector, neither of which exist in jsdom. We expose
// `data-testid="manual-barcode"` so tests can drive a "manual barcode"
// scenario through the same onDetected contract the real component uses.
vi.mock("@/components/wine/barcode-scanner", () => ({
  BarcodeScanner: ({
    active,
    onDetected,
  }: {
    active: boolean;
    onDetected: (b: string) => void;
  }) => (
    <div data-testid="barcode-scanner-stub" data-active={String(active)}>
      <button
        type="button"
        data-testid="manual-barcode"
        onClick={() => onDetected("0123456789012")}
      >
        Manual: emit barcode
      </button>
    </div>
  ),
}));

import { BarcodeScanView } from "@/components/wine/add-wine-form-sections";

describe("BarcodeScanView", () => {
  it("renders the scanner with the correct active flag and a Back button", () => {
    renderInDialog(
      <BarcodeScanView
        aiError={null}
        open={true}
        onDetected={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText(/scan barcode/i)).toBeInTheDocument();
    const stub = screen.getByTestId("barcode-scanner-stub");
    expect(stub).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("manual barcode entry through the scanner fires onDetected with the value", () => {
    const onDetected = vi.fn();
    renderInDialog(
      <BarcodeScanView
        aiError={null}
        open={true}
        onDetected={onDetected}
        onBack={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("manual-barcode"));
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith("0123456789012");
  });

  it("clicking Back fires onBack", () => {
    const onBack = vi.fn();
    renderInDialog(
      <BarcodeScanView
        aiError={null}
        open={true}
        onDetected={vi.fn()}
        onBack={onBack}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders an AI error banner when aiError is non-null", () => {
    renderInDialog(
      <BarcodeScanView
        aiError="Lookup failed"
        open={true}
        onDetected={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText(/lookup failed/i)).toBeInTheDocument();
  });
});
