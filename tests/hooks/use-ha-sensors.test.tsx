import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

/**
 * Regression: the poll kept one shared "mounted" ref across wall switches. A
 * slow sensor response for wall A could land after the user had switched to
 * wall B — the ref was true again by then — and overwrite B's readings with
 * A's for a whole poll cycle.
 */

// Stable across renders — an getIdToken recreated per useAuth() call would
// re-run the poll effect on every render (the hook's effect depends on it).
// A vi.fn so individual tests can make the token refresh reject.
const getIdToken = vi.fn(() => Promise.resolve("tok"));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ getIdToken }),
}));

import { useHaSensors } from "@/hooks/use-ha-sensors";

type FetchLike = { ok: boolean; json: () => Promise<unknown> };

const readings: Record<string, unknown> = {
  "/api/ha-sensor?wallId=wall-a": { temp: "55°F", humidity: "70%" },
  "/api/ha-sensor?wallId=wall-b": { temp: "61°F", humidity: "80%" },
};

let fetchMock: ReturnType<typeof vi.fn>;
let releaseA: ((value: FetchLike) => void) | undefined;

beforeEach(() => {
  releaseA = undefined;
  getIdToken.mockReset();
  getIdToken.mockImplementation(() => Promise.resolve("tok"));
  fetchMock = vi.fn((url: string): Promise<FetchLike> => {
    if (url === "/api/ha-sensor?wallId=wall-a") {
      return new Promise((resolve) => {
        releaseA = resolve;
      });
    }
    return Promise.resolve({ ok: true, json: async () => readings[url] });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useHaSensors wall switching", () => {
  it("shows the wall's sensors once the first poll answers", async () => {
    const { result } = renderHook(() => useHaSensors("wall-b", true));
    await waitFor(() => expect(result.current.temp).toBe("61°F"));
    expect(result.current.error).toBeNull();
  });

  it("ignores a wall's late response after the user switched walls", async () => {
    const { result, rerender } = renderHook(
      ({ wallId }) => useHaSensors(wallId, true),
      { initialProps: { wallId: "wall-a" } }
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender({ wallId: "wall-b" });
    await waitFor(() => expect(result.current.temp).toBe("61°F"));

    await act(async () => {
      releaseA?.({ ok: true, json: async () => readings["/api/ha-sensor?wallId=wall-a"] });
    });

    expect(result.current.temp).toBe("61°F");
    expect(result.current.humidity).toBe("80%");
  });
});

describe("useHaSensors poll resilience", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps polling after a token refresh rejects, instead of freezing the readings forever", async () => {
    // Offline around a token-expiry boundary: getIdToken rejects (network),
    // then connectivity returns and the next refresh succeeds.
    getIdToken.mockRejectedValueOnce(new Error("network"));

    vi.useFakeTimers();
    const { result } = renderHook(() => useHaSensors("wall-b", true));

    // First poll: the token rejection must land in error state (not an
    // unhandled rejection) and still schedule the backoff retry. The fetch
    // never happens on this cycle — the token failed before it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.error).toBe("network");
    expect(fetchMock).toHaveBeenCalledTimes(0);

    // One failure backs off to 120s. The retry must actually fire — before
    // the fix, the rejecting token escaped fetchSensors' try and killed the
    // self-rescheduling tick, so readings froze until a full reload.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.temp).toBe("61°F");
    expect(result.current.error).toBeNull();
  });
});
