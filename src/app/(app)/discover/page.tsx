"use client";

import { useCallback, useRef, useState } from "react";
import { Compass, Search, Loader2, Sparkles, Plus, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WineListItem } from "@/components/inventory/wine-list-item";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { aiSearchWineSuggestions } from "@/server/actions/ai";
import { fetchWines, addBuyListItem } from "@/lib/data";
import { useAuth } from "@/components/auth-provider";
import { useTier } from "@/hooks/use-tier";
import { UpgradePrompt } from "@/components/tier/upgrade-prompt";
import { WineDetailDialog } from "@/components/wine/wine-detail-dialog";
import { toast } from "@/components/ui/custom-toast";
import type { BuyListItem, Wine, WineType } from "@/types/wine";

// Vivino's Discover tab, reframed around Cellar Door's AI (no static catalog):
// AI search, "matches for you" derived from the user's taste, and browse chips
// by region / grape / style. Results are wines to discover → add to wishlist.

interface Suggestion {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  grapeVariety: string;
}

const BROWSE: { label: string; query: string; kind: "region" | "grape" | "style" }[] = [
  { label: "Bordeaux", query: "classic Bordeaux red wines", kind: "region" },
  { label: "Burgundy", query: "Burgundy Pinot Noir and Chardonnay", kind: "region" },
  { label: "Tuscany", query: "Tuscan Sangiovese wines", kind: "region" },
  { label: "Napa Valley", query: "Napa Valley Cabernet Sauvignon", kind: "region" },
  { label: "Rioja", query: "Spanish Rioja Tempranillo", kind: "region" },
  { label: "Malbec", query: "Argentine Malbec", kind: "grape" },
  { label: "Pinot Noir", query: "elegant Pinot Noir", kind: "grape" },
  { label: "Riesling", query: "off-dry Riesling", kind: "grape" },
  { label: "Champagne", query: "grower Champagne", kind: "style" },
  { label: "Rosé", query: "dry Provence rosé", kind: "style" },
  { label: "Orange wine", query: "skin-contact orange wine", kind: "style" },
];

function suggestionToBuyListInput(s: Suggestion): Omit<BuyListItem, "id" | "addedAt" | "userId"> {
  return {
    barcode: "",
    name: s.name,
    winery: s.winery ?? "",
    region: s.region ?? "",
    country: s.country ?? "",
    vintage: s.vintage ?? null,
    type: (s.type || "red") as WineType,
    sparkling: false,
    grapeVariety: s.grapeVariety ?? "",
    imageUrl: "",
    retailPrice: null,
    notes: "",
    description: "",
    foodPairings: "",
    alcohol: "",
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    status: "wanted",
    orderDate: null,
    expectedDelivery: null,
    store: "",
  };
}

function key(s: Suggestion) {
  return `${s.name}|${s.winery}|${s.vintage ?? ""}`.toLowerCase();
}

/** Build a read-only Wine from a discovery suggestion so the detail dialog can
 *  show it (community CD score, details). No owner/handlers → read-only. */
function suggestionToWine(s: Suggestion): Wine {
  return {
    id: `discover-${key(s)}`,
    userId: "",
    cabinetId: null,
    barcode: "",
    name: s.name,
    winery: s.winery ?? "",
    region: s.region ?? "",
    country: s.country ?? "",
    vintage: s.vintage ?? null,
    type: ((s.type || "red").toLowerCase()) as WineType,
    sparkling: false,
    grapeVariety: s.grapeVariety ?? "",
    userRating: null,
    imageUrl: "",
    price: null,
    retailPrice: null,
    purchaseDate: "",
    drinkBy: "",
    notes: "",
    description: "",
    foodPairings: "",
    alcohol: "",
    row: null,
    col: null,
    depth: 0,
    zone: "",
    tastingNotes: null,
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    tags: [],
    addedAt: "",
    updatedAt: "",
  };
}

function ResultCard({
  s,
  added,
  onAdd,
  onOpen,
}: {
  s: Suggestion;
  added: boolean;
  onAdd: () => void;
  onOpen: () => void;
}) {
  return (
    <WineListItem
      wine={{
        name: s.name,
        winery: s.winery ?? "",
        vintage: s.vintage ?? null,
        type: s.type,
        imageUrl: "",
        grapeVariety: s.grapeVariety,
        region: s.region,
        country: s.country,
        price: null,
      }}
      onClick={onOpen}
      trailing={
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          disabled={added}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            added
              ? "bg-green-500/15 text-green-500 cursor-default"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          )}
        >
          {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {added ? "Saved" : "Wishlist"}
        </button>
      }
    />
  );
}

export default function DiscoverPage() {
  const { userId } = useAuth();
  const { hasAI } = useTier();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [detailWine, setDetailWine] = useState<Wine | null>(null);

  const [matches, setMatches] = useState<Suggestion[]>([]);
  // Starts false: matches are loaded on demand, so the page paints instantly.
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesRequested, setMatchesRequested] = useState(false);
  const [matchBasis, setMatchBasis] = useState<string>("");

  const reqId = useRef(0);

  const runSearch = useCallback(
    async (q: string, chip: string | null) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) return;
      const id = ++reqId.current;
      setLoading(true);
      setSearched(true);
      setActiveChip(chip);
      try {
        const res = await aiSearchWineSuggestions(trimmed, userId ?? undefined, 12);
        if (id !== reqId.current) return; // stale
        setResults(res.success ? (res.data.suggestions as Suggestion[]) : []);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [userId]
  );

  // "Matches for you": derive a query from the user's top-rated regions/grapes.
  //
  // Deliberately NOT run on mount. It costs a cellar fetch plus a multi-second
  // AI round trip, which made simply opening Discover feel broken (empty
  // skeletons for seconds). The page now paints instantly and the user asks
  // for matches when they want them.
  const loadMatches = useCallback(async () => {
    if (!hasAI) {
      setMatchesLoading(false);
      return;
    }
    let active = true;
    setMatchesRequested(true);
    setMatchesLoading(true);
    await (async () => {
      try {
        const wines = await fetchWines(userId);
        if (!active) return;
        const rated = wines.filter((w: Wine) => (w.userRating ?? 0) >= 4);
        const tally = (vals: string[]) => {
          const m = new Map<string, number>();
          for (const v of vals) {
            const t = v.trim();
            if (t) m.set(t, (m.get(t) ?? 0) + 1);
          }
          return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
        };
        const topRegions = tally(rated.map((w) => w.region ?? "")).slice(0, 2);
        const topGrapes = tally(rated.flatMap((w) => (w.grapeVariety ?? "").split(/[,/&]/))).slice(0, 2);
        const basisParts = [...topGrapes, ...topRegions].filter(Boolean);
        let q: string;
        if (basisParts.length > 0) {
          q = `highly rated wines like ${basisParts.join(", ")}`;
          setMatchBasis(basisParts.join(" · "));
        } else {
          q = "highly rated crowd-pleasing wines to try";
          setMatchBasis("popular picks");
        }
        const res = await aiSearchWineSuggestions(q, userId ?? undefined, 6);
        if (!active) return;
        setMatches(res.success ? (res.data.suggestions as Suggestion[]) : []);
      } finally {
        if (active) setMatchesLoading(false);
      }
    })();
    active = false;
  }, [userId, hasAI]);

  const handleAdd = useCallback(
    async (s: Suggestion) => {
      const k = key(s);
      setAdded((prev) => new Set(prev).add(k));
      try {
        await addBuyListItem(suggestionToBuyListInput(s), userId);
        toast.success(`Added "${s.name}" to your wishlist`);
      } catch (err) {
        setAdded((prev) => {
          const n = new Set(prev);
          n.delete(k);
          return n;
        });
        toast.error(err instanceof Error ? err.message : "Couldn't add to wishlist");
      }
    },
    [userId]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query, null);
  };

  const headerEls = (
    <PageHeader
      title="Discover"
      icon={Compass}
      subtitle="Find your next bottle — search, get matches for your taste, and explore."
    />
  );

  if (!hasAI) {
    return (
      <div className="space-y-6">
        {headerEls}
        <UpgradePrompt feature="Discover — AI wine search & recommendations" variant="card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {headerEls}

      {/* Search */}
      <form onSubmit={onSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search any wine, grape, region, or style…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </form>

      {/* Browse chips */}
      <div className="flex gap-2 flex-wrap">
        {BROWSE.map((b) => (
          <Badge
            key={b.label}
            variant={activeChip === b.label ? "default" : "outline"}
            className="cursor-pointer select-none"
            onClick={() => {
              setQuery(b.label);
              runSearch(b.query, b.label);
            }}
          >
            {b.label}
          </Badge>
        ))}
      </div>

      {/* Search results */}
      {searched && (
        <div className="space-y-2">
          {loading ? (
            [1, 2, 3, 4].map((i) => <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-muted" />)
          ) : results.length > 0 ? (
            results.map((s) => (
              <ResultCard
                key={key(s)}
                s={s}
                added={added.has(key(s))}
                onAdd={() => handleAdd(s)}
                onOpen={() => setDetailWine(suggestionToWine(s))}
              />
            ))
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No matches — try a different search.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Matches for you (only before a search is run) */}
      {!searched && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Matches for you</h2>
            {matchBasis && <span className="text-xs text-muted-foreground">· {matchBasis}</span>}
          </div>
          {!matchesRequested ? (
            <Card className="border-dashed">
              <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-muted-foreground max-w-xs">
                  Get AI picks based on the wines you&apos;ve rated highest.
                </p>
                <Button size="sm" variant="ai" className="gap-1.5" onClick={loadMatches}>
                  <Sparkles className="h-4 w-4" />
                  Find my matches
                </Button>
              </CardContent>
            </Card>
          ) : matchesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : matches.length > 0 ? (
            <div className="space-y-2">
              {matches.map((s) => (
                <ResultCard
                  key={key(s)}
                  s={s}
                  added={added.has(key(s))}
                  onAdd={() => handleAdd(s)}
                  onOpen={() => setDetailWine(suggestionToWine(s))}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Rate a few wines and your personalized matches will appear here.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Read-only detail for a discovered (not-yet-owned) wine */}
      {detailWine && (
        <WineDetailDialog
          wine={detailWine}
          open={!!detailWine}
          onOpenChange={(o) => {
            if (!o) setDetailWine(null);
          }}
        />
      )}
    </div>
  );
}
