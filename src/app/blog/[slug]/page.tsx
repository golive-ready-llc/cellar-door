import Link from "next/link";
import { SITE_URL } from "@/lib/site-url";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Clock, Wine } from "lucide-react";
import { getAllSlugs, getPost } from "@/lib/blog-posts";

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Not found | Cellar Door" };

  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: `${post.title} | Cellar Door`,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url,
      type: "article",
      publishedTime: post.date,
      tags: post.tags,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  // JSON-LD structured data — helps Google understand this is an article,
  // boosts SEO, and is required-ish for rich results / AdSense quality
  // assessment of the page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Organization",
      name: "Cellar Door",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Cellar Door",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}`,
    },
    keywords: post.tags.join(", "),
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Cellar Door" className="h-8 w-auto rounded-lg" />
            <span className="text-lg font-bold">Cellar Door</span>
          </Link>
          <Link
            href="/blog"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All articles
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Meta strip */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 flex-wrap">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
            >
              {tag}
            </span>
          ))}
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

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
          {post.title}
        </h1>

        <p className="text-lg text-muted-foreground leading-relaxed mb-10 italic border-l-4 border-primary/40 pl-4">
          {post.excerpt}
        </p>

        {/* Body — rendered via dangerouslySetInnerHTML. Content is
            author-controlled in lib/blog-posts.ts (no user input), so the
            XSS surface is the post-author themselves. */}
        <div
          className="prose-content"
          dangerouslySetInnerHTML={{ __html: post.body }}
        />

        {/* CTA at end of article */}
        <div className="mt-16 rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Wine className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-1">
                Put what you just read into practice
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Cellar Door is a wine collection app for serious collectors.
                Visual cellar map, AI label scanning, drink-window guidance, and
                more. Unlimited bottles, free.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Try Cellar Door free <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Back to blog */}
        <div className="mt-12 pt-8 border-t border-border/50">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All articles
          </Link>
        </div>
      </article>

      {/* Inline article styles — kept out of globals.css so they only apply
          to blog body content. */}
      <style>{`
        .prose-content { font-size: 1.0625rem; line-height: 1.75; color: hsl(var(--foreground)); }
        .prose-content > * + * { margin-top: 1.25rem; }
        .prose-content h2 { font-size: 1.625rem; font-weight: 700; line-height: 1.3; margin-top: 2.5rem; margin-bottom: 0.75rem; letter-spacing: -0.01em; }
        .prose-content h3 { font-size: 1.25rem; font-weight: 600; line-height: 1.4; margin-top: 2rem; margin-bottom: 0.5rem; }
        .prose-content p { color: hsl(var(--foreground) / 0.85); }
        .prose-content ul, .prose-content ol { padding-left: 1.5rem; }
        .prose-content li { margin: 0.4rem 0; color: hsl(var(--foreground) / 0.85); }
        .prose-content ul li { list-style: disc; }
        .prose-content ol li { list-style: decimal; }
        .prose-content strong { color: hsl(var(--foreground)); font-weight: 600; }
        .prose-content em { font-style: italic; color: hsl(var(--foreground) / 0.9); }
        .prose-content a { color: hsl(var(--primary)); text-decoration: underline; text-underline-offset: 2px; }
        .prose-content a:hover { text-decoration-thickness: 2px; }
        .prose-content blockquote { border-left: 4px solid hsl(var(--primary) / 0.4); padding-left: 1rem; font-style: italic; color: hsl(var(--muted-foreground)); }
        .prose-content hr { border: 0; border-top: 1px solid hsl(var(--border)); margin: 2rem 0; }
      `}</style>
    </div>
  );
}
