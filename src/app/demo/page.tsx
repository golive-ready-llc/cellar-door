import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site-url";
import { DemoRedirect } from "./demo-client";

export const metadata: Metadata = {
  title: "Try the Live Demo — No Signup | Cellar Door",
  description:
    "Explore the full Cellar Door wine cellar manager with a sample collection: the visual cellar map, label scanning, tasting notes, stats, and AI features — no account needed.",
  alternates: { canonical: `${SITE_URL}/demo` },
};

/**
 * Demo entry point. Server-renders a real description of what the demo is so
 * crawlers (and anyone without JavaScript) get an actual page — the previous
 * version was a client-only redirect stub, which read as an empty page. JS
 * visitors are still carried straight into the demo by <DemoRedirect />.
 */
export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DemoRedirect />
      <main className="mx-auto max-w-2xl px-4 py-20 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Try Cellar Door — live demo, no signup
        </h1>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            The demo loads a complete sample wine collection into the real
            app — everything works: the visual cellar map with drag-and-drop
            bottle placement, label scanning, tasting notes, buy list,
            statistics, and the AI features including Cellar Chat. No account
            is created and nothing you do is saved.
          </p>
          <p>
            If you have JavaScript enabled you are being taken there now.
            Prefer to read first? The{" "}
            <Link className="text-primary underline underline-offset-2" href="/blog">
              blog
            </Link>{" "}
            covers storing, serving, buying, and cellaring wine in depth, and
            the{" "}
            <Link className="text-primary underline underline-offset-2" href="/">
              homepage
            </Link>{" "}
            explains every feature. When you are ready for your own cellar,{" "}
            <Link className="text-primary underline underline-offset-2" href="/signup">
              sign up free
            </Link>
            .
          </p>
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">
          Loading demo…
        </p>
      </main>
    </div>
  );
}
