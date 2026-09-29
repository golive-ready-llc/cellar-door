import { POSTS } from "@/lib/blog-posts";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-static";

/**
 * RSS 2.0 feed for the blog. A standard discovery surface: feed readers,
 * aggregators, and crawlers all use it, and it gives the content a presence
 * outside the HTML surface (the AdSense "consistent presence" criterion).
 */
export async function GET() {
  const newestFirst = [...POSTS].sort((a, b) => (a.date > b.date ? -1 : 1));

  const items = newestFirst
    .map((post) => {
      const url = `${SITE_URL}/blog/${post.slug}`;
      // Excerpt is the syndication summary; the full body stays on the page.
      const excerpt = post.excerpt
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `    <item>
      <title>${post.title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${excerpt}</description>
      <pubDate>${new Date(`${post.date}T12:00:00Z`).toUTCString()}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Cellar Door Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Practical wine articles for collectors — storage, tasting, vintage charts, building a cellar. By the team behind Cellar Door.</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
