import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE_URL } from "@/lib/site-url";
import { isSingleUserMode } from "@/lib/single-user";
import LandingPage from "./landing-client";

export const metadata: Metadata = {
  title: "Cellar Door — AI Wine Cellar Management",
  description:
    "Open-source, AI-powered wine cellar management — track, organize, and analyze your collection with label scanning, community scores, and a visual cellar map. Free to self-host.",
  alternates: {
    canonical: SITE_URL,
    types: { "application/rss+xml": `${SITE_URL}/feed.xml` },
  },
  openGraph: {
    title: "Cellar Door — AI Wine Cellar Management",
    description:
      "Open-source, AI-powered wine cellar management — track, organize, and analyze your collection with label scanning, community scores, and a visual cellar map. Free to self-host.",
    url: SITE_URL,
    type: "website",
  },
};

export default function Page() {
  if (isSingleUserMode()) {
    redirect("/cellar");
  }

  // Entity structured data: tells Google what the site IS (a product with a
  // company behind it, plus a content feed) rather than leaving it to infer
  // from marketing copy. AdSense's quality assessment reads the public
  // surface; an explicit Organization + WebApplication + WebSite graph is
  // the standard way a real product documents itself.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Golive Ready, LLC",
        url: SITE_URL,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Cellar Door",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: "Cellar Door",
        url: SITE_URL,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web, Android, iOS",
        description:
          "Open-source, AI-powered wine cellar management — track, organize, and analyze your collection with label scanning, community scores, and a visual cellar map.",
        publisher: { "@id": `${SITE_URL}/#organization` },
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
