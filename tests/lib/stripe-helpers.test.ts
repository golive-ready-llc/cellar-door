import { describe, it, expect, vi, beforeEach } from "vitest";

const { customersCreateMock, prismaMock } = vi.hoisted(() => ({
  customersCreateMock: vi.fn(),
  prismaMock: { user: { update: vi.fn() } },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: (...args: unknown[]) => customersCreateMock(...args) },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getOrCreateStripeCustomerId } from "@/lib/stripe-helpers";

const user = { id: "user_1", email: "owner@example.com", stripeCustomerId: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrCreateStripeCustomerId", () => {
  it("reuses the stored customer id without touching Stripe or the database", async () => {
    const id = await getOrCreateStripeCustomerId(
      { ...user, stripeCustomerId: "cus_existing" },
      "uid_1"
    );

    expect(id).toBe("cus_existing");
    expect(customersCreateMock).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("creates the Stripe customer on first checkout, tags it with the app user, and persists it", async () => {
    customersCreateMock.mockResolvedValue({ id: "cus_new" });
    prismaMock.user.update.mockResolvedValue({});

    const id = await getOrCreateStripeCustomerId(user, "uid_1");

    expect(id).toBe("cus_new");
    expect(customersCreateMock).toHaveBeenCalledWith({
      email: "owner@example.com",
      metadata: { userId: "user_1", firebaseUid: "uid_1" },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { stripeCustomerId: "cus_new" },
    });
  });
});
