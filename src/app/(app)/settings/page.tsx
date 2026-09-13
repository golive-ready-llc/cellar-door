"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Moon, Sun, Monitor, Sparkles, Zap, LogOut, ChevronDown, ChevronUp } from "lucide-react";
import { AI_CREDIT_COSTS, CREDIT_PACKS } from "@/lib/tier";
import type { AiOperation } from "@/lib/tier";
import { useBuyCredits } from "@/hooks/use-buy-credits";
import { Loader2, Plus } from "lucide-react";
import { auth, firebaseSignOut } from "@/lib/firebase";
import { useCurrency, CURRENCIES } from "@/hooks/use-currency";
import { useAiToggle } from "@/hooks/use-ai-toggle";
import { useAuth } from "@/components/auth-provider";
import { clearDemoCookie } from "@/lib/demo-state";
import { toast } from "@/components/ui/custom-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PricingCards } from "@/components/tier/pricing-card";
import { useTier } from "@/hooks/use-tier";
import { getCreditsRemaining } from "@/server/actions/ai";
import { ProfileEditCard } from "@/components/settings/profile-edit-card";
import { ApiKeysCard } from "@/components/settings/api-keys-card";
import { DataBackupCard } from "@/components/settings/data-backup-card";
import { NotificationsCard } from "@/components/settings/notifications-card";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { SupportCard } from "@/components/settings/support-card";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { currencyCode, setCurrency } = useCurrency();
  const { aiUserEnabled, setAiUserEnabled } = useAiToggle();
  // Demo mode comes from the auth provider, not the `demo_mode` cookie: a
  // cookie left over from a /demo visit used to show a signed-in owner the
  // demo-only Settings page.
  const { refreshTier, devMode, demoMode: isDemo } = useAuth();
  const { isPaid, userId, displayName: tierName } = useTier();
  const searchParams = useSearchParams();

  // All useState / useEffect calls MUST come before any early return to
  // satisfy React's rules-of-hooks — they run in the same order every render.
  const [mounted, setMounted] = useState(false);
  const [credits, setCredits] = useState<{ used: number; limit: number; remaining: number; extraCredits?: number } | null>(null);
  const [usageExpanded, setUsageExpanded] = useState(false);

  useEffect(() => setMounted(true), []);

  // Fetch AI credit usage for paid users
  useEffect(() => {
    if (isPaid && userId) {
      getCreditsRemaining(userId).then(setCredits).catch(() => {});
    }
  }, [isPaid, userId]);

  // Detect return from Stripe Checkout (subscription OR credit top-up)
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      refreshTier().then(() => {
        toast.success("Subscription activated!", {
          description: "Your plan has been upgraded successfully.",
        });
      });
      window.history.replaceState({}, "", "/settings");
    } else if (searchParams.get("credits") === "success") {
      toast.success("Credits added!", {
        description: "Your AI credit balance has been topped up.",
      });
      // Re-fetch credit usage so the new balance shows up
      if (isPaid && userId) {
        getCreditsRemaining(userId).then(setCredits).catch(() => {});
      }
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams, refreshTier, isPaid, userId]);

  if (isDemo) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Demo mode — limited settings available</p>
        </div>
        <Card>
          <CardContent className="py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign up for a free account to customize your experience!
            </p>
            <Button asChild>
              <a href="/signup">Create Free Account</a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <Button
              variant="outline"
              className="w-full gap-2 text-muted-foreground"
              onClick={() => {
                clearDemoCookie();
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full page reload resets auth and demo state
                window.location.href = "/";
              }}
            >
              <LogOut className="h-4 w-4" />
              Exit Demo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile */}
      <ProfileEditCard />

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose how Cellar Door looks to you
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mounted && (
            <div className="grid grid-cols-3 gap-3">
              <ThemeOption
                label="Light"
                value="light"
                icon={<Sun className="h-5 w-5" />}
                isSelected={theme === "light"}
                onClick={() => setTheme("light")}
              />
              <ThemeOption
                label="Dark"
                value="dark"
                icon={<Moon className="h-5 w-5" />}
                isSelected={theme === "dark"}
                onClick={() => setTheme("dark")}
              />
              <ThemeOption
                label="System"
                value="system"
                icon={<Monitor className="h-5 w-5" />}
                isSelected={theme === "system"}
                onClick={() => setTheme("system")}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Features
          </CardTitle>
          <CardDescription>
            Toggle AI-powered features like label search, wine enrichment, and CellarChat
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mounted && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable AI features</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {aiUserEnabled
                    ? "AI label search, enrichment, and CellarChat are active"
                    : "AI features are turned off"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiUserEnabled}
                onClick={() => setAiUserEnabled(!aiUserEnabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  aiUserEnabled ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
                    aiUserEnabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscription / Pricing — appears before credits so users see the
          plans first; credit top-ups are a secondary upsell for folks who
          already subscribe. */}
      <div id="subscription">
        <PricingCards />
      </div>

      {/* AI Credits — hidden entirely when the user has toggled AI
          features off. Also hides the credit top-up purchase UI inside it. */}
      {aiUserEnabled && isPaid && credits && credits.limit > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              AI Credits
            </CardTitle>
            <CardDescription>
              {credits.remaining} credits remaining
              {credits.extraCredits ? ` · ${credits.extraCredits} from top-ups` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="bg-amber-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (credits.used / credits.limit) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{credits.used} used this month</span>
                <span>{credits.limit} monthly ({tierName})</span>
              </div>

              {/* Credit top-up packs */}
              <CreditTopUpSection />

              {/* Usage breakdown */}
              <button
                onClick={() => setUsageExpanded(!usageExpanded)}
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                {usageExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                View credit costs per action
              </button>
              {usageExpanded && (
                <div className="mt-2 space-y-1.5 bg-muted/50 rounded-lg p-3">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide mb-2">
                    Credits per action
                  </p>
                  {(
                    [
                      ["label_scan", "Label Scan"],
                      ["enrich_text", "Wine Enrichment"],
                      ["auto_fill", "Auto Fill"],
                      ["chat", "Chat Message"],
                      ["find_image", "Image Search"],
                      ["batch_enrich_text", "Batch Enrich (per wine)"],
                      ["batch_enrich_image", "Batch Image (per wine)"],
                    ] as [AiOperation, string][]
                  ).map(([op, label]) => (
                    <div
                      key={op}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums">
                        {AI_CREDIT_COSTS[op]} credit{AI_CREDIT_COSTS[op] !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Currency */}
      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
          <CardDescription>
            Set the currency used for wine prices and cellar value
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mounted && (
            <div className="grid grid-cols-4 gap-2">
              {CURRENCIES.map((c) => (
                <Button
                  key={c.code}
                  variant="outline"
                  className={cn(
                    "flex flex-col items-center gap-1 h-auto py-3 px-2",
                    currencyCode === c.code
                      ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30"
                      : "text-muted-foreground"
                  )}
                  onClick={() => setCurrency(c.code)}
                >
                  <span className="text-base font-semibold">{c.symbol}</span>
                  <span className="text-[10px] font-medium">{c.code}</span>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys */}
      <ApiKeysCard />

      {/* Notifications (native only — card hides itself on web) */}
      <NotificationsCard />

      {/* Data & Backup */}
      <DataBackupCard />

      {/* Support */}
      <SupportCard />

      {/* Sign Out */}
      <Card>
        <CardContent className="py-4">
          <Button
            variant="outline"
            className="w-full gap-2 text-muted-foreground"
            onClick={async () => {
              clearDemoCookie();
              if (!devMode) {
                // Clear the server session cookie first, as the sidebar and
                // profile sign-outs do. Without it a valid server session
                // lingered for up to 14 days after "Sign out" here, which
                // matters on shared devices.
                try {
                  const { clearSession } = await import("@/server/actions/auth");
                  await clearSession();
                } catch {
                  /* best effort */
                }
                const firebaseAuth = auth();
                if (firebaseAuth) await firebaseSignOut(firebaseAuth);
              }
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full page reload resets auth and demo state
              window.location.href = "/";
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone — Delete Account */}
      {!devMode && <DeleteAccountCard />}

      {/* Version */}
      <p className="text-center text-xs text-muted-foreground/50 pb-4">
        v{process.env.NEXT_PUBLIC_BUILD_SHA || "dev"} · {process.env.NEXT_PUBLIC_BUILD_VERSION || "local"}
      </p>
    </div>
  );
}

// ─── Credit Top-Up Section ──────────────────────────────────────

function CreditTopUpSection() {
  const { buy, loadingPack } = useBuyCredits();
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Need more credits?
        </p>
        <Plus className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CREDIT_PACKS.map((pack) => {
          const loading = loadingPack === pack.id;
          return (
            <button
              key={pack.id}
              type="button"
              disabled={loading || loadingPack !== null}
              onClick={() => buy(pack)}
              className={cn(
                "relative flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors cursor-pointer",
                pack.highlight
                  ? "border-primary bg-primary/5 hover:bg-primary/10"
                  : "border-border hover:bg-accent/50",
                (loading || loadingPack !== null) && "opacity-60 cursor-wait"
              )}
            >
              {pack.highlight && (
                <span className="absolute -top-1.5 right-2 text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm font-semibold uppercase tracking-wide">
                  Best
                </span>
              )}
              <span className="text-sm font-semibold">
                +{pack.credits} credits
              </span>
              <span className="text-base font-bold">
                ${pack.priceUsd.toFixed(2)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {pack.perCreditLabel}
              </span>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
        Top-up credits never expire and stack on top of your monthly allowance.
      </p>
    </div>
  );
}

function ThemeOption({
  label,
  icon,
  isSelected,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className={cn(
        "flex flex-col items-center gap-2 h-auto py-4 px-3",
        isSelected && "border-primary bg-primary/10 text-primary"
      )}
      onClick={onClick}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Button>
  );
}
