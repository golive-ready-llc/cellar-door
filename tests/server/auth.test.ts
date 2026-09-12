import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://stub";
process.env.STRIPE_SECRET_KEY = "sk_test_stub";

const userFindUnique = vi.fn();
const userUpdate = vi.fn();
const userCreate = vi.fn();
const wallCreate = vi.fn();
const cabinetCreate = vi.fn();
const txSpy = vi.fn();

const verifyIdTokenSpy = vi.fn();
const createSessionCookieSpy = vi.fn();
const cookieSetSpy = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: userFindUnique, update: userUpdate, create: userCreate },
    wall: { create: wallCreate },
    cabinet: { create: cabinetCreate },
    $transaction: (cb: (tx: unknown) => unknown) => txSpy(cb),
  },
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { verifyIdToken: verifyIdTokenSpy },
  getAdminAuth: () => ({
    verifyIdToken: verifyIdTokenSpy,
    createSessionCookie: createSessionCookieSpy,
  }),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ set: cookieSetSpy, get: vi.fn() }),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: { subscriptions: { cancel: vi.fn() }, customers: { del: vi.fn() } },
}));

vi.mock("@/lib/mock-store", () => ({
  mockStore: {
    updateProfile: vi.fn((p) => ({
      id: "dev-user-001",
      displayName: p.displayName,
      email: "dev@cellardoor.app",
      photoURL: p.photoURL,
      avatarColor: "#722F37",
      createdAt: null,
    })),
    getProfile: vi.fn(),
  },
}));

vi.mock("@/types/constants", () => ({
  DEFAULT_CABINETS: [
    { name: "C1", rows: 8, cols: 8, depth: 1, storageRows: [], sortOrder: 0 },
  ],
}));

vi.mock("@/server/audit-log", () => ({ logAudit: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  txSpy.mockImplementation(async (cb: (tx: unknown) => unknown) => {
    const tx = {
      user: { create: userCreate },
      wall: { create: wallCreate },
      cabinet: { create: cabinetCreate },
    };
    return cb(tx);
  });
});

describe("syncUser", () => {
  it("updates an existing user when one already exists for the firebaseUid", async () => {
    verifyIdTokenSpy.mockResolvedValue({
      uid: "fb-1",
      email: "u@example.com",
      name: "U",
      picture: "pic",
    });
    userFindUnique.mockResolvedValue({ id: "p1", firebaseUid: "fb-1" });
    userUpdate.mockResolvedValue({
      id: "p1",
      email: "u@example.com",
      displayName: "U",
      avatarUrl: "pic",
      tier: "FREE",
    });
    const { syncUser } = await import("@/server/actions/auth");
    const result = await syncUser("idtoken");
    expect(userUpdate).toHaveBeenCalledWith({
      where: { firebaseUid: "fb-1" },
      data: { email: "u@example.com", displayName: "U", avatarUrl: "pic" },
    });
    expect(result.id).toBe("p1");
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("creates a new user, default wall, and default cabinets in a transaction", async () => {
    verifyIdTokenSpy.mockResolvedValue({
      uid: "fb-2",
      email: "new@example.com",
      name: "New",
      picture: "",
    });
    userFindUnique.mockResolvedValue(null);
    userCreate.mockResolvedValue({
      id: "p2",
      email: "new@example.com",
      displayName: "New",
      avatarUrl: "",
      tier: "FREE",
    });
    wallCreate.mockResolvedValue({ id: "wall1", userId: "p2" });
    cabinetCreate.mockResolvedValue({ id: "cab1" });
    const { syncUser } = await import("@/server/actions/auth");
    const result = await syncUser("idtoken");
    expect(txSpy).toHaveBeenCalledOnce();
    expect(wallCreate).toHaveBeenCalled();
    expect(cabinetCreate).toHaveBeenCalled();
    expect(result.id).toBe("p2");
  });

  it("throws when the verified Firebase user has no email", async () => {
    verifyIdTokenSpy.mockResolvedValue({ uid: "fb-3" });
    const { syncUser } = await import("@/server/actions/auth");
    await expect(syncUser("idtoken")).rejects.toThrow(/no email/i);
  });

  it("propagates verifyIdToken errors", async () => {
    verifyIdTokenSpy.mockRejectedValue(new Error("invalid token"));
    const { syncUser } = await import("@/server/actions/auth");
    await expect(syncUser("bogus")).rejects.toThrow(/invalid token/i);
  });
});

describe("getCurrentUser", () => {
  it("returns the Prisma user when token verifies", async () => {
    verifyIdTokenSpy.mockResolvedValue({ uid: "fb-1" });
    userFindUnique.mockResolvedValue({ id: "p1", firebaseUid: "fb-1" });
    const { getCurrentUser } = await import("@/server/actions/auth");
    const u = await getCurrentUser("idtoken");
    expect(u?.id).toBe("p1");
  });

  it("returns null on token verification failure", async () => {
    verifyIdTokenSpy.mockRejectedValue(new Error("bad"));
    const { getCurrentUser } = await import("@/server/actions/auth");
    expect(await getCurrentUser("bad")).toBeNull();
  });
});

describe("getUserProfile", () => {
  it("returns id+tier and mints the __session cookie when the email is verified", async () => {
    verifyIdTokenSpy.mockResolvedValue({
      uid: "fb-1",
      email: "u@example.com",
      email_verified: true,
    });
    createSessionCookieSpy.mockResolvedValue("session-cookie");
    userFindUnique.mockResolvedValue({ id: "p1", tier: "PRO" });
    const { getUserProfile } = await import("@/server/actions/auth");
    expect(await getUserProfile("idtoken")).toEqual({ id: "p1", tier: "PRO" });
    expect(createSessionCookieSpy).toHaveBeenCalledOnce();
    expect(cookieSetSpy).toHaveBeenCalledOnce();
  });

  it("refuses an unverified email — no profile, no session cookie", async () => {
    verifyIdTokenSpy.mockResolvedValue({
      uid: "fb-9",
      email: "unverified@example.com",
      email_verified: false,
    });
    createSessionCookieSpy.mockResolvedValue("session-cookie");
    userFindUnique.mockResolvedValue({ id: "p9", tier: "PRO" });
    const { getUserProfile } = await import("@/server/actions/auth");
    expect(await getUserProfile("idtoken")).toBeNull();
    expect(createSessionCookieSpy).not.toHaveBeenCalled();
    expect(cookieSetSpy).not.toHaveBeenCalled();
  });

  it("returns null when user not in Prisma", async () => {
    verifyIdTokenSpy.mockResolvedValue({
      uid: "fb-1",
      email: "u@example.com",
      email_verified: true,
    });
    userFindUnique.mockResolvedValue(null);
    const { getUserProfile } = await import("@/server/actions/auth");
    expect(await getUserProfile("idtoken")).toBeNull();
  });

  it("returns null on verification failure (no throw)", async () => {
    verifyIdTokenSpy.mockRejectedValue(new Error("nope"));
    const { getUserProfile } = await import("@/server/actions/auth");
    expect(await getUserProfile("bad")).toBeNull();
  });
});
