import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { authMock, customersCreateMock, sessionsCreateMock, prismaMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    customersCreateMock: vi.fn(),
    sessionsCreateMock: vi.fn(),
    prismaMock: {
      user: { findUnique: vi.fn(), update: vi.fn() },
    },
  }));

vi.mock("@/lib/api-auth", () => ({
  authenticateIdToken: (...args: unknown[]) => authMock(...args),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: (...args: unknown[]) => customersCreateMock(...args) },
    checkout: {
      sessions: { create: (...args: unknown[]) => sessionsCreateMock(...args) },
    },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "@/app/api/stripe/checkout/route";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_PRICE_PRO = "price_pro_monthly";
  delete process.env.NEXT_PUBLIC_SITE_URL;
  authMock.mockResolvedValue({ ok: true, uid: "uid_1", email: "owner@example.com" });
});

describe("POST /api/stripe/checkout", () => {
  it("creates a customer on first checkout and builds the session against it and SITE_URL", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "owner@example.com",
      stripeCustomerId: null,
    });
    customersCreateMock.mockResolvedValue({ id: "cus_new" });
    prismaMock.user.update.mockResolvedValue({});
    sessionsCreateMock.mockResolvedValue({ url: "https://checkout.stripe.com/s_1" });

    const res = await POST(makeReq({ tier: "PRO" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/s_1" });
    expect(customersCreateMock).toHaveBeenCalledWith({
      email: "owner@example.com",
      metadata: { userId: "user_1", firebaseUid: "uid_1" },
    });
    expect(sessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_new",
        mode: "subscription",
        success_url: "https://mycellardoor.app/settings?checkout=success",
        cancel_url: "https://mycellardoor.app/settings",
      })
    );
  });

  it("reuses the stored customer id instead of creating a second Stripe customer", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "owner@example.com",
      stripeCustomerId: "cus_existing",
    });
    sessionsCreateMock.mockResolvedValue({ url: "https://checkout.stripe.com/s_2" });

    const res = await POST(makeReq({ tier: "PRO" }));

    expect(res.status).toBe(200);
    expect(customersCreateMock).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(sessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" })
    );
  });

  it("returns 404 when the Firebase caller has no Prisma user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeReq({ tier: "PRO" }));

    expect(res.status).toBe(404);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it("rejects tiers that have no checkout price", async () => {
    const res = await POST(makeReq({ tier: "FREE" }));

    expect(res.status).toBe(400);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });
});
