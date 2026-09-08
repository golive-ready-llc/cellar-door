/**
 * Local notifications wrapper — Capacitor on native, no-op on web.
 *
 * We use the LocalNotifications plugin only (no FCM, no server). All
 * scheduling happens on-device. Web build silently no-ops so the same
 * code paths run in dev and production-mobile.
 *
 * Two notification types fire:
 *   - past-peak per-bottle: one-shot fired once when a wine crosses past
 *     its drinkWindow.end year. Notification id derived from wine.id so
 *     editing/deleting the wine can cancel/replace it cleanly.
 *   - monthly digest: recurring on the 1st at 9am. Body is intentionally
 *     generic ("Open Cellar Door…") since LocalNotifications can't
 *     compute personalised text at fire time on Android — the actual
 *     count is shown in-app via PeakingBanner when the user opens the app.
 */
import { isNative } from "@/lib/capacitor";
import { parseDrinkWindow } from "@/lib/drink-window";
import type { Wine } from "@/types/wine";

/** Reserved notification id for the recurring monthly digest. */
export const MONTHLY_DIGEST_ID = 1;

/** Decant timer: ongoing "in progress" notification + one-shot completion
 *  alarm. Both sit below PAST_PEAK_ID_BASE so the wine reconciler (which only
 *  cancels ids >= PAST_PEAK_ID_BASE) never clobbers a running decant timer. */
export const DECANT_PROGRESS_ID = 2;
export const DECANT_DONE_ID = 3;

/** Past-peak notification ids start here — we hash the wineId string into
 * the [PAST_PEAK_ID_BASE, 2^31) integer range. Capacitor requires int32. */
const PAST_PEAK_ID_BASE = 100;

/** Stable positive int from a wine id string, using the full positive int32 range
 *  for lower collision probability than the previous 30-bit mask. Capacitor
 *  requires notification ids to be valid 32-bit signed integers. */
function hashWineId(wineId: string): number {
  let h = 0;
  for (let i = 0; i < wineId.length; i++) {
    h = (h * 31 + wineId.charCodeAt(i)) | 0;
  }
  // >>> 0 converts the signed int32 to unsigned, giving us [0, 2^32-1].
  // Then spread across the range starting at PAST_PEAK_ID_BASE.
  return PAST_PEAK_ID_BASE + ((h >>> 0) % (2_147_483_647 - PAST_PEAK_ID_BASE));
}

async function getPlugin() {
  if (!isNative) return null;
  try {
    const mod = await import("@capacitor/local-notifications");
    return mod.LocalNotifications;
  } catch (err) {
    console.warn("[notifications] plugin load failed", err);
    return null;
  }
}

/**
 * Ensure we have permission to fire notifications. Returns true if granted,
 * false otherwise. On web returns false (we don't use Web Notifications).
 */
export async function ensurePermissions(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  const current = await plugin.checkPermissions();
  if (current.display === "granted") return true;
  if (current.display === "denied") return false;
  const requested = await plugin.requestPermissions();
  return requested.display === "granted";
}

export async function getPermissionState(): Promise<
  "granted" | "denied" | "prompt" | "unsupported"
> {
  const plugin = await getPlugin();
  if (!plugin) return "unsupported";
  const { display } = await plugin.checkPermissions();
  if (display === "granted") return "granted";
  if (display === "denied") return "denied";
  return "prompt";
}

// ─── Past-peak per-bottle ─────────────────────────────────────────

/**
 * Schedule a one-shot past-peak warning for the wine. Fires on Jan 2 of
 * (drinkWindow.end + 1) at 10am local. Replaces any existing notification
 * for the same wine.
 *
 * No-op when:
 *   - running on web
 *   - wine has no parseable drinkWindow.end
 *   - the past-peak boundary is already in the past (we don't backfire
 *     stale warnings; the in-app banner surfaces those instead)
 */
export async function scheduleWinePastPeakWarning(wine: Wine): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;
  const { end } = parseDrinkWindow(wine.drinkWindow);
  if (end === null) return;

  const fireAt = new Date(end + 1, 0, 2, 10, 0, 0);
  if (fireAt.getTime() <= Date.now()) return;

  const id = hashWineId(wine.id);
  // Cancel any previous schedule for this wine first so editing the
  // drinkWindow updates rather than stacks notifications.
  try {
    await plugin.cancel({ notifications: [{ id }] });
  } catch {
    // No prior schedule — ignore.
  }

  const title = `${wine.name} is past peak`;
  const body = wine.winery
    ? `Your ${wine.vintage ? wine.vintage + " " : ""}${wine.winery} is now past its drink-by window. Time to open it or accept the loss.`
    : `This wine is now past its drink-by window.`;

  await plugin.schedule({
    notifications: [
      {
        id,
        title,
        body,
        schedule: { at: fireAt, allowWhileIdle: true },
        extra: { wineId: wine.id, kind: "past-peak" },
      },
    ],
  });
}

/** Cancel any pending past-peak notification for a wine. */
export async function cancelWineNotifications(wineId: string): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    await plugin.cancel({ notifications: [{ id: hashWineId(wineId) }] });
  } catch {
    // Ignored — cancelling a non-existent id is fine.
  }
}

/**
 * Reconcile past-peak schedules against the current wine list:
 *   - schedule a warning for every wine with a future drinkWindow.end
 *   - cancel anything pending for wines that no longer exist
 *
 * Called whenever the wines array changes (add / edit / delete).
 */
export async function reconcileWineNotifications(wines: Wine[]): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;

  const desiredIds = new Set<number>();
  for (const wine of wines) {
    const { end } = parseDrinkWindow(wine.drinkWindow);
    if (end === null) continue;
    const fireAt = new Date(end + 1, 0, 2, 10, 0, 0);
    if (fireAt.getTime() <= Date.now()) continue;
    desiredIds.add(hashWineId(wine.id));
  }

  // Cancel any pending past-peak schedule that's no longer desired.
  try {
    const pending = await plugin.getPending();
    const toCancel = pending.notifications
      .filter(
        (n) =>
          typeof n.id === "number" &&
          n.id >= PAST_PEAK_ID_BASE &&
          !desiredIds.has(n.id)
      )
      .map((n) => ({ id: n.id as number }));
    if (toCancel.length > 0) {
      await plugin.cancel({ notifications: toCancel });
    }
  } catch (err) {
    console.warn("[notifications] reconcile cancel failed", err);
  }

  // Schedule any missing ones.
  for (const wine of wines) {
    await scheduleWinePastPeakWarning(wine);
  }
}

// ─── Decant timer ──────────────────────────────────────────────────

/** Low-importance, silent channel for the ongoing "decanting…" notification so
 *  starting a timer doesn't chime. The completion alarm intentionally uses the
 *  DEFAULT channel, which reliably plays the default notification sound. */
const DECANT_PROGRESS_CHANNEL = "cd-decant-progress";

/** Local clock like "3:45 PM" for the notification body. */
function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Back a decant timer with OS-level notifications so it survives the dialog
 * closing and the app being backgrounded / killed:
 *   - an ongoing "Decanting … — ready at HH:MM" notification posted now
 *     (non-swipeable on Android, silent channel) so the running timer stays
 *     visible, and
 *   - a one-shot completion alarm at `fireAt` that plays the default
 *     notification sound.
 *
 * Returns true if the schedule was placed (native + plugin present + permission
 * granted) so the caller can fall back otherwise. Fails soft if the native
 * plugin isn't in this build (e.g. an APK built before the plugin was added).
 * Only one decant timer runs at a time — scheduling replaces any prior one.
 */
export async function scheduleDecantTimer(
  wineName: string,
  fireAt: Date
): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    const granted = await ensurePermissions();
    if (!granted) return false;

    await cancelDecantTimer();

    // Silent, low-importance channel for the ongoing notification (Android 8+).
    // Best-effort: no-op on iOS / older Android.
    try {
      await plugin.createChannel({
        id: DECANT_PROGRESS_CHANNEL,
        name: "Decanting in progress",
        description: "Ongoing timer shown while a wine is decanting.",
        importance: 2, // LOW — visible in the shade, but silent / no heads-up.
        vibration: false,
      });
    } catch {
      /* createChannel unsupported on this platform — fine. */
    }

    const name = wineName || "Your wine";
    await plugin.schedule({
      notifications: [
        {
          id: DECANT_PROGRESS_ID,
          title: "Decanting in progress",
          body: `${name} — ready to pour at ${formatClock(fireAt)}.`,
          // Post almost immediately and keep it pinned for the whole countdown.
          schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true },
          channelId: DECANT_PROGRESS_CHANNEL,
          ongoing: true,
          autoCancel: false,
          extra: { kind: "decant-progress" },
        },
        {
          id: DECANT_DONE_ID,
          title: "Decant timer done",
          body: `${name} is ready to pour!`,
          // Default channel → plays the default notification sound (the alarm).
          schedule: { at: fireAt, allowWhileIdle: true },
          ongoing: true,
          autoCancel: false,
          extra: { kind: "decant-done" },
        },
      ],
    });
    return true;
  } catch (err) {
    // Most likely the native plugin isn't present in this build (e.g. an APK
    // built before @capacitor/local-notifications was added). Fail soft so the
    // in-app timer still runs and the caller can surface a hint.
    console.warn("[notifications] scheduleDecantTimer failed", err);
    return false;
  }
}

/** Cancel the decant timer's ongoing + completion notifications. */
export async function cancelDecantTimer(): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    await plugin.cancel({
      notifications: [{ id: DECANT_PROGRESS_ID }, { id: DECANT_DONE_ID }],
    });
  } catch {
    // Nothing pending — fine.
  }
}

// ─── Monthly digest ───────────────────────────────────────────────

/**
 * Schedule the recurring monthly "peaking wines" reminder. Fires the 1st
 * of every month at 9am local. The body is generic — the in-app
 * PeakingBanner shows the actual count when the user opens the app.
 */
export async function scheduleMonthlyDigest(): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;

  // Cancel any prior schedule to avoid duplicates if this is called again.
  try {
    await plugin.cancel({ notifications: [{ id: MONTHLY_DIGEST_ID }] });
  } catch {
    /* nothing pending */
  }

  // First fire: next 1st of month at 9am.
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0);
  // If the user just opened the app on the 1st before 9am, fire today.
  if (now.getDate() === 1 && now.getHours() < 9) {
    next.setMonth(now.getMonth());
  }

  await plugin.schedule({
    notifications: [
      {
        id: MONTHLY_DIGEST_ID,
        title: "Cellar Door — drink window check",
        body: "Open Cellar Door to see which wines are hitting their peak this month.",
        schedule: {
          at: next,
          every: "month",
          count: 36, // ~3 years; re-armed every app launch anyway
          allowWhileIdle: true,
        },
        extra: { kind: "monthly-digest" },
      },
    ],
  });
}

/** Cancel everything we've scheduled — used when the user toggles off. */
export async function cancelAllScheduled(): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    const pending = await plugin.getPending();
    if (pending.notifications.length > 0) {
      await plugin.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id as number })),
      });
    }
  } catch (err) {
    console.warn("[notifications] cancelAll failed", err);
  }
}
