"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import type { SensorValue } from "@/types/ha";

export interface HaSensorData {
  temp: SensorValue | null;
  humidity: SensorValue | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const POLL_INTERVAL_MS = 60_000; // 60 seconds when healthy
const MAX_POLL_INTERVAL_MS = 5 * 60_000; // back off to 5 min when HA is unreachable

export function useHaSensors(
  wallId: string | null,
  enabled: boolean
): HaSensorData {
  const { getIdToken } = useAuth();
  const [data, setData] = useState<HaSensorData>({
    temp: null,
    humidity: null,
    loading: false,
    error: null,
    lastUpdated: null,
  });

  const mountedRef = useRef(true);

  // Returns true if the poll failed (so the caller can back off). A poll counts
  // as "failed" whenever no reading came back — a non-OK response, a thrown
  // fetch, or a 200 carrying an `error` field (HA reachable-but-unreadable).
  const fetchSensors = useCallback(async (): Promise<boolean> => {
    if (!wallId || !enabled) return false;

    const token = await getIdToken();
    if (!token) return true;

    setData((prev) => ({ ...prev, loading: !prev.lastUpdated })); // only show loading on first fetch

    try {
      const res = await fetch(`/api/ha-sensor?wallId=${wallId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!mountedRef.current) return false;

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setData((prev) => ({
          ...prev,
          loading: false,
          error: body.error || `HTTP ${res.status}`,
        }));
        return true;
      }

      const body = await res.json();
      const hasReading = Boolean(body.temp || body.humidity);
      setData((prev) => ({
        // On a reading, take the fresh values. On a blank/errored poll keep the
        // last known reading so the chip shows "61.6°F · 81.2% ⚠" (stale, gentle)
        // rather than flipping to a loud "Sensor error" with no data. lastUpdated
        // is also preserved so we can tell "never connected" from "now stale".
        temp: hasReading ? body.temp || null : prev.temp,
        humidity: hasReading ? body.humidity || null : prev.humidity,
        loading: false,
        error: body.error || null,
        lastUpdated: hasReading ? new Date() : prev.lastUpdated,
      }));
      return !hasReading;
    } catch (err) {
      if (!mountedRef.current) return false;
      setData((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Fetch failed",
      }));
      return true;
    }
  }, [wallId, enabled, getIdToken]);

  useEffect(() => {
    mountedRef.current = true;

    if (!wallId || !enabled) {
      setData({
        temp: null,
        humidity: null,
        loading: false,
        error: null,
        lastUpdated: null,
      });
      return;
    }

    // Self-rescheduling poll with exponential backoff. While HA is reachable we
    // poll every 60s; on consecutive failures we back off (60s → 2m → 4m → 5m
    // cap) so an offline server doesn't generate a request — and a server-side
    // log line — every single minute. A successful read resets to 60s.
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const failed = await fetchSensors();
      if (!mountedRef.current) return;
      failures = failed ? failures + 1 : 0;
      const delay = Math.min(
        POLL_INTERVAL_MS * 2 ** Math.min(failures, 3),
        MAX_POLL_INTERVAL_MS
      );
      timer = setTimeout(tick, delay);
    };

    tick();

    return () => {
      mountedRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [wallId, enabled, fetchSensors]);

  return data;
}
