import { describe, it, expect, vi, beforeEach } from "vitest";

/** submitFeedback bounds what one request can store. */

process.env.DATABASE_URL = "postgresql://stub";

const feedbackCreate = vi.fn();
const userFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    feedback: { create: (...a: unknown[]) => feedbackCreate(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
  },
}));
vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null }));
vi.mock("@/lib/admin", () => ({ isAdmin: () => false }));
vi.mock("@/server/auth-guard", () => ({
  resolveServerUserId: async () => "u1",
  requireAdmin: async () => ({ ok: true as const, email: "admin@test", uid: "u1" }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  userFindUnique.mockResolvedValue({ tier: "PRO" });
  feedbackCreate.mockResolvedValue({});
});

describe("submitFeedback", () => {
  it("rejects an over-long message without storing it", async () => {
    const { submitFeedback } = await import("@/server/actions/feedback");
    const res = await submitFeedback("u1", "Subject", "m".repeat(5001));
    expect(res.success).toBe(false);
    expect(feedbackCreate).not.toHaveBeenCalled();
  });

  it("rejects an empty message", async () => {
    const { submitFeedback } = await import("@/server/actions/feedback");
    const res = await submitFeedback("u1", "Subject", "   ");
    expect(res.success).toBe(false);
    expect(feedbackCreate).not.toHaveBeenCalled();
  });

  it("stores a normal message with the subject capped at 200 characters", async () => {
    const { submitFeedback } = await import("@/server/actions/feedback");
    const res = await submitFeedback("u1", "s".repeat(300), "Love the cellar grid");
    expect(res.success).toBe(true);
    const { data } = feedbackCreate.mock.calls[0][0];
    expect(data.subject).toHaveLength(200);
    expect(data.message).toBe("Love the cellar grid");
  });
});
