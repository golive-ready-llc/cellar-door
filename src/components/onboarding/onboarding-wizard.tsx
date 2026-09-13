"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wine,
  Camera,
  Search,
  PenLine,
  PartyPopper,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────

type AddMethod = "scan" | "search" | "manual";

interface OnboardingWizardProps {
  /** Called when user picks an add-wine method in step 2 */
  onAddWine?: (method: AddMethod) => void;
  /**
   * Called with the chosen cellar name ("" if none) the moment setup is
   * finished or skipped. The caller saves it, and the setup flag, on the
   * account. The wizard itself stores nothing: it used to write both to
   * localStorage, so it reappeared on every new device.
   */
  onFinish?: (cellarName: string) => void;
  /** Called after the closing animation */
  onComplete?: () => void;
}

/**
 * Whether first-run setup should show: only for a loaded, empty account that
 * hasn't finished setup on any device, and never in demo mode. `onboarded` is
 * null until the account's setting has loaded.
 */
export function shouldShowOnboarding({
  loading,
  onboarded,
  wineCount,
  demoMode,
}: {
  loading: boolean;
  onboarded: boolean | null;
  wineCount: number;
  demoMode: boolean;
}): boolean {
  return !loading && onboarded === false && wineCount === 0 && !demoMode;
}

// ─── Confetti particles ─────────────────────────────────────

const CONFETTI_COLORS = [
  "bg-amber-400",
  "bg-rose-400",
  "bg-violet-400",
  "bg-emerald-400",
  "bg-sky-400",
  "bg-orange-400",
  "bg-pink-400",
  "bg-teal-400",
];

/**
 * Pre-computed randomized particle positions. Using Math.random() inside
 * the render body causes React to flag impure-function warnings and would
 * re-randomize on every re-render, visibly flickering the animation.
 * We generate once at module load so the particles animate consistently.
 */
const CONFETTI_PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 2,
  duration: 2 + Math.random() * 2,
  size: 4 + Math.random() * 6,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

function ConfettiParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {CONFETTI_PARTICLES.map((p, i) => (
        <div
          key={i}
          className={cn("absolute rounded-full opacity-0", p.color)}
          style={{
            left: `${p.left}%`,
            top: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(400px) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Step indicator dots ────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            i === current
              ? "w-6 bg-primary"
              : i < current
                ? "w-2 bg-primary/50"
                : "w-2 bg-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

// ─── Main wizard ────────────────────────────────────────────

export function OnboardingWizard({ onAddWine, onFinish, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [cellarName, setCellarName] = useState("");
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Report the result right away, then fade out before closing.
  const close = useCallback(
    (afterClose?: () => void) => {
      onFinish?.(cellarName.trim());
      setExiting(true);
      setTimeout(() => {
        onComplete?.();
        afterClose?.();
      }, 300);
    },
    [cellarName, onFinish, onComplete]
  );

  const finish = useCallback(() => close(), [close]);

  const skip = useCallback(() => close(), [close]);

  const handleMethodSelect = (method: AddMethod) => {
    close(() => onAddWine?.(method));
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm transition-opacity duration-300",
        visible && !exiting ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="w-full max-w-md mx-auto px-6">
        {/* Step content with animation */}
        <div className="relative min-h-[380px]">
          {/* Step 1: Name Your Cellar */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center transition-all duration-300",
              step === 0
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-8 pointer-events-none"
            )}
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Wine className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">
              Name Your Cellar
            </h2>
            <p className="text-muted-foreground text-center mb-8 max-w-sm">
              Welcome to Cellar Door! Give your wine collection a name to make it
              yours.
            </p>
            <Input
              placeholder="My Wine Collection"
              value={cellarName}
              onChange={(e) => setCellarName(e.target.value)}
              className="text-center text-lg h-12 max-w-xs"
              autoFocus
            />
            <Button
              className="mt-8 gap-2"
              size="lg"
              onClick={() => setStep(1)}
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Step 2: Add Your First Wine */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center transition-all duration-300",
              step === 1
                ? "opacity-100 translate-x-0"
                : step < 1
                  ? "opacity-0 translate-x-8 pointer-events-none"
                  : "opacity-0 -translate-x-8 pointer-events-none"
            )}
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">
              Add Your First Wine
            </h2>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Choose how you&apos;d like to add a bottle to get started.
            </p>
            <div className="grid gap-3 w-full max-w-xs">
              <MethodCard
                icon={<Camera className="h-5 w-5" />}
                title="Scan a Label"
                description="Take a photo and we'll identify the wine"
                onClick={() => handleMethodSelect("scan")}
              />
              <MethodCard
                icon={<Search className="h-5 w-5" />}
                title="Search by Name"
                description="Look up wines in our database"
                onClick={() => handleMethodSelect("search")}
              />
              <MethodCard
                icon={<PenLine className="h-5 w-5" />}
                title="Add Manually"
                description="Enter wine details yourself"
                onClick={() => handleMethodSelect("manual")}
              />
            </div>
            <Button
              variant="ghost"
              className="mt-4 text-muted-foreground"
              onClick={() => setStep(2)}
            >
              I&apos;ll do this later
            </Button>
          </div>

          {/* Step 3: All Set */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center transition-all duration-300",
              step === 2
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-8 pointer-events-none"
            )}
          >
            {step === 2 && <ConfettiParticles />}
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <PartyPopper className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">
              You&apos;re All Set!
            </h2>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Your cellar is ready. Here&apos;s what you can do:
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground max-w-xs w-full mb-8">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Wine className="h-3 w-3 text-primary" />
                </div>
                Organize wines in customizable racks and walls
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Camera className="h-3 w-3 text-primary" />
                </div>
                Scan labels to add wines instantly with AI
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
                Track value, stats, and drinking windows
              </li>
            </ul>
            <Button
              className="gap-2"
              size="lg"
              onClick={finish}
            >
              Explore Your Cellar
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Step dots + skip */}
        <div className="mt-8 space-y-4">
          <StepIndicator current={step} total={3} />
          {step < 2 && (
            <p className="text-center">
              <button
                onClick={skip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Skip setup
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Method card ─────────────────────────────────────────────

function MethodCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors border-border"
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 py-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
      </CardContent>
    </Card>
  );
}
