// Data access layer — abstracts mock store (dev) vs Prisma (production)
// In dev mode without DATABASE_URL, uses in-memory mock store
// In production, uses Prisma server actions

import type { Wine, Wall, Cabinet, WineHistoryItem, BuyListItem, NewWineInput } from "@/types/wine";
import { DuplicateWineError } from "./errors";
import type { AddWineInput } from "@/server/actions/wines";
import { isDemoModeActive } from "./demo-state";

// The demo/dev data set is ~70 KB. Load it only when mock or demo mode is
// actually in use, so it stays out of every signed-in user's bundle.
let mockStorePromise: Promise<typeof import("./mock-store")["mockStore"]> | null = null;
function loadMockStore() {
  mockStorePromise ??= import("./mock-store").then((m) => m.mockStore);
  return mockStorePromise;
}

const isDev = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const DEV_USER_ID = "dev-user-001";
const DEMO_USER_ID = "demo-user-001";

/**
 * Client-side demo guard. Throws a readable error *before* the mutation
 * reaches the server action, so the UI's catch-block can show the real
 * message. Next.js production sanitises errors thrown inside server actions
 * into an opaque "Server Components render" message, which is useless for
 * users. Server actions still have `assertNotDemo()` as defence-in-depth —
 * this is purely to surface a clean UX message.
 */
function assertNotDemoClient(action: string) {
  if (isDemoModeActive()) {
    throw new Error(
      `Demo mode is read-only. Sign up to ${action} with your own account.`
    );
  }
}

/**
 * Check if we should use the in-memory mock store instead of Prisma.
 * True for:
 *   - local dev (NEXT_PUBLIC_USE_MOCK), and
 *   - demo-mode visitors. The auth provider forces the demo user id here, and
 *     the mock store's normalizeUserId maps it onto the seeded sample cellar,
 *     so /demo lands in a populated cellar instead of the empty first-run setup.
 * Reads only: every mutation is blocked upstream by assertNotDemoClient, so
 * a demo visitor can browse the seeded data but never write it.
 *
 * Demo mode comes from the auth provider's decision, not the `demo_mode`
 * cookie. A cookie left over from a /demo visit used to switch a signed-in
 * owner onto the demo store, where their account has no wines, which also
 * opened the first-run "Name Your Cellar" wizard over their real cellar.
 */
function isMockMode(): boolean {
  return isDev || isDemoModeActive();
}

/** Resolve user ID — in dev/demo mode use fixed IDs; in production require real userId */
function resolveUserId(userId?: string | null): string {
  if (isDev) return DEV_USER_ID;
  // Demo users pass "demo-user-001" from auth provider
  if (userId === DEMO_USER_ID) return DEMO_USER_ID;
  if (userId) return userId;
  throw new Error("userId is required in production — pass it from useAuth()");
}

// ============================================================
// Read cache — makes view switching fast.
//
// Every page hook refetches its lists on mount, so navigating between
// views paid a full server-action round trip each time (the main "app
// feels slow" complaint). The hot list reads now go through a short
// TTL cache; EVERY mutation in this file invalidates it, so your own
// writes are always reflected. Cache is keyed per user and cleared on
// user change (sign-out/sign-in safety).
// ============================================================

// 5 minutes (matches the router staleTimes). Short TTLs defeat the purpose:
// at 30s, browsing one tab for a minute meant the next switch was cold again —
// AND the resulting server-action POST invalidates Next's client router cache,
// forcing an RSC refetch on top. Correctness comes from invalidation (every
// mutation clears this cache), not from the TTL; the TTL only bounds staleness
// from OTHER devices, and pull-to-refresh forces freshness on demand.
const READ_CACHE_TTL_MS = 300_000;
const readCache = new Map<string, { data: unknown; ts: number }>();
let readCacheUserId: string | null = null;

function cacheScope(uid: string) {
  if (readCacheUserId !== uid) {
    readCache.clear();
    readCacheUserId = uid;
  }
}

/** Drop all cached reads — call after any mutation (or pull-to-refresh). */
export function invalidateReadCache(): void {
  readCache.clear();
}

async function cachedRead<T>(key: string, uid: string, load: () => Promise<T>): Promise<T> {
  cacheScope(uid);
  const hit = readCache.get(key);
  if (hit && Date.now() - hit.ts <= READ_CACHE_TTL_MS) return hit.data as T;
  const data = await load();
  readCache.set(key, { data, ts: Date.now() });
  return data;
}

// ============================================================
// Wines
// ============================================================

export async function fetchWines(userId?: string | null): Promise<Wine[]> {
  const uid = resolveUserId(userId);
  if (isMockMode()) return (await loadMockStore()).getWines(uid);
  return cachedRead("wines", uid, async () => {
    const { getWines } = await import("@/server/actions/wines");
    return getWines(uid);
  });
}

export async function fetchWinesByCabinet(cabinetId: string, userId?: string | null): Promise<Wine[]> {
  const uid = resolveUserId(userId);
  if (isMockMode()) return (await loadMockStore()).getWinesByCabinet(uid, cabinetId);
  const { getWinesByCabinet } = await import("@/server/actions/wines");
  return getWinesByCabinet(uid, cabinetId);
}

export async function fetchWine(wineId: string, userId?: string | null): Promise<Wine | null> {
  const uid = resolveUserId(userId);
  if (isMockMode()) return (await loadMockStore()).getWine(uid, wineId);
  const { getWine } = await import("@/server/actions/wines");
  return getWine(uid, wineId);
}

export async function createWine(
  data: NewWineInput,
  userId?: string | null
): Promise<Wine> {
  assertNotDemoClient("add wines");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) return (await loadMockStore()).addWine({ ...data, userId: uid });
  const { addWine } = await import("@/server/actions/wines");
  const result = await addWine({ ...data, userId: uid });
  // The server action RETURNS a duplicate sentinel rather than throwing —
  // production masks thrown server-action errors into an opaque "Server
  // Components render" message. Re-throw the typed error HERE (client side)
  // so callers' instanceof checks work and the message stays readable.
  if ("duplicate" in result) {
    throw new DuplicateWineError(result.existingWineId, result.existingWineName);
  }
  return result;
}

export async function editWine(
  wineId: string,
  data: Partial<Wine>,
  userId?: string | null
): Promise<Wine | null> {
  assertNotDemoClient("edit wines");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) return (await loadMockStore()).updateWine(wineId, data);
  const { updateWine } = await import("@/server/actions/wines");
  return updateWine(uid, wineId, data);
}

export async function deleteWine(
  wineId: string,
  reason: string = "other",
  rating?: number | null,
  notes?: string,
  userId?: string | null
): Promise<void> {
  assertNotDemoClient("remove wines");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) { (await loadMockStore()).removeWine(wineId, reason, rating, notes); return; }
  const { removeWine } = await import("@/server/actions/wines");
  const result = await removeWine(uid, wineId, reason, rating, notes);
  if (!result.success) {
    throw new Error(result.error);
  }
}

export async function bulkDeleteWines(
  wineIds: string[],
  reason: string = "other",
  userId?: string | null
): Promise<number> {
  assertNotDemoClient("remove wines");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) {
    for (const id of wineIds) (await loadMockStore()).removeWine(id, reason);
    return wineIds.length;
  }
  const { bulkRemoveWines } = await import("@/server/actions/wines");
  return bulkRemoveWines(uid, wineIds, reason);
}

// ============================================================
// Walls
// ============================================================

export async function fetchWalls(userId?: string | null): Promise<Wall[]> {
  const uid = resolveUserId(userId);
  if (isMockMode()) return (await loadMockStore()).getWalls(uid);
  return cachedRead("walls", uid, async () => {
    const { getWalls } = await import("@/server/actions/walls");
    return getWalls(uid);
  });
}

export async function createWall(
  data: Partial<Omit<Wall, "id" | "userId">>,
  userId?: string | null
): Promise<Wall> {
  assertNotDemoClient("add walls");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) return (await loadMockStore()).addWall({ userId: uid, name: data.name ?? "New Wall", location: data.location ?? "", sortOrder: data.sortOrder ?? 0 });
  const { addWall } = await import("@/server/actions/walls");
  return addWall({ userId: uid, ...data });
}

export async function editWall(
  wallId: string,
  data: Partial<Omit<Wall, "id" | "userId">>,
  userId?: string | null
): Promise<Wall | null> {
  assertNotDemoClient("edit walls");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) return (await loadMockStore()).updateWall(wallId, data);
  const { updateWall } = await import("@/server/actions/walls");
  return updateWall(uid, wallId, data);
}

export async function removeWall(wallId: string, userId?: string | null): Promise<void> {
  assertNotDemoClient("delete walls");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) { (await loadMockStore()).deleteWall(wallId); return; }
  const { deleteWall } = await import("@/server/actions/walls");
  return deleteWall(uid, wallId);
}

// ============================================================
// Cabinets
// ============================================================

export async function fetchCabinets(userId?: string | null): Promise<Cabinet[]> {
  const uid = resolveUserId(userId);
  if (isMockMode()) return (await loadMockStore()).getCabinets(uid);
  return cachedRead("cabinets", uid, async () => {
    const { getCabinets } = await import("@/server/actions/cabinets");
    return getCabinets(uid);
  });
}

export async function fetchCabinet(cabinetId: string, userId?: string | null): Promise<Cabinet | null> {
  const uid = resolveUserId(userId);
  if (isMockMode()) return (await loadMockStore()).getCabinet(uid, cabinetId);
  const { getCabinet } = await import("@/server/actions/cabinets");
  return getCabinet(uid, cabinetId);
}

export async function createCabinet(
  data: { wallId: string } & Partial<Omit<Cabinet, "id" | "userId" | "wallId">>,
  userId?: string | null
): Promise<Cabinet> {
  assertNotDemoClient("add sections");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) return (await loadMockStore()).addCabinet({ userId: uid, wallId: data.wallId, name: data.name ?? "New Section", rows: data.rows ?? 8, cols: data.cols ?? 8, depth: data.depth ?? 1, storageRows: data.storageRows ?? [], sortOrder: data.sortOrder ?? 0 });
  const { addCabinet } = await import("@/server/actions/cabinets");
  return addCabinet({ userId: uid, ...data });
}

export async function editCabinet(
  cabinetId: string,
  data: Partial<Omit<Cabinet, "id" | "userId">>,
  userId?: string | null
): Promise<Cabinet | null> {
  assertNotDemoClient("edit sections");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) return (await loadMockStore()).updateCabinet(cabinetId, data);
  const { updateCabinet } = await import("@/server/actions/cabinets");
  return updateCabinet(uid, cabinetId, data);
}

export async function removeCabinet(cabinetId: string, userId?: string | null): Promise<void> {
  assertNotDemoClient("delete sections");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) { (await loadMockStore()).deleteCabinet(cabinetId); return; }
  const { deleteCabinet } = await import("@/server/actions/cabinets");
  return deleteCabinet(uid, cabinetId);
}

// ============================================================
// History
// ============================================================

export async function fetchHistory(userId?: string | null): Promise<WineHistoryItem[]> {
  const uid = resolveUserId(userId);
  if (isMockMode()) return (await loadMockStore()).getHistory(uid);
  return cachedRead("history", uid, async () => {
    const { getHistory } = await import("@/server/actions/wines");
    return getHistory(uid);
  });
}

/** Slim rating entries for the taste-profile page — never full rows (the
 *  full-row fetch moved ~10 MB of base64 images and failed on mobile). */
export async function fetchTasteProfileEntries(
  userId?: string | null
): Promise<import("@/server/actions/wines").TasteProfileEntryRow[]> {
  const uid = resolveUserId(userId);
  if (isMockMode()) {
    const store = await loadMockStore();
    const [wines, history] = await Promise.all([
      store.getWines(uid),
      store.getHistory(uid),
    ]);
    return [
      ...wines.map((w) => ({
        id: w.id,
        source: "cellar" as const,
        type: w.type,
        region: w.region ?? "",
        country: w.country ?? "",
        grapeVariety: w.grapeVariety ?? "",
        rating: w.userRating ?? null,
      })),
      ...history.map((h) => ({
        id: h.id,
        source: "history" as const,
        type: h.type,
        region: h.region ?? "",
        country: h.country ?? "",
        grapeVariety: h.grapeVariety ?? "",
        rating: (h.consumeRating ?? h.rating) ?? null,
      })),
    ];
  }
  const { getTasteProfileEntries } = await import("@/server/actions/wines");
  return getTasteProfileEntries(uid);
}

/** Only the most recent history events (activity feed), not a lifetime of history. */
export async function fetchRecentHistory(
  userId: string | null | undefined,
  limit: number
): Promise<WineHistoryItem[]> {
  const uid = resolveUserId(userId);
  if (isMockMode()) return (await loadMockStore()).getHistory(uid).slice(0, limit);
  return cachedRead(`history-recent-${limit}`, uid, async () => {
    const { getHistory } = await import("@/server/actions/wines");
    return getHistory(uid, limit);
  });
}

export async function removeHistoryItem(id: string, userId?: string | null): Promise<void> {
  assertNotDemoClient("edit history");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) { (await loadMockStore()).deleteHistoryItem(id); return; }
  const { deleteHistoryItem } = await import("@/server/actions/wines");
  return deleteHistoryItem(uid, id);
}

export async function editHistoryItem(
  id: string,
  updates: Record<string, unknown>,
  userId?: string | null
): Promise<{ success: boolean; error?: string }> {
  assertNotDemoClient("edit history");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) return { success: true };
  const { updateHistoryItem } = await import("@/server/actions/wines");
  return updateHistoryItem(uid, id, updates as Parameters<typeof updateHistoryItem>[2]);
}

// ============================================================
// Buy List
// ============================================================

export async function fetchBuyList(userId?: string | null): Promise<BuyListItem[]> {
  const uid = resolveUserId(userId);
  if (isMockMode()) return (await loadMockStore()).getBuyList(uid);
  return cachedRead("buyList", uid, async () => {
    const { getBuyList } = await import("@/server/actions/buy-list");
    return getBuyList(uid);
  });
}

export async function addBuyListItem(
  data: Omit<BuyListItem, "id" | "addedAt" | "userId">,
  userId?: string | null
): Promise<BuyListItem> {
  assertNotDemoClient("add buy-list items");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) return (await loadMockStore()).addBuyListItem({ ...data, userId: uid });
  const { addBuyListItem: serverAdd } = await import("@/server/actions/buy-list");
  return serverAdd(uid, data);
}

export async function updateBuyListItemData(
  id: string,
  data: Partial<Omit<BuyListItem, "id" | "addedAt" | "userId">>,
  userId?: string | null
): Promise<BuyListItem> {
  assertNotDemoClient("edit buy-list items");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) return (await loadMockStore()).updateBuyListItem(id, data);
  const { updateBuyListItem: serverUpdate } = await import("@/server/actions/buy-list");
  return serverUpdate(uid, id, data);
}

export async function removeBuyListItem(id: string, userId?: string | null): Promise<void> {
  assertNotDemoClient("remove buy-list items");
  invalidateReadCache();
  const uid = resolveUserId(userId);
  if (isDev) { (await loadMockStore()).removeBuyListItem(id); return; }
  const { removeBuyListItem: serverRemove } = await import("@/server/actions/buy-list");
  return serverRemove(uid, id);
}

// ============================================================
// Profile
// ============================================================

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  avatarColor: string;
  createdAt: string | null;
}

export async function fetchProfile(userId?: string | null): Promise<UserProfile> {
  if (isMockMode()) {
    // Note: mock mode returns the single dev profile regardless of userId
    // since the in-memory mockStore only holds one profile. In production
    // the Prisma query correctly filters by the requested userId.
    return (await loadMockStore()).getProfile();
  }
  const { getFullUserProfile } = await import("@/server/actions/auth");
  const profile = await getFullUserProfile(undefined, userId ?? undefined);
  if (!profile) throw new Error("Profile not found");
  return profile;
}

export async function updateProfile(
  data: {
    displayName?: string;
    photoURL?: string | null;
    avatarColor?: string;
  },
  userId?: string | null
): Promise<UserProfile> {
  assertNotDemoClient("edit your profile");
  invalidateReadCache();
  if (isDev) return (await loadMockStore()).updateProfile(data);
  const { updateUserProfile } = await import("@/server/actions/auth");
  return updateUserProfile(data, userId ?? undefined);
}

// ============================================================
// Cellar settings (first-run setup flag + cellar name)
// ============================================================

export interface CellarSettingsData {
  onboarded: boolean;
  cellarName: string;
}

/**
 * Local dev without a database keeps cellar settings in the browser. A key of
 * its own, so the one-time copy of the old localStorage values up to the
 * account (in useCellar) can never read or delete these.
 */
const DEV_CELLAR_SETTINGS_KEY = "cellar-door-dev-cellar-settings";

function readDevCellarSettings(): CellarSettingsData {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(DEV_CELLAR_SETTINGS_KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as Partial<CellarSettingsData>) : {};
    return { onboarded: parsed.onboarded === true, cellarName: parsed.cellarName ?? "" };
  } catch {
    return { onboarded: false, cellarName: "" };
  }
}

/**
 * Whether first-run setup is done, and the cellar's name. Stored on the
 * account so neither depends on the browser. Demo visitors browse a sample
 * cellar, so they never see first-run setup.
 */
export async function fetchCellarSettings(userId?: string | null): Promise<CellarSettingsData> {
  const uid = resolveUserId(userId);
  if (isDemoModeActive()) return { onboarded: true, cellarName: "" };
  if (isDev) return readDevCellarSettings();
  const { getCellarSettings } = await import("@/server/actions/cellar-settings");
  return getCellarSettings(uid);
}

export async function saveCellarSettings(
  data: { onboarded?: boolean; cellarName?: string },
  userId?: string | null
): Promise<CellarSettingsData> {
  assertNotDemoClient("change your cellar settings");
  const uid = resolveUserId(userId);
  if (isDev) {
    const current = readDevCellarSettings();
    const next: CellarSettingsData = {
      onboarded: data.onboarded === true ? true : current.onboarded,
      cellarName: typeof data.cellarName === "string" ? data.cellarName.trim() : current.cellarName,
    };
    localStorage.setItem(DEV_CELLAR_SETTINGS_KEY, JSON.stringify(next));
    return next;
  }
  const { saveCellarSettings: serverSaveCellarSettings } = await import("@/server/actions/cellar-settings");
  return serverSaveCellarSettings(data, uid);
}

// ============================================================
// Backup / Export
// ============================================================

export async function fetchAllDataForBackup(userId?: string | null) {
  const uid = resolveUserId(userId);
  if (isMockMode()) {
    return (await loadMockStore()).getAllData();
  }
  const { getWines: serverGetWines, getHistory } = await import("@/server/actions/wines");
  const { getWalls } = await import("@/server/actions/walls");
  const { getCabinets } = await import("@/server/actions/cabinets");
  const { getBuyList } = await import("@/server/actions/buy-list");

  const [wines, walls, cabinets, history, buyList] = await Promise.all([
    serverGetWines(uid, { fullImages: true }),
    getWalls(uid),
    getCabinets(uid),
    getHistory(uid, undefined, { fullImages: true }),
    getBuyList(uid),
  ]);

  return { wines, walls, cabinets, history, buyList };
}

export async function restoreFromBackup(
  data: {
    wines?: Wine[];
    walls?: Wall[];
    cabinets?: import("@/types/wine").Cabinet[];
    history?: WineHistoryItem[];
    buyList?: BuyListItem[];
  },
  userId?: string | null
) {
  assertNotDemoClient("restore a backup");
  invalidateReadCache();
  if (isDev) { (await loadMockStore()).replaceAllData(data); return; }
  const uid = resolveUserId(userId);
  const { restoreBackup } = await import("@/server/actions/backup");
  await restoreBackup(data, uid);
}

export async function bulkCreateWines(
  wineDataList: NewWineInput[],
  userId?: string | null
): Promise<Wine[]> {
  assertNotDemoClient("import wines");
  invalidateReadCache();
  if (isDev) {
    // Mock store: create them one at a time. Imports legitimately repeat wines, so
    // skip the duplicate check.
    const created: Wine[] = [];
    for (const data of wineDataList) {
      created.push(await createWine({ ...data, skipDuplicateCheck: true }, userId));
    }
    return created;
  }
  // Production: one server action and a batched, all-or-nothing insert.
  const uid = resolveUserId(userId);
  const { importWines } = await import("@/server/actions/wines");
  return importWines(uid, wineDataList as AddWineInput[]);
}

// ============================================================
// Community Scores
// ============================================================

export async function fetchCommunityScore(
  name: string,
  winery: string,
  vintage: number | null
): Promise<{ cdScore: number | null; cdRatingCount: number } | null> {
  if (isMockMode()) {
    return (await loadMockStore()).getCommunityScore(name, winery, vintage);
  }
  const { getCommunityScore } = await import("@/server/actions/community");
  return getCommunityScore(name, winery, vintage);
}

export async function submitCdRating(
  name: string,
  winery: string,
  vintage: number | null,
  type: string,
  region: string,
  country: string,
  rating: number,
  review: string = "",
  userId?: string | null
): Promise<{ cdScore: number; cdRatingCount: number }> {
  assertNotDemoClient("rate community wines");
  invalidateReadCache();
  if (isMockMode()) {
    return (await loadMockStore()).submitCommunityRating(
      DEV_USER_ID,
      name,
      winery,
      vintage,
      rating,
      review
    );
  }
  const { submitCommunityRating } = await import(
    "@/server/actions/community"
  );
  const result = await submitCommunityRating(
    name,
    winery,
    vintage,
    type,
    region,
    country,
    rating,
    review,
    userId
  );
  return {
    cdScore: result.cdScore ?? rating,
    cdRatingCount: result.cdRatingCount,
  };
}

export async function fetchCommunityRatings(
  name: string,
  winery: string,
  vintage: number | null
): Promise<import("@/types/wine").CommunityRating[]> {
  if (isMockMode()) {
    return (await loadMockStore()).getCommunityRatings(name, winery, vintage);
  }
  const { getCommunityRatings } = await import("@/server/actions/community");
  return getCommunityRatings(name, winery, vintage);
}
