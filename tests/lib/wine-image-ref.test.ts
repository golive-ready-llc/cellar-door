import { describe, it, expect } from "vitest";
import { decodeImageDataUrl, listImageUrl, parseWineImageRef } from "@/lib/wine-image-ref";

const JPEG = "data:image/jpeg;base64," + Buffer.from("fake-jpeg-bytes").toString("base64");
const OTHER_JPEG = "data:image/jpeg;base64," + Buffer.from("other-jpeg-bytes").toString("base64");
const SVG = "data:image/svg+xml;base64," + Buffer.from("<svg/>").toString("base64");

describe("wine image references", () => {
  it("replaces stored raster data URLs with a route URL", () => {
    expect(listImageUrl("wine", "w1", JPEG)).toMatch(/^\/api\/wine-image\/w1\?v=[a-z0-9-]+$/);
  });

  it("leaves remote URLs, SVGs and empty values alone", () => {
    expect(listImageUrl("wine", "w1", "https://img.example/x.jpg")).toBe("https://img.example/x.jpg");
    expect(listImageUrl("wine", "w1", SVG)).toBe(SVG);
    expect(listImageUrl("wine", "w1", "")).toBe("");
  });

  it("gives a changed image a new URL", () => {
    expect(listImageUrl("wine", "w1", JPEG)).not.toBe(listImageUrl("wine", "w1", OTHER_JPEG));
  });

  it("round-trips the record id and kind", () => {
    expect(parseWineImageRef(listImageUrl("history", "h 1", JPEG))).toEqual({ kind: "history", id: "h 1" });
    expect(parseWineImageRef(listImageUrl("wine", "w1", JPEG))).toEqual({ kind: "wine", id: "w1" });
    expect(parseWineImageRef("https://evil.example/api/wine-image/w1")).toBeNull();
    expect(parseWineImageRef("/api/wine-image/a/b?v=1")).toBeNull();
  });

  it("decodes raster images only", () => {
    const image = decodeImageDataUrl(JPEG);
    expect(image?.contentType).toBe("image/jpeg");
    expect(Buffer.from(image!.bytes).toString()).toBe("fake-jpeg-bytes");
    expect(decodeImageDataUrl(SVG)).toBeNull();
  });
});
