import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * Demo visitors can open Sommelier Mode, but hosting a tasting needs an
 * account. The dialog used to call the host server actions anyway, which threw
 * "Unauthorized" (a 500 in production) and, because production hides server
 * error messages, only ever showed "Failed to create session". In demo mode it
 * now skips the server and explains why Create is unavailable.
 */

const auth = vi.hoisted(() => ({ userId: "demo-user-001", demoMode: true }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => auth }));

const actions = vi.hoisted(() => ({
  getUserGuestSessions: vi.fn(async () => []),
  getSessionVotes: vi.fn(async () => null),
  createGuestSession: vi.fn(),
  deleteGuestSession: vi.fn(),
}));
vi.mock("@/server/actions/guest-sessions", () => actions);

vi.mock("@/components/ui/custom-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { SommelierModeDialog } from "@/components/cellar/sommelier-mode-dialog";

describe("SommelierModeDialog", () => {
  beforeEach(() => {
    Object.values(actions).forEach((fn) => fn.mockClear());
  });

  it("makes no server calls and keeps Create disabled in demo mode", async () => {
    auth.demoMode = true;
    render(<SommelierModeDialog open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/session name/i), { target: { value: "Saturday Dinner" } });
    const create = screen.getByRole("button", { name: /create guest session/i });
    expect(create).toBeDisabled();
    fireEvent.click(create);
    expect(screen.getByText(/hosting a tasting needs an account/i)).toBeInTheDocument();
    expect(actions.getUserGuestSessions).not.toHaveBeenCalled();
    expect(actions.createGuestSession).not.toHaveBeenCalled();
  });

  it("loads sessions for a signed-in host", async () => {
    auth.demoMode = false;
    auth.userId = "u-real";
    render(<SommelierModeDialog open onOpenChange={() => {}} />);
    await vi.waitFor(() => expect(actions.getUserGuestSessions).toHaveBeenCalledWith("u-real"));
    expect(screen.queryByText(/hosting a tasting needs an account/i)).toBeNull();
    auth.userId = "demo-user-001";
  });
});
