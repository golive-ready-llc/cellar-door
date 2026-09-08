import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/components/ui/custom-toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { toast } from "@/components/ui/custom-toast";
import { useAddWineForm } from "@/hooks/use-add-wine-form";
import { DuplicateWineError } from "@/lib/errors";
import type { Cabinet } from "@/types/wine";

function makeCabinet(id: string, name = id): Cabinet {
  // Construct a minimal-but-typed Cabinet. We cast because we only need .id
  // for the field-default behavior under test.
  return { id, name } as unknown as Cabinet;
}

describe("useAddWineForm", () => {
  // Typed as any-shaped fn so TS doesn't try to match the giant Wine
  // signature against vi.fn()'s overload soup. Behaviour-wise it's still
  // a Vitest mock.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let onAdd: (wine: any) => Promise<void>;
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onAdd = vi.fn() as unknown as (wine: any) => Promise<void>;
  });

  it("starts with empty cabinetId when cabinets is empty", () => {
    const { result } = renderHook(() =>
      useAddWineForm({ cabinets: [], onAdd })
    );
    expect(result.current.formFields.cabinetId).toBe("");
  });

  it("does NOT pre-select a section even when cabinets exist (defaults to Unfiled)", () => {
    // Regression: defaulting to cabinets[0] silently filed wines into
    // whatever section sorted first ("Wine Fridge") — user bug report.
    const cabs = [makeCabinet("cab-1"), makeCabinet("cab-2")];
    const { result } = renderHook(() =>
      useAddWineForm({ cabinets: cabs, onAdd })
    );
    expect(result.current.formFields.cabinetId).toBe("");
  });

  it("does NOT auto-select when cabinets arrive after first render", () => {
    const { result, rerender } = renderHook(
      ({ cabinets }: { cabinets: Cabinet[] }) =>
        useAddWineForm({ cabinets, onAdd }),
      { initialProps: { cabinets: [] as Cabinet[] } }
    );
    expect(result.current.formFields.cabinetId).toBe("");

    rerender({ cabinets: [makeCabinet("cab-late")] });
    expect(result.current.formFields.cabinetId).toBe("");
  });

  it("does NOT clobber a user-selected cabinet on rerender with new cabinets", () => {
    const cabs = [makeCabinet("cab-1"), makeCabinet("cab-2")];
    const { result, rerender } = renderHook(
      ({ cabinets }: { cabinets: Cabinet[] }) =>
        useAddWineForm({ cabinets, onAdd }),
      { initialProps: { cabinets: cabs } }
    );
    // user picks cab-2 explicitly
    act(() => {
      result.current.formFields.setCabinetId("cab-2");
    });
    expect(result.current.formFields.cabinetId).toBe("cab-2");

    // rerender with cabinets array containing more entries — selection sticks
    rerender({
      cabinets: [makeCabinet("cab-1"), makeCabinet("cab-2"), makeCabinet("cab-3")],
    });
    expect(result.current.formFields.cabinetId).toBe("cab-2");
  });

  it("pendingSlot.cabinetId is reflected in the Section field", () => {
    // When the add flow starts from a specific empty slot, the Section
    // dropdown must SHOW that cabinet — what the user sees should match
    // where the wine will actually go.
    const { result, rerender } = renderHook(
      ({
        cabinets,
        pendingSlot,
      }: {
        cabinets: Cabinet[];
        pendingSlot: { cabinetId: string; row: number; col: number } | null;
      }) => useAddWineForm({ cabinets, onAdd, pendingSlot }),
      {
        initialProps: {
          cabinets: [] as Cabinet[],
          pendingSlot: { cabinetId: "slot-cab", row: 0, col: 0 },
        },
      }
    );
    rerender({
      cabinets: [makeCabinet("cab-1")],
      pendingSlot: { cabinetId: "slot-cab", row: 0, col: 0 },
    });
    expect(result.current.formFields.cabinetId).toBe("slot-cab");
    expect(result.current.unfiledCabinetId).toBe("slot-cab");
  });

  it("default view is 'pick' and saving is false", () => {
    const { result } = renderHook(() =>
      useAddWineForm({ cabinets: [], onAdd })
    );
    expect(result.current.view).toBe("pick");
    expect(result.current.saving).toBe(false);
    expect(result.current.aiLoading).toBe(false);
    expect(result.current.aiFilled).toBe(false);
  });

  it("duplicate → warning toast with Add anyway that resubmits with skipDuplicateCheck", async () => {
    const addMock = vi.fn()
      .mockRejectedValueOnce(new DuplicateWineError("w-existing", "Existing Wine"))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useAddWineForm({ cabinets: [], onAdd: addMock as any })
    );
    act(() => {
      result.current.formFields.setName("Existing Wine");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as React.FormEvent);
    });

    // First submit: dup check ON, blocked, dialog NOT closed, warning shown.
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock.mock.calls[0][0].skipDuplicateCheck).toBe(false);
    const warnMock = vi.mocked(toast.warning);
    expect(warnMock).toHaveBeenCalledTimes(1);
    expect(warnMock.mock.calls[0][0]).toMatch(/already have "Existing Wine"/i);
    const action = warnMock.mock.calls[0][1]?.action;
    expect(action?.label).toBe("Add anyway");

    // Tapping "Add anyway" resubmits the SAME wine with the check skipped.
    await act(async () => {
      action!.onClick();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(addMock).toHaveBeenCalledTimes(2);
    expect(addMock.mock.calls[1][0].name).toBe("Existing Wine");
    expect(addMock.mock.calls[1][0].skipDuplicateCheck).toBe(true);
  });

  it("resetForm clears cabinetId back to Unfiled (no auto-default)", () => {
    const cabs = [makeCabinet("cab-1"), makeCabinet("cab-2")];
    const { result } = renderHook(() =>
      useAddWineForm({ cabinets: cabs, onAdd })
    );
    act(() => {
      result.current.formFields.setCabinetId("cab-2");
      result.current.formFields.setName("Some Wine");
    });
    expect(result.current.formFields.cabinetId).toBe("cab-2");
    act(() => {
      result.current.resetForm();
    });
    expect(result.current.formFields.cabinetId).toBe("");
    expect(result.current.formFields.name).toBe("");
  });
});
