"use client";

import { useEffect, useState, useCallback } from "react";
import { CellarChat } from "./cellar-chat";
import { fetchWines, editWine } from "@/lib/data";
import { useTier } from "@/hooks/use-tier";
import { WineDetailDialog } from "@/components/wine/wine-detail-dialog";
import { useWineData } from "@/contexts/wine-data-context";
import type { Wine } from "@/types/wine";

/**
 * Wrapper that fetches wine data for CellarChat.
 * Used in the app layout so CellarChat is available on every page.
 * - Free users: FAB shown (upgrade prompt on open)
 * - Paid users with AI toggle ON: FAB shown, chat active
 * - Paid users with AI toggle OFF: FAB hidden entirely (user explicitly
 *   opted out of AI features)
 */
export function CellarChatWrapper() {
  const [wines, setWines] = useState<Wine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const { hasAI, tierHasAI, userId } = useTier();
  const aiToggledOff = tierHasAI && !hasAI;

  useEffect(() => {
    // Only fetch wines if user has AI access (no need to load for free users)
    if (!hasAI) {
      setLoaded(true);
      return;
    }
    // A failed initial load must not hide the FAB for the whole session:
    // the effect only refires on user/tier change, so there'd be no retry.
    // Show the FAB with whatever we have; refreshWines refetches on open.
    fetchWines(userId)
      .then((w) => {
        setWines(w);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, [hasAI, userId]);

  // The list above loads once, when the app opens, so without this the chat
  // never saw bottles added afterwards and told new users their cellar was
  // empty. Reload it each time the chat opens. Reads are cached and every
  // write clears that cache, so this is cheap and always current.
  const refreshWines = useCallback(() => {
    if (!hasAI) return;
    fetchWines(userId)
      .then(setWines)
      .catch(() => {
        // Keep the list we have; the chat still works with it.
      });
  }, [hasAI, userId]);

  // Fallback: if the user opens chat on a page that doesn't itself
  // populate WineDataContext (e.g. /settings, /admin), push our locally
  // fetched wines so the chat-spawned WineDetailDialog still works.
  // Pages that DO populate (cellar/inventory/stats) overwrite this on
  // their own mount — last-write-wins, freshest data wins.
  const { setWineData } = useWineData();
  useEffect(() => {
    if (wines.length > 0) setWineData({ wines });
  }, [wines, setWineData]);

  const handleWineClick = useCallback((wine: Wine) => {
    setSelectedWine(wine);
  }, []);

  const handleSave = useCallback(async (wineId: string, updates: Partial<Wine>) => {
    const updated = await editWine(wineId, updates, userId);
    if (updated) {
      setWines((prev) => prev.map((w) => (w.id === wineId ? { ...w, ...updated } : w)));
      setSelectedWine((prev) => (prev?.id === wineId ? { ...prev, ...updated } : prev));
    }
  }, [userId]);

  if (!loaded) return null;
  // User on a paid tier who's turned AI off — hide the FAB entirely.
  if (aiToggledOff) return null;

  return (
    <>
      <CellarChat
        wines={wines}
        onWineClick={handleWineClick}
        hasAI={hasAI}
        userId={userId}
        onOpen={refreshWines}
      />
      {selectedWine && (
        <WineDetailDialog
          wine={selectedWine}
          open={!!selectedWine}
          onOpenChange={(open) => { if (!open) setSelectedWine(null); }}
          onSave={handleSave}
          onUpdate={(updates) => {
            if (selectedWine) {
              const updated = { ...selectedWine, ...updates };
              setSelectedWine(updated);
              setWines((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
            }
          }}
        />
      )}
    </>
  );
}
