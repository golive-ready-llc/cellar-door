import { describe, it, expect } from "vitest";

// The RSS feed is a discovery surface for the blog — it must contain every
// published post and be well-formed enough for readers/aggregators.

import { GET } from "@/app/feed.xml/route";
import { POSTS } from "@/lib/blog-posts";

describe("RSS feed", () => {
  it("includes every published post with its canonical URL", async () => {
    const xml = await GET().then((r) => r.text());
    for (const post of POSTS) {
      expect(xml).toContain(`<link>https://mycellardoor.app/blog/${post.slug}</link>`);
      expect(xml).toContain(post.title.replace(/&/g, "&amp;"));
    }
  });

  it("is valid RSS 2.0 with a self link, sorted newest first", async () => {
    const xml = await GET().then((r) => r.text());
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('rel="self" type="application/rss+xml"');
    const dates = [...xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map((m) =>
      new Date(m[1]).getTime()
    );
    expect(dates.length).toBeGreaterThan(1);
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });
});
