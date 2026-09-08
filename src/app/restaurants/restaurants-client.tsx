"use client";

// B2B marketing page for restaurants, wine bars, and wine shops.
// Public + indexable (middleware allows /restaurants even when the site
// password gate is on). Lead capture goes to the BusinessLead table via
// submitBusinessLead and surfaces in the admin dashboard.

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Camera,
  ReceiptText,
  Calculator,
  LayoutGrid,
  Clock,
  Award,
  CheckCircle2,
  Loader2,
  ArrowRight,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitBusinessLead } from "@/server/actions/business-leads";

const FEATURES = [
  {
    icon: Camera,
    title: "Wine-list scan",
    body: "Photograph any wine list — yours or a competitor's — and AI digitizes every bottle in under a minute, matched against your cellar.",
  },
  {
    icon: ReceiptText,
    title: "Invoice receiving",
    body: "Snap a distributor invoice and quantities, vintages, and prices land in inventory. No more Sunday-night data entry.",
  },
  {
    icon: Calculator,
    title: "Pour-cost engineering",
    body: "Plan by-the-glass programs and events with per-pour costing across your actual bottle costs — know your margin before you print the menu.",
  },
  {
    icon: LayoutGrid,
    title: "Cellar mapping",
    body: "Racks, bins, and bulk zones mapped visually. Any staff member finds any bottle in seconds — no more tribal knowledge.",
  },
  {
    icon: Clock,
    title: "Drink windows",
    body: "Every bottle tracked against its drinking window. Sell it, pour it, or feature it before it slides past peak and becomes dead stock.",
  },
  {
    icon: Award,
    title: "Expert & community scores",
    body: "Critic-derived Expert Scores and community ratings on every bottle — arm your floor staff with talking points that sell.",
  },
];

const VENUE_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "wine_bar", label: "Wine bar" },
  { value: "wine_shop", label: "Wine shop / retail" },
  { value: "other", label: "Other" },
];

const CELLAR_SIZES = ["Under 100", "100–500", "500–1,000", "1,000+"];

export function RestaurantsClient() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Cellar Door" width={36} height={36} className="rounded-lg" />
            <span className="text-lg font-semibold tracking-tight">Cellar Door</span>
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Business
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:block">
              For collectors
            </Link>
            <a
              href="/demo"
              target="_blank"
              rel="noopener"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Live demo
            </a>
            <Button size="lg" className="gap-1.5" asChild>
              <Link href="/signup">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
          For restaurants · wine bars · wine shops
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Your wine program, finally under control
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Beverage programs lose 10–20% of revenue to untracked bottles, dead stock, and
          guesswork pricing. Cellar Door puts AI on the problem: scan, track, cost, and
          sell every bottle — without a clipboard in sight.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" className="h-12 gap-2 px-6 text-base" asChild>
            <Link href="/signup">
              Start free — 14-day trial <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 gap-2 px-6 text-base"
            onClick={() => window.open("/demo", "_blank", "noopener")}
          >
            <PlayCircle className="h-4 w-4" />
            Try it live — no signup
          </Button>
          <p className="text-sm text-muted-foreground">
            Then <span className="font-semibold text-foreground">$13.99/mo</span> — unlimited bottles
          </p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The live demo drops you into a fully stocked 1,000-bottle cellar — browse, scan, and explore every feature.
          No sales calls, no onboarding meetings: sign up, scan, done.
        </p>
      </section>

      {/* Features */}
      <section className="border-y border-border/50 bg-muted/20 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Built for the way a wine program actually runs
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border/60 bg-card p-6">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Live in an afternoon, not a quarter
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {[
            ["1. Scan what you have", "Walk the cellar with a phone. Label scans, barcodes, and invoice photos build your inventory as fast as you can point a camera."],
            ["2. Map your cellar", "Lay out racks, bins, and bulk storage visually so every bottle has a home your whole team can find."],
            ["3. Run the program", "Pour costs, drink windows, scores, and depletion — the daily decisions, made with data instead of memory."],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Founding partner + form */}
      <section id="demo" className="border-t border-border/50 bg-muted/20 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Self-serve from day one
            </h2>
            <p className="mt-4 text-muted-foreground">
              No sales process. Poke around the live demo, start the free
              trial, and scan your first case of wine before dinner service.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Set up in an afternoon — camera-first capture, no data entry",
                "Runs on the phones and tablets your staff already have",
                "14-day free trial, $13.99/mo after — no contracts",
                "Cancel anytime — your data exports with you (CSV + full backup)",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex gap-3">
              <Button size="lg" className="h-11 gap-2" asChild>
                <Link href="/signup">Start free <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 gap-2"
                onClick={() => window.open("/demo", "_blank", "noopener")}
              >
                <PlayCircle className="h-4 w-4" /> Live demo
              </Button>
            </div>
          </div>
          <DemoRequestForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Golive Ready, LLC</p>
          <div className="flex gap-6">
            <Link href="/" className="transition-colors hover:text-foreground">Cellar Door for collectors</Link>
            <Link href="/blog" className="transition-colors hover:text-foreground">Blog</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DemoRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueType, setVenueType] = useState("");
  const [cellarSize, setCellarSize] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitBusinessLead({ name, email, venueName, venueType, cellarSize, message, website });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card p-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <h3 className="mt-4 text-xl font-semibold">Thanks — message received</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ll get back to you by email. Meanwhile, the free trial and
          live demo are open — no need to wait on us.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border/60 bg-card p-6">
      <h3 className="text-lg font-semibold">Questions before you switch?</h3>
      <div className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="lead-name">Your name</Label>
            <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lead-email">Work email</Label>
            <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lead-venue">Venue name</Label>
          <Input id="lead-venue" value={venueName} onChange={(e) => setVenueName(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label>Venue type</Label>
          <div className="flex flex-wrap gap-2">
            {VENUE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setVenueType(t.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  venueType === t.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Bottles in your program</Label>
          <div className="flex flex-wrap gap-2">
            {CELLAR_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setCellarSize(s)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  cellarSize === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lead-message">Anything else? (optional)</Label>
          <Textarea
            id="lead-message"
            rows={3}
            placeholder="Tell us about your program, current tooling, timeline…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        {/* Honeypot — hidden from humans, catnip for bots */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="h-11 gap-2" disabled={submitting || !venueType}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Sending…" : "Send"}
        </Button>
        <p className="text-xs text-muted-foreground">
          No spam, no sales sequences — a human reads every message.
        </p>
      </div>
    </form>
  );
}
