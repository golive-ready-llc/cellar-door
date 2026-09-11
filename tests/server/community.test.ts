import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * getCommunityRatings is a public read (no sign-in needed to see reviews), so
 * it must never expose internal user ids or anything derived from an email
 * address. Leaked ids were the input for the AI-credit abuse fixed 2026-09-10.
 */

process.env.DATABASE_URL = "postgresql://stub";

const communityWineFindFirst = vi.fn();
const communityRatingFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    communityWine: { findFirst: (...a: unknown[]) => communityWineFindFirst(...a) },
    communityRating: { findMany: (...a: unknown[]) => communityRatingFindMany(...a) },
  },
}));
vi.mock("@/lib/mock-store", () => ({ mockStore: {} }));
vi.mock("@/server/auth-guard", () => ({
  resolveServerUserId: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  communityWineFindFirst.mockResolvedValue({ id: "cw1" });
  communityRatingFindMany.mockResolvedValue([
    {
      id: "r1",
      userId: "user_secret_1",
      rating: 4,
      review: "Lovely",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      user: { displayName: "", email: "alice.private@example.com" },
    },
    {
      id: "r2",
      userId: "user_secret_2",
      rating: 5,
      review: "",
      createdAt: new Date("2026-02-01T00:00:00Z"),
      user: { displayName: "Sam", email: "sam@example.com" },
    },
  ]);
});

describe("getCommunityRatings (public read)", () => {
  it("never selects the reviewer's email", async () => {
    const { getCommunityRatings } = await import("@/server/actions/community");
    await getCommunityRatings("Cuvée", "Domaine", 2020);
    const args = communityRatingFindMany.mock.calls[0][0];
    expect(args.include.user.select).toEqual({ displayName: true });
  });

  it("returns no user ids and no email-derived names", async () => {
    const { getCommunityRatings } = await import("@/server/actions/community");
    const ratings = await getCommunityRatings("Cuvée", "Domaine", 2020);
    expect(ratings.map((r) => r.username)).toEqual(["Anonymous", "Sam"]);
    for (const r of ratings) expect(r).not.toHaveProperty("userId");
    const json = JSON.stringify(ratings);
    expect(json).not.toContain("user_secret");
    expect(json).not.toContain("alice");
  });
});

describe("submitCommunityRating validation", () => {
  it.each([1e9, -1, 0, 5.5, Number.NaN])("rejects rating %s without touching the database", async (rating) => {
    const { submitCommunityRating } = await import("@/server/actions/community");
    await expect(
      submitCommunityRating("Cuvée", "Domaine", 2020, "red", "", "", rating)
    ).rejects.toThrow(/Rating/);
    expect(communityWineFindFirst).not.toHaveBeenCalled();
  });

  it("rejects an over-long review", async () => {
    const { submitCommunityRating } = await import("@/server/actions/community");
    await expect(
      submitCommunityRating("Cuvée", "Domaine", 2020, "red", "", "", 4, "r".repeat(2001))
    ).rejects.toThrow(/too long/);
    expect(communityWineFindFirst).not.toHaveBeenCalled();
  });
});
