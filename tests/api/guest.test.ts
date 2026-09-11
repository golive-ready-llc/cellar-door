import { describe, it, expect, vi, beforeEach } from "vitest";

const getGuestSessionMock = vi.fn();
const voteForWineMock = vi.fn();
vi.mock("@/server/actions/guest-sessions", () => ({
  getGuestSession: (...a: unknown[]) => getGuestSessionMock(...a),
  voteForWine: (...a: unknown[]) => voteForWineMock(...a),
}));

import { GET, POST } from "@/app/api/guest/[code]/route";

function makePost(code: string, body: unknown): Request {
  return new Request(`http://localhost/api/guest/${code}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/guest/[code]", () => {
  it("GET 400 when code length != 6", async () => {
    const res = await GET(new Request("http://localhost/api/guest/SHORT"), {
      params: Promise.resolve({ code: "SHORT" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET 404 when session not found / expired", async () => {
    getGuestSessionMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/guest/ABCDEF"), {
      params: Promise.resolve({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST voteForWine with wineId belonging to host → 200 with votes", async () => {
    voteForWineMock.mockResolvedValue({ wine_1: 3 });
    const res = await POST(makePost("ABCDEF", { wineId: "wine_1" }), {
      params: Promise.resolve({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.votes).toEqual({ wine_1: 3 });
    expect(voteForWineMock).toHaveBeenCalledWith("ABCDEF", "wine_1");
  });

  it("POST with wineId not in session → returns 500 with error (audit #20)", async () => {
    voteForWineMock.mockRejectedValue(new Error("Wine not in this guest session"));
    const res = await POST(makePost("ABCDEF", { wineId: "wine_other" }), {
      params: Promise.resolve({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to record vote");
  });
});

describe("guest code format (2026-09-10)", () => {
  it("GET accepts the new 8-character codes", async () => {
    const res = await GET(new Request("http://localhost/api/guest/ABCDEFGH"), {
      params: Promise.resolve({ code: "ABCDEFGH" }),
    });
    expect(res.status).not.toBe(400);
  });

  it("GET rejects a 7-character code", async () => {
    const res = await GET(new Request("http://localhost/api/guest/ABCDEFG"), {
      params: Promise.resolve({ code: "ABCDEFG" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST rejects a malformed code before recording a vote", async () => {
    const before = voteForWineMock.mock.calls.length;
    const res = await POST(makePost("BAD!", { wineId: "wine_1" }), {
      params: Promise.resolve({ code: "BAD!" }),
    });
    expect(res.status).toBe(400);
    expect(voteForWineMock.mock.calls.length).toBe(before);
  });
});
