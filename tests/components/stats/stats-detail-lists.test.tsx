import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { render, act, screen } from "@testing-library/react";
import type { Wine } from "@/types/wine";

const winesMock = vi.fn<() => Promise<Partial<Wine>[]>>(async () => []);
const historyMock = vi.fn<() => Promise<Partial<Wine>[]>>(async () => []);
const searchParamsRef = { value: new URLSearchParams() };

vi.mock("@/lib/data", () => ({
  fetchWines: (...args: unknown[]) => winesMock(...(args as [])),
  fetchHistory: (...args: unknown[]) => historyMock(...(args as [])),
  fetchCabinets: vi.fn().mockResolvedValue([]),
  editWine: vi.fn(),
}));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ userId: "u1", user: null, tier: "PRO" }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => searchParamsRef.value,
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/contexts/wine-data-context", () => ({
  useWineData: () => ({ setWineData: vi.fn() }),
}));
vi.mock("@/components/wine/wine-detail-dialog", () => ({
  WineDetailDialog: ({ wine, open }: { wine: { name: string }; open: boolean }) =>
    open ? <div data-testid="detail-stub">{wine.name}</div> : null,
}));

import StatsDetailPage from "@/app/(app)/stats/[metric]/page";

function makeWines(n: number): Partial<Wine>[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    name: `Wine ${i}`,
    winery: `Winery ${i}`,
    vintage: 1990 + (i % 30),
    type: "red",
    imageUrl: "",
    price: 10 + i,
    retailPrice: 20 + i,
    userRating: (i % 5) + 1,
    country: i % 2 === 0 ? "France" : "Italy",
    grapeVariety: "Merlot",
  }));
}

async function renderMetric(metric: string, count: number, historyCount = 0) {
  winesMock.mockResolvedValue(makeWines(count));
  historyMock.mockResolvedValue(makeWines(historyCount));
  const params = Promise.resolve({ metric });
  let container!: HTMLElement;
  await act(async () => {
    ({ container } = render(
      <Suspense fallback={null}>
        <StatsDetailPage params={params} />
      </Suspense>
    ));
  });
  return container;
}

const rowNames = () =>
  screen.queryAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  searchParamsRef.value = new URLSearchParams();
});

describe("stats detail page — long lists mount a page at a time", () => {
  it("mounts one page of a big cellar instead of every bottle", async () => {
    await renderMetric("bottles", 300);
    // 300 wines, 60 mounted: the rest are behind the sentinel.
    expect(screen.getByText("300 wines")).toBeInTheDocument();
    expect(rowNames()).toHaveLength(60);
    expect(screen.getByRole("button", { name: /Show more \(240 left\)/ })).toBeInTheDocument();
  });

  it("loads the next page on demand, keeping the first page mounted", async () => {
    await renderMetric("bottles", 300);
    await act(async () => {
      screen.getByRole("button", { name: /Show more/ }).click();
    });
    expect(rowNames()).toHaveLength(120);
    expect(screen.getByRole("button", { name: /Show more \(180 left\)/ })).toBeInTheDocument();
  });

  it("shows a short list in full, with no sentinel", async () => {
    await renderMetric("bottles", 12);
    expect(rowNames()).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /Show more/ })).not.toBeInTheDocument();
  });

  it("keeps the loaded pages when the page re-renders (not a fresh list)", async () => {
    const container = await renderMetric("bottles", 300);
    await act(async () => {
      screen.getByRole("button", { name: /Show more/ }).click();
    });
    expect(rowNames()).toHaveLength(120);

    // Opening a wine re-renders the page (selectedWine/detailOpen). A fresh
    // array identity here would collapse the list back to page one.
    await act(async () => {
      container.querySelectorAll("h3")[5].click();
    });
    expect(screen.getByTestId("detail-stub")).toBeInTheDocument();
    expect(rowNames()).toHaveLength(120);
  });
});

describe("stats detail page — metric views after the list refactor", () => {
  it("sorts the value list by price, most valuable first", async () => {
    await renderMetric("value", 80);
    const names = screen.getAllByText(/^Wine \d+$/).map((el) => el.textContent);
    expect(names[0]).toBe("Wine 79");
    expect(names).toHaveLength(60);
  });

  it("drills into a country and still paginates the filtered list", async () => {
    searchParamsRef.value = new URLSearchParams("value=France");
    await renderMetric("countries", 300);
    expect(screen.getByText("150 wines")).toBeInTheDocument();
    expect(rowNames()).toHaveLength(60);
    expect(screen.getByRole("button", { name: /Show more \(90 left\)/ })).toBeInTheDocument();
  });

  it("paginates the consumed history list", async () => {
    const container = await renderMetric("consumed", 0, 300);
    expect(screen.getByText("300 entries")).toBeInTheDocument();
    expect(container.querySelectorAll("p.text-sm.font-semibold")).toHaveLength(60);
    expect(screen.getByRole("button", { name: /Show more \(240 left\)/ })).toBeInTheDocument();
  });
});
