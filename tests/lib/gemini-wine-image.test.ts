import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Regression: a product page whose og:image is a root-relative URL
 * (content="/media/bottle.jpg") went straight into the SSRF guard, which
 * threw on a relative URL — so the chunk was dropped and the user was told
 * no image was found after spending the image-search credits. Relative image
 * URLs now resolve against the (already SSRF-checked) page URL.
 */

vi.mock("@/lib/ssrf-guard", () => ({
  assertPublicUrl: async (url: string) => new URL(url),
}));

import { GeminiProvider } from "@/lib/ai/gemini";

type FetchLike = {
  ok: boolean;
  headers: { get: (name: string) => string | null };
  text?: () => Promise<string>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
};

const PAGE_URL = "https://shop.example/wine/1";

function pageHtml(ogImage: string): string {
  return `<html><head><meta property="og:image" content="${ogImage}"></head><body></body></html>`;
}

async function runImageSearch(ogImage: string) {
  const fetchedUrls: string[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request): Promise<FetchLike> => {
    const href = typeof url === "string" ? url : url.toString();
    fetchedUrls.push(href);
    if (href === "https://news.example/redirect/x") {
      return { ok: true, headers: { get: (n) => (n === "location" ? PAGE_URL : null) } };
    }
    if (href === PAGE_URL) {
      return { ok: true, headers: { get: () => null }, text: async () => pageHtml(ogImage) };
    }
    return {
      ok: true,
      headers: { get: (n) => (n === "content-type" ? "image/jpeg" : null) },
      arrayBuffer: async () => new ArrayBuffer(8192),
    };
  });
  vi.stubGlobal("fetch", fetchMock);

  const provider = new GeminiProvider("test-key");
  (
    provider as unknown as {
      client: {
        models: {
          generateContent: () => Promise<{
            candidates: {
              groundingMetadata: {
                groundingChunks: { web: { uri: string } }[];
              };
            }[];
          }>;
        };
      };
    }
  ).client = {
    models: {
      generateContent: async () => ({
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [{ web: { uri: "https://news.example/redirect/x" } }],
            },
          },
        ],
      }),
    },
  };

  try {
    const result = await provider.fetchWineImage({
      name: "Côtes du Rhône",
      winery: "Guigal",
      vintage: 2019,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    return { result, fetchedUrls };
  } finally {
    vi.unstubAllGlobals();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GeminiProvider.fetchWineImage", () => {
  it("resolves a root-relative og:image against the page URL", async () => {
    const { result, fetchedUrls } = await runImageSearch("/media/bottle.jpg");
    expect(fetchedUrls).toContain("https://shop.example/media/bottle.jpg");
    expect(result.imageUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("resolves a protocol-relative og:image to https", async () => {
    const { fetchedUrls } = await runImageSearch("//cdn.shop.example/img.jpg");
    expect(fetchedUrls).toContain("https://cdn.shop.example/img.jpg");
  });

  it("downloads an absolute og:image unchanged (control)", async () => {
    const { fetchedUrls } = await runImageSearch("https://img.shop.example/b.jpg");
    expect(fetchedUrls).toContain("https://img.shop.example/b.jpg");
  });
});
