import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Cabinet } from "@/types/wine";

// ─── Mock the heavy deps the dialog reaches into ───────────────────
//
// The component's own useAddWineForm + the didAutoOpenRef live untouched
// — that's the behavior under test. We only stub OUTBOUND deps:
//
// - useTier: avoid Firebase
// - useWineData: avoid the wine-data context
// - useAIWineFill: returns no-op handlers (we never trigger AI here)
// - aiExtractWineList: not called in these flows
// - ImageCapture: replace the camera with a button so label-capture renders
// - BarcodeScanner: replace with a stub
// - WineNameAutocomplete / TagSelector / AISearchDialog / WineListResults:
//   stubs to keep the test render small

vi.mock("@/hooks/use-tier", () => ({
  useTier: () => ({
    userId: "u1",
    tier: "PRO",
    isLoading: false,
    canUseAi: true,
    hasAI: true,
    tierHasAI: true,
    can: () => true,
    hasApiAccess: false,
    showAds: false,
  }),
}));

vi.mock("@/contexts/wine-data-context", () => ({
  useWineData: () => ({ wines: [], cabinets: [], walls: [], allTags: [] }),
}));

vi.mock("@/hooks/use-ai-wine-fill", () => ({
  useAIWineFill: () => ({
    handleAIAutoFill: vi.fn(),
    handleLabelIdentify: vi.fn(),
    handleReceiptCapture: vi.fn(),
    handleReceiptSubmit: vi.fn(),
    handleBarcodeLookup: vi.fn(),
  }),
}));

vi.mock("@/server/actions/ai", () => ({
  aiExtractWineList: vi.fn(),
}));

vi.mock("@/components/wine/image-capture", () => ({
  ImageCapture: ({
    onCapture,
    onClose,
    renderTabs,
  }: {
    onCapture: (b: string, m: string) => void;
    onClose?: () => void;
    renderTabs?: React.ReactNode;
  }) => (
    <div data-testid="image-capture-stub">
      {renderTabs}
      <button
        type="button"
        data-testid="stub-capture"
        onClick={() => onCapture("FAKE_B64", "image/jpeg")}
      >
        Capture
      </button>
      {onClose && (
        <button type="button" data-testid="stub-close" onClick={onClose}>
          Close
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/wine/barcode-scanner", () => ({
  BarcodeScanner: () => <div data-testid="barcode-scanner-stub" />,
}));

vi.mock("@/components/wine/wine-name-autocomplete", () => ({
  WineNameAutocomplete: ({
    value,
    onChange,
    id,
  }: {
    value: string;
    onChange: (v: string) => void;
    onPickSuggestion?: (s: unknown) => void;
    id?: string;
    autoFocus?: boolean;
  }) => (
    <input
      data-testid="autocomplete-name"
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/wine/tag-selector", () => ({
  TagSelector: () => <div />,
}));

vi.mock("@/components/wine/ai-search-dialog", () => ({
  AISearchDialog: () => null,
}));

vi.mock("@/components/wine/wine-list-results", () => ({
  WineListResults: () => <div data-testid="wine-list-results" />,
  WineListResultsFooter: () => <div data-testid="wine-list-results-footer" />,
}));

import { AddWineDialog } from "@/components/wine/add-wine-dialog";

const cabinets: Cabinet[] = [];

describe("AddWineDialog — auto-jump from pick → label-capture (didAutoOpenRef)", () => {
  it("opening the dialog auto-jumps directly to label-capture (camera stub renders)", async () => {
    render(
      <AddWineDialog
        cabinets={cabinets}
        onAdd={vi.fn()}
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    // The camera-first effect runs after mount — image-capture stub appears.
    await waitFor(() => {
      expect(screen.getByTestId("image-capture-stub")).toBeInTheDocument();
    });
    // The MethodPicker's "Scan Wine Label" call-to-action is NOT rendered
    // (we skipped past pick view).
    expect(
      screen.queryByRole("button", { name: /scan wine/i })
    ).not.toBeInTheDocument();
  });

  it("after auto-jumping once, capturing then hitting Back lands on the MethodPicker (no infinite bounce)", async () => {
    render(
      <AddWineDialog
        cabinets={cabinets}
        onAdd={vi.fn()}
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    // Wait for the auto-jump to land in label-capture.
    await waitFor(() =>
      expect(screen.getByTestId("image-capture-stub")).toBeInTheDocument()
    );

    // Capture an image — this puts us in the captured-image review branch
    // of LabelCaptureView, which renders a real "Back" button wired to
    // goBack() (which routes the dialog back to "pick").
    fireEvent.click(screen.getByTestId("stub-capture"));

    // Now click Back — must land on MethodPicker (didAutoOpenRef prevents
    // an immediate re-jump).
    const backBtn = await screen.findByRole("button", { name: /back/i });
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /scan wine/i })
      ).toBeInTheDocument();
    });
    // The camera stub from label-capture should NOT be back on screen.
    expect(screen.queryByTestId("image-capture-stub")).not.toBeInTheDocument();
  });

  it("reopening the dialog after close auto-jumps again (ref resets on close)", async () => {
    let isOpen = true;
    const onOpenChange = vi.fn((next: boolean) => {
      isOpen = next;
    });

    const { rerender } = render(
      <AddWineDialog
        cabinets={cabinets}
        onAdd={vi.fn()}
        open={isOpen}
        onOpenChange={onOpenChange}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("image-capture-stub")).toBeInTheDocument()
    );

    // Simulate the dialog being closed externally (Esc / outside-click).
    isOpen = false;
    rerender(
      <AddWineDialog
        cabinets={cabinets}
        onAdd={vi.fn()}
        open={isOpen}
        onOpenChange={onOpenChange}
      />
    );
    await waitFor(() =>
      expect(screen.queryByTestId("image-capture-stub")).not.toBeInTheDocument()
    );

    // Reopen — the auto-jump must fire fresh.
    isOpen = true;
    rerender(
      <AddWineDialog
        cabinets={cabinets}
        onAdd={vi.fn()}
        open={isOpen}
        onOpenChange={onOpenChange}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("image-capture-stub")).toBeInTheDocument()
    );
  });

  it("opening renders the camera-first label-capture WITHOUT showing MethodPicker first", async () => {
    render(
      <AddWineDialog
        cabinets={cabinets}
        onAdd={vi.fn()}
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    // Both effects (auto-jump + reset) run on mount; we should not see
    // any MethodPicker buttons at all on first paint after the effect.
    await waitFor(() =>
      expect(screen.getByTestId("image-capture-stub")).toBeInTheDocument()
    );
    expect(
      screen.queryByRole("button", { name: /scan wine/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /scan barcode/i })
    ).not.toBeInTheDocument();
  });

  it("when controlled-closed initially, no auto-jump fires (effect is gated on open)", async () => {
    render(
      <AddWineDialog
        cabinets={cabinets}
        onAdd={vi.fn()}
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    // Give effects a tick to flush — there should still be no camera stub
    // because the auto-jump effect bails when !open.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.queryByTestId("image-capture-stub")).not.toBeInTheDocument();
  });

  it("the auto-jump effect uses the dialog's own setView/setEntryMethod and does NOT re-jump while staying open", async () => {
    // Render once, wait for jump, then re-render with the same open=true
    // prop. The effect should be a no-op (ref already true) and the
    // camera stub should still be the only content.
    const { rerender } = render(
      <AddWineDialog
        cabinets={cabinets}
        onAdd={vi.fn()}
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("image-capture-stub")).toBeInTheDocument()
    );

    rerender(
      <AddWineDialog
        cabinets={cabinets}
        onAdd={vi.fn()}
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("image-capture-stub")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /scan wine/i })
    ).not.toBeInTheDocument();
  });
});
