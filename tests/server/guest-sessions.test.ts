import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://stub";

const guestSessionFindUnique = vi.fn();
const guestSessionFindFirst = vi.fn();
const guestSessionFindMany = vi.fn();
const guestSessionCreate = vi.fn();
const guestSessionDeleteMany = vi.fn();
const wineFindFirst = vi.fn();
const wineFindMany = vi.fn();
const executeRawSpy = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    guestSession: {
      findUnique: guestSessionFindUnique,
      findFirst: guestSessionFindFirst,
      findMany: guestSessionFindMany,
      create: guestSessionCreate,
      deleteMany: guestSessionDeleteMany,
    },
    wine: { findFirst: wineFindFirst, findMany: wineFindMany },
    $executeRaw: (...args: unknown[]) => executeRawSpy(...args),
  },
}));

const resolveServerUserId = vi.fn();
vi.mock("@/server/auth-guard", () => ({
  resolveServerUserId: (id?: string | null) => resolveServerUserId(id),
  getAuthenticatedUserId: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  resolveServerUserId.mockImplementation(async (id?: string | null) => {
    if (!id) throw new Error("Unauthorized");
    return id;
  });
});

describe("createGuestSession", () => {
  it("creates with resolved userId and a generated 6-char code", async () => {
    guestSessionCreate.mockImplementation((args) =>
      Promise.resolve({ id: "gs1", ...args.data })
    );
    const { createGuestSession } = await import("@/server/actions/guest-sessions");
    const session = await createGuestSession("u1", "Dinner", 4);
    expect(guestSessionCreate).toHaveBeenCalled();
    const data = guestSessionCreate.mock.calls[0][0].data;
    expect(data.userId).toBe("u1");
    expect(data.name).toBe("Dinner");
    expect(typeof data.code).toBe("string");
    expect(data.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(session).toBeDefined();
  });

  it("retries on P2002 unique constraint collisions", async () => {
    let calls = 0;
    guestSessionCreate.mockImplementation(() => {
      calls++;
      if (calls < 3) {
        const err = Object.assign(new Error("dup"), { code: "P2002" });
        return Promise.reject(err);
      }
      return Promise.resolve({ id: "gs1", code: "ABCDEF" });
    });
    const { createGuestSession } = await import("@/server/actions/guest-sessions");
    await createGuestSession("u1", "x", 1);
    expect(guestSessionCreate).toHaveBeenCalledTimes(3);
  });
});

describe("voteForWine — audit fix #20", () => {
  it("returns null when the session code is invalid", async () => {
    guestSessionFindUnique.mockResolvedValue(null);
    const { voteForWine } = await import("@/server/actions/guest-sessions");
    expect(await voteForWine("BADCOD", "w1")).toBeNull();
    expect(wineFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when the session has expired", async () => {
    guestSessionFindUnique.mockResolvedValue({
      userId: "host1",
      expiresAt: new Date(Date.now() - 1000),
    });
    const { voteForWine } = await import("@/server/actions/guest-sessions");
    expect(await voteForWine("ABC123", "w1")).toBeNull();
    expect(wineFindFirst).not.toHaveBeenCalled();
  });

  it("throws when the wine doesn't belong to the host (cross-user vote attempt)", async () => {
    guestSessionFindUnique.mockResolvedValue({
      userId: "host1",
      expiresAt: new Date(Date.now() + 60000),
    });
    wineFindFirst.mockResolvedValue(null);
    const { voteForWine } = await import("@/server/actions/guest-sessions");
    await expect(voteForWine("ABC123", "w-other-user")).rejects.toThrow(/not in this guest session/i);
    expect(wineFindFirst).toHaveBeenCalledWith({
      where: { id: "w-other-user", userId: "host1" },
      select: { id: true },
    });
    expect(executeRawSpy).not.toHaveBeenCalled();
  });

  it("atomically increments via $executeRaw on a valid vote", async () => {
    guestSessionFindUnique
      .mockResolvedValueOnce({ userId: "host1", expiresAt: new Date(Date.now() + 60000) })
      .mockResolvedValueOnce({ votes: { w1: 3 } });
    wineFindFirst.mockResolvedValue({ id: "w1" });
    executeRawSpy.mockResolvedValue(1);
    const { voteForWine } = await import("@/server/actions/guest-sessions");
    const votes = await voteForWine("abc123", "w1"); // lowercase to verify uppercase normalization
    expect(executeRawSpy).toHaveBeenCalledOnce();
    expect(votes).toEqual({ w1: 3 });
    // Code should have been uppercased before lookup
    expect(guestSessionFindUnique.mock.calls[0][0].where.code).toBe("ABC123");
  });
});

describe("getSessionVotes", () => {
  it("scopes lookup to the resolved userId", async () => {
    guestSessionFindFirst.mockResolvedValue({ votes: { w1: 1 } });
    const { getSessionVotes } = await import("@/server/actions/guest-sessions");
    const v = await getSessionVotes("u1", "gs1");
    expect(guestSessionFindFirst).toHaveBeenCalledWith({
      where: { id: "gs1", userId: "u1" },
    });
    expect(v).toEqual({ w1: 1 });
  });
});

describe("deleteGuestSession", () => {
  it("uses deleteMany scoped by userId (no IDOR)", async () => {
    guestSessionDeleteMany.mockResolvedValue({ count: 1 });
    const { deleteGuestSession } = await import("@/server/actions/guest-sessions");
    await deleteGuestSession("u1", "gs1");
    expect(guestSessionDeleteMany).toHaveBeenCalledWith({
      where: { id: "gs1", userId: "u1" },
    });
  });
});

// Demo visitors can open Sommelier Mode (the demo runs on the top plan). The
// host actions used to throw "Unauthorized" for them, a 500 in production.
// vi.mock is hoisted, so this switch applies to the whole file; it stays off
// for every test above.
const demo = vi.hoisted(() => ({ active: false }));
vi.mock("@/lib/demo", () => ({
  isDemoRequest: () => Promise.resolve(demo.active),
  assertNotDemo: async (action = "do this") => {
    if (demo.active) {
      throw new Error(`Demo mode is read-only. Sign up to ${action} with your own account.`);
    }
  },
}));

describe("host actions in demo mode", () => {
  beforeEach(() => {
    demo.active = true;
  });

  it("returns no sessions instead of throwing Unauthorized", async () => {
    const { getUserGuestSessions } = await import("@/server/actions/guest-sessions");
    await expect(getUserGuestSessions("demo-user-001")).resolves.toEqual([]);
    expect(resolveServerUserId).not.toHaveBeenCalled();
    expect(guestSessionFindMany).not.toHaveBeenCalled();
    demo.active = false;
  });

  it("returns no votes", async () => {
    const { getSessionVotes } = await import("@/server/actions/guest-sessions");
    await expect(getSessionVotes("demo-user-001", "gs1")).resolves.toBeNull();
    expect(guestSessionFindFirst).not.toHaveBeenCalled();
    demo.active = false;
  });

  it("refuses to create a session with a readable message", async () => {
    const { createGuestSession } = await import("@/server/actions/guest-sessions");
    await expect(createGuestSession("demo-user-001", "Dinner", 4)).rejects.toThrow("Demo mode is read-only");
    expect(guestSessionCreate).not.toHaveBeenCalled();
    demo.active = false;
  });

  it("refuses to delete a session", async () => {
    const { deleteGuestSession } = await import("@/server/actions/guest-sessions");
    await expect(deleteGuestSession("demo-user-001", "gs1")).rejects.toThrow("Demo mode is read-only");
    expect(guestSessionDeleteMany).not.toHaveBeenCalled();
    demo.active = false;
  });
});
