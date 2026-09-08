import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Allow all public-content paths. Disallow gated app paths
        // (signed-in routes) since they require auth + return 307 to
        // /gate for unauth visitors anyway. Crawlers that try them
        // just waste their budget.
        allow: ["/", "/blog", "/blog/", "/demo", "/terms", "/login", "/signup"],
        disallow: [
          "/cellar",
          "/inventory",
          "/buy-list",
          "/history",
          "/stats",
          "/settings",
          "/admin",
          "/insurance-report",
          "/api/",
          "/gate",
          "/verify-email",
          "/guest/",
        ],
      },
    ],
    sitemap: "https://mycellardoor.app/sitemap.xml",
    host: "https://mycellardoor.app",
  };
}
