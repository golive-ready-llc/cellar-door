import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { WineDataProvider, useWineData } from "@/contexts/wine-data-context";
import type { Wine } from "@/types/wine";

/**
 * Regression: the cross-page "show in cellar" action pushed /cellar?wineId=…
 * while use-cellar-data reads `?wine=` (the same param the search palette
 * links with). Nothing read `wineId`, so the vault/inventory/stats detail
 * dialogs navigated to a plain cellar with no bottle opened or highlighted.
 */

function makeWine(id: string): Wine {
  return { id, name: "Test" } as Wine;
}

function ShowInCellarButton({ wine }: { wine: Wine }) {
  const { showInCellar } = useWineData();
  return (
    <button type="button" onClick={() => showInCellar(wine)}>
      Show in cellar
    </button>
  );
}

describe("WineDataProvider.showInCellar", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("deep-links with the param the cellar page reads", () => {
    render(
      <WineDataProvider>
        <ShowInCellarButton wine={makeWine("w-42")} />
      </WineDataProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Show in cellar" }));

    expect(pushMock).toHaveBeenCalledWith("/cellar?wine=w-42");
  });

  it("encodes ids that need it", () => {
    render(
      <WineDataProvider>
        <ShowInCellarButton wine={makeWine("w 42/1")} />
      </WineDataProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Show in cellar" }));

    expect(pushMock).toHaveBeenCalledWith("/cellar?wine=w%2042%2F1");
  });
});
