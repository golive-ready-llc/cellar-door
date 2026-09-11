import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Verification test for the account-delete → Stripe-cancel wiring.
 *
 * Why this test exists: when a user deletes their account, we must cancel
 * their Stripe subscription AND delete their Stripe customer BEFORE
 * wiping the Prisma row. Otherwise the customer/sub IDs are lost and
 * the subscription keeps billing forever (silent revenue leak + GDPR
 * problem). This test mocks Stripe + Prisma + Firebase Admin and
 * asserts:
 *
 *   1. stripe.subscriptions.cancel(subId, {invoice_now: false, prorate: false})
 *      is called BEFORE prisma.user.delete()
 *   2. stripe.customers.del(customerId) is called BEFORE prisma.user.delete()
 *   3. Stripe failures don't block deletion (try/catch swallows them
 *      after audit-logging — better to lose a Stripe sub than strand
 *      a user mid-delete).
 *   4. Users with no Stripe IDs (e.g. free-tier users) skip Stripe
 *      entirely without crashing.
 */

// ─── Mock setup ──────────────────────────────────────────────────────

const cancelSpy = vi.fn().mockResolvedValue({ id: "sub_xxx", status: "canceled" });
const customerDelSpy = vi.fn().mockResolvedValue({ id: "cus_xxx", deleted: true });
const userDeleteSpy = vi.fn().mockResolvedValue({ id: "user_xxx" });
const userFindUniqueSpy = vi.fn();
const adminDeleteUserSpy = vi.fn().mockResolvedValue(undefined);
const verifyIdTokenSpy = vi.fn().mockResolvedValue({ uid: "firebase_uid_xxx" });

// Stripe lazy proxy reads from process.env on first access — set a stub
// so the lazy init doesn't throw "STRIPE_SECRET_KEY is not set".
process.env.STRIPE_SECRET_KEY = "sk_test_stub_for_unit_tests";
process.env.DATABASE_URL = "postgresql://stub";

vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: { cancel: cancelSpy },
    customers: { del: customerDelSpy },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueSpy,
      delete: userDeleteSpy,
    },
  },
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    verifyIdToken: verifyIdTokenSpy,
    deleteUser: adminDeleteUserSpy,
  },
  getAdminAuth: () => ({
    verifyIdToken: verifyIdTokenSpy,
    deleteUser: adminDeleteUserSpy,
  }),
}));

vi.mock("@/server/actions/audit", () => ({
  logAudit: vi.fn(),
}));

// Mock unrelated imports that the auth.ts module pulls in
vi.mock("@/types/constants", () => ({ DEFAULT_CABINETS: [] }));
vi.mock("@/lib/mock-store", () => ({ mockStore: {} }));

// ─── Import AFTER mocks are registered ──────────────────────────────

const { deleteAccount } = await import("@/server/actions/auth");

// ─── Tests ───────────────────────────────────────────────────────────

describe("deleteAccount → Stripe cancellation", () => {
  beforeEach(() => {
    cancelSpy.mockClear();
    customerDelSpy.mockClear();
    userDeleteSpy.mockClear();
    userFindUniqueSpy.mockClear();
    adminDeleteUserSpy.mockClear();
    verifyIdTokenSpy.mockClear();
    cancelSpy.mockResolvedValue({ id: "sub_xxx", status: "canceled" });
    customerDelSpy.mockResolvedValue({ id: "cus_xxx", deleted: true });
    userDeleteSpy.mockResolvedValue({ id: "user_xxx" });
  });

  it("cancels sub + deletes customer BEFORE deleting Prisma user (paid user)", async () => {
    userFindUniqueSpy.mockResolvedValue({
      id: "user_xxx",
      firebaseUid: "firebase_uid_xxx",
      email: "paid@example.com",
      stripeCustomerId: "cus_xxx",
      stripeSubId: "sub_xxx",
      tier: "PRO",
    });

    const result = await deleteAccount("fake-id-token");

    expect(result).toEqual({ success: true });

    // Stripe sub cancellation: correct args, immediate (no proration / no final invoice)
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(cancelSpy).toHaveBeenCalledWith("sub_xxx", {
      invoice_now: false,
      prorate: false,
    });

    // Stripe customer deletion: correct ID
    expect(customerDelSpy).toHaveBeenCalledTimes(1);
    expect(customerDelSpy).toHaveBeenCalledWith("cus_xxx");

    // Prisma user deletion: correct ID
    expect(userDeleteSpy).toHaveBeenCalledTimes(1);
    expect(userDeleteSpy).toHaveBeenCalledWith({ where: { id: "user_xxx" } });

    // Order matters: both Stripe calls must complete BEFORE prisma.user.delete
    // (vitest's invocationCallOrder gives a global call sequence)
    const cancelOrder = cancelSpy.mock.invocationCallOrder[0];
    const customerDelOrder = customerDelSpy.mock.invocationCallOrder[0];
    const userDeleteOrder = userDeleteSpy.mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(userDeleteOrder);
    expect(customerDelOrder).toBeLessThan(userDeleteOrder);

    // Firebase Auth user also deleted
    expect(adminDeleteUserSpy).toHaveBeenCalledWith("firebase_uid_xxx");
  });

  it("skips Stripe calls for free users with no stripeSubId / stripeCustomerId", async () => {
    userFindUniqueSpy.mockResolvedValue({
      id: "user_free",
      firebaseUid: "firebase_uid_free",
      email: "free@example.com",
      stripeCustomerId: null,
      stripeSubId: null,
      tier: "FREE",
    });

    const result = await deleteAccount("fake-id-token");

    expect(result).toEqual({ success: true });
    expect(cancelSpy).not.toHaveBeenCalled();
    expect(customerDelSpy).not.toHaveBeenCalled();
    expect(userDeleteSpy).toHaveBeenCalledTimes(1);
  });

  it("still deletes the user even if Stripe.subscriptions.cancel throws", async () => {
    cancelSpy.mockRejectedValueOnce(new Error("Stripe API down"));
    userFindUniqueSpy.mockResolvedValue({
      id: "user_xxx",
      firebaseUid: "firebase_uid_xxx",
      email: "paid@example.com",
      stripeCustomerId: "cus_xxx",
      stripeSubId: "sub_xxx",
      tier: "PRO",
    });

    const result = await deleteAccount("fake-id-token");

    expect(result).toEqual({ success: true });
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    // Customer del still attempted (defense-in-depth — sub cancel might
    // have failed because sub already canceled, customer del still useful)
    expect(customerDelSpy).toHaveBeenCalledTimes(1);
    // Prisma user still deleted — Stripe failures must NOT strand the user
    expect(userDeleteSpy).toHaveBeenCalledTimes(1);
  });

  it("still deletes the user even if Stripe.customers.del throws", async () => {
    customerDelSpy.mockRejectedValueOnce(new Error("Stripe API down"));
    userFindUniqueSpy.mockResolvedValue({
      id: "user_xxx",
      firebaseUid: "firebase_uid_xxx",
      email: "paid@example.com",
      stripeCustomerId: "cus_xxx",
      stripeSubId: "sub_xxx",
      tier: "PRO",
    });

    const result = await deleteAccount("fake-id-token");

    expect(result).toEqual({ success: true });
    expect(userDeleteSpy).toHaveBeenCalledTimes(1);
  });

  it("returns error and skips Stripe when user not found", async () => {
    userFindUniqueSpy.mockResolvedValue(null);

    const result = await deleteAccount("fake-id-token");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(cancelSpy).not.toHaveBeenCalled();
    expect(customerDelSpy).not.toHaveBeenCalled();
    expect(userDeleteSpy).not.toHaveBeenCalled();
  });
});
