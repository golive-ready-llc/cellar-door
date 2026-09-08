"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wine, Camera, MessageCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

/**
 * Mobile-first welcome / onboarding screen.
 *
 * Capacitor unauthenticated users land here on cold launch — they
 * see a brief value prop + Sign In / Sign Up CTAs instead of either
 * the full marketing landing (too heavy for app context) or the
 * login form alone (presumes existing account, dead-end for new users).
 *
 * Web users typically don't see this — they hit the full landing
 * page at `/` instead. But the route is reachable directly so deep
 * links work.
 */
export default function WelcomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Already signed in? Skip welcome entirely.
  useEffect(() => {
    if (!loading && user) router.push("/cellar");
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center pt-4 pb-8 gap-8 max-w-sm mx-auto">
      {/* Logo + brand */}
      <div className="flex flex-col items-center gap-3 mt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Cellar Door"
          className="h-20 w-auto rounded-2xl shadow-lg"
        />
        <h1 className="text-3xl font-bold">Cellar Door</h1>
        <p className="text-muted-foreground text-sm">
          Your wine cellar, in your pocket.
        </p>
      </div>

      {/* Three quick value props — kept short for mobile */}
      <div className="w-full space-y-3 text-left">
        <div className="flex items-start gap-3 px-1">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Camera className="h-4 w-4 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-medium">Snap a label, AI fills the rest</p>
            <p className="text-muted-foreground text-xs">
              Producer, vintage, region, critic scores — in seconds.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 px-1">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Wine className="h-4 w-4 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-medium">A visual map of your cellar</p>
            <p className="text-muted-foreground text-xs">
              Drag-and-drop slots that mirror your real racks.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 px-1">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MessageCircle className="h-4 w-4 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-medium">Cork &amp; Fork meal pairing</p>
            <p className="text-muted-foreground text-xs">
              AI suggests bottles from your cellar for tonight&apos;s dinner.
            </p>
          </div>
        </div>
      </div>

      {/* CTAs — Sign Up filled (primary action for new users), Sign In outlined */}
      <div className="w-full space-y-3">
        <Button
          asChild
          size="lg"
          className="w-full h-12 text-base font-semibold gap-2"
        >
          <Link href="/signup">
            Get Started — Free <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          size="lg"
          className="w-full h-12 text-base"
        >
          <Link href="/login">Sign In</Link>
        </Button>

        <p className="text-xs text-muted-foreground pt-2">
          Track unlimited bottles free · No card required ·{" "}
          <a
            href="/demo"
            className="text-primary underline underline-offset-2"
          >
            Try the demo
          </a>
        </p>
      </div>
    </div>
  );
}
