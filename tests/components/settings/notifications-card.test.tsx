import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ─── Mocks for the underlying hook + capacitor flag ────────────────
// We hoist the per-test-controllable mock state so each test can flip
// `supported`, `enabled`, and `permission` without re-importing the
// component.
const { hookState, setEnabledMock } = vi.hoisted(() => {
  const state = {
    enabled: true,
    setEnabled: vi.fn(),
    permission: "granted" as "granted" | "denied" | "prompt" | "unsupported",
    supported: true,
  };
  return { hookState: state, setEnabledMock: state.setEnabled };
});

vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: () => ({
    enabled: hookState.enabled,
    setEnabled: hookState.setEnabled,
    permission: hookState.permission,
    supported: hookState.supported,
  }),
}));

import { NotificationsCard } from "@/components/settings/notifications-card";

describe("NotificationsCard", () => {
  beforeEach(() => {
    setEnabledMock.mockReset();
    hookState.enabled = true;
    hookState.permission = "granted";
    hookState.supported = true;
  });

  it("returns null on web (supported = false)", () => {
    hookState.supported = false;
    const { container } = render(<NotificationsCard />);
    // Component renders nothing — root has no children.
    expect(container.firstChild).toBeNull();
  });

  it("toggle defaults to on (effective = true) when enabled & permission granted", () => {
    render(<NotificationsCard />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).not.toBeDisabled();
    expect(screen.getByText(/notifications are on/i)).toBeInTheDocument();
  });

  it("toggling off calls setEnabled(false)", () => {
    hookState.enabled = true;
    render(<NotificationsCard />);
    fireEvent.click(screen.getByRole("switch"));
    expect(setEnabledMock).toHaveBeenCalledTimes(1);
    expect(setEnabledMock).toHaveBeenCalledWith(false);
  });

  it("toggling on (when currently off) calls setEnabled(true)", () => {
    hookState.enabled = false;
    render(<NotificationsCard />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(setEnabledMock).toHaveBeenCalledTimes(1);
    expect(setEnabledMock).toHaveBeenCalledWith(true);
  });

  it("disables the toggle and shows OS-blocked copy when permission is denied", () => {
    hookState.enabled = true;
    hookState.permission = "denied";
    render(<NotificationsCard />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeDisabled();
    // Effective is false because denied — aria-checked reflects that.
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/blocked at the os level/i)).toBeInTheDocument();
    expect(
      screen.getByText(/notifications are blocked in your phone/i)
    ).toBeInTheDocument();
  });
});
