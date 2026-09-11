import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for `authenticateIdToken` in `src/lib/api-auth.ts` — the
 * Firebase-ID-token path used by the routes whose caller is the signed-in
 * browser user (Stripe checkout, credit packs, billing portal).
 */

const verifyIdTokenSpy = vi.fn();
const getAdminAuthSpy = vi.fn();

vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => getAdminAuthSpy(),
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { authenticateIdToken } from "@/lib/api-auth";

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/stripe/portal", {
    method: "POST",
    headers,
  });
}

async function body(response: Response) {
  return (await response.json()) as { error?: string };
}

beforeEach(() => {
  verifyIdTokenSpy.mockReset();
  getAdminAuthSpy.mockReset();
  getAdminAuthSpy.mockReturnValue({ verifyIdToken: verifyIdTokenSpy });
});

describe("authenticateIdToken", () => {
  it("401s a request with no Authorization header", async () => {
    const result = await authenticateIdToken(req());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect((await body(result.response)).error).toBe("Unauthorized");
    }
    expect(verifyIdTokenSpy).not.toHaveBeenCalled();
  });

  it("401s a scheme that is not Bearer", async () => {
    const result = await authenticateIdToken(req({ Authorization: "Basic abc" }));
    expect(result.ok).toBe(false);
    expect(verifyIdTokenSpy).not.toHaveBeenCalled();
  });

  it("500s when Firebase Admin is not configured", async () => {
    getAdminAuthSpy.mockReturnValue(null);
    const result = await authenticateIdToken(req({ Authorization: "Bearer tok" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(500);
      expect((await body(result.response)).error).toBe("Auth not configured");
    }
  });

  it("401s an expired or forged token rather than 500ing", async () => {
    verifyIdTokenSpy.mockRejectedValue(new Error("Firebase ID token has expired"));
    const result = await authenticateIdToken(req({ Authorization: "Bearer stale" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns the verified uid and email", async () => {
    verifyIdTokenSpy.mockResolvedValue({ uid: "fb-uid-1", email: "wine@example.com" });
    const result = await authenticateIdToken(req({ Authorization: "Bearer good" }));
    expect(result).toEqual({ ok: true, uid: "fb-uid-1", email: "wine@example.com" });
    expect(verifyIdTokenSpy).toHaveBeenCalledWith("good");
  });

  it("accepts a lowercased authorization header and trims the token", async () => {
    verifyIdTokenSpy.mockResolvedValue({ uid: "fb-uid-1" });
    // Two spaces after "Bearer": the header value is normalized by fetch but
    // the space past the scheme survives, so only trim() reaches the SDK clean.
    const result = await authenticateIdToken(req({ authorization: "Bearer  good" }));
    expect(result.ok).toBe(true);
    expect(verifyIdTokenSpy).toHaveBeenCalledWith("good");
  });
});
