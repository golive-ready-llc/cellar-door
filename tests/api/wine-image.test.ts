import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://stub";

const findWine = vi.fn();
const findHistory = vi.fn();
const authSpy = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    wine: { findFirst: (...a: unknown[]) => findWine(...a) },
    wineHistory: { findFirst: (...a: unknown[]) => findHistory(...a) },
  },
}));
vi.mock("@/server/auth-guard", () => ({ getAuthenticatedUserId: () => authSpy() }));

import { GET } from "@/app/api/wine-image/[id]/route";

const JPEG = "data:image/jpeg;base64," + Buffer.from("jpeg-bytes").toString("base64");
const call = (id: string, query = "") =>
  GET(new Request(`http://localhost/api/wine-image/${id}${query}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  authSpy.mockResolvedValue("u1");
});

describe("GET /api/wine-image/[id]", () => {
  it("requires a session", async () => {
    authSpy.mockResolvedValue(null);
    const res = await call("w1");
    expect(res.status).toBe(401);
    expect(findWine).not.toHaveBeenCalled();
  });

  it("serves the owner's image with long-lived caching", async () => {
    findWine.mockResolvedValue({ imageUrl: JPEG });
    const res = await call("w1", "?v=abc");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("jpeg-bytes");
    expect(findWine.mock.calls[0][0].where).toEqual({ id: "w1", userId: "u1" });
  });

  it("returns 404 for someone else's wine", async () => {
    findWine.mockResolvedValue(null);
    expect((await call("w-other")).status).toBe(404);
  });

  it("never serves SVG from our origin", async () => {
    findWine.mockResolvedValue({ imageUrl: "data:image/svg+xml;base64,PHN2Zy8+" });
    expect((await call("w1")).status).toBe(404);
  });

  it("reads history records for ?k=h", async () => {
    findHistory.mockResolvedValue({ imageUrl: JPEG });
    const res = await call("h1", "?v=abc&k=h");
    expect(res.status).toBe(200);
    expect(findHistory.mock.calls[0][0].where).toEqual({ id: "h1", userId: "u1" });
    expect(findWine).not.toHaveBeenCalled();
  });
});
