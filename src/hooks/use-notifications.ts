"use client";

/**
 * useNotifications — single source of truth for the notifications opt-in
 * state, OS permission state, and reconciliation against the current
 * wine list.
 *
 * The toggle defaults to ON. The OS permission prompt is the real gate —
 * if the user denies at the OS level, our toggle still says "on" but
 * nothing actually fires.
 */
import { useEffect, useState, useCallback } from "react";
import { useWineData } from "@/contexts/wine-data-context";
import { isNative } from "@/lib/capacitor";
import {
  ensurePermissions,
  getPermissionState,
  reconcileWineNotifications,
  scheduleMonthlyDigest,
  cancelAllScheduled,
} from "@/lib/notifications";

const TOGGLE_KEY = "cd:notifications:enabled";
const LAST_RECONCILE_KEY = "cd:notifications:lastReconcileWineCount";

type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(TOGGLE_KEY);
  // Default ON — the OS prompt is the real opt-in gate.
  return v === null ? true : v === "true";
}

export function useNotifications() {
  const { wines } = useWineData();
  const [enabled, setEnabledState] = useState<boolean>(true);
  const [permission, setPermission] = useState<PermissionState>("unsupported");

  // Hydrate toggle + permission state on mount.
  useEffect(() => {
    setEnabledState(readEnabled());
    getPermissionState().then(setPermission);
  }, []);

  // Whenever the wine list, toggle, or permission changes, reconcile the
  // native schedule. On web (or with permission denied / toggle off) this
  // becomes a no-op via the helpers' own guards.
  useEffect(() => {
    if (!isNative || !enabled || permission !== "granted") return;
    let cancelled = false;
    (async () => {
      // Cheap guard: avoid re-running reconcile on every render — only
      // when the wine count actually changed since the last reconcile.
      // Drink-window edits are reconciled by hashWineId-keyed cancel +
      // re-schedule, so we still need to run on edits; check both count
      // and a content fingerprint.
      const fingerprint = wines
        .map((w) => `${w.id}:${w.drinkWindow}`)
        .join("|");
      const prev = window.localStorage.getItem(LAST_RECONCILE_KEY);
      if (prev === fingerprint) return;
      await reconcileWineNotifications(wines);
      await scheduleMonthlyDigest();
      if (!cancelled) {
        window.localStorage.setItem(LAST_RECONCILE_KEY, fingerprint);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wines, enabled, permission]);

  /** User-facing toggle. Persists immediately and reconciles. */
  const setEnabled = useCallback(async (next: boolean) => {
    setEnabledState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOGGLE_KEY, String(next));
      // Force the next reconcile to actually run.
      window.localStorage.removeItem(LAST_RECONCILE_KEY);
    }

    if (!isNative) return;

    if (next) {
      const ok = await ensurePermissions();
      setPermission(ok ? "granted" : "denied");
      // Reconciler effect picks it up from here.
    } else {
      await cancelAllScheduled();
    }
  }, []);

  return {
    /** User-facing on/off (defaults true). */
    enabled,
    setEnabled,
    /** OS-level permission state. */
    permission,
    /** True if running on a platform that supports notifications. */
    supported: isNative,
  };
}
