import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Clock, Wine } from "lucide-react";
import { POSTS } from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: "Wine Cellar Blog — Storage, Tasting, and Collecting | Cellar Door",
  description:
    "Practical wine articles for collectors: how to store wine at home, decanting basics, vintage charts, building your first cellar. By the team behind Cellar Door.",
  alternates: { canonical: "https://mycellardoor.app/blog" },
  openGraph: {
    title: "Wine Cellar Blog | Cellar Door",
    description:
      "Practical wine articles for collectors. Storage, tasting, vintage charts, building your first cellar.",
    url: "https://mycellardoor.app/blog",
    type: "website",
  },
};

export default function BlogIndex() {
  // Newest first
  const sorted = [...POSTS].sort((a, b) => (a.date > b.date ? -1 : 1));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Cellar Door" className="h-8 w-auto rounded-lg" />
            <span className="text-lg font-bold">Cellar Door</span>
          </Link>
          <Link
            href="/signup"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            Try the app <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Wine Cellar Blog</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Practical articles on wine storage, tasting, vintage charts, and
            building a collection — written for serious home collectors by the
            team that built Cellar Door.
          </p>
        </div>

        <div className="space-y-6">
          {sorted.map((post) => (
            <article
              key={post.slug}
              className="rounded-2xl border border-border/50 bg-card p-6 hover:border-border transition-colors group"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  <Wine className="h-3 w-3" />
                  {post.tags[0]}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.readingMinutes} min read
                </span>
                <span>·</span>
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </div>
              <h2 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {post.excerpt}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline"
              >
                Read article <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
          <Wine className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            Ready to organize your own cellar?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Cellar Door turns reading about wine into actually managing yours.
            Track unlimited bottles free, no credit card.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            Create your cellar <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
