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
const getIdToken = () => Promise.resolve("tok");

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
