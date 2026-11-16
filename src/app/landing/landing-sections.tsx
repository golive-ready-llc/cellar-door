import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
  Wine,
  Sparkles,
  ArrowRight,
  Check,
  Shield,
  Zap,
  Crown,
  ChevronDown,
  Smartphone,
  X,
  HelpCircle,
  GitCompare,
  UtensilsCrossed,
  Lock,
  Heart,
  Code2,
  Server,
  FileText,
  Grid3X3,
  Camera,
  BarChart3,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactDialog } from "@/components/contact-dialog";
import { cn } from "@/lib/utils";
import { TIER_CONFIGS, type Tier } from "@/lib/tier";
import { ClickableScreenshot, CookieSettingsButton, FeaturesSection } from "./landing-interactive";

/**
 * The landing page's marketing tree. These sections are plain (server)
 * components — the whole page renders to HTML with no client JS except the
 * small islands in landing-interactive.tsx (screenshot lightboxes, feature
 * modals, cookie settings) and the auth gate in landing-gate.tsx. The hero's
 * entrance stagger is pure CSS (tw-animate `fill-mode-both` + `delay-*`), so
 * it plays on first paint instead of waiting for hydration and the headline
 * text is fully visible in the served HTML.
 */

// ─── Pricing ─────────────────────────────────────────────────

// Marketing-only dressing per tier (icon, accent, feature bullets). Names,
// taglines, prices, and trial length come from TIER_CONFIGS so the landing
// can never drift from the billing configuration.
const PLAN_MARKETING: Record<Tier, { icon: LucideIcon; iconClass: string; popular?: boolean; features: string[] }> = {
  FREE: {
    icon: Zap,
    iconClass: "bg-muted text-muted-foreground",
    features: [
      "Unlimited wines",
      "Manual wine entry",
      "Visual cellar grid",
      "Wine history tracking",
      "Community CD Scores",
    ],
  },
  PRO: {
    icon: Sparkles,
    iconClass: "bg-primary/10 text-primary",
    popular: true,
    features: [
      "Unlimited wines",
      "300 AI credits / month",
      "AI label scanning",
      "AI wine enrichment",
      "AI sommelier chat",
      "AI label image search",
      "Ad-free experience",
    ],
  },
  PREMIUM: {
    icon: Crown,
    iconClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    features: [
      "Everything in Cellar+",
      "1,000 AI credits / month",
      "Batch AI enrichment",
      "Home Assistant climate sensors",
      "REST API access",
      "Priority support",
    ],
  },
};

const PLANS = (["FREE", "PRO", "PREMIUM"] as const).map((tier) => {
  const config = TIER_CONFIGS[tier];
  return {
    name: config.displayName,
    tagline: config.tagline,
    monthlyPrice: config.pricing.monthly,
    annualPrice: config.pricing.annual,
    trial: config.trialDays,
    ...PLAN_MARKETING[tier],
  };
});

// ─── Navigation ──────────────────────────────────────────────

function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-small.png" alt="Cellar Door" className="h-9 w-auto rounded-lg" />
          <span className="text-xl font-bold">Cellar Door</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#compare" className="hover:text-foreground transition-colors">Compare</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          <a href="#open-source" className="hover:text-foreground transition-colors whitespace-nowrap">Open Source</a>
          <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          <Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link>
          <Link href="/restaurants" className="hover:text-foreground transition-colors whitespace-nowrap">For Restaurants</Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Button variant="ghost" size="sm" asChild>
            <a href="https://github.com/golive-ready-llc/cellar-door" target="_blank" rel="noopener" aria-label="Cellar Door source on GitHub" className="whitespace-nowrap inline-flex items-center gap-1">
              <Code2 className="h-4 w-4" />
              <span className="hidden lg:inline">GitHub</span>
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/demo" target="_blank" rel="noopener" className="whitespace-nowrap inline-flex items-center gap-1 text-primary border-primary/30">
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Try Demo</span>
              <span className="sm:hidden">Demo</span>
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login" className="whitespace-nowrap">Sign In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup" className="whitespace-nowrap inline-flex items-center gap-1">
              <span className="hidden sm:inline">Get Started</span>
              <span className="sm:hidden">Start</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ────────────────────────────────────────────────────

function LandingHero() {
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
      {/* Gradient background effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-primary/8 via-primary/3 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Logo */}
        <div className="mb-6 animate-in fade-in zoom-in-90 fill-mode-both duration-700">
          <Image
            src="/logo.png"
            alt="Cellar Door"
            width={609}
            height={480}
            sizes="(min-width: 640px) 203px, 163px"
            priority
            className="h-32 sm:h-40 w-auto mx-auto drop-shadow-2xl object-contain"
          />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700">
          <Sparkles className="h-3.5 w-3.5" />
          AI-Enhanced Wine Collection Management
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-100">
          Your cellar, visualized
          <br />
          <span className="bg-gradient-to-r from-primary via-amber-500 to-primary bg-clip-text text-transparent">
            and beautifully organized
          </span>
        </h1>

        {/* Subheading */}
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-200">
          Track every bottle with a visual cellar grid that mirrors your real setup.
          Scan labels, get AI insights, and never lose track of a great wine again.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-300">
          <Button size="lg" className="text-base px-8 h-12 gap-2" asChild>
            <Link href="/signup">
              Start Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="text-base px-8 h-12 gap-2" asChild>
            <a href="#features">
              See Features
              <ChevronDown className="h-4 w-4" />
            </a>
          </Button>
        </div>

        {/* Trust signals — surface the open-source direction up top */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:text-sm text-muted-foreground mb-16 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-300">
          <span className="inline-flex items-center gap-1.5"><Code2 className="h-3.5 w-3.5 text-primary" /> Open source (AGPL-3.0)</span>
          <span className="text-border" aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5"><Server className="h-3.5 w-3.5 text-primary" /> Free to self-host</span>
          <span className="text-border" aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-primary" /> Your data, always exportable</span>
        </div>

        {/* Hero Image — Desktop screenshot in browser frame */}
        <div className="relative max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 fill-mode-both duration-1000 delay-500">
          <div className="relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-2xl shadow-black/20 overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-muted/50 rounded-md px-3 py-1 text-xs text-muted-foreground text-center max-w-xs mx-auto">
                  mycellardoor.app
                </div>
              </div>
            </div>
            <ClickableScreenshot
              src="/screenshots/desktop-cellar.png"
              alt="Cellar Door desktop view showing the visual wine cellar grid"
              width={1280}
              height={800}
              className="w-full h-auto"
              priority
            />
          </div>

          {/* Decorative glow */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-primary/10 rounded-full blur-3xl -z-10" />
        </div>
      </div>
    </section>
  );
}

// ─── App Showcase ────────────────────────────────────────────

function ShowcaseSection() {
  return (
    <section className="py-20 sm:py-28 bg-muted/30 border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            See it in action
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Beautiful on every screen. From desktop dashboards to quick mobile lookups,
            Cellar Door adapts to how you manage your collection.
          </p>
        </div>

        {/* Desktop + Mobile side by side showcase */}
        <div className="space-y-16">
          {/* Stats & Analytics */}
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <div className="flex-1 order-2 lg:order-1">
              <div className="flex items-center gap-2 text-primary mb-3">
                <BarChart3 className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">Analytics</span>
              </div>
              <h3 className="text-2xl font-bold mb-3">
                Collection insights at a glance
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Track your cellar&apos;s value, see drinking window distributions,
                explore wine type breakdowns, and discover your top regions and producers
                with beautiful interactive charts.
              </p>
            </div>
            <div className="flex-1 order-1 lg:order-2 flex items-end justify-center gap-4">
              {/* Desktop stats */}
              <div className="rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden max-w-md">
                <ClickableScreenshot
                  src="/screenshots/desktop-stats.png"
                  alt="Collection analytics and statistics"
                  width={1280}
                  height={800}
                  className="w-full h-auto"
                />
              </div>
              {/* Mobile stats */}
              <div className="rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden w-[100px] sm:w-[130px] shrink-0 hidden sm:block">
                <ClickableScreenshot
                  src="/screenshots/mobile-stats.png"
                  alt="Stats on mobile"
                  width={390}
                  height={844}
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>

          {/* Inventory + Mobile views */}
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <div className="flex-1 flex items-end justify-center gap-4">
              {/* Mobile inventory */}
              <div className="rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden w-[130px] sm:w-[160px] shrink-0">
                <ClickableScreenshot
                  src="/screenshots/mobile-inventory.png"
                  alt="Wine inventory list on mobile"
                  width={390}
                  height={844}
                  className="w-full h-auto"
                />
              </div>
              {/* Mobile cellar */}
              <div className="rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden w-[130px] sm:w-[160px] shrink-0">
                <ClickableScreenshot
                  src="/screenshots/mobile-cellar.png"
                  alt="Cellar grid on mobile"
                  width={390}
                  height={844}
                  className="w-full h-auto"
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-primary mb-3">
                <Smartphone className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">Mobile First</span>
              </div>
              <h3 className="text-2xl font-bold mb-3">
                Your cellar in your pocket
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Browse your full inventory, manage your visual cellar grid, and scan
                new wines — all from your phone. The mobile experience is just as
                powerful as desktop.
              </p>
            </div>
          </div>

          {/* AI Assistant */}
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <div className="flex-1 order-2 lg:order-1">
              <div className="flex items-center gap-2 text-primary mb-3">
                <MessageCircle className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">AI Sommelier</span>
              </div>
              <h3 className="text-2xl font-bold mb-3">
                Your personal wine expert
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                CellarChat is your AI sommelier that knows your entire collection.
                Ask for food pairings, get recommendations for tonight&apos;s dinner,
                find out which wines to drink now, or learn about any bottle in your cellar.
                It&apos;s like having a sommelier on call 24/7.
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  "Ask natural language questions about your collection",
                  "Get personalized food pairing suggestions",
                  "Find the perfect bottle for any occasion",
                  "Learn tasting notes and wine history",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 order-1 lg:order-2 flex items-end justify-center gap-4">
              {/* Real AI Chat screenshot */}
              <div className="rounded-xl border border-primary/20 bg-card shadow-xl overflow-hidden w-[150px] sm:w-[180px] shrink-0">
                <ClickableScreenshot
                  src="/screenshots/mobile-chat.png"
                  alt="CellarChat AI sommelier assistant"
                  width={390}
                  height={844}
                  className="w-full h-auto"
                />
              </div>
              {/* Wine detail screenshot */}
              <div className="rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden w-[150px] sm:w-[180px] shrink-0">
                <ClickableScreenshot
                  src="/screenshots/mobile-detail.png"
                  alt="Wine detail view with AI insights"
                  width={390}
                  height={844}
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────

function HowItWorksSection() {
  return (
    <section className="py-20 sm:py-28 bg-muted/30 border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Get started in minutes
          </h2>
          <p className="text-lg text-muted-foreground">
            Three simple steps to digitize your wine collection.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              step: "1",
              title: "Set up your cellar",
              description:
                "Create cabinets and racks that match your physical setup. Name walls, sections, and rows.",
              icon: Grid3X3,
            },
            {
              step: "2",
              title: "Add your wines",
              description:
                "Scan labels with your camera, scan barcodes, or add manually. AI fills in the details.",
              icon: Camera,
            },
            {
              step: "3",
              title: "Track & enjoy",
              description:
                "Get drinking window alerts, food pairing suggestions, and collection insights. Never miss a perfect moment.",
              icon: Wine,
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <item.icon className="h-7 w-7 text-primary" />
              </div>
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold mb-3">
                {item.step}
              </div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Who It's For ────────────────────────────────────────────

function WhoItsForSection() {
  return (
    <section id="who-its-for" className="py-20 sm:py-28 bg-muted/30 border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Heart className="h-3 w-3" />
            Built for real wine collectors
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Who Cellar Door is for
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you have 12 bottles or 1,200, Cellar Door grows with your
            collection. Here&apos;s how it fits three kinds of collectors.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Wine className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">The Beginning Collector</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              You&apos;ve got 20–80 bottles between a few wine fridges, a kitchen
              rack, and a closet. You&apos;re tired of forgetting what&apos;s in the
              fridge in the basement.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Snap a label, AI fills in winery, vintage, region in seconds</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Drink-now / hold / past-peak guidance based on vintage</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Unlimited bottles free forever — no card required</span></li>
            </ul>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-card p-6 ring-1 ring-primary/20">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Grid3X3 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">The Serious Collector</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              You&apos;ve got 200–800 bottles spread across cabinets, racks, and a
              dedicated cellar room. You buy en primeur, you have first-growth
              Bordeaux you&apos;ll open in 15 years, and you need to know exactly
              where every bottle is.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Visual cellar map mirroring your real racks — slot-by-slot</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Live temp + humidity from Home Assistant sensors</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Insurance report PDF for your contents policy</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>AI-estimated values from WS / RP / JD / AG critic scores</span></li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <UtensilsCrossed className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">The Restaurant Sommelier</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              You manage 150+ bottles for service. You need fast inventory, pour
              cost analysis, and a way to scan a guest&apos;s wine list when they
              ask &ldquo;what would you recommend with the lamb?&rdquo;
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Cork &amp; Fork: AI meal-pairing from your actual cellar</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Pour cost / margin tracker with retail vs cost</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Wine list scanner finds matches in your inventory instantly</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Sommelier mode: let guests vote between bottles</span></li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Comparison ──────────────────────────────────────────────

function CompareSection() {
  return (
    <section id="compare" className="py-20 sm:py-28 border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <GitCompare className="h-3 w-3" />
            Honest comparison
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            How Cellar Door compares
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We respect Vivino and CellarTracker — they&apos;re great tools.
            Here&apos;s where Cellar Door is genuinely different, in our own words.
          </p>
        </div>

        <div className="overflow-x-auto max-w-5xl mx-auto rounded-2xl border border-border/50">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold w-[34%]">Feature</th>
                <th className="text-center px-4 py-3 font-semibold text-primary">Cellar Door</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Vivino</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">CellarTracker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {[
                { feat: "Visual cellar map (slot-by-slot)", us: "yes", v: "no", ct: "limited" },
                { feat: "AI label scan (no manual typing)", us: "yes", v: "yes", ct: "yes" },
                { feat: "AI meal pairing from your cellar", us: "yes", v: "no", ct: "no" },
                { feat: "Restaurant wine list scanner", us: "yes", v: "no", ct: "no" },
                { feat: "Live temp + humidity (Home Assistant)", us: "yes", v: "no", ct: "no" },
                { feat: "AI-estimated WS/RP/JD/AG critic scores", us: "yes", v: "user-rated only", ct: "yes" },
                { feat: "Insurance report PDF", us: "yes", v: "no", ct: "limited" },
                { feat: "Free tier", us: "unlimited", v: "unlimited", ct: "unlimited" },
                { feat: "Mobile + web (same data)", us: "yes", v: "mobile-first", ct: "web-first" },
                { feat: "Built for collectors first", us: "yes", v: "social-first", ct: "yes" },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.feat}</td>
                  <td className="px-4 py-3 text-center">
                    {row.us === "yes" ? <Check className="h-4 w-4 text-green-500 inline" /> : <span className="text-xs text-muted-foreground">{row.us}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.v === "yes" ? <Check className="h-4 w-4 text-muted-foreground inline" /> : row.v === "no" ? <X className="h-4 w-4 text-muted-foreground/40 inline" /> : <span className="text-xs text-muted-foreground">{row.v}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.ct === "yes" ? <Check className="h-4 w-4 text-muted-foreground inline" /> : row.ct === "no" ? <X className="h-4 w-4 text-muted-foreground/40 inline" /> : <span className="text-xs text-muted-foreground">{row.ct}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6 max-w-2xl mx-auto">
          Comparison reflects the apps as we&apos;ve experienced them as paying
          users, as of September 2026. Each app has its strengths — Vivino is unmatched for casual
          social discovery, CellarTracker for community tasting notes, and
          Cellar Door for collectors who want a beautiful visual cellar with
          modern AI built in.
        </p>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────

function PricingSection() {
  return (
    <section id="pricing" className="py-20 sm:py-28 border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Start free. Upgrade when you want the AI features.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative rounded-2xl border p-6 flex flex-col",
                plan.popular
                  ? "border-primary bg-card shadow-lg shadow-primary/5 ring-1 ring-primary/20"
                  : "border-border/50 bg-card/50"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  Most Popular
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", plan.iconClass)}>
                  <plan.icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                </div>
              </div>

              <div className="flex items-baseline gap-1 mb-1">
                {plan.monthlyPrice === null ? (
                  <span className="text-3xl font-bold">Free</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold">${plan.monthlyPrice.toFixed(2)}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </>
                )}
              </div>
              {plan.annualPrice !== null && (
                <p className="text-xs text-muted-foreground mb-1">
                  or ${plan.annualPrice.toFixed(2)}/year
                </p>
              )}
              {plan.trial && (
                <p className="text-xs text-primary font-medium mb-3">
                  {plan.trial}-day free trial
                </p>
              )}
              {!plan.trial && <div className="mb-3" />}

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={cn("w-full", plan.popular && "bg-primary hover:bg-primary/90")}
                variant={plan.popular ? "default" : "outline"}
                asChild
              >
                <Link href="/signup">
                  {plan.monthlyPrice === null ? "Get Started Free" : `Start Free Trial`}
                </Link>
              </Button>
            </div>
          ))}
        </div>

        {/* Self-hosted — the open-source option, separate from the hosted tiers */}
        <div className="max-w-4xl mx-auto mt-6">
          <div className="rounded-2xl border border-primary/30 bg-card/50 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Server className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold">Self-Hosted</h3>
                <span className="text-2xl font-bold">Free</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Run the whole app on your own machine — <span className="text-foreground font-medium">open source under AGPL-3.0</span>, every feature unlocked, no license fee. <code className="text-xs bg-muted px-1.5 py-0.5 rounded">docker compose up -d</code> brings up the app with its own database, and a single-user mode skips login entirely. Bring your own AI provider key (you pay the provider directly); your data never leaves your hardware.
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-primary shrink-0" /> Every feature, no cap</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-primary shrink-0" /> Your own AI key</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-primary shrink-0" /> Your data, your hardware</span>
              </div>
            </div>
            <div className="shrink-0 sm:w-52">
              <Button variant="outline" className="w-full gap-2" asChild>
                <a href="https://github.com/golive-ready-llc/cellar-door/blob/master/SELF-HOSTING.md" target="_blank" rel="noopener">
                  <Code2 className="h-4 w-4" /> Self-hosting guide
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Open Source ─────────────────────────────────────────────

function OpenSourceSection() {
  return (
    <section id="open-source" className="py-20 sm:py-28 border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Code2 className="h-3 w-3" />
            Open source
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            The whole app is open source. Really.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Not &ldquo;open core&rdquo; — the code behind this site is the code
            in the repo. Subscriptions pay for AI calls, hosting, and the
            community score dataset, not for access to features.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            {
              icon: FileText,
              title: "AGPL-3.0 licensed",
              text: "Genuinely open source. Read it, run it, modify it, self-host it. The one catch is the AGPL's network copyleft: run a modified version as a service and you share your changes back. The name and logo stay ours — brand your own fork.",
            },
            {
              icon: Server,
              title: "Free to self-host, one command",
              text: "docker compose up -d brings up the app plus its own Postgres — no Vercel, no Neon, no license fee, every feature unlocked. A single-user mode removes even the login; your data stays on your machine.",
            },
            {
              icon: Lock,
              title: "Your data, exportable",
              text: "CSV import/export, a public REST API, and a plain Postgres database you can point any tool at. Leaving is a feature, not a punishment.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-border/50 bg-card p-6 text-center"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{card.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button variant="outline" asChild>
            <a
              href="https://github.com/golive-ready-llc/cellar-door"
              target="_blank"
              rel="noopener"
              className="gap-2"
            >
              <Code2 className="h-4 w-4" />
              Read the source on GitHub
            </a>
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Or skim the{" "}
            <a
              href="https://github.com/golive-ready-llc/cellar-door/blob/master/SELF-HOSTING.md"
              target="_blank"
              rel="noopener"
              className="underline hover:text-foreground"
            >
              self-hosting guide
            </a>{" "}
            first.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────

function FaqSection() {
  return (
    <section id="faq" className="py-20 sm:py-28 border-t border-border/50 bg-muted/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <HelpCircle className="h-3 w-3" />
            Frequently asked questions
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything you wanted to know
          </h2>
          <p className="text-lg text-muted-foreground">
            Common questions from wine collectors. If yours isn&apos;t here,{" "}
            <ContactDialog>
              <button type="button" className="text-primary hover:underline">
                get in touch
              </button>
            </ContactDialog>
            .
          </p>
        </div>

        <div className="space-y-3">
          {[
            {
              q: "Is Cellar Door open source?",
              a: "Yes — genuinely open source, under the GNU AGPL-3.0. The full source is public: read it, run it, modify it, and self-host it with docker compose up -d (it brings its own Postgres, and a single-user mode skips login entirely), and every feature works with your own AI provider key. The AGPL's network copyleft means anyone who runs a modified version as a service must share their changes back. Subscriptions to the hosted service pay for the AI calls, hosting, and the community CD Score dataset — not for access to the source.",
            },
            {
              q: "Is Cellar Door really free?",
              a: "Yes — the free tier tracks unlimited bottles forever, no credit card required. You get the visual cellar map, manual entry, barcode scanning, and basic stats. Cellar+ ($9.99/mo) and Cellar Pro ($13.99/mo) unlock AI label scanning, AI-estimated critic scores, AI meal pairing, and restaurant wine list scanning.",
            },
            {
              q: "How does AI label scanning actually work?",
              a: "You snap a photo of a wine label with your phone. We send the image to Google Gemini's vision model, which identifies the winery, name, vintage, region, grape variety, alcohol, drinkability window, and estimated WS/RP/JD/AG critic scores in about 3 seconds. You review the result and tap save. Usually no manual typing at all.",
            },
            {
              q: "Will my wine data be safe if I cancel my subscription?",
              a: "Yes. If you cancel, your account simply drops to the free tier — your wines stay exactly where they are; you just lose the AI features. If you&apos;d rather leave entirely, deleting your account immediately and permanently removes your personal data from our live database and cancels any active Stripe subscription in the same action. Our encrypted backups exist only for disaster recovery — they&apos;re never used to bring back a deleted account, and your data ages out of them on our backup retention schedule. And you can export your whole collection to CSV or JSON at any time from Settings, so your data is always yours to take with you.",
            },
            {
              q: "Can I track wines I've already drunk?",
              a: "Yes — the History view keeps a permanent record of every bottle you&apos;ve consumed, with optional tasting notes and a final star rating. It&apos;s separate from your active inventory but contributes to your stats (favorite regions, total spent, etc.).",
            },
            {
              q: "Do I need a wine fridge or special storage?",
              a: "Not at all. Cellar Door works for collections in wine fridges, kitchen racks, basement cellars, closets, or anywhere else. You define your own &ldquo;walls,&rdquo; &ldquo;cabinets,&rdquo; and &ldquo;sections&rdquo; — they don&apos;t have to match anything physical, just a layout that makes sense to you.",
            },
            {
              q: "How does the temperature monitoring work?",
              a: "Cellar Pro lets you connect Home Assistant temp + humidity sensors using your Home Assistant&apos;s public HTTPS address (Nabu Casa works well). Once paired, the live readings show on each cabinet card and you get historical charts in Stats. We don&apos;t sell sensors — you can get a Govee or SwitchBot for ~$30 and connect it through Home Assistant. We never store readings on our servers; they live in your HA instance.",
            },
            {
              q: "What's the deal with Cork & Fork?",
              a: "Tell it what you&apos;re cooking — &ldquo;mushroom risotto,&rdquo; &ldquo;BBQ ribs,&rdquo; &ldquo;Tuesday pasta&rdquo; — and AI recommends 3 wines from your actual cellar that pair well, ranked by match quality. It only suggests bottles you own (no pushing you to buy more).",
            },
            {
              q: "Can I import my existing cellar from CellarTracker / Vivino / a spreadsheet?",
              a: "Yes — every plan, including Free, can import a CSV from Settings. It recognizes CellarTracker and Vivino export columns automatically, along with common spreadsheet column names like producer, vintage, and region.",
            },
            {
              q: "Is there a mobile app or just a website?",
              a: "The web app at mycellardoor.app works in any modern browser and installs to your home screen as a PWA — full-screen, with camera access for label scanning. Native iOS / Android apps are on the way. Either way it&apos;s the same account and the same data, so you can scan a label on your phone and see the wine appear on your laptop instantly.",
            },
            {
              q: "What about my privacy?",
              a: "Your wine collection is private to your account by default. We don&apos;t share it with anyone, sell data to third parties, or train AI models on your collection. Sharing happens only when you explicitly create a &ldquo;Guest Cellar&rdquo; link or use Sommelier mode for a tasting event. Read the full terms at /terms.",
            },
            {
              q: "If tracking is free and unlimited, what am I actually paying for?",
              a: "AI. Tracking bottles is cheap to run, so it&apos;s free for everyone, forever, with no cap. What costs real money is the AI: label scans, wine-list scans, AI-estimated critic scores, enrichment, and meal pairings each burn paid API calls. The paid tiers fund exactly that — you&apos;re paying for the AI you use, not for permission to store your own cellar.",
            },
            {
              q: "I have feedback / a feature request / found a bug",
              a: "We read every message. Use the &ldquo;get in touch&rdquo; link above, or the in-app feedback button in Settings once you&apos;re signed in. We ship updates roughly weekly based on what users actually ask for.",
            },
          ].map((item, i) => (
            <details
              key={i}
              className="group rounded-xl border border-border/50 bg-card p-5 hover:border-border transition-colors"
            >
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none">
                <h3 className="text-base font-semibold pr-2">{item.q}</h3>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: item.a }} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Trust & Security strip ──────────────────────────────────

function TrustStrip() {
  return (
    <section className="py-12 border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-semibold">Encrypted backups</p>
            <p className="text-xs text-muted-foreground">Daily, stored off-site</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-semibold">No data sold</p>
            <p className="text-xs text-muted-foreground">Your cellar stays yours</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-semibold">Cancel anytime</p>
            <p className="text-xs text-muted-foreground">Free tier always available</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-semibold">Made by collectors</p>
            <p className="text-xs text-muted-foreground">For collectors</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ───────────────────────────────────────────────

function FinalCtaSection() {
  return (
    <section className="py-20 sm:py-28 border-t border-border/50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Wine className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Ready to organize your cellar?
        </h2>
        <p className="text-lg text-muted-foreground mb-8">
          Set up your cellar in minutes and see every bottle at a glance.
          Free forever, unlimited bottles.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="text-base px-8 h-12 gap-2 whitespace-nowrap shrink-0" asChild>
            <Link href="/signup">
              Create Your Cellar <ArrowRight className="h-4 w-4 shrink-0 inline-block" />
            </Link>
          </Button>
          <Button size="lg" variant="ghost" className="text-base" asChild>
            <Link href="/login">Already have an account? Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer className="border-t border-border/50 py-12 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-small.png" alt="Cellar Door" className="h-8 w-auto rounded-lg" />
            <span className="text-lg font-bold">Cellar Door</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link>
            <Link href="/restaurants" className="hover:text-foreground transition-colors">For Restaurants</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/terms#privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <CookieSettingsButton />
            <ContactDialog>
              <button type="button" className="hover:text-foreground transition-colors">Contact</button>
            </ContactDialog>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Golive Ready, LLC. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Composition ─────────────────────────────────────────────

export function LandingContent() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <LandingNav />
      <LandingHero />
      <FeaturesSection />
      <ShowcaseSection />
      <HowItWorksSection />
      <WhoItsForSection />
      <CompareSection />
      <PricingSection />
      <OpenSourceSection />
      <FaqSection />
      <TrustStrip />
      <FinalCtaSection />
      <LandingFooter />
    </div>
  );
}
