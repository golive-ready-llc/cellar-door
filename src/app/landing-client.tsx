"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import Image from "next/image";
import {
  Wine,
  Grid3X3,
  Camera,
  Sparkles,
  BarChart3,
  MessageCircle,
  ScanBarcode,
  Globe,
  ArrowRight,
  Check,
  Star,
  Shield,
  Zap,
  Crown,
  ChevronDown,
  Smartphone,
  Thermometer,
  X,
  HelpCircle,
  GitCompare,
  UtensilsCrossed,
  Lock,
  Heart,
  Calendar,
  Code2,
  Server,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Tier data (duplicated from lib/tier to avoid server import issues) ───

const PLANS = [
  {
    name: "Free",
    tagline: "Get started",
    monthlyPrice: null,
    annualPrice: null,
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
  {
    name: "Cellar+",
    tagline: "Most popular",
    monthlyPrice: 9.99,
    annualPrice: 99.99,
    trial: 14,
    popular: true,
    icon: Sparkles,
    iconClass: "bg-primary/10 text-primary",
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
  {
    name: "Cellar Pro",
    tagline: "Power user",
    monthlyPrice: 13.99,
    annualPrice: 139.99,
    trial: 14,
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
];

// 12 features in a 4-col grid renders as a clean 3-row block (4+4+4) on
// desktop and as 2-col 6-row on tablets — no orphan cards. Ordered by
// "what would catch a brand-new visitor's eye first" rather than by
// implementation depth: signature features → smart additions →
// collector-grade tools.
const FEATURES = [
  // ── Row 1: signature features ──────────────────────────────
  {
    icon: Grid3X3,
    title: "Visual Cellar Grid",
    description:
      "A drag-and-drop grid that mirrors your physical wine racks slot-by-slot. Color-coded by wine type, scrollable, and works on phone or desktop.",
    expandedDescription:
      "Define your own walls, cabinets, sections, and rows — they don't have to match anything physical, just whatever layout makes sense to you. Each slot shows the wine type at a glance with color-coded circles. Long-press any wine to move it between slots, tap to view full details. The grid is built for collections from 12 bottles to 1,200+.",
    gif: "/screenshots/gif-grid.gif",
    screenshotAlt: "Navigating the visual cellar grid — filtering wines and switching cabinets",
  },
  {
    icon: Camera,
    title: "AI Label Scanning",
    description:
      "Snap a photo, the AI identifies the wine and fills the form in ~3 seconds. Producer, vintage, region, varietal, alcohol, drink window, critic scores — all auto-filled.",
    expandedDescription:
      "Point your camera at any wine label and Google Gemini's vision model identifies the producer, vintage, region, varietal, ABV, drinkability window, and estimated WS / RP / JD / AG critic scores. Works on labels in any language and handles small text gracefully. You just confirm and tap save — no typing needed for 95% of bottles.",
    gif: "/screenshots/gif-scan.gif",
    screenshotAlt: "Adding a wine via label scan — tap Add Wine, choose Scan Label, AI fills the form",
  },
  {
    icon: UtensilsCrossed,
    title: "Cork & Fork",
    description:
      "Tell it what you're cooking and AI recommends 3 wines from YOUR cellar that pair well — ranked by match quality. The most-loved feature among paid users.",
    expandedDescription:
      "Type any meal — \"mushroom risotto,\" \"BBQ ribs,\" \"Tuesday pasta,\" \"date-night sushi\" — and the AI sommelier picks 3 bottles from your actual collection that pair well, ranked by match quality with reasoning. It only suggests bottles you own, so it never pushes you to buy more. Works for casual weeknight meals and serious dinner parties alike.",
    gif: "/screenshots/gif-chat.gif",
    screenshotAlt: "Cork & Fork suggesting wines from your cellar for a specific meal",
  },
  {
    icon: ScanBarcode,
    title: "Wine List Scanner",
    description:
      "At a restaurant? Snap their wine list. We extract every bottle, match against your cellar, and show critic scores + your own ratings inline.",
    expandedDescription:
      "Open the camera, switch to Wine List mode, snap a photo of the restaurant's list. The AI extracts every wine and instantly tells you which ones you've already had (with your rating), which match wines you enjoyed at home (similar grape / region), and which have published critic scores. Add interesting bottles directly to your Buy List.",
    gif: "/screenshots/gif-scan.gif",
    screenshotAlt: "Wine list scan results showing matches in your cellar",
  },

  // ── Row 2: smart additions ─────────────────────────────────
  {
    icon: MessageCircle,
    title: "CellarChat AI Sommelier",
    description:
      "Ask anything about your collection in natural language. \"What should I drink tonight?\" \"Which Bordeaux are at peak?\" \"What pairs with the duck?\"",
    expandedDescription:
      "CellarChat is a conversational AI sommelier that knows every bottle in your cellar. Ask natural-language questions like \"What's drinking well right now?\" or \"Which 2015 Bordeaux should I open first?\" and get personalized, context-aware answers grounded in your actual collection. Works as a floating chat widget on every page.",
    gif: "/screenshots/gif-chat.gif",
    screenshotAlt: "CellarChat answering questions about specific bottles in the cellar",
  },
  {
    icon: Sparkles,
    title: "AI Enrichment",
    description:
      "One tap fills tasting notes, food pairings, drinking windows, and AI-estimated critic scores for any wine. Bulk-enrich your entire collection at once.",
    expandedDescription:
      "Hit the Enrich button on any wine and get detailed tasting notes, optimal drinking windows, food pairing suggestions, AI-estimated critic scores from Wine Spectator, Robert Parker, Jeb Dunnuck, and Antonio Galloni — all generated by AI specialized for wine. Bulk-enrich your entire collection in the background while you do other things.",
    gif: "/screenshots/gif-enrich.gif",
    screenshotAlt: "AI enrichment populating wine details — food pairings, critic scores, descriptions",
  },
  {
    icon: ScanBarcode,
    title: "Barcode Scanning",
    description:
      "Scan EAN-13 or UPC-A barcodes for instant wine identification. Falls back to label scan if the barcode isn't in any wine database.",
    expandedDescription:
      "Use your phone's camera to scan barcodes printed on bottles or boxes. We look them up against global wine databases and pre-fill matching results. If the barcode isn't recognized — common for boutique wineries — the app falls back to AI label scan automatically.",
    gif: "/screenshots/gif-scan.gif",
    screenshotAlt: "Adding a wine via barcode — tap Add Wine, choose Scan Barcode",
  },
  {
    icon: Calendar,
    title: "Drink-Window Guidance",
    description:
      "Every wine shows Drink Now, Hold, or Past Peak based on vintage and varietal. Stop forgetting bottles past their prime.",
    expandedDescription:
      "Each bottle gets a clear visual indicator: Drink Now (green), Hold (amber), or Past Peak (red), based on the wine's drinkability window. The Drinkability Report on the Stats page lists everything that's hitting peak this year — sorted so you don't accidentally let your 2010 Bordeaux turn into vinegar. Filter your inventory by status to see what to open next.",
    gif: "/screenshots/gif-stats.gif",
    screenshotAlt: "Drinkability report showing wines hitting peak this year",
  },

  // ── Row 3: collector-grade tools ───────────────────────────
  {
    icon: BarChart3,
    title: "Collection Analytics",
    description:
      "Interactive charts of your cellar's value, type breakdown, regions, vintages, and consumption trends over time.",
    expandedDescription:
      "Dive into charts showing collection value over time, wine type distribution, top regions and producers, drinking-window timelines, price breakdowns, and your personal Flavor Genome — a six-axis taste profile derived from wines you've rated. Tap any stat to see the bottles behind the numbers.",
    gif: "/screenshots/gif-stats.gif",
    screenshotAlt: "Stats page showing analytics charts and Flavor Genome",
  },
  {
    icon: Globe,
    title: "Community CD Scores",
    description:
      "Every wine gets a 0–5 score blending AI-estimated critic baselines with peer ratings. See where your collection ranks vs the community.",
    expandedDescription:
      "The CD Score is a Bayesian blend of an AI-estimated critic baseline (from WS / RP / JD / AG predictions) and real ratings from other collectors. New wines get a baseline immediately; as the community rates, real ratings increasingly dominate. See how your wines rank against peer collections.",
    gif: "/screenshots/gif-stats.gif",
    screenshotAlt: "Wine detail showing CD score alongside personal rating",
  },
  {
    icon: Thermometer,
    title: "Climate Monitoring",
    description:
      "Connect Home Assistant temperature + humidity sensors for live cellar climate. Charts, ideal-range indicators, 30-day history. Cellar Pro.",
    expandedDescription:
      "Link your Home Assistant temp + humidity sensors to monitor your cellar climate directly in the app. Live readings with ideal-range indicators (55–65°F, 55–75% humidity), 24-hour min/max/avg, and historical charts up to 30 days. We don't sell sensors — get a Govee or SwitchBot for ~$30 and pair it through Home Assistant. Readings live in your HA instance, never on our servers.",
    gif: "/screenshots/gif-stats.gif",
    screenshotAlt: "Cellar climate monitoring — temperature and humidity charts",
  },
  {
    icon: Shield,
    title: "Insurance Report + Backups",
    description:
      "Generate a PDF insurance report for your contents policy. Daily encrypted backups + JSON / CSV export. Your data is yours.",
    expandedDescription:
      "Generate a PDF insurance report with full collection valuation, per-bottle replacement values, and optional label photos — drop it into your homeowners policy or wine collection rider. We also keep daily encrypted backups of the database for 7 years for disaster recovery, and you can export everything as JSON or CSV at any time. Import from CellarTracker, Vivino, or any spreadsheet via the CSV importer.",
    gif: "/screenshots/gif-backup.gif",
    screenshotAlt: "Insurance report generation showing collection valuation",
  },
];

const TESTIMONIALS = [
  {
    name: "Marcus T.",
    role: "Collector, 200+ bottles",
    text: "Finally a wine app that actually looks like my cellar. The grid view is exactly what I've been looking for.",
    rating: 5,
  },
  {
    name: "Sarah K.",
    role: "Sommelier",
    text: "The AI enrichment is surprisingly accurate. It nailed the drinking windows and food pairings for my Burgundy collection.",
    rating: 5,
  },
  {
    name: "David L.",
    role: "Weekend enthusiast",
    text: "I just scan the label and everything fills in. No more typing wine names on my phone.",
    rating: 5,
  },
];


// ─── Screenshot Lightbox ─────────────────────────────────────

function ScreenshotLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  // Detect if this is a mobile screenshot (portrait aspect)
  const isMobile = src.includes("mobile-") || src.includes("mobile_");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-8 cursor-zoom-out animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>
      {isMobile ? (
        /* Mobile screenshots: show tall, centered, with phone-like frame */
        <div
          className="relative rounded-[2rem] border-4 border-white/10 bg-black shadow-2xl overflow-hidden"
          style={{ maxHeight: "90vh", width: "min(380px, 80vw)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src={src}
            alt={alt}
            width={390}
            height={844}
            className="w-full h-auto"
            style={{ cursor: "default" }}
          />
        </div>
      ) : (
        /* Desktop screenshots: show wide */
        <div
          className="relative rounded-xl overflow-hidden shadow-2xl"
          style={{ maxWidth: "90vw", maxHeight: "90vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src={src}
            alt={alt}
            width={1280}
            height={800}
            className="w-full h-auto"
            style={{ cursor: "default", minWidth: "min(1200px, 85vw)" }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Feature Detail Modal ────────────────────────────────────

function FeatureDetailModal({
  feature,
  onClose,
}: {
  feature: (typeof FEATURES)[number];
  onClose: () => void;
}) {
  const Icon = feature.icon;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-muted/80 hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold">{feature.title}</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-6">
            {feature.expandedDescription || feature.description}
          </p>

          {/* Animated GIF demo */}
          {feature.gif && (
            <div className="flex justify-center">
              <div className="rounded-2xl border-2 border-border/50 overflow-hidden shadow-lg max-w-[280px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={feature.gif}
                  alt={feature.screenshotAlt || feature.title}
                  className="w-full h-auto"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Clickable Screenshot ────────────────────────────────────

function ClickableScreenshot({
  src,
  alt,
  width,
  height,
  className,
  containerClassName,
  priority,
  onOpen,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  containerClassName?: string;
  priority?: boolean;
  onOpen: (src: string, alt: string) => void;
}) {
  return (
    <div
      className={cn("cursor-zoom-in transition-transform hover:scale-[1.02]", containerClassName)}
      onClick={() => onOpen(src, alt)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(src, alt); }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        priority={priority}
      />
    </div>
  );
}

// ─── Main Landing Page ─────────────────────────────────────

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [activeFeature, setActiveFeature] = useState<(typeof FEATURES)[number] | null>(null);

  const openLightbox = useCallback((src: string, alt: string) => {
    setActiveFeature(null); // close feature modal if open
    setLightbox({ src, alt });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  const openFeature = useCallback((feature: (typeof FEATURES)[number]) => {
    setActiveFeature(feature);
  }, []);

  const closeFeature = useCallback(() => {
    setActiveFeature(null);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Clear demo cookie when visiting the landing page (exiting demo)
  useEffect(() => {
    if (typeof document !== "undefined" && document.cookie.includes("demo_mode=true")) {
      document.cookie = "demo_mode=; path=/; max-age=0";
      window.location.reload(); // reload to clear demo state from auth provider
    }
  }, []);

  // Authenticated real users (not demo) go straight to the app
  useEffect(() => {
    if (!loading && user) {
      router.push("/cellar");
    }
  }, [user, loading, router]);

  // Capacitor / native app users skip the marketing landing entirely.
  // The landing page is for prospects deciding whether to install —
  // once they're inside the native shell, send them to a brief mobile
  // welcome screen with Sign In / Sign Up CTAs (real users) or
  // straight to /cellar (signed-in users — handled by the auth-aware
  // useEffect above).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.() && !loading && !user) {
      router.push("/welcome");
    }
  }, [loading, user, router]);

  // Show loading while checking auth (only for real authenticated users)
  if (loading || user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ─── Modals ───────────────────────────────────── */}
      {lightbox && (
        <ScreenshotLightbox src={lightbox.src} alt={lightbox.alt} onClose={closeLightbox} />
      )}
      {activeFeature && (
        <FeatureDetailModal feature={activeFeature} onClose={closeFeature} />
      )}

      {/* ─── Navigation ─────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Cellar Door" className="h-9 w-auto rounded-lg" />
            <span className="text-xl font-bold">Cellar Door</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#compare" className="hover:text-foreground transition-colors">Compare</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#open-source" className="hover:text-foreground transition-colors whitespace-nowrap">Source</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link>
            <Link href="/restaurants" className="hover:text-foreground transition-colors whitespace-nowrap">For Restaurants</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

      {/* ─── Hero ───────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        {/* Gradient background effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-primary/8 via-primary/3 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Logo */}
          <div className={cn(
            "mb-6 transition-all duration-700",
            mounted ? "opacity-100 scale-100" : "opacity-0 scale-90"
          )}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Cellar Door" width={609} height={480} className="h-32 sm:h-40 w-auto mx-auto drop-shadow-2xl object-contain" />
          </div>

          {/* Badge */}
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 transition-all duration-700",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}>
            <Sparkles className="h-3.5 w-3.5" />
            AI-Enhanced Wine Collection Management
          </div>

          {/* Headline */}
          <h1 className={cn(
            "text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6 transition-all duration-700 delay-100",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}>
            Your wine collection,
            <br />
            <span className="bg-gradient-to-r from-primary via-amber-500 to-primary bg-clip-text text-transparent">
              beautifully organized
            </span>
          </h1>

          {/* Subheading */}
          <p className={cn(
            "text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 transition-all duration-700 delay-200",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}>
            Track every bottle with a visual cellar grid that mirrors your real setup.
            Scan labels, get AI insights, and never lose track of a great wine again.
          </p>

          {/* CTAs */}
          <div className={cn(
            "flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 transition-all duration-700 delay-300",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}>
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

          {/* Hero Image — Desktop screenshot in browser frame */}
          <div className={cn(
            "relative max-w-5xl mx-auto transition-all duration-1000 delay-500",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
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
                onOpen={openLightbox}
              />
            </div>

            {/* Decorative glow */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-primary/10 rounded-full blur-3xl -z-10" />
          </div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything you need to manage your cellar
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From scanning a label to tracking drinking windows, Cellar Door handles
              it all with a beautiful interface powered by AI.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-border hover:shadow-lg transition-all duration-300 cursor-pointer"
                onClick={() => openFeature(feature)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") openFeature(feature); }}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
                <span className="inline-flex items-center gap-1 text-xs text-primary mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── App Showcase ─────────────────────────────── */}
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
                    onOpen={openLightbox}
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
                    onOpen={openLightbox}
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
                    onOpen={openLightbox}
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
                    onOpen={openLightbox}
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
                    onOpen={openLightbox}
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
                    onOpen={openLightbox}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ───────────────────────────────── */}
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

      {/* ─── Who It's For ──────────────────────────────── */}
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
              collection. Here&apos;s how three real-world collectors use it.
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

      {/* ─── Comparison ─────────────────────────────────── */}
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
                  { feat: "AI label scan (no manual typing)", us: "yes", v: "yes", ct: "no" },
                  { feat: "AI meal pairing from your cellar", us: "yes", v: "no", ct: "no" },
                  { feat: "Restaurant wine list scanner", us: "yes", v: "no", ct: "no" },
                  { feat: "Live temp + humidity (Home Assistant)", us: "yes", v: "no", ct: "no" },
                  { feat: "AI-estimated WS/RP/JD/AG critic scores", us: "yes", v: "user-rated only", ct: "yes" },
                  { feat: "Insurance report PDF", us: "yes", v: "no", ct: "limited" },
                  { feat: "Free tier", us: "unlimited", v: "unlimited", ct: "unlimited (read-only)" },
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
            users. Each app has its strengths — Vivino is unmatched for casual
            social discovery, CellarTracker for community tasting notes, and
            Cellar Door for collectors who want a beautiful visual cellar with
            modern AI built in. Many of our users use more than one.
          </p>
        </div>
      </section>

      {/* ─── Pricing ────────────────────────────────────── */}
      <section id="pricing" className="py-20 sm:py-28 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Start free. Upgrade when you need AI features or more capacity.
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
        </div>
      </section>

      {/* ─── Testimonials ───────────────────────────────── */}
      <section id="testimonials" className="py-20 sm:py-28 bg-muted/30 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Loved by wine collectors
            </h2>
            <p className="text-lg text-muted-foreground">
              See what our community is saying about Cellar Door.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-border/50 bg-card p-6"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-4 text-muted-foreground">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Open Source ────────────────────────────────── */}
      <section id="open-source" className="py-20 sm:py-28 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
              <Code2 className="h-3 w-3" />
              Source available
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              The whole app is source-available. Really.
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
                title: "Source-available (FSL)",
                text: "Read it, run it, modify it, self-host it — for anything except reselling it as a service that competes with Cellar Door. Each release turns Apache-2.0 two years after it ships. The name and logo stay ours — brand your own fork.",
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

      {/* ─── Final CTA ──────────────────────────────────── */}
      {/* ─── FAQ ────────────────────────────────────────── */}
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
              Real questions from real wine collectors. If yours isn&apos;t here,
              email <a href="mailto:support@email242.com" className="text-primary hover:underline">support@email242.com</a>.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: "Is Cellar Door open source?",
                a: "It's source-available — close, but let's be precise. The full source is public under the Functional Source License (FSL). You can read it, run it, modify it, and self-host it with docker compose up -d (it brings its own Postgres, and a single-user mode skips login entirely), and every feature works with your own AI provider key. The one thing you can't do is resell it as a service that competes with Cellar Door — and each release automatically becomes Apache-2.0 two years after it ships. Subscriptions to the hosted service pay for the AI calls, hosting, and the community CD Score dataset — not for access to the source.",
              },
              {
                q: "Is Cellar Door really free?",
                a: "Yes — the free tier tracks unlimited bottles forever, no credit card required. You get the visual cellar map, manual entry, barcode scanning, and basic stats. Cellar+ ($9.99/mo) and Cellar Pro ($13.99/mo) unlock AI label scanning, AI-estimated critic scores, AI meal pairing, and restaurant wine list scanning.",
              },
              {
                q: "How does AI label scanning actually work?",
                a: "You snap a photo of a wine label with your phone. We send the image to Google Gemini's vision model, which identifies the winery, name, vintage, region, grape variety, alcohol, drinkability window, and estimated WS/RP/JD/AG critic scores in about 3 seconds. You review the result and tap save. No manual typing for 95% of bottles.",
              },
              {
                q: "Will my wine data be safe if I cancel my subscription?",
                a: "Yes. If you cancel, your account drops to the free tier — your wines stay where they are, you just lose access to AI features. If you choose to delete your account entirely, we delete all your data from our database and cancel any active Stripe subscription in the same transaction. We also keep daily encrypted backups of the database for 7 years for disaster recovery.",
              },
              {
                q: "Can I track wines I&apos;ve already drunk?",
                a: "Yes — the History view keeps a permanent record of every bottle you&apos;ve consumed, with optional tasting notes and a final star rating. It&apos;s separate from your active inventory but contributes to your stats (favorite regions, total spent, etc.).",
              },
              {
                q: "Do I need a wine fridge or special storage?",
                a: "Not at all. Cellar Door works for collections in wine fridges, kitchen racks, basement cellars, closets, or anywhere else. You define your own &ldquo;walls,&rdquo; &ldquo;cabinets,&rdquo; and &ldquo;sections&rdquo; — they don&apos;t have to match anything physical, just a layout that makes sense to you.",
              },
              {
                q: "How does the temperature monitoring work?",
                a: "Cellar Pro lets you connect Home Assistant temp + humidity sensors via your local HA URL. Once paired, the live readings show on each cabinet card and you get historical charts in Stats. We don&apos;t sell sensors — you can get a Govee or SwitchBot for ~$30 and connect it through Home Assistant. We never store readings on our servers; they live in your HA instance.",
              },
              {
                q: "What&apos;s the deal with Cork &amp; Fork?",
                a: "Tell it what you&apos;re cooking — &ldquo;mushroom risotto,&rdquo; &ldquo;BBQ ribs,&rdquo; &ldquo;Tuesday pasta&rdquo; — and AI recommends 3 wines from your actual cellar that pair well, ranked by match quality. Most of our paid users say this is their favorite feature. It only suggests bottles you own (no pushing you to buy more).",
              },
              {
                q: "Can I import my existing cellar from CellarTracker / Vivino / a spreadsheet?",
                a: "Yes — Cellar Pro supports CSV import with column mapping. We have presets for CellarTracker exports and Vivino exports, or you can map any spreadsheet&apos;s columns to our fields. Most users get a 200-bottle import in under 5 minutes.",
              },
              {
                q: "Is there a mobile app or just a website?",
                a: "Both. The web app at mycellardoor.app works on any modern browser, and we have native iOS / Android apps via Capacitor that wrap the same web experience with native camera access. Same data either way — you can scan a label on your phone and see the wine appear on your laptop instantly.",
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
                a: "We read every email — support@email242.com. There&apos;s also an in-app feedback button in Settings. We ship updates roughly weekly based on what users actually ask for.",
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

      {/* ─── Trust & Security strip ────────────────────── */}
      <section className="py-12 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-semibold">Encrypted backups</p>
              <p className="text-xs text-muted-foreground">7-year retention</p>
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

      <section className="py-20 sm:py-28 border-t border-border/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Wine className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to organize your cellar?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of collectors who trust Cellar Door to manage their wine.
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

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-border/50 py-12 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Cellar Door" className="h-8 w-auto rounded-lg" />
              <span className="text-lg font-bold">Cellar Door</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link>
              <Link href="/restaurants" className="hover:text-foreground transition-colors">For Restaurants</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <a href="mailto:support@email242.com" className="hover:text-foreground transition-colors">Support</a>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Golive Ready, LLC. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
