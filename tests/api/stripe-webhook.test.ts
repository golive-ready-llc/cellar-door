import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Hoisted mocks (vi.hoisted runs before vi.mock factories)
const { constructEventMock, subscriptionsRetrieveMock, prismaMock, sentryCaptureExceptionMock } = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  subscriptionsRetrieveMock: vi.fn(),
  prismaMock: {
    processedStripeEvent: { create: vi.fn(), delete: vi.fn() },
    user: { update: vi.fn(), findFirst: vi.fn() },
  },
  sentryCaptureExceptionMock: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => sentryCaptureExceptionMock(...args),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: (...args: unknown[]) => constructEventMock(...args) },
    subscriptions: { retrieve: (...args: unknown[]) => subscriptionsRetrieveMock(...args) },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("@/lib/stripe-helpers", () => ({
  tierFromPriceId: (id: string) => (id === "price_pro" ? "PRO" : id === "price_premium" ? "PREMIUM" : null),
}));

import { POST } from "@/app/api/stripe/webhook/route";

function makeReq(body: string, sig: string | null): NextRequest {
  const headers: Record<string, string> = {};
  if (sig) headers["stripe-signature"] = sig;
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers,
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  prismaMock.processedStripeEvent.create.mockResolvedValue({});
  prismaMock.processedStripeEvent.delete.mockResolvedValue({});
  prismaMock.user.update.mockResolvedValue({});
  prismaMock.user.findFirst.mockResolvedValue({ id: "user_1" });
});

describe("Stripe webhook", () => {
  it("returns 400 if missing signature header", async () => {
    const res = await POST(makeReq("{}", null));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid signature", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await POST(makeReq("{}", "sig"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });

  it("acks 200 with deduped:true on already-processed event", async () => {
    constructEventMock.mockReturnValue({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
    prismaMock.processedStripeEvent.create.mockRejectedValue({ code: "P2002" });
    const res = await POST(makeReq("{}", "sig"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deduped).toBe(true);
  });

  it("inserts dedupe row, runs handler, returns 200 on new event", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_2",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "u1" } } },
    });
    const res = await POST(makeReq("{}", "sig"));
    expect(prismaMock.processedStripeEvent.create).toHaveBeenCalledWith({
      data: { id: "evt_2", type: "checkout.session.completed" },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
  });

  it("captures cleanup failure to Sentry when both handler and dedupe delete throw", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_cleanup_fail",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", customer: "cus_1", status: "active", items: { data: [{ price: { id: "price_pro" } }] } } },
    });
    const handlerError = new Error("DB down");
    const cleanupError = new Error("DB still down");
    prismaMock.user.update.mockRejectedValue(handlerError);
    prismaMock.processedStripeEvent.delete.mockRejectedValue(cleanupError);

    const res = await POST(makeReq("{}", "sig"));

    expect(res.status).toBe(500);
    expect(sentryCaptureExceptionMock).toHaveBeenCalledTimes(1);
    expect(sentryCaptureExceptionMock).toHaveBeenCalledWith(
      cleanupError,
      expect.objectContaining({
        tags: expect.objectContaining({
          source: "stripe-webhook",
          phase: "dedupe-cleanup",
          eventType: "customer.subscription.updated",
        }),
        extra: expect.objectContaining({
          eventId: "evt_cleanup_fail",
          eventType: "customer.subscription.updated",
          originalError: "DB down",
        }),
      })
    );
    const json = await res.json();
    expect(json.cleanupFailed).toBe(true);
    expect(json.eventId).toBe("evt_cleanup_fail");
    expect(json.originalError).toBe("DB down");
  });

  it("DELETEs dedupe row when handler throws (so retry re-runs)", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_3",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", customer: "cus_1", status: "active", items: { data: [{ price: { id: "price_pro" } }] } } },
    });
    prismaMock.user.update.mockRejectedValue(new Error("DB down"));
    const res = await POST(makeReq("{}", "sig"));
    expect(res.status).toBe(500);
    expect(prismaMock.processedStripeEvent.delete).toHaveBeenCalledWith({ where: { id: "evt_3" } });
  });

  it("ai_credits + payment_status=paid → increments extraCredits (valid pack)", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_4",
      type: "checkout.session.completed",
      data: {
        object: {
          // 100 is a defined CREDIT_PACKS amount.
          metadata: { userId: "u1", type: "ai_credits", credits: "100" },
          payment_status: "paid",
        },
      },
    });
    const res = await POST(makeReq("{}", "sig"));
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { extraCredits: { increment: 100 } },
    });
  });

  it("ai_credits with a credits amount not matching any pack → refuses to grant", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_4b",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "u1", type: "ai_credits", credits: "999999" },
          payment_status: "paid",
        },
      },
    });
    const res = await POST(makeReq("{}", "sig"));
    expect(res.status).toBe(200); // acknowledged, but no grant
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("ai_credits + payment_status!=paid → does NOT increment", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_5",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "u1", type: "ai_credits", credits: "50" },
          payment_status: "unpaid",
        },
      },
    });
    await POST(makeReq("{}", "sig"));
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("checkout.session.completed for incomplete sub → does NOT promote tier", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_6",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "u1" }, subscription: "sub_1" } },
    });
    subscriptionsRetrieveMock.mockResolvedValue({
      status: "incomplete",
      items: { data: [{ price: { id: "price_pro" } }] },
    });
    await POST(makeReq("{}", "sig"));
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("checkout.session.completed for active sub → promotes tier", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_7",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "u1" }, subscription: "sub_1", customer: "cus_1" } },
    });
    subscriptionsRetrieveMock.mockResolvedValue({
      status: "active",
      items: { data: [{ price: { id: "price_pro" } }] },
    });
    await POST(makeReq("{}", "sig"));
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ tier: "PRO", stripeSubId: "sub_1" }),
      })
    );
  });

  it("checkout.session.completed for trialing sub → promotes tier", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_8",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "u1" }, subscription: "sub_1", customer: "cus_1" } },
    });
    subscriptionsRetrieveMock.mockResolvedValue({
      status: "trialing",
      items: { data: [{ price: { id: "price_premium" } }] },
    });
    await POST(makeReq("{}", "sig"));
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tier: "PREMIUM" }) })
    );
  });

  it("subscription.updated to incomplete_expired → downgrades to FREE, clears stripeSubId", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_9",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "incomplete_expired",
          items: { data: [{ price: { id: "price_pro" } }] },
        },
      },
    });
    await POST(makeReq("{}", "sig"));
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { tier: "FREE", stripeSubId: null },
    });
  });

  it("subscription.updated paused → downgrades to FREE", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_10",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "paused",
          items: { data: [{ price: { id: "price_pro" } }] },
        },
      },
    });
    await POST(makeReq("{}", "sig"));
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { tier: "FREE", stripeSubId: null },
    });
  });

  it("subscription.updated unhandled status → console.error", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    constructEventMock.mockReturnValue({
      id: "evt_11",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "future_unknown_status",
          items: { data: [{ price: { id: "price_pro" } }] },
        },
      },
    });
    await POST(makeReq("{}", "sig"));
    expect(errSpy).toHaveBeenCalledWith(expect.stringMatching(/Unhandled subscription status/));
    errSpy.mockRestore();
  });

  it("customer.subscription.paused → downgrades to FREE", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_12",
      type: "customer.subscription.paused",
      data: { object: { id: "sub_1", customer: "cus_1" } },
    });
    await POST(makeReq("{}", "sig"));
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { tier: "FREE", stripeSubId: null },
    });
  });

  it("invoice.payment_failed → logs warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    constructEventMock.mockReturnValue({
      id: "evt_13",
      type: "invoice.payment_failed",
      data: { object: { customer: "cus_1", id: "in_1", amount_due: 1000 } },
    });
    const res = await POST(makeReq("{}", "sig"));
    expect(res.status).toBe(200);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/invoice\.payment_failed/));
    warnSpy.mockRestore();
  });
});
