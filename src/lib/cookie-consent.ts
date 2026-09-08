"use client";

/**
 * Cookie-consent state — the single source of truth for whether the visitor
 * has opted in to non-essential (advertising) cookies.
 *
 * Essential cookies (auth/session, the site gate, demo mode, sidebar state)
 * are always allowed and are not governed by this — they're strictly necessary
 * for the app to function. This store gates ONLY the non-essential ones,
 * currently Google AdSense: the ad script must not load until consent is
 * "accepted" (opt-in), per GDPR/ePrivacy.
 *
 * Reactive via useSyncExternalStore so the banner, the AdSense loader, and the
 * ad slots all react to a choice without a reload. SSR-safe: the server and the
 * first client render both see `null` (undecided), avoiding hydration flashes.
 */

import { useSyncExternalStore } from "react";

export type ConsentValue = "accepted" | "rejected" | null;

const STORAGE_KEY = "cd_cookie_consent";
const OPEN_EVENT = "cd:cookie-settings-open";

let cached: ConsentValue = null;
let hydrated = false;
const listeners = new Set<() => void>();

function read(): ConsentValue {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "accepted" || v === "rejected" ? v : null;
  } catch {
    // Private mode / storage blocked — treat as undecided (no non-essential cookies).
    return null;
  }
}

/** Lazily hydrate the cache from storage on first client access. */
function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  cached = read();
  hydrated = true;
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cached = read();
      listeners.forEach((l) => l());
    }
  });
}

function subscribe(cb: () => void): () => void {
  ensureHydrated();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ConsentValue {
  ensureHydrated();
  return cached;
}

function getServerSnapshot(): ConsentValue {
  return null;
}

/** Record the visitor's choice and notify everything that reacts to it. */
export function setCookieConsent(value: Exclude<ConsentValue, null>): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Best effort — if storage is blocked, the choice just won't persist.
  }
  cached = value;
  hydrated = true;
  listeners.forEach((l) => l());
}

/** Reopen the consent banner (e.g. from a footer "Cookie settings" link). */
export function openCookieSettings(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_EVENT));
  }
}

/** Subscribe to "reopen settings" requests. Returns an unsubscribe fn. */
export function onOpenCookieSettings(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(OPEN_EVENT, cb);
  return () => window.removeEventListener(OPEN_EVENT, cb);
}

/** React hook: the current consent value, reactive to changes. */
export function useCookieConsent(): ConsentValue {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
