"use client";

import { useCallback, useSyncExternalStore } from "react";

const AI_TOGGLE_KEY = "cellar-door-ai-enabled";

/** Simple pub/sub so all hook instances stay in sync */
const listeners: Set<() => void> = new Set();

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Cross-tab sync: a 'storage' event fires in OTHER tabs when this tab
  // writes to localStorage. Without this listener Tab B would keep showing
  // the stale value until the next manual rerender.
  const onStorage = (e: StorageEvent) => {
    if (e.key === AI_TOGGLE_KEY || e.key === null) {
      cb();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(AI_TOGGLE_KEY);
  return v === null ? true : v === "true";
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * User-level toggle for AI features.
 * Uses useSyncExternalStore so ALL components using this hook
 * update immediately when the toggle changes.
 */
export function useAiToggle() {
  const aiUserEnabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setAiUserEnabled = useCallback((value: boolean) => {
    localStorage.setItem(AI_TOGGLE_KEY, String(value));
    // Notify all subscribers (same tab)
    listeners.forEach((cb) => cb());
  }, []);

  return { aiUserEnabled, setAiUserEnabled };
}
