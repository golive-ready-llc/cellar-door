"use client";

/**
 * WineDataContext — single source of truth for the data WineDetailDialog
 * needs (wines, cabinets, walls, allTags) plus the cross-page navigation
 * action `showInCellar`. Lives at the (app) layout so every authenticated
 * page can populate / consume it.
 *
 * Background: we kept getting reports that "the wine detail looks different
 * depending where you open it from." Root cause was that 4 mount sites
 * (cellar / inventory / stats / chat-wrapper) each decided independently
 * which optional props to pass — `cellarWines` controlled Terroir Twins,
 * `walls` controlled Show-in-Cellar, `storageType` controlled the
 * Add-Bottle/Remove-Bottle row, etc. Drift was inevitable.
 *
 * Now: pages call `setWineData({ wines, cabinets, walls })` once when
 * their data loads, and WineDetailDialog reads everything from this
 * context. Page-specific behavior (consume, duplicate, edit, etc.) stays
 * on the dialog as explicit props.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { Cabinet, Wall, Wine } from "@/types/wine";

interface WineDataContextValue {
  wines: Wine[];
  cabinets: Cabinet[];
  walls: Wall[];
  allTags: string[];
  /** Page-level setter — pages that have already fetched this data
   * call it in a useEffect so the dialog can read it. Partial updates
   * merge with existing context (only the supplied keys overwrite). */
  setWineData: (data: {
    wines?: Wine[];
    cabinets?: Cabinet[];
    walls?: Wall[];
    allTags?: string[];
  }) => void;
  /** Cross-page navigate-and-highlight. Pushes /cellar?wineId=X — the
   * cellar page reads the param and scrolls to the slot. */
  showInCellar: (wine: Wine) => void;
}

const WineDataContext = createContext<WineDataContextValue | null>(null);

export function WineDataProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [wines, setWines] = useState<Wine[]>([]);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  const setWineData = useCallback(
    (data: {
      wines?: Wine[];
      cabinets?: Cabinet[];
      walls?: Wall[];
      allTags?: string[];
    }) => {
      if (data.wines !== undefined) setWines(data.wines);
      if (data.cabinets !== undefined) setCabinets(data.cabinets);
      if (data.walls !== undefined) setWalls(data.walls);
      if (data.allTags !== undefined) setAllTags(data.allTags);
    },
    []
  );

  const showInCellar = useCallback(
    (wine: Wine) => {
      // The cellar page reads ?wineId= and handles scrolling/highlight.
      // Keep navigation simple — don't depend on the cellar page being
      // mounted right now.
      router.push(`/cellar?wineId=${encodeURIComponent(wine.id)}`);
    },
    [router]
  );

  const value = useMemo<WineDataContextValue>(
    () => ({ wines, cabinets, walls, allTags, setWineData, showInCellar }),
    [wines, cabinets, walls, allTags, setWineData, showInCellar]
  );

  return (
    <WineDataContext.Provider value={value}>
      {children}
    </WineDataContext.Provider>
  );
}

/**
 * Read the current wine data from context. Returns empty arrays when
 * the provider hasn't been mounted (defensive — keeps callers from
 * crashing if the dialog is ever rendered outside the (app) layout).
 */
export function useWineData(): WineDataContextValue {
  const ctx = useContext(WineDataContext);
  if (!ctx) {
    return {
      wines: [],
      cabinets: [],
      walls: [],
      allTags: [],
      setWineData: () => {},
      showInCellar: () => {},
    };
  }
  return ctx;
}
