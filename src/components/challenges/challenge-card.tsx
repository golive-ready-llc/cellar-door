"use client";

import { useState } from "react";
import { Wine, Globe, Share2, BookOpen, Check, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ChallengeData } from "@/server/actions/challenges";

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Wine; label: string; color: string }
> = {
  taste: {
    icon: Wine,
    label: "Taste",
    color: "text-rose-400",
  },
  explore: {
    icon: Globe,
    label: "Explore",
    color: "text-emerald-400",
  },
  share: {
    icon: Share2,
    label: "Share",
    color: "text-blue-400",
  },
  learn: {
    icon: BookOpen,
    label: "Learn",
    color: "text-amber-400",
  },
};

function getTimeRemaining(expiresAt: Date): string {
  const now = new Date();
  const diff = new Date(expiresAt).getTime() - now.getTime();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${mins}m left`;
}

interface ChallengeCardProps {
  challenge: ChallengeData;
  onComplete: (challengeId: string) => Promise<void>;
}

export function ChallengeCard({ challenge, onComplete }: ChallengeCardProps) {
  const [completing, setCompleting] = useState(false);
  const config = TYPE_CONFIG[challenge.type] || TYPE_CONFIG.taste;
  const Icon = config.icon;
  const isCompleted = challenge.completed;
  const isExpired =
    !isCompleted && new Date(challenge.expiresAt).getTime() < Date.now();

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await onComplete(challenge.id);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Card
      className={`relative overflow-hidden transition-all ${
        isCompleted
          ? "ring-1 ring-emerald-500/30 bg-emerald-500/5"
          : isExpired
            ? "opacity-50"
            : "hover:ring-1 hover:ring-primary/20"
      }`}
    >
      <CardContent className="flex gap-3 items-start">
        {/* Type icon */}
        <div
          className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
            isCompleted ? "bg-emerald-500/10" : "bg-muted"
          }`}
        >
          {isCompleted ? (
            <Check className="h-5 w-5 text-emerald-500" />
          ) : (
            <Icon className={`h-5 w-5 ${config.color}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}
            >
              {config.label}
            </span>
            {!isCompleted && !isExpired && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {getTimeRemaining(challenge.expiresAt)}
              </span>
            )}
          </div>

          <h4 className="font-semibold text-sm leading-snug mb-1">
            {challenge.title}
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {challenge.description}
          </p>

          {/* Complete button */}
          {!isCompleted && !isExpired && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-xs"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? "Completing..." : "Mark Complete"}
            </Button>
          )}

          {isCompleted && (
            <p className="mt-1.5 text-[10px] text-emerald-500 font-medium">
              Completed{" "}
              {challenge.completedAt
                ? new Date(challenge.completedAt).toLocaleDateString()
                : ""}
            </p>
          )}

          {isExpired && (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Challenge expired
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
