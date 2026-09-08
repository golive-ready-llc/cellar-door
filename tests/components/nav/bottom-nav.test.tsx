import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// next/navigation must be mocked before BottomNav is imported because it
// calls usePathname() at the top of its body.
const pathnameMock = vi.fn<() => string>(() => "/cellar");
const routerPushMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
  useRouter: () => ({ push: routerPushMock }),
}));

// Stub next/link so we render a vanilla <a> — RTL can then read href.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Add-wine context drives the center Scan button. Mutable so tests can flip
// between "handler registered" (cellar/inventory) and "no handler" pages.
const openCameraFirstMock = vi.fn();
const requestCameraOnReadyMock = vi.fn();
let onAddValue: (() => void) | null = () => {};

vi.mock("@/components/add-wine-context", () => ({
  useAddWine: () => ({
    _onAdd: onAddValue,
    _openCameraFirst: openCameraFirstMock,
    requestCameraOnReady: requestCameraOnReadyMock,
  }),
}));

import { BottomNav } from "@/components/bottom-nav";

// 5-surface nav: Cellar · Stats · Scan (center) · Activity · Profile.
// Cellar stays leftmost. Secondary surfaces (Discover, Inventory, Buy List,
// History, Taste Profile, Settings) live under Profile.
const EXPECTED_LINKS = [
  { title: "Cellar", href: "/cellar" },
  { title: "Stats", href: "/stats" },
  { title: "Activity", href: "/activity" },
  { title: "Profile", href: "/profile" },
];

beforeEach(() => {
  openCameraFirstMock.mockReset();
  requestCameraOnReadyMock.mockReset();
  routerPushMock.mockReset();
  onAddValue = () => {};
});

describe("BottomNav", () => {
  it("renders the 4 navigation links plus the red Scan button", () => {
    pathnameMock.mockReturnValue("/cellar");
    render(<BottomNav />);
    for (const { title } of EXPECTED_LINKS) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Scan wine" })).toBeInTheDocument();
    // Secondary surfaces moved under Profile — not top-level tabs anymore.
    for (const gone of ["Inventory", "Buy List", "History", "Discover", "Settings"]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });

  it("keeps Cellar as the leftmost tab", () => {
    pathnameMock.mockReturnValue("/cellar");
    render(<BottomNav />);
    const anchors = screen.getAllByRole("link");
    expect(anchors[0]).toHaveAttribute("href", "/cellar");
  });

  it("emits the correct href for every link", () => {
    pathnameMock.mockReturnValue("/cellar");
    render(<BottomNav />);
    for (const { title, href } of EXPECTED_LINKS) {
      const label = screen.getByText(title);
      const anchor = label.closest("a");
      expect(anchor).not.toBeNull();
      expect(anchor).toHaveAttribute("href", href);
    }
  });

  it("highlights the active route with primary text color", () => {
    pathnameMock.mockReturnValue("/stats");
    render(<BottomNav />);
    const anchor = screen.getByText("Stats").closest("a");
    expect(anchor?.className).toMatch(/text-primary/);
    const cellarAnchor = screen.getByText("Cellar").closest("a");
    expect(cellarAnchor?.className).not.toMatch(/text-primary/);
  });

  it("does not highlight any item when pathname matches none", () => {
    pathnameMock.mockReturnValue("/some-unrelated-page");
    render(<BottomNav />);
    for (const { title } of EXPECTED_LINKS) {
      const anchor = screen.getByText(title).closest("a");
      expect(anchor?.className).not.toMatch(/\btext-primary\b/);
    }
  });

  it("highlights only the matching item across tabs", () => {
    pathnameMock.mockReturnValue("/activity");
    render(<BottomNav />);
    const activityAnchor = screen.getByText("Activity").closest("a");
    expect(activityAnchor?.className).toMatch(/text-primary/);
    const cellarAnchor = screen.getByText("Cellar").closest("a");
    expect(cellarAnchor?.className).not.toMatch(/text-primary/);
  });

  it("Scan opens the camera directly when a page handler is registered", () => {
    pathnameMock.mockReturnValue("/cellar");
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "Scan wine" }));
    expect(openCameraFirstMock).toHaveBeenCalledOnce();
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("Scan navigates to /cellar and defers the camera when no handler exists", () => {
    pathnameMock.mockReturnValue("/activity");
    onAddValue = null; // pages like Activity don't register an add handler
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "Scan wine" }));
    expect(requestCameraOnReadyMock).toHaveBeenCalledOnce();
    expect(routerPushMock).toHaveBeenCalledWith("/cellar");
    expect(openCameraFirstMock).not.toHaveBeenCalled();
  });
});
