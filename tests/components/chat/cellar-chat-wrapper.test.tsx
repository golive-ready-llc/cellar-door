import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Wine } from "@/types/wine";

// Hoisted mocks so individual test bodies can mutate behaviour.
const fetchWines = vi.fn();
const editWine = vi.fn();
vi.mock("@/lib/data", () => ({
  fetchWines: (...args: unknown[]) => fetchWines(...args),
  editWine: (...args: unknown[]) => editWine(...args),
}));

const tierState = vi.hoisted(() => ({
  hasAI: true,
  tierHasAI: true,
  userId: "user-1" as string | null,
}));
vi.mock("@/hooks/use-tier", () => ({
  useTier: () => tierState,
}));

vi.mock("@/contexts/wine-data-context", () => ({
  useWineData: () => ({ setWineData: vi.fn(), wines: [], cabinets: [], walls: [], allTags: [] }),
}));

// Replace WineDetailDialog with a sentinel so tests can assert it
// rendered without pulling in 1000+ lines of dialog markup.
vi.mock("@/components/wine/wine-detail-dialog", () => ({
  WineDetailDialog: ({ wine }: { wine: Wine }) => (
    <div data-testid="wine-detail-dialog">{wine.name}</div>
  ),
}));

// CellarChat is heavy — replace with a tiny harness that exposes
// "open chat" + "send message" + "click [[Wine]]" via simple buttons.
vi.mock("@/components/chat/cellar-chat", () => {
  return {
    CellarChat: (props: {
      wines: Wine[];
      onWineClick?: (wine: Wine) => void;
      hasAI: boolean;
      onOpen?: () => void;
    }) => {
      return (
        <div>
          <button data-testid="cellar-chat-fab">FAB ({props.wines.length})</button>
          <button data-testid="cellar-chat-open" onClick={() => props.onOpen?.()}>
            open
          </button>
          {props.wines[0] && (
            <button
              data-testid="wine-link"
              onClick={() => props.onWineClick?.(props.wines[0])}
            >
              [[{props.wines[0].name}]]
            </button>
          )}
        </div>
      );
    },
  };
});

import { CellarChatWrapper } from "@/components/chat/cellar-chat-wrapper";

function makeWine(overrides: Partial<Wine> = {}): Wine {
  return {
    id: "w-1",
    userId: "user-1",
    cabinetId: null,
    barcode: "",
    name: "Catena Malbec",
    winery: "Catena Zapata",
    region: "Mendoza",
    country: "Argentina",
    vintage: 2020,
    type: "red",
    sparkling: false,
    grapeVariety: "Malbec",
    userRating: null,
    imageUrl: "",
    price: null,
    retailPrice: null,
    purchaseDate: "",
    drinkBy: "",
    notes: "",
    description: "",
    foodPairings: "",
    alcohol: "",
    row: null,
    col: null,
    depth: 1,
    zone: "",
    tastingNotes: null,
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    tags: [],
    addedAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("CellarChatWrapper", () => {
  beforeEach(() => {
    fetchWines.mockReset();
    editWine.mockReset();
    tierState.hasAI = true;
    tierState.tierHasAI = true;
    tierState.userId = "user-1";
  });

  it("FAB renders by default once wines load (paid tier with AI on)", async () => {
    fetchWines.mockResolvedValue([makeWine()]);
    render(<CellarChatWrapper />);
    await waitFor(() => {
      expect(screen.getByTestId("cellar-chat-fab")).toBeInTheDocument();
    });
    expect(fetchWines).toHaveBeenCalledWith("user-1");
  });

  it("returns null and does not render the FAB when paid user toggles AI off", async () => {
    tierState.hasAI = false;
    tierState.tierHasAI = true; // paid but AI toggle off
    const { container } = render(<CellarChatWrapper />);
    await waitFor(() => {
      // loaded becomes true synchronously when !hasAI, and aiToggledOff
      // → component returns null.
      expect(container.firstChild).toBeNull();
    });
    expect(fetchWines).not.toHaveBeenCalled();
  });

  it("clicking a [[Wine]] link opens the WineDetailDialog with that wine", async () => {
    const wine = makeWine({ name: "Catena Malbec" });
    fetchWines.mockResolvedValue([wine]);

    render(<CellarChatWrapper />);
    await waitFor(() => {
      expect(screen.getByTestId("wine-link")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("wine-link"));
    });

    expect(screen.getByTestId("wine-detail-dialog")).toBeInTheDocument();
    expect(screen.getByText("Catena Malbec")).toBeInTheDocument();
  });

  it("renders nothing while wines are still loading (free user fast-path returns FAB after sync setLoaded)", async () => {
    // Free tier: hasAI=false, tierHasAI=false → wrapper sets loaded=true
    // synchronously and renders chat with empty wines list.
    tierState.hasAI = false;
    tierState.tierHasAI = false;
    render(<CellarChatWrapper />);
    await waitFor(() => {
      expect(screen.getByTestId("cellar-chat-fab")).toBeInTheDocument();
    });
    expect(fetchWines).not.toHaveBeenCalled();
  });

  it("keeps the FAB when the initial load fails, and recovers on chat open", async () => {
    fetchWines
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([makeWine()]);
    render(<CellarChatWrapper />);

    // A failed initial fetch must not hide the chat entry point for the
    // whole session — the FAB still renders, with whatever list we have.
    await waitFor(() => {
      expect(screen.getByTestId("cellar-chat-fab")).toBeInTheDocument();
    });
    expect(screen.getByTestId("cellar-chat-fab")).toHaveTextContent("FAB (0)");

    // Opening the chat refetches and the list recovers.
    await act(async () => {
      fireEvent.click(screen.getByTestId("cellar-chat-open"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("cellar-chat-fab")).toHaveTextContent("FAB (1)");
    });
  });

  it("reloads the wine list each time the chat opens, so new bottles are included", async () => {
    // The app loaded with an empty cellar; a wine was added before the chat opened.
    fetchWines.mockResolvedValueOnce([]).mockResolvedValueOnce([makeWine()]);
    render(<CellarChatWrapper />);
    await waitFor(() => {
      expect(screen.getByTestId("cellar-chat-fab")).toHaveTextContent("FAB (0)");
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("cellar-chat-open"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("cellar-chat-fab")).toHaveTextContent("FAB (1)");
    });
    expect(fetchWines).toHaveBeenCalledTimes(2);
  });
});
