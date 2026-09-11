import { describe, it, expect } from "vitest";
import { limitWineText, WINE_TEXT_LIMITS } from "@/lib/wine-text-limits";

describe("limitWineText", () => {
  it("truncates over-long short and long text fields", () => {
    const out = limitWineText({
      name: "n".repeat(WINE_TEXT_LIMITS.short + 50),
      notes: "x".repeat(WINE_TEXT_LIMITS.long + 1),
      region: "Loire",
    });
    expect(out.name).toHaveLength(WINE_TEXT_LIMITS.short);
    expect(out.notes).toHaveLength(WINE_TEXT_LIMITS.long);
    expect(out.region).toBe("Loire");
  });

  it("bounds the tag list and drops non-string tags", () => {
    const tags = [...Array.from({ length: 80 }, (_, i) => `tag${i}`), 42, "t".repeat(200)];
    const out = limitWineText({ tags: tags as unknown as string[] });
    expect(out.tags).toHaveLength(WINE_TEXT_LIMITS.tagCount);
    expect(out.tags?.every((t) => typeof t === "string" && t.length <= WINE_TEXT_LIMITS.tagLength)).toBe(true);
  });

  it("leaves image data and absent fields alone", () => {
    const imageUrl = "data:image/jpeg;base64," + "A".repeat(100_000);
    const out = limitWineText({ imageUrl });
    expect(out.imageUrl).toBe(imageUrl);
    expect(out).not.toHaveProperty("name");
  });

  it("bounds string or object tasting notes", () => {
    expect(limitWineText({ tastingNotes: "y".repeat(WINE_TEXT_LIMITS.long + 5) }).tastingNotes)
      .toHaveLength(WINE_TEXT_LIMITS.long);
    const obj = limitWineText({ tastingNotes: { aroma: "z".repeat(WINE_TEXT_LIMITS.long + 5) } })
      .tastingNotes as { aroma: string };
    expect(obj.aroma).toHaveLength(WINE_TEXT_LIMITS.long);
  });
});
