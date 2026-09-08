"use client";

import { useEffect, useState, useCallback } from "react";
import { Flame, Trophy, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChallengeCard } from "./challenge-card";
import { useAuth } from "@/components/auth-provider";
import { useTier } from "@/hooks/use-tier";
import type {
  ChallengeData,
  BadgeData,
} from "@/server/actions/challenges";

export function ChallengesSection() {
  const { userId } = useAuth();
  const { hasAI } = useTier();

  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newBadges, setNewBadges] = useState<BadgeData[]>([]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      const {
        getActiveChallenges,
        getUserBadges,
        getUserStreak,
      } = await import("@/server/actions/challenges");

      const [challengesData, badgesData, streakData] = await Promise.all([
        getActiveChallenges(userId),
        getUserBadges(userId),
        getUserStreak(userId),
      ]);

      setChallenges(challengesData);
      setBadges(badgesData);
      setStreak(streakData);
    } catch (err) {
      // Unauthorized is EXPECTED in demo/guest sessions (no server session
      // cookie) — the section just stays empty. Don't spam the console;
      // only surface genuinely unexpected failures.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/unauthorized/i.test(msg)) {
        console.error("[Challenges] Failed to load:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // AI-powered challenges require Cellar+ or higher — skip loading for free tier
    if (!hasAI) return;
    loadData();
  }, [loadData, hasAI]);

  // AI-powered challenges require Cellar+ or higher
  if (!hasAI) return null;

  const handleGenerate = async () => {
    if (!userId) return;
    setGenerating(true);
    try {
      const { generateWeeklyChallenge } = await import(
        "@/server/actions/challenges"
      );
      const challenge = await generateWeeklyChallenge(userId);
      setChallenges((prev) => [challenge, ...prev]);
    } catch (err) {
      console.error("[Challenges] Failed to generate:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleComplete = async (challengeId: string) => {
    if (!userId) return;
    try {
      const { completeChallenge } = await import(
        "@/server/actions/challenges"
      );
      const result = await completeChallenge(userId, challengeId);
      setChallenges((prev) =>
        prev.map((c) => (c.id === challengeId ? result.challenge : c))
      );
      if (result.newBadges.length > 0) {
        setBadges((prev) => [...result.newBadges, ...prev]);
        setNewBadges(result.newBadges);
        // Clear new badge animation after 5s
        setTimeout(() => setNewBadges([]), 5000);
      }
      // Refresh streak
      const { getUserStreak } = await import("@/server/actions/challenges");
      const newStreak = await getUserStreak(userId);
      setStreak(newStreak);
    } catch (err) {
      console.error("[Challenges] Failed to complete:", err);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Corkscrew Challenges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Corkscrew Challenges
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* Streak counter */}
            {streak > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-500">
                <Flame className="h-4 w-4" />
                <span className="text-sm font-bold">{streak}</span>
                <span className="text-xs">
                  week{streak !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New badge notification */}
        {newBadges.length > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-in fade-in slide-in-from-top-2 duration-500">
            <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-500">
                New badge{newBadges.length > 1 ? "s" : ""} earned!
              </p>
              <p className="text-xs text-muted-foreground">
                {newBadges.map((b) => `${b.icon} ${b.name}`).join(", ")}
              </p>
            </div>
          </div>
        )}

        {/* Active challenges */}
        {challenges.length > 0 ? (
          <div className="space-y-3">
            {challenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onComplete={handleComplete}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">
              No active challenges. Ready for a new one?
            </p>
          </div>
        )}

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={generating}
          variant="ai"
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating challenge...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              New Challenge
            </>
          )}
        </Button>

        {/* Badge collection */}
        {badges.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Your Badges
            </h4>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium transition-all ${
                    newBadges.some((nb) => nb.id === badge.id)
                      ? "ring-2 ring-amber-500 animate-in zoom-in-95 duration-500"
                      : ""
                  }`}
                  title={`Earned ${new Date(badge.earnedAt).toLocaleDateString()}`}
                >
                  <span className="text-base">{badge.icon}</span>
                  <span>{badge.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
