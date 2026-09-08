"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Wine, ThumbsUp, Clock, Grape } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────

interface GuestWine {
  id: string;
  name: string;
  winery: string;
  type: string;
  vintage: number | null;
  region: string;
  country: string;
  grapeVariety: string;
  description: string;
  disposition: string;
  imageUrl: string;
  drinkWindow: string;
  foodPairings: string;
}

interface GuestSessionData {
  id: string;
  name: string;
  hostName: string;
  expiresAt: string;
  votes: Record<string, number>;
  wines: GuestWine[];
}

// ─── Type badge colors ─────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  white: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  "rosé": "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  sparkling: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  champagne: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  prosecco: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  cava: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  crémant: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  cremant: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  franciacorta: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  dessert: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  fortified: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
};

const VOTED_KEY_PREFIX = "cd-guest-voted-";

// ─── Component ──────────────────────────────────────────────

export default function GuestPage() {
  const params = useParams();
  const code = (params?.code as string)?.toUpperCase() ?? "";

  const [session, setSession] = useState<GuestSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [voting, setVoting] = useState<string | null>(null);
  // Tick every minute so the "hours left" display stays fresh without
  // calling the impure Date.now() directly in the render body.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Load voted wines from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(VOTED_KEY_PREFIX + code);
    if (stored) {
      try {
        setVotedIds(new Set(JSON.parse(stored)));
      } catch {
        // ignore
      }
    }
  }, [code]);

  // Fetch session data
  useEffect(() => {
    if (!code) return;
    setLoading(true);
    fetch(`/api/guest/${code}`)
      .then((r) => {
        if (!r.ok) throw new Error("Session not found or expired");
        return r.json();
      })
      .then((data) => {
        setSession(data);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  const handleVote = useCallback(
    async (wineId: string) => {
      if (votedIds.has(wineId) || voting) return;
      setVoting(wineId);
      try {
        const res = await fetch(`/api/guest/${code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wineId }),
        });
        if (res.ok) {
          const { votes } = await res.json();
          setSession((prev) => (prev ? { ...prev, votes } : prev));
          const newVoted = new Set(votedIds);
          newVoted.add(wineId);
          setVotedIds(newVoted);
          localStorage.setItem(
            VOTED_KEY_PREFIX + code,
            JSON.stringify([...newVoted])
          );
        }
      } catch {
        // ignore
      }
      setVoting(null);
    },
    [code, votedIds, voting]
  );

  // ─── Loading ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Wine className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">Loading cellar...</p>
        </div>
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────

  if (error || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Wine className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Session Not Found</h1>
          <p className="text-muted-foreground">
            This tasting session may have expired or the code is invalid.
            Ask your host for a new link.
          </p>
        </div>
      </div>
    );
  }

  // ─── Sort wines by vote count ──────────────────────────

  const sortedWines = [...session.wines].sort((a, b) => {
    const va = session.votes[a.id] || 0;
    const vb = session.votes[b.id] || 0;
    return vb - va;
  });

  const expiresAt = new Date(session.expiresAt);
  const hoursLeft = Math.max(
    0,
    Math.round((expiresAt.getTime() - nowTick) / 1000 / 60 / 60 * 10) / 10
  );

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Wine className="h-5 w-5 text-primary" />
            {session.name}
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span>Hosted by {session.hostName}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {hoursLeft}h left
            </span>
            <span>{session.wines.length} wines ready to drink</span>
          </div>
        </div>
      </div>

      {/* Wine list */}
      <div className="max-w-lg mx-auto p-4 space-y-3">
        <p className="text-sm text-muted-foreground text-center mb-4">
          Tap a wine to vote for what we should open!
        </p>

        {sortedWines.map((wine) => {
          const voteCount = session.votes[wine.id] || 0;
          const hasVoted = votedIds.has(wine.id);
          const isVoting = voting === wine.id;

          return (
            <div
              key={wine.id}
              className="rounded-xl border bg-card p-4 space-y-2"
            >
              <div className="flex items-start gap-3">
                {wine.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- host-uploaded wine label, base64 or external
                  <img
                    src={wine.imageUrl}
                    alt={wine.name}
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight">
                      {wine.name}
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ${
                        TYPE_COLORS[wine.type] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {wine.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {wine.winery}
                    {wine.vintage ? ` \u00B7 ${wine.vintage}` : ""}
                    {wine.region ? ` \u00B7 ${wine.region}` : ""}
                  </p>
                </div>
              </div>

              {wine.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {wine.description}
                </p>
              )}

              {wine.foodPairings && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Pairs with:</span>{" "}
                  {wine.foodPairings}
                </p>
              )}

              {wine.disposition && (
                <div className="flex items-center gap-1 text-xs">
                  <Grape className="h-3 w-3" />
                  <span>
                    {wine.disposition === "D"
                      ? "Drink Now"
                      : wine.disposition === "H"
                      ? "Hold"
                      : wine.disposition === "P"
                      ? "Past Peak"
                      : wine.disposition}
                  </span>
                  {wine.drinkWindow && (
                    <span className="text-muted-foreground">
                      ({wine.drinkWindow})
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => handleVote(wine.id)}
                  disabled={hasVoted || isVoting}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors ${
                    hasVoted
                      ? "bg-primary/10 text-primary cursor-default"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {isVoting
                    ? "Voting..."
                    : hasVoted
                    ? "Voted"
                    : "Vote to open"}
                </button>
                {voteCount > 0 && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {voteCount} vote{voteCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {sortedWines.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Wine className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No wines in this cellar yet.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-muted-foreground">
        Powered by{" "}
        <a
          href="https://mycellardoor.app"
          className="text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Cellar Door
        </a>
      </div>
    </div>
  );
}
