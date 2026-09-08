import type { Metadata } from "next";
import LandingPage from "./landing-client";

export const metadata: Metadata = {
  title: "Cellar Door — AI Wine Cellar Management",
  description:
    "Track, organize, and analyze your wine collection with AI-powered label scanning, community scores, and visual cellar management.",
  alternates: { canonical: "https://mycellardoor.app" },
  openGraph: {
    title: "Cellar Door — AI Wine Cellar Management",
    description:
      "Track, organize, and analyze your wine collection with AI-powered label scanning, community scores, and visual cellar management.",
    url: "https://mycellardoor.app",
    type: "website",
  },
};

export default function Page() {
  return <LandingPage />;
}
