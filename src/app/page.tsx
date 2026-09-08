import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";
import LandingPage from "./landing-client";

export const metadata: Metadata = {
  title: "Cellar Door — AI Wine Cellar Management",
  description:
    "Open-source, AI-powered wine cellar management — track, organize, and analyze your collection with label scanning, community scores, and a visual cellar map. Free to self-host.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Cellar Door — AI Wine Cellar Management",
    description:
      "Open-source, AI-powered wine cellar management — track, organize, and analyze your collection with label scanning, community scores, and a visual cellar map. Free to self-host.",
    url: SITE_URL,
    type: "website",
  },
};

export default function Page() {
  return <LandingPage />;
}
