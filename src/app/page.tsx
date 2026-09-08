import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";
import LandingPage from "./landing-client";

export const metadata: Metadata = {
  title: "Cellar Door — AI Wine Cellar Management",
  description:
    "Track, organize, and analyze your wine collection with AI-powered label scanning, community scores, and visual cellar management.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Cellar Door — AI Wine Cellar Management",
    description:
      "Track, organize, and analyze your wine collection with AI-powered label scanning, community scores, and visual cellar management.",
    url: SITE_URL,
    type: "website",
  },
};

export default function Page() {
  return <LandingPage />;
}
