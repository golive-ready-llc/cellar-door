"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Star,
  Users,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating, RatingDistribution } from "@/components/ui/star-rating";
import { cn } from "@/lib/utils";
import {
  fetchCommunityScore,
  fetchCommunityRatings,
  submitCdRating,
} from "@/lib/data";
import type { CommunityRating } from "@/types/wine";
import { useTier } from "@/hooks/use-tier";

interface CdScoreBadgeProps {
  /** Current score — if already loaded */
  score?: number | null;
  /** Rating count — if already loaded */
  ratingCount?: number;
  /** Compact mode for card display */
  compact?: boolean;
}

export const getScoreColor = (s: number) => {
  if (s >= 4.5) return "bg-emerald-500 text-white";
  if (s >= 4.0) return "bg-green-500 text-white";
  if (s >= 3.5) return "bg-lime-500 text-white";
  if (s >= 3.0) return "bg-yellow-500 text-white";
  if (s >= 2.0) return "bg-orange-500 text-white";
  return "bg-red-500 text-white";
};

/**
 * CD Score badge — shows the community rating.
 * Compact mode: small inline badge
 * Full mode: larger badge with rating count
 */
export function CdScoreBadge({
  score,
  ratingCount = 0,
  compact = false,
}: CdScoreBadgeProps) {
  if (score === null || score === undefined) return null;
  // An unrated wine has no community score to show. The cdScore field still
  // carries an AI-estimated baseline even with zero real ratings, but showing
  // it reads as a community rating that doesn't exist. Render nothing until at
  // least one person has actually rated the wine.
  if (ratingCount <= 0) return null;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold",
          getScoreColor(score)
        )}
        title={`CD Score: ${score.toFixed(1)} (${ratingCount} ratings)`}
      >
        CD {score.toFixed(1)}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold",
          getScoreColor(score)
        )}
      >
        <Star className="h-3.5 w-3.5 fill-current" />
        {score.toFixed(1)}
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Users className="h-3 w-3" />
        {ratingCount} {ratingCount === 1 ? "rating" : "ratings"}
      </div>
    </div>
  );
}

/**
 * The labeled "CD Score" block used at the top of every wine/bottle detail
 * dialog — shows the score badge once the community has rated it, otherwise a
 * "–" placeholder. Single source of truth so all three detail dialogs match.
 */
export function CdScoreInline({
  score,
  ratingCount = 0,
}: {
  score?: number | null;
  ratingCount?: number;
}) {
  return (
    <div className="text-center shrink-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">CD Score</p>
      {score != null && ratingCount > 0 ? (
        <CdScoreBadge score={score} ratingCount={ratingCount} />
      ) : (
        <div
          className="inline-flex items-center justify-center min-w-[48px] h-7 rounded-full border border-dashed border-muted-foreground/30 text-xs text-muted-foreground px-3"
          title="No community ratings yet — be the first to rate this wine"
        >
          –
        </div>
      )}
    </div>
  );
}

interface CdScoreSectionProps {
  wineName: string;
  wineWinery: string;
  wineVintage: number | null;
  wineType: string;
  wineRegion: string;
  wineCountry: string;
  /** Current CD score from the wine object */
  cdScore?: number | null;
  cdRatingCount?: number;
  /** Callback when score is updated */
  onScoreUpdate?: (cdScore: number, cdRatingCount: number) => void;
}

/**
 * Full CD Score section for the wine detail dialog.
 * Shows the community score, individual ratings list, and rating form.
 */
export function CdScoreSection({
  wineName,
  wineWinery,
  wineVintage,
  wineType,
  wineRegion,
  wineCountry,
  cdScore: initialScore,
  cdRatingCount: initialCount = 0,
  onScoreUpdate,
}: CdScoreSectionProps) {
  const { userId } = useTier();
  const [cdScore, setCdScore] = useState(initialScore ?? null);
  const [cdRatingCount, setCdRatingCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showRateForm, setShowRateForm] = useState(false);
  const [showRatings, setShowRatings] = useState(false);
  const [ratings, setRatings] = useState<CommunityRating[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [review, setReview] = useState("");

  // Fetch score on mount if not provided
  useEffect(() => {
    if (initialScore !== undefined && initialScore !== null) return;

    setLoading(true);
    fetchCommunityScore(wineName, wineWinery, wineVintage)
      .then((result) => {
        if (result) {
          setCdScore(result.cdScore);
          setCdRatingCount(result.cdRatingCount);
        }
      })
      .finally(() => setLoading(false));
  }, [wineName, wineWinery, wineVintage, initialScore]);

  // Fetch individual ratings when expanded
  const loadRatings = useCallback(async () => {
    if (ratings.length > 0) return; // already loaded
    setRatingsLoading(true);
    try {
      const result = await fetchCommunityRatings(
        wineName,
        wineWinery,
        wineVintage
      );
      setRatings(result);
    } finally {
      setRatingsLoading(false);
    }
  }, [wineName, wineWinery, wineVintage, ratings.length]);

  const handleToggleRatings = useCallback(() => {
    if (!showRatings) {
      loadRatings();
    }
    setShowRatings((v) => !v);
  }, [showRatings, loadRatings]);

  const handleSubmitRating = useCallback(async () => {
    if (userRating === 0) return;

    setSubmitting(true);
    try {
      const result = await submitCdRating(
        wineName,
        wineWinery,
        wineVintage,
        wineType,
        wineRegion,
        wineCountry,
        userRating,
        review,
        userId
      );
      setCdScore(result.cdScore);
      setCdRatingCount(result.cdRatingCount);
      onScoreUpdate?.(result.cdScore, result.cdRatingCount);
      setShowRateForm(false);
      setUserRating(0);
      setReview("");
      // Reset ratings so they reload with new rating
      setRatings([]);
    } finally {
      setSubmitting(false);
    }
  }, [
    userRating,
    review,
    wineName,
    wineWinery,
    wineVintage,
    wineType,
    wineRegion,
    wineCountry,
    // userId was missing — a rating submitted after a late auth hydration
    // would have used a stale (null) userId from the first render's closure.
    userId,
    onScoreUpdate,
  ]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading community score...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Score header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground">CD Score</p>
          {cdScore !== null && cdScore !== undefined ? (
            <CdScoreBadge score={cdScore} ratingCount={cdRatingCount} />
          ) : (
            <span className="text-xs text-muted-foreground italic">
              No community ratings yet
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {cdRatingCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleRatings}
              className="h-6 px-2 text-xs gap-1"
            >
              {showRatings ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              Reviews
            </Button>
          )}
          {!showRateForm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRateForm(true)}
              className="h-6 px-2 text-xs gap-1"
            >
              <Star className="h-3 w-3" />
              Rate
            </Button>
          )}
        </div>
      </div>

      {/* Individual ratings list */}
      {showRatings && (
        <div className="space-y-2 pt-1">
          {ratingsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs">Loading reviews...</span>
            </div>
          ) : ratings.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              No detailed reviews yet. Be the first!
            </p>
          ) : (
            <>
              <RatingDistribution ratings={ratings.map((r) => r.rating)} className="pb-1" />
              {ratings.map((r) => (
                <RatingCard key={r.id} rating={r} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Rating form */}
      {showRateForm && (
        <div className="p-3 rounded-lg bg-muted/50 border border-dashed space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Your rating:</span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="p-0.5 transition-transform hover:scale-110"
                  onClick={() =>
                    setUserRating(star === userRating ? 0 : star)
                  }
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                >
                  <Star
                    className={cn(
                      "h-5 w-5 transition-colors",
                      (hoverRating || userRating) >= star
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
            {userRating > 0 && (
              <span className="text-sm font-medium">{userRating}.0</span>
            )}
          </div>

          <Textarea
            placeholder="Share your tasting notes or review..."
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={2}
            className="text-sm"
          />

          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowRateForm(false);
                setUserRating(0);
                setReview("");
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitRating}
              disabled={userRating === 0 || submitting}
              className="text-xs gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Submit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Individual rating card ─────────────────────────────────

function RatingCard({ rating }: { rating: CommunityRating }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
      {/* Header: username, stars, date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
            <User className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium">{rating.username}</span>
          <StarRating value={rating.rating} size={12} />
        </div>
        <span className="text-[10px] text-muted-foreground">
          {new Date(rating.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Review text */}
      {rating.review && (
        <p className="text-sm text-foreground/90">{rating.review}</p>
      )}

      {/* Tasting notes */}
      {rating.tastingNotes && (
        <div className="grid gap-1 text-xs">
          {rating.tastingNotes.aroma && (
            <div className="flex gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                Aroma
              </Badge>
              <span className="text-muted-foreground">
                {rating.tastingNotes.aroma}
              </span>
            </div>
          )}
          {rating.tastingNotes.taste && (
            <div className="flex gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                Taste
              </Badge>
              <span className="text-muted-foreground">
                {rating.tastingNotes.taste}
              </span>
            </div>
          )}
          {rating.tastingNotes.finish && (
            <div className="flex gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                Finish
              </Badge>
              <span className="text-muted-foreground">
                {rating.tastingNotes.finish}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
