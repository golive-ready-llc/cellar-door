import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { NewWineInput } from "@/types/wine";

vi.mock("@/components/ui/custom-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { useAddWineForm } from "@/hooks/use-add-wine-form";

function setup(onAdd: (w: NewWineInput) => void | Promise<void>) {
  return renderHook(() => useAddWineForm({ cabinets: [], onAdd }));
}

describe("useAddWineForm — quantity", () => {
  let added: NewWineInput[];
  const onAdd = vi.fn(async (w: NewWineInput) => {
    added.push(w);
  });

  beforeEach(() => {
    added = [];
    onAdd.mockClear();
  });

  it("defaults to a single bottle", async () => {
    const { result } = setup(onAdd);
    act(() => result.current.formFields.setName("Solo Wine"));
    expect(result.current.formFields.quantity).toBe("1");
    await act(async () => {
      await result.current.handleSubmit({ preventDefault() {} } as unknown as React.FormEvent);
    });
    expect(added).toHaveLength(1);
    expect(added[0].name).toBe("Solo Wine");
  });

  it("adds N identical bottles when quantity > 1", async () => {
    const { result } = setup(onAdd);
    act(() => {
      result.current.formFields.setName("Case Wine");
      result.current.formFields.setQuantity("3");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault() {} } as unknown as React.FormEvent);
    });
    expect(added).toHaveLength(3);
    expect(added.every((w) => w.name === "Case Wine")).toBe(true);
  });

  it("only the first bottle runs the duplicate check; copies skip it", async () => {
    const { result } = setup(onAdd);
    act(() => {
      result.current.formFields.setName("Dup Wine");
      result.current.formFields.setQuantity("2");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault() {} } as unknown as React.FormEvent);
    });
    // Manual entry → first submit keeps the duplicate warning, copies bypass it
    expect(added[0].skipDuplicateCheck).toBe(false);
    expect(added[1].skipDuplicateCheck).toBe(true);
  });

  it("clamps junk/empty quantity to a single bottle", async () => {
    const { result } = setup(onAdd);
    act(() => {
      result.current.formFields.setName("Junk Qty");
      result.current.formFields.setQuantity("");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault() {} } as unknown as React.FormEvent);
    });
    expect(added).toHaveLength(1);
  });

  it("caps runaway quantities at 99", async () => {
    const { result } = setup(onAdd);
    act(() => {
      result.current.formFields.setName("Too Many");
      result.current.formFields.setQuantity("500");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault() {} } as unknown as React.FormEvent);
    });
    expect(added).toHaveLength(99);
  });

  it("resets quantity back to 1 after a successful add", async () => {
    const { result } = setup(onAdd);
    act(() => {
      result.current.formFields.setName("Reset Wine");
      result.current.formFields.setQuantity("4");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault() {} } as unknown as React.FormEvent);
    });
    expect(result.current.formFields.quantity).toBe("1");
  });
});
